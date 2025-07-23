import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 密码加密
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return { hash, salt };
}

// 验证密码
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// 生成JWT令牌
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'libretv',
    audience: 'libretv-users'
  });
}

// 验证JWT令牌
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'libretv',
      audience: 'libretv-users'
    });
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// 生成安全的随机token
export function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// 验证邮箱格式
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 验证用户名格式
export function validateUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

// 验证密码强度
export function validatePassword(password) {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少8位' };
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return { valid: false, message: '密码必须包含大小写字母和数字' };
  }
  return { valid: true };
}

// 从请求头获取Bearer token
export function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// 生成token哈希值用于数据库存储
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateSecureToken,
  validateEmail,
  validateUsername,
  validatePassword,
  extractBearerToken,
  hashToken
};