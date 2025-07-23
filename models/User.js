import { executeQuery, executeQueryFirst, executeUpdate } from '../lib/database.js';
import { hashPassword, verifyPassword, generateToken, hashToken } from '../lib/auth.js';

export class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.salt = data.salt;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.status = data.status;
  }

  // 创建新用户
  static async create({ username, email, password }) {
    try {
      console.log('User.create 开始:', { username, email });
      const { hash, salt } = await hashPassword(password);
      console.log('密码哈希完成');
      
      const result = await executeUpdate(
        `INSERT INTO users (username, email, password_hash, salt) 
         VALUES (?, ?, ?, ?)`,
        [username, email, hash, salt]
      );
      console.log('数据库插入结果:', result);

      if (result.success) {
        console.log('查找新创建的用户，ID:', result.meta.last_row_id);
        const newUser = await User.findById(result.meta.last_row_id);
        console.log('找到新用户:', newUser ? '成功' : '失败');
        return newUser;
      }
      throw new Error('Failed to create user');
    } catch (error) {
      console.error('User.create 错误:', error);
      throw error;
    }
  }

  // 通过ID查找用户
  static async findById(id) {
    const userData = await executeQueryFirst(
      'SELECT * FROM users WHERE id = ? AND status = "active"',
      [id]
    );
    
    return userData ? new User(userData) : null;
  }

  // 通过邮箱查找用户
  static async findByEmail(email) {
    const userData = await executeQueryFirst(
      'SELECT * FROM users WHERE email = ? AND status = "active"',
      [email]
    );
    
    return userData ? new User(userData) : null;
  }

  // 通过用户名查找用户
  static async findByUsername(username) {
    const userData = await executeQueryFirst(
      'SELECT * FROM users WHERE username = ? AND status = "active"',
      [username]
    );
    
    return userData ? new User(userData) : null;
  }

  // 验证用户登录
  static async authenticate(emailOrUsername, password) {
    let user;
    
    // 判断是邮箱还是用户名
    if (emailOrUsername.includes('@')) {
      user = await User.findByEmail(emailOrUsername);
    } else {
      user = await User.findByUsername(emailOrUsername);
    }

    if (!user) {
      return null;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    return isValid ? user : null;
  }

  // 生成用户token
  generateAuthToken() {
    return generateToken({
      userId: this.id,
      username: this.username,
      email: this.email
    });
  }

  // 保存用户会话
  async saveSession(token) {
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

    await executeUpdate(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at) 
       VALUES (?, ?, ?)`,
      [this.id, tokenHash, expiresAt.toISOString()]
    );
  }

  // 验证会话token
  static async validateSession(token) {
    const tokenHash = hashToken(token);
    
    const session = await executeQueryFirst(
      `SELECT us.*, u.* FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.token_hash = ? AND us.expires_at > ? AND u.status = "active"`,
      [tokenHash, new Date().toISOString()]
    );

    return session ? new User(session) : null;
  }

  // 登出（删除会话）
  static async logout(token) {
    const tokenHash = hashToken(token);
    
    await executeUpdate(
      'DELETE FROM user_sessions WHERE token_hash = ?',
      [tokenHash]
    );
  }

  // 获取用户当前订阅信息
  async getCurrentSubscription() {
    const subscription = await executeQueryFirst(
      `SELECT us.*, sp.name as plan_name, sp.description as plan_description
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = ? AND us.status = "active" AND us.end_date > ?
       ORDER BY us.end_date DESC
       LIMIT 1`,
      [this.id, new Date().toISOString()]
    );

    return subscription;
  }

  // 检查订阅是否有效
  async hasValidSubscription() {
    const subscription = await this.getCurrentSubscription();
    return subscription && subscription.status === 'active' && new Date(subscription.end_date) > new Date();
  }

  // 验证用户密码
  async verifyPassword(password) {
    return await verifyPassword(password, this.passwordHash);
  }

  // 更新用户信息
  async update(data) {
    const updates = [];
    const params = [];

    if (data.username) {
      updates.push('username = ?');
      params.push(data.username);
    }
    if (data.email) {
      updates.push('email = ?');
      params.push(data.email);
    }
    if (data.password) {
      const { hash, salt } = await hashPassword(data.password);
      updates.push('password_hash = ?', 'salt = ?');
      params.push(hash, salt);
    }

    if (updates.length > 0) {
      params.push(this.id);
      await executeUpdate(
        `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params
      );
    }
  }

  // 返回安全的用户信息（不包含敏感数据）
  toSafeObject() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      createdAt: this.createdAt,
      status: this.status
    };
  }
}

export default User;