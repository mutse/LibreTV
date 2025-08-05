import express from 'express';
import crypto from 'crypto';
import { executeQuery, executeQueryFirst, executeUpdate } from '../lib/database.js';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';

const router = express.Router();

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '需要管理员权限' });
    }

    // Verify admin token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await executeQueryFirst(
      'SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > ?',
      [tokenHash, new Date().toISOString()]
    );

    if (!session) {
      return res.status(401).json({ error: '管理员会话已过期' });
    }

    req.adminId = session.admin_id;
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(401).json({ error: '认证失败' });
  }
};

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: '密码不能为空' });
    }

    // Check admin password from environment
    const adminPassword = process.env.ADMINPASSWORD;
    if (!adminPassword || adminPassword !== password) {
      return res.status(401).json({ error: '管理员密码错误' });
    }

    // Generate admin token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save admin session
    await executeUpdate(
      'INSERT OR REPLACE INTO admin_sessions (admin_id, token_hash, expires_at) VALUES (?, ?, ?)',
      ['admin', tokenHash, expiresAt.toISOString()]
    );

    res.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// Admin logout
router.post('/logout', authenticateAdmin, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    await executeUpdate(
      'DELETE FROM admin_sessions WHERE token_hash = ?',
      [tokenHash]
    );

    res.json({ success: true, message: '已登出' });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({ error: '登出失败' });
  }
});

// Get dashboard stats
router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await executeQueryFirst('SELECT COUNT(*) as count FROM users WHERE status = "active"');
    const newUsersToday = await executeQueryFirst(
      'SELECT COUNT(*) as count FROM users WHERE status = "active" AND DATE(created_at) = DATE("now")'
    );
    
    // Get subscription statistics
    const activeSubscriptions = await executeQueryFirst(
      'SELECT COUNT(*) as count FROM user_subscriptions WHERE status = "active" AND end_date > datetime("now")'
    );
    const expiredSubscriptions = await executeQueryFirst(
      'SELECT COUNT(*) as count FROM user_subscriptions WHERE status = "active" AND end_date <= datetime("now")'
    );
    
    // Get revenue statistics (assuming we have payment records)
    const totalRevenue = await executeQueryFirst(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = "completed"'
    );
    const revenueThisMonth = await executeQueryFirst(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = "completed" AND DATE(created_at) >= DATE("now", "start of month")'
    );

    res.json({
      users: {
        total: totalUsers?.count || 0,
        newToday: newUsersToday?.count || 0
      },
      subscriptions: {
        active: activeSubscriptions?.count || 0,
        expired: expiredSubscriptions?.count || 0
      },
      revenue: {
        total: totalRevenue?.total || 0,
        thisMonth: revenueThisMonth?.total || 0
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// Get all users with pagination
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = `
      SELECT u.*, 
             us.plan_id,
             us.status as subscription_status,
             us.start_date as subscription_start,
             us.end_date as subscription_end,
             sp.name as plan_name
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE u.status = 'active'
    `;
    
    const params = [];
    
    if (search) {
      query += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await executeQuery(query, params);
    // Handle different return formats for local vs production
    const users = result.results || result || [];
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE status = "active"';
    const countParams = [];
    
    if (search) {
      countQuery += ' AND (username LIKE ? OR email LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    const totalResult = await executeQueryFirst(countQuery, countParams);
    const total = totalResult?.total || 0;

    res.json({
      users: users || [],
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        limit,
        totalUsers: total
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// Get user details
router.get('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await executeQueryFirst(
      `SELECT u.*, 
              us.id as subscription_id, us.plan_id, us.status as subscription_status,
              us.start_date as subscription_start, us.end_date as subscription_end,
              sp.name as plan_name, sp.description as plan_description, sp.price
       FROM users u
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE u.id = ? AND u.status = 'active'`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // Get subscription history
    const historyResult = await executeQuery(
      `SELECT us.*, sp.name as plan_name, sp.price
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ?
       ORDER BY us.created_at DESC`,
      [userId]
    );
    
    // Handle different return formats for local vs production
    const subscriptionHistory = historyResult.results || historyResult || [];

    res.json({
      user,
      subscriptionHistory
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: '获取用户详情失败' });
  }
});

// Update user subscription
router.put('/users/:id/subscription', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { planId, endDate } = req.body;

    if (!planId || !endDate) {
      return res.status(400).json({ error: '计划ID和结束日期不能为空' });
    }

    // Verify plan exists
    const plan = await executeQueryFirst('SELECT * FROM subscription_plans WHERE id = ?', [planId]);
    if (!plan) {
      return res.status(400).json({ error: '订阅计划不存在' });
    }

    // Verify user exists
    const user = await executeQueryFirst('SELECT * FROM users WHERE id = ? AND status = "active"', [userId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // Deactivate existing subscriptions
    await executeUpdate(
      'UPDATE user_subscriptions SET status = "cancelled" WHERE user_id = ? AND status = "active"',
      [userId]
    );

    // Create new subscription
    await executeUpdate(
      `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
       VALUES (?, ?, 'active', datetime('now'), ?)`,
      [userId, planId, endDate]
    );

    res.json({ success: true, message: '订阅更新成功' });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: '更新订阅失败' });
  }
});

// Cancel user subscription
router.delete('/users/:id/subscription', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    await executeUpdate(
      'UPDATE user_subscriptions SET status = "cancelled" WHERE user_id = ? AND status = "active"',
      [userId]
    );

    res.json({ success: true, message: '订阅已取消' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: '取消订阅失败' });
  }
});

// Delete user
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Soft delete user by setting status to inactive
    await executeUpdate(
      'UPDATE users SET status = "inactive" WHERE id = ?',
      [userId]
    );

    // Cancel all active subscriptions
    await executeUpdate(
      'UPDATE user_subscriptions SET status = "cancelled" WHERE user_id = ? AND status = "active"',
      [userId]
    );

    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

export default router;