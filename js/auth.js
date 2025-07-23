// 为认证请求创建一个不被拦截的fetch函数
const createAuthFetch = () => {
  // 创建一个XMLHttpRequest的Promise包装器
  return function authFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', url);
      
      // 设置请求头
      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
      }
      
      xhr.onload = () => {
        const response = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: {
            get: (name) => xhr.getResponseHeader(name)
          },
          json: () => Promise.resolve(JSON.parse(xhr.responseText)),
          text: () => Promise.resolve(xhr.responseText)
        };
        resolve(response);
      };
      
      xhr.onerror = () => reject(new Error('网络请求失败'));
      xhr.ontimeout = () => reject(new Error('请求超时'));
      
      xhr.timeout = 10000; // 10秒超时
      xhr.send(options.body);
    });
  };
};

// 用户认证管理类
class AuthManager {
  constructor() {
    this.baseUrl = '/api';
    this.token = localStorage.getItem('authToken');
    this.user = null;
    this.subscription = null;
    console.log('AuthManager 初始化:', { baseUrl: this.baseUrl, hasToken: !!this.token });
    
    // 使用不被拦截的fetch函数
    this.authFetch = createAuthFetch();
    
    this.init();
  }

  // 初始化
  async init() {
    if (this.token) {
      try {
        await this.loadUserProfile();
      } catch (error) {
        console.log('Auto-login failed:', error);
        this.logout();
      }
    }
  }

  // 健康检查
  async healthCheck() {
    try {
      console.log('开始健康检查...');
      const response = await fetch(`${this.baseUrl}/subscription/plans`);
      console.log('健康检查响应:', response);
      if (response.ok) {
        const data = await response.json();
        console.log('健康检查成功:', data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('健康检查失败:', error);
      return false;
    }
  }

  // 获取请求头
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };
  }

  // 用户注册
  async register(username, email, password, confirmPassword) {
    try {
      console.log('开始注册请求...', { username, email });
      
      const response = await this.authFetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ username, email, password, confirmPassword })
      });

      console.log('注册响应状态:', response.status);
      console.log('响应对象:', response);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonError) {
          console.error('解析错误响应JSON失败:', jsonError);
          throw new Error(`服务器错误 (${response.status})`);
        }
        throw new Error(errorData.message || '注册失败');
      }

      let data;
      try {
        data = await response.json();
        console.log('解析的完整响应数据:', data);
        console.log('data.data:', data.data);
        console.log('data.data 的类型:', typeof data.data);
      } catch (jsonError) {
        console.error('解析成功响应JSON失败:', jsonError);
        throw new Error('服务器响应格式错误');
      }

      // 检查响应数据结构
      if (!data) {
        throw new Error('响应数据为空');
      }

      if (!data.data) {
        console.error('data.data 不存在, 完整响应:', data);
        throw new Error('响应数据结构异常：缺少 data 字段');
      }

      if (!data.data.token) {
        console.error('data.data.token 不存在, data.data:', data.data);
        throw new Error('响应数据结构异常：缺少 token 字段');
      }

      if (!data.data.user) {
        console.error('data.data.user 不存在, data.data:', data.data);
        throw new Error('响应数据结构异常：缺少 user 字段');
      }

      console.log('所有数据验证通过，设置token和用户信息...');
      this.token = data.data.token;
      this.user = data.data.user;
      localStorage.setItem('authToken', this.token);
      
      console.log('注册成功，用户信息已设置:', this.user);
      this.onAuthStateChanged();
      return data;
    } catch (error) {
      console.error('注册错误:', error);
      console.error('错误堆栈:', error.stack);
      throw error;
    }
  }

  // 用户登录
  async login(emailOrUsername, password) {
    try {
      const response = await this.authFetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ emailOrUsername, password })
      });

      // 检查响应是否存在
      if (!response) {
        throw new Error('网络请求失败，请检查网络连接');
      }

      // 检查响应的内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('非JSON响应:', text);
        throw new Error('服务器响应格式错误');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '登录失败');
      }

      this.token = data.data.token;
      this.user = data.data.user;
      this.subscription = data.data.subscription;
      localStorage.setItem('authToken', this.token);
      
      this.onAuthStateChanged();
      return data;
    } catch (error) {
      console.error('登录错误:', error);
      throw error;
    }
  }

  // 用户登出
  async logout() {
    if (this.token) {
      try {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: this.getHeaders()
        });
      } catch (error) {
        console.log('Logout API call failed:', error);
      }
    }

    this.token = null;
    this.user = null;
    this.subscription = null;
    localStorage.removeItem('authToken');
    
    this.onAuthStateChanged();
  }

  // 加载用户资料
  async loadUserProfile() {
    const response = await fetch(`${this.baseUrl}/auth/profile`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '获取用户信息失败');
    }

    this.user = data.data.user;
    this.subscription = data.data.subscription;
    this.onAuthStateChanged();
    
    return data;
  }

  // 更新用户资料
  async updateProfile(updateData) {
    const response = await fetch(`${this.baseUrl}/auth/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updateData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '更新失败');
    }

    this.user = data.data.user;
    this.onAuthStateChanged();
    
    return data;
  }

  // 获取订阅计划
  async getSubscriptionPlans() {
    try {
      const response = await fetch(`${this.baseUrl}/subscription/plans`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      // 检查响应的内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('getSubscriptionPlans 非JSON响应:', text);
        throw new Error('服务器响应格式错误');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '获取订阅计划失败');
      }

      return data.data.plans;
    } catch (error) {
      console.error('获取订阅计划错误:', error);
      throw error;
    }
  }

  // 订阅
  async subscribe(planId) {
    const response = await fetch(`${this.baseUrl}/subscription/subscribe`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ planId })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '订阅失败');
    }

    this.subscription = data.data.subscription;
    this.onAuthStateChanged();
    
    return data;
  }

  // 获取当前订阅
  async getCurrentSubscription() {
    try {
      const response = await fetch(`${this.baseUrl}/subscription/current`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      // 检查响应的内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('getCurrentSubscription 非JSON响应:', text);
        throw new Error('服务器响应格式错误');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '获取订阅信息失败');
      }

      this.subscription = data.data.subscription;
      return data;
    } catch (error) {
      console.error('获取当前订阅错误:', error);
      throw error;
    }
  }

  // 取消订阅
  async cancelSubscription() {
    const response = await fetch(`${this.baseUrl}/subscription/cancel`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '取消订阅失败');
    }

    this.subscription = data.data.subscription;
    this.onAuthStateChanged();
    
    return data;
  }

  // 续费订阅
  async renewSubscription(planId) {
    const response = await fetch(`${this.baseUrl}/subscription/renew`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ planId })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '续费失败');
    }

    this.subscription = data.data.subscription;
    this.onAuthStateChanged();
    
    return data;
  }

  // 检查是否已登录
  isLoggedIn() {
    return !!this.token && !!this.user;
  }

  // 检查是否有有效订阅
  hasValidSubscription() {
    return this.subscription && 
           this.subscription.status === 'active' && 
           new Date(this.subscription.endDate) > new Date();
  }

  // 获取用户信息
  getUser() {
    return this.user;
  }

  // 获取订阅信息
  getSubscription() {
    return this.subscription;
  }

  // 认证状态改变回调
  onAuthStateChanged() {
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('authStateChanged', {
      detail: {
        isLoggedIn: this.isLoggedIn(),
        user: this.user,
        subscription: this.subscription,
        hasValidSubscription: this.hasValidSubscription()
      }
    }));
  }
}

// 创建全局认证管理器实例
window.authManager = new AuthManager();