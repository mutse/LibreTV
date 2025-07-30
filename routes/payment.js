import express from 'express';
import alipayService from '../services/alipayService.js';
import paypalService from '../services/paypalService.js';
import { Subscription, SubscriptionPlan } from '../models/Subscription.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 支付状态枚举
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing', 
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// 创建支付订单
router.post('/alipay/create', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { planId, paymentType = 'web' } = req.body;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    if (!planId) {
      return res.status(400).json({
        error: 'MISSING_PLAN_ID',
        message: '请选择订阅计划'
      });
    }

    // 检查支付宝配置
    if (!alipayService.isConfigured()) {
      return res.status(500).json({
        error: 'PAYMENT_NOT_CONFIGURED',
        message: '支付服务未配置，请联系管理员'
      });
    }

    // 验证订阅计划
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        error: 'PLAN_NOT_FOUND',
        message: '订阅计划不存在'
      });
    }

    // 检查用户是否已有活跃订阅（如果是新订阅）
    const existingSubscription = await Subscription.findActiveByUserId(user.id);
    const isRenewal = existingSubscription && existingSubscription.isValid();

    // 生成订单号
    const outTradeNo = alipayService.generateOrderNo();
    
    // 准备订单数据
    const orderData = {
      subject: `LibreTV ${plan.name} - ${isRenewal ? '续费' : '订阅'}`,
      outTradeNo,
      totalAmount: plan.price,
      body: `${plan.description} - 用户: ${user.username}`,
    };

    // 创建支付订单
    let paymentResult;
    if (paymentType === 'mobile') {
      paymentResult = await alipayService.createMobilePayment(orderData);
    } else {
      paymentResult = await alipayService.createPayment(orderData);
    }

    // 在这里你可以将订单信息保存到数据库
    // 注意：实际应用中应该创建一个 payment_orders 表来跟踪支付订单
    
    res.json({
      success: true,
      data: {
        paymentUrl: paymentResult.paymentUrl,
        outTradeNo: paymentResult.outTradeNo,
        planInfo: {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          description: plan.description,
          durationMonths: plan.durationMonths
        },
        isRenewal
      }
    });

  } catch (error) {
    console.error('创建支付订单失败:', error);
    res.status(500).json({
      error: 'CREATE_PAYMENT_FAILED',
      message: '创建支付订单失败: ' + error.message
    });
  }
});

// 查询支付状态
router.get('/alipay/query/:outTradeNo', authenticateToken, async (req, res) => {
  try {
    const { outTradeNo } = req.params;
    
    if (!outTradeNo) {
      return res.status(400).json({
        error: 'MISSING_ORDER_NO',
        message: '缺少订单号'
      });
    }

    const result = await alipayService.queryPayment(outTradeNo);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('查询支付状态失败:', error);
    res.status(500).json({
      error: 'QUERY_PAYMENT_FAILED',
      message: '查询支付状态失败: ' + error.message
    });
  }
});

// 支付宝异步通知回调
router.post('/alipay/notify', async (req, res) => {
  try {
    console.log('收到支付宝通知:', req.body);
    
    // 验证签名
    const isValid = alipayService.verifyNotify(req.body);
    
    if (!isValid) {
      console.error('支付宝通知签名验证失败');
      return res.status(400).send('fail');
    }

    const {
      trade_status,
      out_trade_no,
      trade_no,
      total_amount,
      buyer_pay_amount,
      gmt_payment,
      app_id
    } = req.body;

    // 验证应用ID
    if (app_id !== process.env.ALIPAY_APP_ID) {
      console.error('应用ID不匹配');
      return res.status(400).send('fail');
    }

    // 处理支付成功
    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      await handlePaymentSuccess({
        outTradeNo: out_trade_no,
        tradeNo: trade_no,
        totalAmount: parseFloat(total_amount),
        buyerPayAmount: parseFloat(buyer_pay_amount),
        gmtPayment: gmt_payment
      });
    }

    res.send('success');

  } catch (error) {
    console.error('处理支付宝通知失败:', error);
    res.status(500).send('fail');
  }
});

// 支付成功页面回调
router.get('/alipay/return', async (req, res) => {
  try {
    // 验证签名
    const isValid = alipayService.verifyNotify(req.query);
    
    if (!isValid) {
      return res.redirect('/payment/failed?reason=signature_invalid');
    }

    const { out_trade_no, trade_no, trade_status } = req.query;

    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      // 支付成功，重定向到成功页面
      res.redirect(`/payment/success?order=${out_trade_no}&trade=${trade_no}`);
    } else {
      // 支付未完成，重定向到等待页面
      res.redirect(`/payment/pending?order=${out_trade_no}`);
    }

  } catch (error) {
    console.error('处理支付宝返回失败:', error);
    res.redirect('/payment/failed?reason=processing_error');
  }
});

