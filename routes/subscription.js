import express from 'express';
import { Subscription, SubscriptionPlan } from '../models/Subscription.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 获取所有订阅计划
router.get('/plans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.findAllActive();

    res.json({
      success: true,
      data: {
        plans: plans.map(plan => plan.toSafeObject())
      }
    });

  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({
      error: 'FETCH_PLANS_FAILED',
      message: '获取订阅计划失败'
    });
  }
});

// 创建订阅 (需要支付验证)
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    const { planId, outTradeNo, skipPayment = false } = req.body;

    if (!planId) {
      return res.status(400).json({
        error: 'MISSING_PLAN_ID',
        message: '请选择订阅计划'
      });
    }

    // 验证订阅计划是否存在
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        error: 'PLAN_NOT_FOUND',
        message: '订阅计划不存在'
      });
    }

    // 检查用户是否已有活跃订阅
    const existingSubscription = await Subscription.findActiveByUserId(user.id);
    if (existingSubscription && existingSubscription.isValid()) {
      return res.status(409).json({
        error: 'ACTIVE_SUBSCRIPTION_EXISTS',
        message: '您已经有活跃的订阅了',
        data: {
          subscription: existingSubscription.toSafeObject()
        }
      });
    }

    // 如果不跳过支付验证，需要验证支付状态
    if (!skipPayment) {
      if (!outTradeNo) {
        return res.status(400).json({
          error: 'MISSING_TRADE_NO',
          message: '请先完成支付'
        });
      }

      // 这里应该验证支付状态
      // 在实际应用中，你需要查询数据库中的支付订单状态
      // 或者调用支付宝API验证支付状态
      console.log(`验证支付订单: ${outTradeNo}`);
    }

    // 创建新订阅
    const newSubscription = await Subscription.create({
      userId: user.id,
      planId: plan.id,
      durationMonths: plan.durationMonths
    });

    const subscriptionDetails = await newSubscription.getDetails();

    res.status(201).json({
      success: true,
      message: '订阅成功',
      data: {
        subscription: {
          id: subscriptionDetails.id,
          planName: subscriptionDetails.plan_name,
          planDescription: subscriptionDetails.plan_description,
          startDate: subscriptionDetails.start_date,
          endDate: subscriptionDetails.end_date,
          status: subscriptionDetails.status,
          paymentStatus: subscriptionDetails.payment_status,
          price: subscriptionDetails.price
        }
      }
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      error: 'SUBSCRIPTION_FAILED',
      message: '订阅失败，请稍后重试'
    });
  }
});

// 获取用户当前订阅信息
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    const subscription = await Subscription.findActiveByUserId(user.id);
    
    if (!subscription) {
      return res.json({
        success: true,
        data: {
          subscription: null,
          hasValidSubscription: false
        }
      });
    }

    const subscriptionDetails = await subscription.getDetails();

    res.json({
      success: true,
      data: {
        subscription: {
          id: subscriptionDetails.id,
          planName: subscriptionDetails.plan_name,
          planDescription: subscriptionDetails.plan_description,
          startDate: subscriptionDetails.start_date,
          endDate: subscriptionDetails.end_date,
          status: subscriptionDetails.status,
          paymentStatus: subscriptionDetails.payment_status,
          price: subscriptionDetails.price,
          durationMonths: subscriptionDetails.duration_months,
          isValid: subscription.isValid(),
          isExpiringSoon: subscription.isExpiringSoon()
        },
        hasValidSubscription: subscription.isValid()
      }
    });

  } catch (error) {
    console.error('Get current subscription error:', error);
    res.status(500).json({
      error: 'FETCH_SUBSCRIPTION_FAILED',
      message: '获取订阅信息失败'
    });
  }
});

// 获取用户订阅历史
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const subscriptions = await Subscription.findAllByUserId(user.id, limit, offset);

    res.json({
      success: true,
      data: {
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          planName: sub.plan_name,
          planDescription: sub.plan_description,
          startDate: sub.start_date,
          endDate: sub.end_date,
          status: sub.status,
          paymentStatus: sub.payment_status,
          price: sub.price,
          durationMonths: sub.duration_months,
          createdAt: sub.created_at
        })),
        pagination: {
          page,
          limit,
          hasMore: subscriptions.length === limit
        }
      }
    });

  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({
      error: 'FETCH_HISTORY_FAILED',
      message: '获取订阅历史失败'
    });
  }
});

// 续费订阅
router.post('/renew', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        error: 'MISSING_PLAN_ID',
        message: '请选择订阅计划'
      });
    }

    // 验证订阅计划是否存在
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        error: 'PLAN_NOT_FOUND',
        message: '订阅计划不存在'
      });
    }

    // 获取用户当前订阅
    const currentSubscription = await Subscription.findActiveByUserId(user.id);
    
    if (!currentSubscription) {
      return res.status(404).json({
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: '没有找到活跃的订阅'
      });
    }

    // 续费订阅
    await currentSubscription.renew(plan.durationMonths);

    const subscriptionDetails = await currentSubscription.getDetails();

    res.json({
      success: true,
      message: '续费成功',
      data: {
        subscription: {
          id: subscriptionDetails.id,
          planName: subscriptionDetails.plan_name,
          planDescription: subscriptionDetails.plan_description,
          startDate: subscriptionDetails.start_date,
          endDate: subscriptionDetails.end_date,
          status: subscriptionDetails.status,
          paymentStatus: subscriptionDetails.payment_status,
          price: subscriptionDetails.price
        }
      }
    });

  } catch (error) {
    console.error('Renew subscription error:', error);
    res.status(500).json({
      error: 'RENEWAL_FAILED',
      message: '续费失败，请稍后重试'
    });
  }
});

