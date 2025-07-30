import dotenv from 'dotenv';
import paypal from 'paypal-rest-sdk';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

class PaypalService {
  constructor() {
    // Configure PayPal SDK
    paypal.configure({
      mode: process.env.PAYPAL_MODE || 'sandbox', // sandbox or live
      client_id: process.env.PAYPAL_CLIENT_ID,
      client_secret: process.env.PAYPAL_CLIENT_SECRET
    });
    
    this.returnUrl = process.env.PAYPAL_RETURN_URL || 'http://localhost:3000/api/payment/paypal/return';
    this.cancelUrl = process.env.PAYPAL_CANCEL_URL || 'http://localhost:3000/payment/cancelled';
  }

  /**
   * 创建PayPal支付订单
   * @param {Object} orderData - 订单数据
   * @param {string} orderData.subject - 商品名称
   * @param {string} orderData.outTradeNo - 商户订单号
   * @param {number} orderData.totalAmount - 支付金额
   * @param {string} orderData.body - 商品描述
   * @param {string} orderData.currency - 货币类型，默认USD
   * @returns {Promise<Object>} 支付信息
   */
  async createPayment(orderData) {
    try {
      const { subject, outTradeNo, totalAmount, body, currency = 'USD' } = orderData;
      
      const paymentConfig = {
        intent: 'sale',
        payer: {
          payment_method: 'paypal'
        },
        redirect_urls: {
          return_url: `${this.returnUrl}?order_id=${outTradeNo}`,
          cancel_url: `${this.cancelUrl}?order_id=${outTradeNo}`
        },
        transactions: [{
          item_list: {
            items: [{
              name: subject,
              description: body,
              price: totalAmount.toFixed(2),
              currency: currency,
              quantity: 1
            }]
          },
          amount: {
            currency: currency,
            total: totalAmount.toFixed(2)
          },
          description: body,
          custom: outTradeNo // 用于存储商户订单号
        }]
      };

      return new Promise((resolve, reject) => {
        paypal.payment.create(paymentConfig, (error, payment) => {
          if (error) {
            console.error('创建PayPal支付失败:', error);
            reject(new Error('创建PayPal支付失败: ' + error.message));
          } else {
            // 获取审批URL
            const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
            
            resolve({
              success: true,
              paymentId: payment.id,
              paymentUrl: approvalUrl ? approvalUrl.href : null,
              outTradeNo,
              payment: payment
            });
          }
        });
      });
    } catch (error) {
      console.error('创建PayPal支付失败:', error);
      throw new Error('创建PayPal支付失败: ' + error.message);
    }
  }

  /**
   * 执行PayPal支付
   * @param {string} paymentId - PayPal支付ID
   * @param {string} payerId - 付款人ID
   * @returns {Promise<Object>} 执行结果
   */
  async executePayment(paymentId, payerId) {
    try {
      const executePaymentJson = {
        payer_id: payerId
      };

      return new Promise((resolve, reject) => {
        paypal.payment.execute(paymentId, executePaymentJson, (error, payment) => {
          if (error) {
            console.error('执行PayPal支付失败:', error);
            reject(new Error('执行PayPal支付失败: ' + error.message));
          } else {
            resolve({
              success: true,
              payment: payment,
              transactionId: payment.transactions[0].related_resources[0].sale.id,
              outTradeNo: payment.transactions[0].custom,
              totalAmount: parseFloat(payment.transactions[0].amount.total),
              currency: payment.transactions[0].amount.currency,
              payerEmail: payment.payer.payer_info.email,
              paymentTime: payment.transactions[0].related_resources[0].sale.create_time
            });
          }
        });
      });
    } catch (error) {
      console.error('执行PayPal支付失败:', error);
      throw new Error('执行PayPal支付失败: ' + error.message);
    }
  }

