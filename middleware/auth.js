import User from '../models/User.js';
import { extractBearerToken, verifyToken } from '../lib/auth.js';

// 身份验证中间件
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractBearerToken(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'NO_TOKEN',
        message: '缺少访问令牌'
      });
    }

    // 验证JWT令牌
    const decoded = verifyToken(token);
    
    // 验证会话是否存在且有效
    const user = await User.validateSession(token);
    
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: '无效或已过期的令牌'
      });
    }

    req.user = user;
    req.token = token;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      error: 'AUTH_FAILED',
      message: '身份验证失败'
    });
  }
}

// 可选身份验证中间件（不强制要求登录）
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractBearerToken(authHeader);

    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await User.validateSession(token);
        
        if (user) {
          req.user = user;
          req.token = token;
        }
      } catch (error) {
        // 忽略令牌验证错误，继续处理请求
        console.log('Optional auth failed:', error.message);
      }
    }

    next();
  } catch (error) {
    // 忽略任何错误，继续处理请求
    next();
  }
}

// 订阅验证中间件
export async function requireSubscription(req, res, next) {
  try {
    // 首先确保用户已认证
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    // 检查用户是否有有效订阅
    const hasValidSubscription = await req.user.hasValidSubscription();
    
    if (!hasValidSubscription) {
      return res.status(403).json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: '需要有效的订阅才能访问此内容',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    next();
  } catch (error) {
    console.error('Subscription verification error:', error);
    return res.status(500).json({
      error: 'SUBSCRIPTION_CHECK_FAILED',
      message: '订阅状态验证失败'
    });
  }
}

// 组合中间件：要求身份验证和订阅
export function requireAuthAndSubscription(req, res, next) {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    requireSubscription(req, res, next);
  });
}

// 管理员验证中间件（如果需要的话）
export async function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    // 这里可以添加管理员权限检查逻辑
    // 例如检查用户是否有admin角色
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'ADMIN_REQUIRED',
        message: '需要管理员权限'
      });
    }

    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(500).json({
      error: 'ADMIN_CHECK_FAILED',
      message: '管理员权限验证失败'
    });
  }
}

// 错误处理中间件
export function authErrorHandler(error, req, res, next) {
  console.error('Auth middleware error:', error);
  
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: '无效的令牌'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: '令牌已过期'
    });
  }

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: '服务器内部错误'
  });
}

export default {
  authenticateToken,
  optionalAuth,
  requireSubscription,
  requireAuthAndSubscription,
  requireAdmin,
  authErrorHandler
};