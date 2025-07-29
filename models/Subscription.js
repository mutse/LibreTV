import { executeQuery, executeQueryFirst, executeUpdate } from '../lib/database.js';

export class Subscription {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.planId = data.plan_id;
    this.startDate = data.start_date;
    this.endDate = data.end_date;
    this.status = data.status;
    this.paymentStatus = data.payment_status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // 创建新订阅
  static async create({ userId, planId, durationMonths, isTrial = false }) {
    console.log('Subscription.create - 参数:', { userId, planId, durationMonths, isTrial });
    
    const startDate = new Date();
    const endDate = new Date();
    
    if (isTrial) {
      endDate.setDate(endDate.getDate() + 3); // 3天试用
      console.log('Subscription.create - 试用模式，设置3天期限');
    } else {
      endDate.setMonth(endDate.getMonth() + durationMonths);
      console.log('Subscription.create - 正常模式，设置月数:', durationMonths);
    }

    const paymentStatus = isTrial ? 'trial' : 'paid';
    
    console.log('Subscription.create - 订阅详情:', {
      userId,
      planId, 
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      paymentStatus
    });

    const result = await executeUpdate(
      `INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, status, payment_status) 
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [userId, planId, startDate.toISOString(), endDate.toISOString(), paymentStatus]
    );
    
    console.log('Subscription.create - 数据库插入结果:', result);

    if (result.success) {
      const newSubscription = await Subscription.findById(result.meta.last_row_id);
      console.log('Subscription.create - 创建的订阅:', newSubscription ? {id: newSubscription.id, endDate: newSubscription.endDate} : 'null');
      return newSubscription;
    }
    
    console.log('Subscription.create - 错误: 订阅创建失败');
    throw new Error('Failed to create subscription');
  }

  // 通过ID查找订阅
  static async findById(id) {
    const subscriptionData = await executeQueryFirst(
      'SELECT * FROM user_subscriptions WHERE id = ?',
      [id]
    );
    
    return subscriptionData ? new Subscription(subscriptionData) : null;
  }

  // 获取用户的活跃订阅
  static async findActiveByUserId(userId) {
    const subscriptionData = await executeQueryFirst(
      `SELECT * FROM user_subscriptions 
       WHERE user_id = ? AND status = 'active' AND end_date > ? 
       ORDER BY end_date DESC LIMIT 1`,
      [userId, new Date().toISOString()]
    );
    
    return subscriptionData ? new Subscription(subscriptionData) : null;
  }

  // 获取用户所有订阅历史
  static async findAllByUserId(userId, limit = 10, offset = 0) {
    const results = await executeQuery(
      `SELECT us.*, sp.name as plan_name, sp.description as plan_description, sp.duration_months, sp.price
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ? 
       ORDER BY us.created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    return results.results || [];
  }

  // 检查用户是否已使用过试用
  static async hasUserUsedTrial(userId) {
    const trialSubscription = await executeQueryFirst(
      `SELECT id FROM user_subscriptions 
       WHERE user_id = ? AND payment_status = 'trial'`,
      [userId]
    );
    
    return !!trialSubscription;
  }

  // 创建3天试用订阅
  static async createTrialSubscription(userId) {
    console.log('createTrialSubscription - 开始为用户创建试用订阅:', userId);
    
    // 首先检查用户是否已使用过试用
    const hasUsedTrial = await Subscription.hasUserUsedTrial(userId);
    console.log('createTrialSubscription - 用户是否已使用过试用:', hasUsedTrial);
    
    if (hasUsedTrial) {
      console.log('createTrialSubscription - 错误: 用户已使用过试用');
      throw new Error('User has already used trial subscription');
    }

    // 检查是否有活跃订阅
    const existingSubscription = await Subscription.findActiveByUserId(userId);
    console.log('createTrialSubscription - 现有活跃订阅:', existingSubscription ? {id: existingSubscription.id, status: existingSubscription.status} : 'null');
    
    if (existingSubscription && existingSubscription.isValid()) {
      console.log('createTrialSubscription - 错误: 用户已有活跃订阅');
      throw new Error('User already has an active subscription');
    }

    // 获取默认计划（月度订阅）用于试用
    console.log('createTrialSubscription - 查询默认订阅计划...');
    const defaultPlan = await executeQueryFirst(
      'SELECT * FROM subscription_plans WHERE duration_months = 1 ORDER BY price ASC LIMIT 1'
    );
    
    console.log('createTrialSubscription - 查询到的默认计划:', defaultPlan);

    if (!defaultPlan) {
      console.log('createTrialSubscription - 错误: 没有可用的订阅计划');
      throw new Error('No available plan for trial');
    }

    console.log('createTrialSubscription - 开始创建试用订阅...');
    const result = await Subscription.create({
      userId,
      planId: defaultPlan.id,
      durationMonths: 1,
      isTrial: true
    });
    
    console.log('createTrialSubscription - 试用订阅创建完成:', result ? {id: result.id, endDate: result.endDate} : 'null');
    return result;
  }

  // 检查订阅是否有效
  isValid() {
    const now = new Date();
    const endDate = new Date(this.endDate);
    return this.status === 'active' && endDate > now && 
           (this.paymentStatus === 'paid' || this.paymentStatus === 'trial');
  }

  // 检查订阅是否即将过期（7天内）
  isExpiringSoon() {
    const now = new Date();
    const endDate = new Date(this.endDate);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return this.isValid() && endDate <= sevenDaysFromNow;
  }

  // 续费订阅
  async renew(durationMonths) {
    const newEndDate = new Date(this.endDate);
    newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

    await executeUpdate(
      `UPDATE user_subscriptions 
       SET end_date = ?, status = 'active', payment_status = 'paid', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [newEndDate.toISOString(), this.id]
    );

    this.endDate = newEndDate.toISOString();
    this.status = 'active';
    this.paymentStatus = 'paid';
  }

  // 取消订阅
  async cancel() {
    await executeUpdate(
      `UPDATE user_subscriptions 
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [this.id]
    );

    this.status = 'cancelled';
  }

  // 标记订阅为过期
  async expire() {
    await executeUpdate(
      `UPDATE user_subscriptions 
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [this.id]
    );

    this.status = 'expired';
  }

  // 获取订阅详情（包含计划信息）
  async getDetails() {
    const details = await executeQueryFirst(
      `SELECT us.*, sp.name as plan_name, sp.description as plan_description, 
              sp.duration_months, sp.price
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.id = ?`,
      [this.id]
    );

    return details;
  }

  // 返回订阅的安全对象
  toSafeObject() {
    return {
      id: this.id,
      planId: this.planId,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      paymentStatus: this.paymentStatus,
      isValid: this.isValid(),
      isExpiringSoon: this.isExpiringSoon(),
      createdAt: this.createdAt
    };
  }
}

export class SubscriptionPlan {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.durationMonths = data.duration_months;
    this.price = data.price;
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
  }

  // 获取所有活跃的订阅计划
  static async findAllActive() {
    const results = await executeQuery(
      'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price ASC'
    );

    return (results.results || []).map(plan => new SubscriptionPlan(plan));
  }

  // 通过ID查找计划
  static async findById(id) {
    const planData = await executeQueryFirst(
      'SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1',
      [id]
    );
    
    return planData ? new SubscriptionPlan(planData) : null;
  }

  // 返回计划的安全对象
  toSafeObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      durationMonths: this.durationMonths,
      price: this.price,
      createdAt: this.createdAt
    };
  }
}

// 批量过期订阅的工具函数
export async function expireOldSubscriptions() {
  const result = await executeUpdate(
    `UPDATE user_subscriptions 
     SET status = 'expired', updated_at = CURRENT_TIMESTAMP 
     WHERE status = 'active' AND end_date <= ?`,
    [new Date().toISOString()]
  );

  return result.meta?.changes || 0;
}

export default { Subscription, SubscriptionPlan, expireOldSubscriptions };