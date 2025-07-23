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

// 创建订阅
router.post('/subscribe', authenticateToken, async (req, res) => {
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

// 检查订阅状态
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