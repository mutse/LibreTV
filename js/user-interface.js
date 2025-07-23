// 用户界面管理
class UserInterface {
  constructor() {
    this.authManager = window.authManager;
    this.currentModal = null;
    this.init();
  }

  init() {
    this.createModalContainer();
    this.bindEvents();
    this.updateUI();

    // 监听认证状态变化
    window.addEventListener('authStateChanged', () => {
      this.updateUI();
    });
  }

  // 创建模态框容器
  createModalContainer() {
    if (!document.getElementById('modal-container')) {
      const modalContainer = document.createElement('div');
      modalContainer.id = 'modal-container';
      modalContainer.className = 'fixed inset-0 z-50 hidden';
      document.body.appendChild(modalContainer);
    }
  }

  // 绑定事件
  bindEvents() {
    // 点击模态框背景关闭
    document.addEventListener('click', (e) => {
      if (e.target.id === 'modal-container') {
        this.closeModal();
      }
    });

    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentModal) {
        this.closeModal();
      }
    });
  }

  // 更新UI
  updateUI() {
    this.updateAuthButtons();
    this.updateUserInfo();
    this.updateSubscriptionStatus();

    // 根据登录状态和订阅状态决定显示内容
    const isLoggedIn = this.authManager.isLoggedIn();
    const hasValidSubscription = this.authManager.hasValidSubscription();

    if (isLoggedIn && hasValidSubscription) {
      // 已登录且有有效订阅，显示完整内容
      this.showContentArea();
    } else {
      // 未登录或无有效订阅，隐藏内容
      this.hideContentArea();
    }
  }

  // 更新认证按钮
  updateAuthButtons() {
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const userMenu = document.getElementById('user-menu');
    const logoutBtn = document.getElementById('logout-btn');

    if (this.authManager.isLoggedIn()) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (registerBtn) registerBtn.style.display = 'none';
      if (userMenu) userMenu.style.display = 'block';
    } else {
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (registerBtn) registerBtn.style.display = 'inline-block';
      if (userMenu) userMenu.style.display = 'none';
    }

    // 绑定按钮事件
    if (loginBtn) {
      loginBtn.onclick = () => this.showLoginModal();
    }
    if (registerBtn) {
      registerBtn.onclick = () => this.showRegisterModal();
    }
    if (logoutBtn) {
      logoutBtn.onclick = () => this.logout();
    }
  }

  // 更新用户信息
  updateUserInfo() {
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');

    if (this.authManager.isLoggedIn()) {
      const user = this.authManager.getUser();
      if (userNameEl) userNameEl.textContent = user.username;
      if (userEmailEl) userNameEl.textContent = user.email;
    }
  }

  // 更新订阅状态
  updateSubscriptionStatus() {
    const subscriptionStatus = document.getElementById('subscription-status');
    const subscriptionBtn = document.getElementById('subscription-btn');

    if (!this.authManager.isLoggedIn()) {
      if (subscriptionStatus) subscriptionStatus.style.display = 'none';
      if (subscriptionBtn) subscriptionBtn.style.display = 'none';
      return;
    }

    const subscription = this.authManager.getSubscription();
    const hasValid = this.authManager.hasValidSubscription();

    if (subscriptionStatus) {
      subscriptionStatus.style.display = 'block';
      if (hasValid) {
        subscriptionStatus.innerHTML = `
          <span class="text-green-600">✓ 订阅有效</span>
          <span class="text-sm text-gray-600">到期时间: ${new Date(subscription.endDate).toLocaleDateString()}</span>
        `;
      } else {
        subscriptionStatus.innerHTML = `
          <span class="text-red-600">⚠ 订阅已过期</span>
        `;
      }
    }

    if (subscriptionBtn) {
      subscriptionBtn.style.display = 'inline-block';
      subscriptionBtn.textContent = hasValid ? '管理订阅' : '立即订阅';
      subscriptionBtn.onclick = () => this.showSubscriptionModal();
    }
  }

  // 显示登录模态框
  showLoginModal() {
    const modalHtml = `
      <div class="bg-black bg-opacity-50 flex items-center justify-center min-h-screen">
        <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold">用户登录</h2>
            <button onclick="userInterface.closeModal()" class="text-gray-500 hover:text-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <form id="login-form" onsubmit="userInterface.handleLogin(event)">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">用户名或邮箱</label>
              <input type="text" name="emailOrUsername" required 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black">
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">密码</label>
              <input type="password" name="password" required 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black">
            </div>
            <div class="flex justify-between items-center">
              <button type="button" onclick="userInterface.showRegisterModal()" 
                      class="text-blue-600 hover:text-blue-800 text-sm">注册新账户</button>
              <div>
                <button type="button" onclick="userInterface.closeModal()" 
                        class="px-4 py-2 text-gray-600 hover:text-gray-800 mr-2">取消</button>
                <button type="submit" 
                        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">登录</button>
              </div>
            </div>
          </form>
          <div id="login-error" class="mt-4 text-red-600 text-sm hidden"></div>
        </div>
      </div>
    `;
    this.showModal(modalHtml);
  }

  // 显示注册模态框
  showRegisterModal() {
    const modalHtml = `
      <div class="bg-black bg-opacity-50 flex items-center justify-center min-h-screen">
        <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold">用户注册</h2>
            <button onclick="userInterface.closeModal()" class="text-gray-500 hover:text-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <form id="register-form" onsubmit="userInterface.handleRegister(event)">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">用户名</label>
              <input type="text" name="username" required 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                     pattern="[a-zA-Z0-9_]{3,20}" title="用户名只能包含字母、数字和下划线，长度3-20位">
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
              <input type="email" name="email" required 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black">
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">密码</label>
              <input type="password" name="password" required 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                     minlength="8" title="密码至少8位，包含大小写字母和数字">
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">确认密码</label>
              <input type="password" name="confirmPassword" required 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black">
            </div>
            <div class="flex justify-between items-center">
              <button type="button" onclick="userInterface.showLoginModal()" 
                      class="text-blue-600 hover:text-blue-800 text-sm">已有账户？登录</button>
              <div>
                <button type="button" onclick="userInterface.closeModal()" 
                        class="px-4 py-2 text-gray-600 hover:text-gray-800 mr-2">取消</button>
                <button type="submit" 
                        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">注册</button>
              </div>
            </div>
          </form>
          <div id="register-error" class="mt-4 text-red-600 text-sm hidden"></div>
        </div>
      </div>
    `;
    this.showModal(modalHtml);
  }

  // 显示订阅模态框
  async showSubscriptionModal() {
    try {
      console.log('获取订阅计划和当前订阅状态...');
      const plans = await this.authManager.getSubscriptionPlans();
      console.log('订阅计划:', plans);
      
      // 检查用户是否有有效订阅
      const hasValid = this.authManager.hasValidSubscription();
      console.log('用户是否有有效订阅:', hasValid);
      
      // 获取当前订阅详情（如果有的话）
      let currentSubscriptionInfo = null;
      if (hasValid) {
        try {
          const currentSubscription = await this.authManager.getCurrentSubscription();
          currentSubscriptionInfo = currentSubscription.data.subscription;
        } catch (error) {
          console.warn('获取当前订阅详情失败:', error);
        }
      }

      // 只保留月订阅和年订阅，并去除重复内容
      const filteredPlans = [];
      const seen = new Set();
      for (const plan of plans) {
        if (plan.durationMonths === 1 || plan.durationMonths === 12) {
          const key = `${plan.name}_${plan.price}_${plan.durationMonths}`;
          if (!seen.has(key)) {
            filteredPlans.push(plan);
            seen.add(key);
          }
        }
      }

      const modalHtml = `
        <div class="bg-black bg-opacity-50 flex items-center justify-center min-h-screen">
          <div class="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-xl font-semibold">${hasValid ? '管理订阅' : '选择订阅计划'}</h2>
              <button onclick="userInterface.closeModal()" class="text-gray-500 hover:text-gray-700">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            ${hasValid && currentSubscriptionInfo ? `
              <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 class="font-medium text-green-800">当前订阅</h3>
                <p class="text-green-700">计划: ${currentSubscriptionInfo.planName}</p>
                <p class="text-green-700">到期时间: ${new Date(currentSubscriptionInfo.endDate).toLocaleDateString()}</p>
              </div>
            ` : ''}
            
            <div class="grid md:grid-cols-2 gap-4 mb-6">
              ${filteredPlans.map(plan => `
                <div class="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors">
                  <h3 class="text-lg font-semibold mb-2">${plan.name}</h3>
                  <p class="text-gray-600 mb-3">${plan.description}</p>
                  <div class="text-2xl font-bold text-blue-600 mb-4">¥${plan.price}</div>
                  <button onclick="userInterface.handleSubscribe(${plan.id})" 
                          class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    ${hasValid ? '续费此计划' : '选择此计划'}
                  </button>
                </div>
              `).join('')}
            </div>
            
            ${hasValid ? `
              <div class="border-t pt-4">
                <button onclick="userInterface.handleCancelSubscription()" 
                        class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                  取消订阅
                </button>
              </div>
            ` : ''}
            
            <div id="subscription-error" class="mt-4 text-red-600 text-sm hidden"></div>
          </div>
        </div>
      `;
      this.showModal(modalHtml);
    } catch (error) {
      console.error('显示订阅模态框错误:', error);
      this.showError('获取订阅信息失败: ' + error.message);
    }
  }

  // 处理登录
  async handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const emailOrUsername = formData.get('emailOrUsername');
    const password = formData.get('password');

    try {
      await this.authManager.login(emailOrUsername, password);
      this.closeModal();
      this.showSuccess('登录成功！');
      
      // 检查用户是否有有效订阅
      const hasValidSubscription = this.authManager.hasValidSubscription();
      
      if (!hasValidSubscription) {
        // 如果没有有效订阅，显示订阅页面
        setTimeout(() => {
          this.showSubscriptionModal();
        }, 1000);
      } else {
        // 如果有有效订阅，显示内容页面
        this.showContentArea();
      }
    } catch (error) {
      this.showErrorInModal('login-error', error.message);
    }
  }

  // 处理注册
  async handleRegister(event) {
    event.preventDefault();
    console.log('开始处理注册表单...');
    
    const formData = new FormData(event.target);
    const username = formData.get('username');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    console.log('注册表单数据:', { username, email, passwordLength: password?.length });

    // 基本验证
    if (password !== confirmPassword) {
      this.showErrorInModal('register-error', '两次输入的密码不一致');
      return;
    }

    // 简单的网络连接测试
    try {
      console.log('测试网络连接...');
      const testResponse = await fetch('/api/subscription/plans');
      console.log('网络测试响应状态:', testResponse.status);
      if (!testResponse.ok) {
        throw new Error('网络连接测试失败');
      }
    } catch (networkError) {
      console.error('网络连接失败:', networkError);
      this.showErrorInModal('register-error', '网络连接异常，请检查网络后重试');
      return;
    }

    try {
      console.log('调用authManager.register...');
      const result = await this.authManager.register(username, email, password, confirmPassword);
      console.log('注册成功，结果:', result);
      
      this.closeModal();
      this.showSuccess('注册成功！');
      
      // 注册成功后，直接显示订阅页面
      setTimeout(() => {
        console.log('显示订阅模态框...');
        this.showSubscriptionModal();
      }, 1000);
    } catch (error) {
      console.error('注册处理错误:', error);
      this.showErrorInModal('register-error', error.message || '注册失败，请重试');
    }
  }

  // 处理订阅
  async handleSubscribe(planId) {
    try {
      const hasValid = this.authManager.hasValidSubscription();
      if (hasValid) {
        await this.authManager.renewSubscription(planId);
        this.showSuccess('续费成功！');
      } else {
        await this.authManager.subscribe(planId);
        this.showSuccess('订阅成功！');
      }
      this.closeModal();
      
      // 订阅成功后，显示内容页面
      setTimeout(() => {
        this.showContentArea();
      }, 1000);
    } catch (error) {
      this.showErrorInModal('subscription-error', error.message);
    }
  }

  // 处理取消订阅
  async handleCancelSubscription() {
    if (confirm('确定要取消订阅吗？取消后将无法继续观看视频。')) {
      try {
        await this.authManager.cancelSubscription();
        this.closeModal();
        this.showSuccess('订阅已取消');
      } catch (error) {
        this.showErrorInModal('subscription-error', error.message);
      }
    }
  }

  // 登出
  async logout() {
    if (confirm('确定要登出吗？')) {
      await this.authManager.logout();
      this.showSuccess('已登出');
    }
  }

  // 显示模态框
  showModal(html) {
    const container = document.getElementById('modal-container');
    container.innerHTML = html;
    container.classList.remove('hidden');
    this.currentModal = container;
    document.body.style.overflow = 'hidden';
  }

  // 关闭模态框
  closeModal() {
    const container = document.getElementById('modal-container');
    container.classList.add('hidden');
    container.innerHTML = '';
    this.currentModal = null;
    document.body.style.overflow = '';
  }

  // 在模态框中显示错误
  showErrorInModal(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  // 显示成功消息
  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  // 显示错误消息
  showError(message) {
    this.showNotification(message, 'error');
  }

  // 显示内容区域
  showContentArea() {
    // 显示所有主要内容元素
    const elementsToShow = [
      // 历史按钮
      document.querySelector('.fixed.top-4.left-4'),
      // 设置按钮（在右上角工具栏中的齿轮图标）
      document.querySelector('.fixed.top-4.right-4 button[aria-label="打开设置"]'),
      // 设置面板
      document.getElementById('settingsPanel'),
      // 历史面板
      document.getElementById('historyPanel'),
      // LOGO和header
      document.querySelector('header'),
      // 搜索区域
      document.getElementById('searchArea'),
      // 豆瓣推荐区域
      document.getElementById('doubanArea'),
      // 搜索结果区域
      document.getElementById('resultsArea')
    ];

    elementsToShow.forEach(element => {
      if (element) {
        element.style.display = '';
      }
    });

    // 确保用户菜单正确显示
    this.updateUI();
  }

  // 隐藏内容区域（显示欢迎界面）
  hideContentArea() {
    const isLoggedIn = this.authManager.isLoggedIn();
    
    // 只保留右上角登录/注册按钮，其余全部隐藏
    // 历史按钮
    const historyBtn = document.querySelector('.fixed.top-4.left-4');
    if (historyBtn) historyBtn.style.display = 'none';
    
    // 设置按钮（右上角齿轮）
    const rightTopBar = document.querySelector('.fixed.top-4.right-4');
    if (rightTopBar) {
      // 只隐藏齿轮按钮，不影响登录/注册按钮
      const settingBtn = Array.from(rightTopBar.querySelectorAll('button')).find(btn => btn.getAttribute('aria-label') === '打开设置');
      if (settingBtn) settingBtn.style.display = 'none';
    }
    
    // 设置面板
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) settingsPanel.style.display = 'none';
    
    // 历史面板
    const historyPanel = document.getElementById('historyPanel');
    if (historyPanel) historyPanel.style.display = 'none';
    
    // LOGO和header
    const headers = document.querySelectorAll('header, .container > header');
    headers.forEach(h => h.style.display = 'none');
    
    // 搜索/推荐/结果区
    const searchArea = document.getElementById('searchArea');
    const doubanArea = document.getElementById('doubanArea');
    const resultsArea = document.getElementById('resultsArea');
    if (searchArea) searchArea.style.display = 'none';
    if (doubanArea) doubanArea.style.display = 'none';
    if (resultsArea) resultsArea.style.display = 'none';
  }

  // 显示通知
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg text-white transition-opacity duration-300 ${
      type === 'success' ? 'bg-green-600' : 
      type === 'error' ? 'bg-red-600' : 'bg-blue-600'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// 创建全局用户界面实例
window.userInterface = new UserInterface();