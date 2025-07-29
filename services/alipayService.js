import dotenv from 'dotenv';
import { AlipaySdk } from 'alipay-sdk';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

dotenv.config();

class AlipayService {
  constructor() {
    console.log('id:', process.env.ALIPAY_APP_ID);
    this.alipay = new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
      gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
      timeout: 5000,
      camelCase: true,
    });
    
    this.notifyUrl = process.env.ALIPAY_NOTIFY_URL || 'http://localhost:3000/api/payment/alipay/notify';
    this.returnUrl = process.env.ALIPAY_RETURN_URL || 'http://localhost:3000/payment/success';
  }

  /**
   * 创建支付宝支付订单
   * @param {Object} orderData - 订单数据
   * @param {string} orderData.subject - 商品名称
   * @param {string} orderData.outTradeNo - 商户订单号
   * @param {number} orderData.totalAmount - 支付金额
   * @param {string} orderData.body - 商品描述
   * @returns {Promise<Object>} 支付信息
   */
  async createPayment(orderData) {
    try {
      const { subject, outTradeNo, totalAmount, body } = orderData;
      
      const bizContent = {
        subject,
        outTradeNo,
        totalAmount: totalAmount.toString(),
        body,
        productCode: 'FAST_INSTANT_TRADE_PAY',
        timeoutExpress: '30m', // 30分钟超时
      };

      // 创建网页支付
      const result = await this.alipay.pageExec('alipay.trade.page.pay', {
        notify_url: this.notifyUrl,
        return_url: this.returnUrl,
        biz_content: bizContent,
      });

      return {
        success: true,
        paymentUrl: result,
        outTradeNo,
      };
    } catch (error) {
      console.error('创建支付宝支付失败:', error);
      throw new Error('创建支付失败: ' + error.message);
    }
  }

  /**
   * 创建手机网站支付
   * @param {Object} orderData - 订单数据
   * @returns {Promise<Object>} 支付信息
   */
  async createMobilePayment(orderData) {
    try {
      const { subject, outTradeNo, totalAmount, body } = orderData;
      
      const bizContent = {
        subject,
        outTradeNo,
        totalAmount: totalAmount.toString(),
        body,
        productCode: 'QUICK_WAP_WAY',
        timeoutExpress: '30m',
      };

      // 创建手机网站支付
      const result = await this.alipay.pageExec('alipay.trade.wap.pay', {
        notify_url: this.notifyUrl,
        return_url: this.returnUrl,
        biz_content: bizContent,
      });

      return {
        success: true,
        paymentUrl: result,
        outTradeNo,
      };
    } catch (error) {
      console.error('创建支付宝手机支付失败:', error);
      throw new Error('创建手机支付失败: ' + error.message);
    }
  }

  /**
   * 查询支付状态
   * @param {string} outTradeNo - 商户订单号
   * @returns {Promise<Object>} 支付状态
   */
  async queryPayment(outTradeNo) {
    try {
      const result = await this.alipay.exec('alipay.trade.query', {
        bizContent: {
          outTradeNo,
        },
      });

      if (result.code === '10000') {
        return {
          success: true,
          tradeStatus: result.tradeStatus,
          tradeNo: result.tradeNo,
          outTradeNo: result.outTradeNo,
          totalAmount: result.totalAmount,
          buyerPayAmount: result.buyerPayAmount,
          gmtPayment: result.gmtPayment,
        };
      } else {
        return {
          success: false,
          code: result.code,
          message: result.msg,
        };
      }
    } catch (error) {
      console.error('查询支付状态失败:', error);
      throw new Error('查询支付状态失败: ' + error.message);
    }
  }

  /**
   * 验证支付宝回调签名
   * @param {Object} params - 回调参数
   * @returns {boolean} 验证结果
   */
  verifyNotify(params) {
    try {
      return this.alipay.checkNotifySign(params);
    } catch (error) {
      console.error('验证支付宝回调签名失败:', error);
      return false;
    }
  }

  /**
   * 关闭订单
   * @param {string} outTradeNo - 商户订单号
   * @returns {Promise<Object>} 关闭结果
   */
  async closeOrder(outTradeNo) {
    try {
      const result = await this.alipay.exec('alipay.trade.close', {
        bizContent: {
          outTradeNo,
        },
      });

      return {
        success: result.code === '10000',
        code: result.code,
        message: result.msg,
      };
    } catch (error) {
      console.error('关闭支付宝订单失败:', error);
      throw new Error('关闭订单失败: ' + error.message);
    }
  }

  /**
   * 申请退款
   * @param {Object} refundData - 退款数据
   * @param {string} refundData.outTradeNo - 商户订单号
   * @param {number} refundData.refundAmount - 退款金额
   * @param {string} refundData.refundReason - 退款原因
   * @returns {Promise<Object>} 退款结果
   */
  async refund(refundData) {
    try {
      const { outTradeNo, refundAmount, refundReason } = refundData;
      const outRequestNo = uuidv4(); // 退款请求号

      const result = await this.alipay.exec('alipay.trade.refund', {
        bizContent: {
          outTradeNo,
          refundAmount: refundAmount.toString(),
          refundReason,
          outRequestNo,
        },
      });

      return {
        success: result.code === '10000',
        code: result.code,
        message: result.msg,
        refundFee: result.refundFee,
        gmtRefundPay: result.gmtRefundPay,
        outRequestNo,
      };
    } catch (error) {
      console.error('支付宝退款失败:', error);
      throw new Error('退款失败: ' + error.message);
    }
  }

  /**
   * 生成订单号
   * @returns {string} 订单号
   */
  generateOrderNo() {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `LTV${timestamp}${randomNum}`;
  }

  /**
   * 检查配置是否完整
   * @returns {boolean} 配置是否完整
   */
  isConfigured() {
    return !!(
      process.env.ALIPAY_APP_ID &&
      process.env.ALIPAY_PRIVATE_KEY &&
      process.env.ALIPAY_PUBLIC_KEY
    );
  }

  /**
   * 获取配置状态
   * @returns {Object} 配置状态
   */
  getConfigStatus() {
    return {
      hasAppId: !!process.env.ALIPAY_APP_ID,
      hasPrivateKey: !!process.env.ALIPAY_PRIVATE_KEY,
      hasPublicKey: !!process.env.ALIPAY_PUBLIC_KEY,
      isConfigured: this.isConfigured(),
    };
  }
}

export default new AlipayService();