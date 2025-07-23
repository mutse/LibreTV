import express from 'express';
import User from '../models/User.js';
import { validateEmail, validateUsername, validatePassword } from '../lib/auth.js';

const router = express.Router();

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // 基础验证
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: '请填写所有必填字段'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'PASSWORD_MISMATCH',
        message: '两次输入的密码不一致'
      });
    }

    // 验证输入格式
    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: '邮箱格式不正确'
      });
    }

    if (!validateUsername(username)) {
      return res.status(400).json({
        error: 'INVALID_USERNAME',
        message: '用户名只能包含字母、数字和下划线，长度3-20位'
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: passwordValidation.message
      });
    }

    // 检查用户名和邮箱是否已存在
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: '该邮箱已被注册'
      });
    }

    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(409).json({
        error: 'USERNAME_EXISTS',
        message: '该用户名已被使用'
      });
    }

    // 创建用户
    const newUser = await User.create({
      username,
      email,
      password
    });

    // 生成令牌
    const token = newUser.generateAuthToken();
    await newUser.saveSession(token);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: newUser.toSafeObject(),
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error, error?.stack);
    res.status(500).json({
      error: 'REGISTRATION_FAILED',
      message: '注册失败，请稍后重试'
    });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    // 基础验证
    if (!emailOrUsername || !password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: '请输入用户名/邮箱和密码'
      });
    }

    // 身份验证
    const user = await User.authenticate(emailOrUsername, password);
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: '用户名/邮箱或密码错误'
      });
    }

    // 生成令牌
    const token = user.generateAuthToken();
    await user.saveSession(token);

    // 获取用户订阅信息
    const subscription = await user.getCurrentSubscription();

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: user.toSafeObject(),
        token,
        subscription: subscription ? {
          planName: subscription.plan_name,
          endDate: subscription.end_date,
          status: subscription.status
        } : null
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'LOGIN_FAILED',
      message: '登录失败，请稍后重试'
    });
  }
});

// 用户登出
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await User.logout(token);
    }

    res.json({
      success: true,
      message: '登出成功'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'LOGOUT_FAILED',
      message: '登出失败'
    });
  }
});

// 获取用户信息
router.get('/profile', async (req, res) => {
  try {
    // 这个路由需要身份验证中间件
    const user = req.user; // 由身份验证中间件设置
    
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    // 获取用户订阅信息
    const subscription = await user.getCurrentSubscription();

    res.json({
      success: true,
      data: {
        user: user.toSafeObject(),
        subscription: subscription ? {
          id: subscription.id,
          planName: subscription.plan_name,
          planDescription: subscription.plan_description,
          startDate: subscription.start_date,
          endDate: subscription.end_date,
          status: subscription.status,
          paymentStatus: subscription.payment_status
        } : null
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      error: 'PROFILE_FAILED',
      message: '获取用户信息失败'
    });
  }
});

// 更新用户信息
router.put('/profile', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '请先登录'
      });
    }

    const { username, email, currentPassword, newPassword } = req.body;
    const updateData = {};

    // 验证当前密码（如果要修改任何信息）
    if ((username || email || newPassword) && !currentPassword) {
      return res.status(400).json({
        error: 'CURRENT_PASSWORD_REQUIRED',
        message: '修改信息需要验证当前密码'
      });
    }

    if (currentPassword) {
      const isValidPassword = await user.verifyPassword(currentPassword);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'INVALID_CURRENT_PASSWORD',
          message: '当前密码错误'
        });
      }
    }

    // 验证新的用户名
    if (username && username !== user.username) {
      if (!validateUsername(username)) {
        return res.status(400).json({
          error: 'INVALID_USERNAME',
          message: '用户名只能包含字母、数字和下划线，长度3-20位'
        });
      }
      
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({
          error: 'USERNAME_EXISTS',
          message: '该用户名已被使用'
        });
      }
      
      updateData.username = username;
    }

    // 验证新的邮箱
    if (email && email !== user.email) {
      if (!validateEmail(email)) {
        return res.status(400).json({
          error: 'INVALID_EMAIL',
          message: '邮箱格式不正确'
        });
      }
      
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'EMAIL_EXISTS',
          message: '该邮箱已被注册'
        });
      }
      
      updateData.email = email;
    }

    // 验证新密码
    if (newPassword) {
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: passwordValidation.message
        });
      }
      
      updateData.password = newPassword;
    }

    // 更新用户信息
    if (Object.keys(updateData).length > 0) {
      await user.update(updateData);
    }

    res.json({
      success: true,
      message: '用户信息更新成功',
      data: {
        user: user.toSafeObject()
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: '更新用户信息失败'
    });
  }
});

export default router;