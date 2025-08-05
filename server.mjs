import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { initDatabase, initTables } from './lib/database.js';
import { ensureSubscriptionPlans } from './ensure-plans.js';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscription.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import { authenticateToken, optionalAuth, requireSubscription, authErrorHandler } from './middleware/auth.js';
import { expireOldSubscriptions } from './models/Subscription.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  port: process.env.PORT || 8080,
  password: process.env.PASSWORD || '',
  adminpassword: process.env.ADMINPASSWORD || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '2'),
  cacheMaxAge: process.env.CACHE_MAX_AGE || '1d',
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  debug: process.env.DEBUG === 'true'
};

const log = (...args) => {
  if (config.debug) {
    console.log('[DEBUG]', ...args);
  }
};

const app = express();

// 启用JSON解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

function sha256Hash(input) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    hash.update(input);
    resolve(hash.digest('hex'));
  });
}

async function renderPage(filePath, password) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (password !== '') {
    const sha256 = await sha256Hash(password);
    content = content.replace('{{PASSWORD}}', sha256);
  }
  // 添加ADMINPASSWORD注入
  if (config.adminpassword !== '') {
      const adminSha256 = await sha256Hash(config.adminpassword);
      content = content.replace('{{ADMINPASSWORD}}', adminSha256);
  } 
  return content;
}

app.get(['/', '/index.html', '/player.html', '/admin.html'], async (req, res) => {
  try {
    let filePath;
    switch (req.path) {
      case '/player.html':
        filePath = path.join(__dirname, 'player.html');
        break;
      case '/admin.html':
        filePath = path.join(__dirname, 'admin.html');
        break;
      default: // '/' 和 '/index.html'
        filePath = path.join(__dirname, 'index.html');
        break;
    }
    
    const content = await renderPage(filePath, config.password);
    res.send(content);
  } catch (error) {
    console.error('页面渲染错误:', error);
    res.status(500).send('读取静态页面失败');
  }
});

app.get('/s=:keyword', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'index.html');
    const content = await renderPage(filePath, config.password);
    res.send(content);
  } catch (error) {
    console.error('搜索页面渲染错误:', error);
    res.status(500).send('读取静态页面失败');
  }
});

function isValidUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const allowedProtocols = ['http:', 'https:'];
    
    // 从环境变量获取阻止的主机名列表
    const blockedHostnames = (process.env.BLOCKED_HOSTS || 'localhost,127.0.0.1,0.0.0.0,::1').split(',');
    
    // 从环境变量获取阻止的 IP 前缀
    const blockedPrefixes = (process.env.BLOCKED_IP_PREFIXES || '192.168.,10.,172.').split(',');
    
    if (!allowedProtocols.includes(parsed.protocol)) return false;
    if (blockedHostnames.includes(parsed.hostname)) return false;
    
    for (const prefix of blockedPrefixes) {
      if (parsed.hostname.startsWith(prefix)) return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// 修复反向代理处理过的路径
app.use('/proxy', (req, res, next) => {
  const targetUrl = req.url.replace(/^\//, '').replace(/(https?:)\/([^/])/, '$1//$2');
  req.url = '/' + encodeURIComponent(targetUrl);
  next();
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// 受保护的代理路由 - 需要订阅才能访问
app.get('/proxy/:encodedUrl', optionalAuth, async (req, res, next) => {
  // 如果用户已登录，检查订阅状态
  if (req.user) {
    const hasValidSubscription = await req.user.hasValidSubscription();
    if (!hasValidSubscription) {
      return res.status(403).json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: '需要有效的订阅才能访问视频内容'
      });
    }
  }
  // 如果没有登录，使用传统的密码验证（向后兼容）
  else if (config.password && config.password !== '') {
    // 可以在这里添加传统密码验证逻辑
    // 或者直接要求登录
    return res.status(401).json({
      error: 'LOGIN_REQUIRED',
      message: '请登录后观看视频'
    });
  }
  
  next();
}, async (req, res) => {
  try {
    const encodedUrl = req.params.encodedUrl;
    const targetUrl = decodeURIComponent(encodedUrl);

    // 安全验证
    if (!isValidUrl(targetUrl)) {
      return res.status(400).send('无效的 URL');
    }

    log(`代理请求: ${targetUrl}`);

    // 添加请求超时和重试逻辑
    const maxRetries = config.maxRetries;
    let retries = 0;
    
    const makeRequest = async () => {
      try {
        return await axios({
          method: 'get',
          url: targetUrl,
          responseType: 'stream',
          timeout: config.timeout,
          headers: {
            'User-Agent': config.userAgent
          }
        });
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          log(`重试请求 (${retries}/${maxRetries}): ${targetUrl}`);
          return makeRequest();
        }
        throw error;
      }
    };

    const response = await makeRequest();

    // 转发响应头（过滤敏感头）
    const headers = { ...response.headers };
    const sensitiveHeaders = (
      process.env.FILTERED_HEADERS || 
      'content-security-policy,cookie,set-cookie,x-frame-options,access-control-allow-origin'
    ).split(',');
    
    sensitiveHeaders.forEach(header => delete headers[header]);
    res.set(headers);

    // 管道传输响应流
    response.data.pipe(res);
  } catch (error) {
    console.error('代理请求错误:', error.message);
    if (error.response) {
      res.status(error.response.status || 500);
      error.response.data.pipe(res);
    } else {
      res.status(500).send(`请求失败: ${error.message}`);
    }
  }
});

// 支付相关页面路由
app.get('/payment/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'payment-success.html'));
});

app.get('/payment/failed', (req, res) => {
  res.sendFile(path.join(__dirname, 'payment-failed.html'));
});

app.use(express.static(path.join(__dirname), {
  maxAge: config.cacheMaxAge
}));

app.use(authErrorHandler);

app.use((req, res) => {
  res.status(404).send('页面未找到');
});

// 初始化数据库和启动服务器
async function startServer() {
  try {
    console.log('正在初始化数据库...');
    await initDatabase();
    await initTables();
    console.log('数据库初始化完成');
    
    // 确保订阅计划数据存在
    console.log('确保订阅计划数据...');
    await ensureSubscriptionPlans();
    console.log('订阅计划数据确保完成');

    // 设置定期清理过期订阅的任务
    setInterval(async () => {
      try {
        const expiredCount = await expireOldSubscriptions();
        if (expiredCount > 0) {
          console.log(`已处理 ${expiredCount} 个过期订阅`);
        }
      } catch (error) {
        console.error('清理过期订阅失败:', error);
      }
    }, 60 * 60 * 1000); // 每小时执行一次

    // 启动服务器
    app.listen(config.port, () => {
      console.log(`服务器运行在 http://localhost:${config.port}`);
      if (config.password !== '') {
        console.log('用户登录密码已设置');
      }
      if (config.adminpassword !== '') {
        console.log('管理员登录密码已设置');
      }
      console.log('用户认证和订阅系统已启用');
      if (config.debug) {
        console.log('调试模式已启用');
        console.log('配置:', { ...config, password: config.password ? '******' : '', adminpassword: config.adminpassword? '******' : '' });
      }
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();