// 取消支付订单
router.post('/alipay/cancel/:outTradeNo', authenticateToken, async (req, res) => {
  try {
    const { outTradeNo } = req.params;
    
    const result = await alipayService.closeOrder(outTradeNo);
    
    res.json({
      success: result.success,
      message: result.success ? '订单已取消' : '取消订单失败',
      data: result
    });

  } catch (error) {
    console.error('取消支付订单失败:', error);
    res.status(500).json({
      error: 'CANCEL_PAYMENT_FAILED',
      message: '取消支付订单失败: ' + error.message
    });
  }
});

// 申请退款
router.post('/alipay/refund', authenticateToken, async (req, res) => {
  try {
    const { outTradeNo, refundAmount, refundReason } = req.body;
    
    if (!outTradeNo || !refundAmount) {
      return res.status(400).json({
        error: 'MISSING_PARAMETERS',
        message: '缺少必要参数'
      });
    }

    const result = await alipayService.refund({
      outTradeNo,
      refundAmount: parseFloat(refundAmount),
      refundReason: refundReason || '用户申请退款'
    });
    
    res.json({
      success: result.success,
      message: result.success ? '退款申请成功' : '退款申请失败',
      data: result
    });

  } catch (error) {
    console.error('申请退款失败:', error);
    res.status(500).json({
      error: 'REFUND_FAILED',
      message: '申请退款失败: ' + error.message
    });
  }
});

// ==================== PayPal 支付相关路由 ====================

// 创建PayPal支付订单
router.post('/paypal/create', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { planId, currency = 'USD' } = req.body;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    if (!planId) {
      return res.status(400).json({
        error: 'MISSING_PLAN_ID',
        message: '请选择订阅计划'
      });
    }

    // 检查PayPal配置
    if (!paypalService.isConfigured()) {
      return res.status(500).json({
        error: 'PAYMENT_NOT_CONFIGURED',
        message: 'PayPal支付服务未配置，请联系管理员'
      });
    }

    // 验证订阅计划
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        error: 'PLAN_NOT_FOUND',
        message: '订阅计划不存在'
      });
    }

    // 检查用户是否已有活跃订阅（如果是新订阅）
    const existingSubscription = await Subscription.findActiveByUserId(user.id);
    const isRenewal = existingSubscription && existingSubscription.isValid();

    // 生成订单号
    const outTradeNo = paypalService.generateOrderNo();
    
    // 转换价格为美元（如果计划价格是人民币）
    const usdAmount = currency === 'USD' ? 
      paypalService.convertCNYToUSD(plan.price) : 
      plan.price;
    
    // 准备订单数据
    const orderData = {
      subject: `LibreTV ${plan.name} - ${isRenewal ? 'Renewal' : 'Subscription'}`,
      outTradeNo,
      totalAmount: usdAmount,
      body: `${plan.description} - User: ${user.username}`,
      currency
    };

    // 创建PayPal支付订单
    const paymentResult = await paypalService.createPayment(orderData);

    // 在实际应用中应该创建一个 payment_orders 表来跟踪支付订单
    
    res.json({
      success: true,
      data: {
        paymentId: paymentResult.paymentId,
        paymentUrl: paymentResult.paymentUrl,
        outTradeNo: paymentResult.outTradeNo,
        planInfo: {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          priceUSD: usdAmount,
          currency: currency,
          description: plan.description,
          durationMonths: plan.durationMonths
        },
        isRenewal
      }
    });

  } catch (error) {
    console.error('创建PayPal支付订单失败:', error);
    res.status(500).json({
      error: 'CREATE_PAYPAL_PAYMENT_FAILED',
      message: '创建PayPal支付订单失败: ' + error.message
    });
  }
});

// PayPal支付成功回调
router.get('/paypal/return', async (req, res) => {
  try {
    const { paymentId, PayerID, order_id } = req.query;

    if (!paymentId || !PayerID) {
      return res.redirect('/payment/failed?reason=missing_parameters');
    }

    // 执行PayPal支付
    const result = await paypalService.executePayment(paymentId, PayerID);

    if (result.success) {
      // 处理支付成功逻辑
      await handlePaypalPaymentSuccess({
        paymentId: paymentId,
        transactionId: result.transactionId,
        outTradeNo: result.outTradeNo,
        totalAmount: result.totalAmount,
        currency: result.currency,
        payerEmail: result.payerEmail,
        paymentTime: result.paymentTime
      });

      // 重定向到成功页面
      res.redirect(`/payment/success?order=${result.outTradeNo}&transaction=${result.transactionId}&type=paypal`);
    } else {
      res.redirect('/payment/failed?reason=execution_failed');
    }

  } catch (error) {
    console.error('处理PayPal支付回调失败:', error);
    res.redirect('/payment/failed?reason=processing_error');
  }
});

// PayPal支付取消回调
router.get('/paypal/cancel', async (req, res) => {
  try {
    const { order_id } = req.query;
    console.log(`PayPal支付被取消: ${order_id}`);
    
    res.redirect(`/payment/cancelled?order=${order_id}&type=paypal`);
  } catch (error) {
    console.error('处理PayPal支付取消失败:', error);
    res.redirect('/payment/failed?reason=cancel_error');
  }
});