  /**
   * 查询PayPal支付状态
   * @param {string} paymentId - PayPal支付ID
   * @returns {Promise<Object>} 支付状态
   */
  async queryPayment(paymentId) {
    try {
      return new Promise((resolve, reject) => {
        paypal.payment.get(paymentId, (error, payment) => {
          if (error) {
            console.error('查询PayPal支付状态失败:', error);
            reject(new Error('查询PayPal支付状态失败: ' + error.message));
          } else {
            const transaction = payment.transactions[0];
            const sale = transaction.related_resources && transaction.related_resources[0] && transaction.related_resources[0].sale;
            
            resolve({
              success: true,
              paymentId: payment.id,
              state: payment.state,
              outTradeNo: transaction.custom,
              totalAmount: parseFloat(transaction.amount.total),
              currency: transaction.amount.currency,
              transactionId: sale ? sale.id : null,
              paymentTime: sale ? sale.create_time : null,
              payerEmail: payment.payer.payer_info ? payment.payer.payer_info.email : null
            });
          }
        });
      });
    } catch (error) {
      console.error('查询PayPal支付状态失败:', error);
      throw new Error('查询PayPal支付状态失败: ' + error.message);
    }
  }

  /**
   * PayPal退款
   * @param {Object} refundData - 退款数据
   * @param {string} refundData.saleId - 销售交易ID
   * @param {number} refundData.refundAmount - 退款金额
   * @param {string} refundData.currency - 货币类型
   * @param {string} refundData.reason - 退款原因
   * @returns {Promise<Object>} 退款结果
   */
  async refund(refundData) {
    try {
      const { saleId, refundAmount, currency = 'USD', reason } = refundData;
      
      const refundRequest = {
        amount: {
          total: refundAmount.toFixed(2),
          currency: currency
        }
      };

      if (reason) {
        refundRequest.reason = reason;
      }

      return new Promise((resolve, reject) => {
        paypal.sale.refund(saleId, refundRequest, (error, refund) => {
          if (error) {
            console.error('PayPal退款失败:', error);
            reject(new Error('PayPal退款失败: ' + error.message));
          } else {
            resolve({
              success: true,
              refundId: refund.id,
              state: refund.state,
              refundAmount: parseFloat(refund.amount.total),
              currency: refund.amount.currency,
              refundTime: refund.create_time,
              reason: refund.reason || reason
            });
          }
        });
      });
    } catch (error) {
      console.error('PayPal退款失败:', error);
      throw new Error('PayPal退款失败: ' + error.message);
    }
  }

  /**
   * 生成订单号
   * @returns {string} 订单号
   */
  generateOrderNo() {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PP${timestamp}${randomNum}`;
  }

  /**
   * 检查PayPal配置是否完整
   * @returns {boolean} 配置是否完整
   */
  isConfigured() {
    console.log('PayPal环境变量检查:');
    console.log('PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? '已设置' : '未设置');
    console.log('PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? '已设置' : '未设置');
    console.log('PAYPAL_MODE:', process.env.PAYPAL_MODE || 'sandbox');
    
    const isConfigured = !!(
      process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET
    );
    
    console.log('PayPal配置状态:', isConfigured);
    return isConfigured;
  }

  /**
   * 获取PayPal配置状态
   * @returns {Object} 配置状态
   */
  getConfigStatus() {
    return {
      hasClientId: !!process.env.PAYPAL_CLIENT_ID,
      hasClientSecret: !!process.env.PAYPAL_CLIENT_SECRET,
      mode: process.env.PAYPAL_MODE || 'sandbox',
      isConfigured: this.isConfigured(),
    };
  }

  /**
   * 将金额从人民币转换为美元（简单汇率转换，实际应用中应使用实时汇率）
   * @param {number} amount - 人民币金额
   * @param {number} exchangeRate - 汇率，默认0.14（1人民币=0.14美元）
   * @returns {number} 美元金额
   */
  convertCNYToUSD(amount, exchangeRate = 0.14) {
    return Math.round(amount * exchangeRate * 100) / 100; // 保留两位小数
  }

  /**
   * 将金额从美元转换为人民币
   * @param {number} amount - 美元金额
   * @param {number} exchangeRate - 汇率，默认7.14（1美元=7.14人民币）
   * @returns {number} 人民币金额
   */
  convertUSDToCNY(amount, exchangeRate = 7.14) {
    return Math.round(amount * exchangeRate * 100) / 100; // 保留两位小数
  }
}

export default new PaypalService();