// 取消订阅
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    // 获取用户当前订阅
    const currentSubscription = await Subscription.findActiveByUserId(user.id);
    
    if (!currentSubscription) {
      return res.status(404).json({
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: '没有找到活跃的订阅'
      });
    }

    // 取消订阅
    await currentSubscription.cancel();

    res.json({
      success: true,
      message: '订阅已取消',
      data: {
        subscription: currentSubscription.toSafeObject()
      }
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      error: 'CANCELLATION_FAILED',
      message: '取消订阅失败，请稍后重试'
    });
  }
});

// 激活3天试用卡
router.post('/trial', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    console.log('试用激活请求 - 用户信息:', user ? { id: user.id, username: user.username } : 'null');
    
    if (!user) {
      console.log('试用激活失败 - 用户未认证');
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    // 检查用户是否已使用过试用
    const hasUsedTrial = await Subscription.hasUserUsedTrial(user.id);
    console.log('用户是否已使用过试用:', hasUsedTrial);
    
    if (hasUsedTrial) {
      console.log('试用激活失败 - 用户已使用过试用');
      return res.status(409).json({
        error: 'TRIAL_ALREADY_USED',
        message: '您已经使用过3天试用卡'
      });
    }

    // 检查用户是否已有活跃订阅
    const existingSubscription = await Subscription.findActiveByUserId(user.id);
    console.log('用户现有订阅:', existingSubscription ? { id: existingSubscription.id, status: existingSubscription.status } : 'null');
    
    if (existingSubscription && existingSubscription.isValid()) {
      console.log('试用激活失败 - 用户已有活跃订阅');
      return res.status(409).json({
        error: 'ACTIVE_SUBSCRIPTION_EXISTS',
        message: '您已经有活跃的订阅了',
        data: {
          subscription: existingSubscription.toSafeObject()
        }
      });
    }

    // 创建试用订阅
    console.log('开始创建试用订阅...');
    const trialSubscription = await Subscription.createTrialSubscription(user.id);
    console.log('试用订阅创建成功:', { id: trialSubscription.id, endDate: trialSubscription.endDate });
    
    const subscriptionDetails = await trialSubscription.getDetails();

    res.status(201).json({
      success: true,
      message: '3天试用卡激活成功！开始享受会员服务吧',
      data: {
        subscription: {
          id: subscriptionDetails.id,
          planName: `${subscriptionDetails.plan_name} (3天试用)`,
          planDescription: subscriptionDetails.plan_description,
          startDate: subscriptionDetails.start_date,
          endDate: subscriptionDetails.end_date,
          status: subscriptionDetails.status,
          paymentStatus: subscriptionDetails.payment_status,
          price: 0,
          isTrial: true,
          daysRemaining: Math.ceil((new Date(subscriptionDetails.end_date) - new Date()) / (1000 * 60 * 60 * 24))
        }
      }
    });

  } catch (error) {
    console.error('Trial activation error:', error);
    
    if (error.message === 'User has already used trial subscription') {
      return res.status(409).json({
        error: 'TRIAL_ALREADY_USED',
        message: '您已经使用过3天试用卡'
      });
    }
    
    if (error.message === 'User already has an active subscription') {
      return res.status(409).json({
        error: 'ACTIVE_SUBSCRIPTION_EXISTS',
        message: '您已经有活跃的订阅了'
      });
    }

    res.status(500).json({
      error: 'TRIAL_ACTIVATION_FAILED',
      message: '试用卡激活失败，请稍后重试'
    });
  }
});

// 检查试用卡资格
router.get('/trial/eligibility', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    const hasUsedTrial = await Subscription.hasUserUsedTrial(user.id);
    const existingSubscription = await Subscription.findActiveByUserId(user.id);
    const hasActiveSubscription = existingSubscription && existingSubscription.isValid();

    res.json({
      success: true,
      data: {
        eligible: !hasUsedTrial && !hasActiveSubscription,
        hasUsedTrial,
        hasActiveSubscription,
        message: hasUsedTrial ? '您已经使用过3天试用卡' : 
                hasActiveSubscription ? '您已经有活跃的订阅' : 
                '您可以激活3天试用卡'
      }
    });

  } catch (error) {
    console.error('Check trial eligibility error:', error);
    res.status(500).json({
      error: 'ELIGIBILITY_CHECK_FAILED',
      message: '检查试用资格失败'
    });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    const hasValidSubscription = await user.hasValidSubscription();

    res.json({
      success: true,
      data: {
        hasValidSubscription,
        userId: user.id
      }
    });

  } catch (error) {
    console.error('Check subscription status error:', error);
    res.status(500).json({
      error: 'STATUS_CHECK_FAILED',
      message: '检查订阅状态失败'
    });
  }
});

export default router;