// 查询PayPal支付状态
router.get('/paypal/query/:paymentId', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    if (!paymentId) {
      return res.status(400).json({
        error: 'MISSING_PAYMENT_ID',
        message: '缺少支付ID'
      });
    }

    const result = await paypalService.queryPayment(paymentId);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('查询PayPal支付状态失败:', error);
    res.status(500).json({
      error: 'QUERY_PAYPAL_PAYMENT_FAILED',
      message: '查询PayPal支付状态失败: ' + error.message
    });
  }
});

// PayPal退款
router.post('/paypal/refund', authenticateToken, async (req, res) => {
  try {
    const { saleId, refundAmount, currency = 'USD', reason } = req.body;
    
    if (!saleId || !refundAmount) {
      return res.status(400).json({
        error: 'MISSING_PARAMETERS',
        message: '缺少必要参数'
      });
    }

    const result = await paypalService.refund({
      saleId,
      refundAmount: parseFloat(refundAmount),
      currency,
      reason: reason || '用户申请退款'
    });
    
    res.json({
      success: result.success,
      message: result.success ? 'PayPal退款申请成功' : 'PayPal退款申请失败',
      data: result
    });

  } catch (error) {
    console.error('PayPal退款失败:', error);
    res.status(500).json({
      error: 'PAYPAL_REFUND_FAILED',
      message: 'PayPal退款失败: ' + error.message
    });
  }
});

// ==================== 通用支付配置 ====================

// 获取支付配置状态
router.get('/config/status', async (req, res) => {
  try {
    console.log('获取支付配置状态...');
    
    // 检查支付宝配置
    let alipayStatus;
    try {
      alipayStatus = alipayService.getConfigStatus();
      console.log('支付宝配置状态:', alipayStatus);
    } catch (alipayError) {
      console.error('支付宝配置检查失败:', alipayError);
      alipayStatus = {
        hasAppId: false,
        hasPrivateKey: false,
        hasPublicKey: false,
        isConfigured: false,
        error: alipayError.message
      };
    }
    
    // 检查PayPal配置
    let paypalStatus;
    try {
      paypalStatus = paypalService.getConfigStatus();
      console.log('PayPal配置状态:', paypalStatus);
    } catch (paypalError) {
      console.error('PayPal配置检查失败:', paypalError);
      paypalStatus = {
        hasClientId: false,
        hasClientSecret: false,
        mode: 'sandbox',
        isConfigured: false,
        error: paypalError.message
      };
    }
    
    // 构建支持的支付方法列表
    const supportedMethods = [];
    if (alipayStatus.isConfigured) {
      supportedMethods.push('alipay');
    }
    if (paypalStatus.isConfigured) {
      supportedMethods.push('paypal');
    }
    
    res.json({
      success: true,
      data: {
        alipay: alipayStatus,
        paypal: paypalStatus,
        supportedMethods,
        message: supportedMethods.length === 0 
          ? '未配置任何支付方式，请检查环境变量设置' 
          : `已配置 ${supportedMethods.length} 种支付方式`
      }
    });

  } catch (error) {
    console.error('获取支付配置状态失败:', error);
    res.status(500).json({
      error: 'GET_CONFIG_FAILED',
      message: '获取支付配置失败: ' + error.message,
      data: {
        alipay: { isConfigured: false, error: '配置检查失败' },
        paypal: { isConfigured: false, error: '配置检查失败' },
        supportedMethods: []
      }
    });
  }
});

/**
 * 处理支付成功逻辑
 */
async function handlePaymentSuccess(paymentData) {
  try {
    const { outTradeNo, tradeNo, totalAmount } = paymentData;
    
    console.log(`处理支付成功: ${outTradeNo}, 金额: ${totalAmount}`);
    
    // 这里需要根据订单号查找对应的订阅计划和用户信息
    // 在实际应用中，你应该在创建支付订单时将这些信息保存到数据库
    
    // 由于当前系统没有订单表，这里暂时无法完成自动处理
    // 建议在生产环境中创建 payment_orders 表来跟踪订单状态
    
    console.log('支付成功处理完成');
    
  } catch (error) {
    console.error('处理支付成功失败:', error);
    throw error;
  }
}

/**
 * 处理PayPal支付成功逻辑
 */
async function handlePaypalPaymentSuccess(paymentData) {
  try {
    const { paymentId, transactionId, outTradeNo, totalAmount, currency, payerEmail, paymentTime } = paymentData;
    
    console.log(`处理PayPal支付成功: ${outTradeNo}, 金额: ${totalAmount} ${currency}, 交易ID: ${transactionId}`);
    console.log(`付款人邮箱: ${payerEmail}, 支付时间: ${paymentTime}`);
    
    // 这里需要根据订单号查找对应的订阅计划和用户信息
    // 在实际应用中，你应该在创建支付订单时将这些信息保存到数据库
    
    // 由于当前系统没有订单表，这里暂时无法完成自动处理
    // 建议在生产环境中创建 payment_orders 表来跟踪订单状态
    
    console.log('PayPal支付成功处理完成');
    
  } catch (error) {
    console.error('处理PayPal支付成功失败:', error);
    throw error;
  }
}

export default router;