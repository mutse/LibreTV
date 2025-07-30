class UserInterface {
  constructor() {
    // 确保 authManager 正确初始化
    this.authManager = window.authManager;
    if (!this.authManager) {
      console.error('authManager 未找到，等待初始化...');
      // 延迟初始化，等待 authManager 加载
      setTimeout(() => {
        this.authManager = window.authManager;
        if (this.authManager) {
          console.log('authManager 已找到，重新初始化...');
          this.init();
        } else {
          console.error('authManager 仍然未找到！');
        }
      }, 100);
      return;
    }
    
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
      
      // 获取支付配置状态
      const paymentConfig = await this.authManager.getPaymentConfigStatus();
      console.log('支付配置:', paymentConfig);
      
      // 检查是否有可用的支付方式
      const hasPaymentMethods = paymentConfig.supportedMethods && paymentConfig.supportedMethods.length > 0;
      console.log('可用支付方式:', paymentConfig.supportedMethods);
      
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

      // 简化试用卡显示逻辑 - 对于没有订阅的用户直接显示
      // 让后端来判断具体的资格
      let showTrialCard = !hasValid;

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
              <div class="mb-6 p-4 ${currentSubscriptionInfo.paymentStatus === 'trial' ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'} border rounded-lg">
                <h3 class="font-medium ${currentSubscriptionInfo.paymentStatus === 'trial' ? 'text-purple-800' : 'text-green-800'}">
                  ${currentSubscriptionInfo.paymentStatus === 'trial' ? '🎁 试用订阅' : '当前订阅'}
                </h3>
                <p class="${currentSubscriptionInfo.paymentStatus === 'trial' ? 'text-purple-700' : 'text-green-700'}">
                  计划: ${currentSubscriptionInfo.planName}
                </p>
                <p class="${currentSubscriptionInfo.paymentStatus === 'trial' ? 'text-purple-700' : 'text-green-700'}">
                  到期时间: ${new Date(currentSubscriptionInfo.endDate).toLocaleDateString()}
                </p>
                ${currentSubscriptionInfo.paymentStatus === 'trial' ? `
                  <div class="mt-2 p-2 bg-purple-100 rounded text-sm">
                    <p class="text-purple-800 font-medium">
                      📅 体验剩余: ${Math.max(0, Math.ceil((new Date(currentSubscriptionInfo.endDate) - new Date()) / (1000 * 60 * 60 * 24)))} 天
                    </p>
                    <p class="text-purple-600 text-xs mt-1">试用结束前请选择订阅计划以继续享受服务</p>
                    <button onclick="userInterface.showSubscriptionModal()" 
                            class="mt-2 w-full px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors">
                      立即订阅
                    </button>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            ${!hasPaymentMethods ? `
              <div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div class="flex items-center mb-2">
                  <svg class="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                  </svg>
                  <h3 class="font-medium text-yellow-800">支付服务暂不可用</h3>
                </div>
                <p class="text-yellow-700 text-sm">
                  ${paymentConfig.message || '支付服务正在维护中，请稍后再试'}
                </p>
                ${paymentConfig.alipay && paymentConfig.alipay.error ? `
                  <p class="text-yellow-600 text-xs mt-1">支付宝: ${paymentConfig.alipay.error}</p>
                ` : ''}
                ${paymentConfig.paypal && paymentConfig.paypal.error ? `
                  <p class="text-yellow-600 text-xs mt-1">PayPal: ${paymentConfig.paypal.error}</p>
                ` : ''}
              </div>
            ` : ''}

            ${showTrialCard ? `
              <div class="mb-6 p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl shadow-lg">
                <div class="text-center mb-4">
                  <div class="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span class="text-white text-xl">🎁</span>
                  </div>
                  <h3 class="text-xl font-bold text-purple-800 mb-2">免费体验3天</h3>
                  <span class="inline-block px-3 py-1 bg-purple-600 text-white text-xs rounded-full">新用户专享</span>
                </div>
                <div class="bg-white rounded-lg p-4 mb-4">
                  <p class="text-purple-700 text-sm mb-3 text-center">立即享受全部会员功能，无需付费</p>
                  <div class="grid grid-cols-2 gap-2 text-xs text-purple-600">
                    <div class="flex items-center"><span class="text-green-500 mr-1">✓</span> 无限制观看</div>
                    <div class="flex items-center"><span class="text-green-500 mr-1">✓</span> 高清画质</div>
                    <div class="flex items-center"><span class="text-green-500 mr-1">✓</span> 无广告体验</div>
                    <div class="flex items-center"><span class="text-green-500 mr-1">✓</span> 随时可取消</div>
                  </div>
                </div>
                <button onclick="userInterface.handleTrialActivation()" 
                        class="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-bold text-lg shadow-md transition-all transform hover:scale-105">
                  🎉 立即免费体验3天
                </button>
                <p class="text-center text-xs text-purple-600 mt-2">每个用户仅限一次，到期前可随时取消</p>
              </div>
              
              <div class="text-center mb-4">
                <span class="px-4 py-2 bg-gray-100 rounded-full text-gray-500 text-sm">或选择订阅计划</span>
              </div>
            ` : ''}
            
            <div class="grid md:grid-cols-2 gap-4 mb-6">
              ${filteredPlans.map(plan => `
                <div class="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors">
                  <h3 class="text-lg font-semibold mb-2">${plan.name}</h3>
                  <p class="text-gray-600 mb-3">${plan.description}</p>
                  <div class="text-2xl font-bold text-blue-600 mb-4">¥${plan.price}</div>
                  
                  ${hasValid ? '' : `
                    <div class="space-y-2">
                      ${hasPaymentMethods ? `
                        ${paymentConfig.supportedMethods.includes('alipay') ? `
                          <button onclick="userInterface.handleAlipayPayment(${plan.id})" 
                                  class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                            <span>支付宝支付</span>
                          </button>
                        ` : ''}
                        ${paymentConfig.supportedMethods.includes('paypal') || true ? `
                          <button onclick="console.log('PayPal按钮点击'); userInterface.handlePaypalPayment(${plan.id})" 
                                  class="w-full px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 flex items-center justify-center space-x-2">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a9.159 9.159 0 0 1-.444 1.823c-1.048 4.455-4.538 6.083-8.696 6.083H9.83c-.524 0-.968.382-1.05.9L7.598 21.9c-.054.26.159.5.427.5h4.19c.524 0 .968-.382 1.05-.9l.444-2.817c.082-.518.526-.9 1.05-.9h1.49c3.965 0 7.07-1.61 7.98-6.267.378-1.935.17-3.55-.607-4.599z"/>
                            </svg>
                            <span>PayPal支付（测试）</span>
                          </button>
                        ` : ''}
                        <button onclick="userInterface.showPaymentSelectionModal(${plan.id})" 
                                class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                          订阅支付
                        </button>
                      ` : `
                        <div class="text-center p-4 bg-gray-50 rounded-md">
                          <p class="text-gray-500 text-sm">支付服务暂不可用</p>
                          <p class="text-gray-400 text-xs mt-1">请联系管理员配置支付服务</p>
                        </div>
                      `}
                    </div>
                  `}
                  
                  ${hasValid ? `
                    <div class="space-y-2">
                      ${hasPaymentMethods ? `
                        ${paymentConfig.supportedMethods.includes('alipay') ? `
                          <button onclick="userInterface.handleAlipayPayment(${plan.id}, true)" 
                                  class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                            <span>支付宝续费</span>
                          </button>
                        ` : ''}
                        ${paymentConfig.supportedMethods.includes('paypal') || true ? `
                          <button onclick="console.log('PayPal续费按钮点击'); userInterface.handlePaypalPayment(${plan.id}, true)" 
                                  class="w-full px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 flex items-center justify-center space-x-2">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a9.159 9.159 0 0 1-.444 1.823c-1.048 4.455-4.538 6.083-8.696 6.083H9.83c-.524 0-.968.382-1.05.9L7.598 21.9c-.054.26.159.5.427.5h4.19c.524 0 .968-.382 1.05-.9l.444-2.817c.082-.518.526-.9 1.05-.9h1.49c3.965 0 7.07-1.61 7.98-6.267.378-1.935.17-3.55-.607-4.599z"/>
                            </svg>
                            <span>PayPal续费（测试）</span>
                          </button>
                        ` : ''}
                      ` : `
                        <div class="text-center p-2 bg-gray-50 rounded-md">
                          <p class="text-gray-500 text-xs">支付服务暂不可用</p>
                        </div>
                      `}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
            
            ${hasValid ? `
              <div class="border-t pt-4 flex justify-between items-center">
                <button onclick="userInterface.handleCancelSubscription()" 
                        class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                  取消订阅
                </button>
                ${currentSubscriptionInfo && currentSubscriptionInfo.paymentStatus === 'trial' ? `
                  <button onclick="userInterface.showSubscriptionModal()" 
                          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    立即订阅
                  </button>
                ` : ''}
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

  // 显示新用户体验卡选择模态框
  showNewUserTrialModal() {
    const modalHtml = `
      <div class="bg-black bg-opacity-50 flex items-center justify-center min-h-screen">
        <div class="bg-white rounded-lg p-8 w-full max-w-lg mx-4">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-white text-2xl">🎉</span>
            </div>
            <h2 class="text-2xl font-bold text-gray-800 mb-2">欢迎加入 LibreTV！</h2>
            <p class="text-gray-600">感谢您的注册，请选择您的体验方式</p>
          </div>
          
          <div class="space-y-4 mb-6">
            <!-- 3天免费体验卡 -->
            <div class="border-2 border-purple-200 rounded-xl p-6 bg-gradient-to-r from-purple-50 to-pink-50 hover:border-purple-400 transition-colors cursor-pointer" onclick="userInterface.activateNewUserTrial()">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center mb-2">
                    <span class="text-2xl mr-2">🎁</span>
                    <h3 class="text-lg font-bold text-purple-800">免费体验3天</h3>
                    <span class="ml-2 px-2 py-1 bg-purple-600 text-white text-xs rounded-full">推荐</span>
                  </div>
                  <p class="text-purple-700 text-sm mb-3">立即享受全部会员功能，无需付费</p>
                  <ul class="text-purple-600 text-sm space-y-1">
                    <li>✓ 无限制观看所有视频</li>
                    <li>✓ 高清画质体验</li>
                    <li>✓ 无广告打扰</li>
                    <li>✓ 3天后可选择续费或停用</li>
                  </ul>
                </div>
              </div>
              <button class="w-full mt-4 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-medium transition-all">
                立即激活免费体验
              </button>
            </div>
            
            <!-- 直接订阅选项 -->
            <div class="border border-gray-200 rounded-xl p-6 hover:border-blue-400 transition-colors cursor-pointer" onclick="userInterface.showSubscriptionModalFromTrial()">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center mb-2">
                    <span class="text-2xl mr-2">💳</span>
                    <h3 class="text-lg font-bold text-gray-800">直接订阅</h3>
                  </div>
                  <p class="text-gray-600 text-sm mb-3">跳过体验，直接选择订阅计划</p>
                  <ul class="text-gray-600 text-sm space-y-1">
                    <li>✓ 月度订阅 ¥9.9/月</li>
                    <li>✓ 年度订阅 ¥99.9/年（更优惠）</li>
                    <li>✓ 支付宝安全支付</li>
                  </ul>
                </div>
              </div>
              <button class="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
                查看订阅计划
              </button>
            </div>
            
            <!-- 稍后决定选项 -->
            <div class="text-center">
              <button onclick="userInterface.skipTrialSelection()" 
                      class="text-gray-500 hover:text-gray-700 text-sm underline">
                稍后再决定，先浏览看看
              </button>
            </div>
          </div>
          
          <div id="trial-selection-error" class="mt-4 text-red-600 text-sm hidden"></div>
        </div>
      </div>
    `;
    this.showModal(modalHtml);
  }

  // 激活新用户试用
  async activateNewUserTrial() {
    try {
      console.log('开始激活新用户试用...');
      
      // 检查 authManager 是否存在
      if (!this.authManager) {
        console.error('authManager 不存在');
        this.showErrorInModal('trial-selection-error', '认证管理器未初始化，请刷新页面重试');
        return;
      }
      
      // 检查 getToken 方法是否存在
      if (typeof this.authManager.getToken !== 'function') {
        console.error('authManager.getToken 不是一个函数', this.authManager);
        this.showErrorInModal('trial-selection-error', '认证方法不可用，请刷新页面重试');
        return;
      }
      
      // 检查token是否存在
      const token = this.authManager.getToken();
      console.log('当前用户token:', token ? 'exists' : 'not found');
      
      if (!token) {
        this.showErrorInModal('trial-selection-error', '用户未登录，请重新登录后重试');
        return;
      }

      const response = await fetch('/api/subscription/trial', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('试用激活响应状态:', response.status);
      
      const result = await response.json();
      console.log('试用激活响应数据:', result);

      if (result.success) {
        // 重新加载用户数据
        console.log('试用激活成功，重新加载用户数据...');
        if (this.authManager.loadUserData && typeof this.authManager.loadUserData === 'function') {
          await this.authManager.loadUserData();
        }
        
        this.closeModal();
        this.showSuccess('🎉 3天免费体验已激活！现在就开始享受会员服务吧');
        
        // 显示内容页面
        setTimeout(() => {
          this.showContentArea();
        }, 1500);
      } else {
        console.error('试用激活失败:', result);
        this.showErrorInModal('trial-selection-error', result.message || '体验卡激活失败');
      }
    } catch (error) {
      console.error('新用户试用激活错误:', error);
      this.showErrorInModal('trial-selection-error', '体验卡激活失败: ' + error.message);
    }
  }

  // 从体验选择界面跳转到订阅界面
  showSubscriptionModalFromTrial() {
    this.closeModal();
    setTimeout(() => {
      this.showSubscriptionModal();
    }, 300);
  }

  // 显示支付选择模态框
  async showPaymentSelectionModal(planId) {
    try {
      // 获取订阅计划信息
      const response = await fetch('/api/subscription/plans');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '获取订阅计划失败');
      }
      
      const plan = result.data.plans.find(p => p.id === planId);
      if (!plan) {
        throw new Error('订阅计划不存在');
      }

      const modalHtml = `
        <div class="bg-black bg-opacity-50 flex items-center justify-center min-h-screen">
          <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold">选择支付方式</h2>
              <button onclick="userInterface.closeModal()" class="text-gray-500 hover:text-gray-700">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <div class="mb-6">
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 class="font-medium text-blue-800">${plan.name}</h3>
                <p class="text-blue-600 text-sm">${plan.description}</p>
                <div class="flex justify-between items-center mt-2">
                  <span class="text-blue-700 font-semibold">价格: ¥${plan.price}</span>
                  <span class="text-xs text-blue-600">新订阅</span>
                </div>
              </div>
            </div>
            
            <div class="space-y-3">
              <button onclick="userInterface.handleAlipayPayment(${planId})" 
                      class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>支付宝支付</span>
              </button>
              
              <button onclick="userInterface.handlePaypalPayment(${planId})" 
                      class="w-full px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 flex items-center justify-center space-x-2">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a9.159 9.159 0 0 1-.444 1.823c-1.048 4.455-4.538 6.083-8.696 6.083H9.83c-.524 0-.968.382-1.05.9L7.598 21.9c-.054.26.159.5.427.5h4.19c.524 0 .968-.382 1.05-.9l.444-2.817c.082-.518.526-.9 1.05-.9h1.49c3.965 0 7.07-1.61 7.98-6.267.378-1.935.17-3.55-.607-4.599z"/>
                </svg>
                <span>PayPal支付</span>
              </button>
              
              <button onclick="userInterface.closeModal()" 
                      class="w-full px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-200 rounded-md hover:bg-gray-50">
                取消
              </button>
            </div>
            
            <div id="payment-selection-error" class="mt-4 text-red-600 text-sm hidden"></div>
          </div>
        </div>
      `;
      
      this.showModal(modalHtml);
    } catch (error) {
      console.error('显示支付选择模态框错误:', error);
      this.showError('获取订阅信息失败: ' + error.message);
    }
  }

  // 跳过体验选择
  skipTrialSelection() {
    this.closeModal();
    this.showSuccess('您可以随时在右上角菜单中选择订阅方案');
    // 不显示内容，保持当前登录但未订阅状态
  }

  // 处理试用卡激活
  async handleTrialActivation() {
    try {
      const response = await fetch('/api/subscription/trial', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authManager.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        // 重新加载用户数据
        await this.authManager.loadUserData();
        
        this.closeModal();
        this.showSuccess(result.message || '3天试用卡激活成功！');
        
        // 显示内容页面
        setTimeout(() => {
          this.showContentArea();
        }, 1000);
      } else {
        this.showErrorInModal('subscription-error', result.message || '试用卡激活失败');
      }
    } catch (error) {
      console.error('试用卡激活错误:', error);
      this.showErrorInModal('subscription-error', '试用卡激活失败: ' + error.message);
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
      this.showSuccess(result.message || '注册成功！');
      
      // 检查是否为新用户，显示体验卡选择界面
      if (result.data && result.data.isNewUser) {
        setTimeout(() => {
          console.log('显示新用户体验卡选择界面...');
          this.showNewUserTrialModal();
        }, 1000);
      } else {
        // 不是新用户，显示普通订阅界面
        setTimeout(() => {
          this.showSubscriptionModal();
        }, 1000);
      }
    } catch (error) {
      console.error('注册处理错误:', error);
      this.showErrorInModal('register-error', error.message || '注册失败，请重试');
    }
  }

  // 处理订阅
  async handleSubscribe(planId) {
    try {
      console.log('开始处理订阅，planId:', planId);
      
      // 检查用户是否已登录
      if (!this.authManager.isLoggedIn()) {
        this.showErrorInModal('subscription-error', '请先登录');
        return;
      }
      
      const hasValid = this.authManager.hasValidSubscription();
      console.log('用户是否有有效订阅:', hasValid);
      
      if (hasValid) {
        console.log('用户已有订阅，执行续费');
        await this.authManager.renewSubscription(planId);
        this.showSuccess('续费成功！');
      } else {
        console.log('用户无订阅，执行新订阅，跳过支付');
        // 跳过支付直接订阅（用于测试）
        await this.authManager.subscribe(planId, true);
        this.showSuccess('订阅成功！');
      }
      this.closeModal();
      
      // 订阅成功后，显示内容页面
      setTimeout(() => {
        this.showContentArea();
      }, 1000);
    } catch (error) {
      console.error('订阅失败:', error);
      this.showErrorInModal('subscription-error', error.message);
    }
  }

  // 处理支付宝支付
  async handleAlipayPayment(planId, isRenewal = false) {
    try {
      // 显示支付处理中状态
      const paymentBtn = event.target;
      const originalText = paymentBtn.innerHTML;
      paymentBtn.innerHTML = '<span class="animate-spin">⏳</span> 创建支付订单...';
      paymentBtn.disabled = true;

      // 检测设备类型，选择支付方式
      const paymentType = this.authManager.isMobileDevice() ? 'mobile' : 'web';
      
      // 创建支付订单
      const paymentData = await this.authManager.createAlipayPayment(planId, paymentType);
      
      // 恢复按钮状态
      paymentBtn.innerHTML = originalText;
      paymentBtn.disabled = false;

      // 显示支付确认弹窗
      this.showPaymentModal(paymentData, isRenewal);

    } catch (error) {
      // 恢复按钮状态
      if (event && event.target) {
        event.target.innerHTML = event.target.getAttribute('data-original-text') || '支付宝支付';
        event.target.disabled = false;
      }
      this.showErrorInModal('subscription-error', error.message);
    }
  }

  // 处理PayPal支付
  async handlePaypalPayment(planId, isRenewal = false) {
    console.log('PayPal支付按钮被点击，参数:', { planId, isRenewal });
    
    try {
      // 检查用户是否已登录
      if (!this.authManager.isLoggedIn()) {
        console.error('用户未登录');
        this.showErrorInModal('subscription-error', '请先登录后再进行支付');
        return;
      }
      
      // 显示支付处理中状态
      const paymentBtn = event.target;
      const originalText = paymentBtn.innerHTML;
      console.log('原始按钮文本:', originalText);
      
      paymentBtn.innerHTML = '<span class="animate-spin">⏳</span> 创建PayPal支付订单...';
      paymentBtn.disabled = true;
      
      console.log('开始创建PayPal支付订单...');
      
      // 创建PayPal支付订单
      const paymentData = await this.authManager.createPaypalPayment(planId, 'USD');
      console.log('PayPal支付订单创建成功:', paymentData);
      
      // 恢复按钮状态
      paymentBtn.innerHTML = originalText;
      paymentBtn.disabled = false;
      
      // 显示PayPal支付确认弹窗
      this.showPaypalPaymentModal(paymentData, isRenewal);
      
    } catch (error) {
      console.error('PayPal支付处理失败:', error);
      
      // 恢复按钮状态
      if (event && event.target) {
        event.target.innerHTML = event.target.getAttribute('data-original-text') || 'PayPal支付';
        event.target.disabled = false;
      }
      
      // 显示错误信息
      this.showErrorInModal('subscription-error', 'PayPal支付失败: ' + error.message);
    }
  }

  // 显示支付模态框
  showPaymentModal(paymentData, isRenewal) {
    const { paymentUrl, outTradeNo, planInfo } = paymentData;
    
    const modalHtml = `
      <div class="bg-black bg-opacity-50 flex items-center justify-center min-h-screen">
        <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold">确认支付</h2>
            <button onclick="userInterface.closePaymentModal()" class="text-gray-500 hover:text-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="mb-6">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 class="font-medium text-blue-800">${planInfo.name}</h3>
              <p class="text-blue-600 text-sm">${planInfo.description}</p>
              <p class="text-blue-800 font-bold text-lg mt-2">¥${planInfo.price}</p>
            </div>
            
            <div class="text-sm text-gray-600 mb-4">
              <p>订单号: ${outTradeNo}</p>
              <p>支付方式: 支付宝</p>
            </div>
          </div>
          
          <div class="space-y-3">
            <button onclick="userInterface.openAlipayPayment('${paymentUrl}', '${outTradeNo}')" 
                    class="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span>前往支付宝支付</span>
            </button>
            
            <button onclick="userInterface.checkPaymentStatus('${outTradeNo}')" 
                    class="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
              检查支付状态
            </button>
            
            <button onclick="userInterface.cancelPayment('${outTradeNo}')" 
                    class="w-full px-4 py-2 text-red-600 hover:text-red-800 border border-red-200 rounded-md hover:bg-red-50">
              取消支付
            </button>
          </div>
          
          <div id="payment-status" class="mt-4 text-sm hidden"></div>
          <div id="payment-error" class="mt-4 text-red-600 text-sm hidden"></div>
        </div>
      </div>
    `;
    
    this.showModal(modalHtml);
  }

  // 打开支付宝支付页面
  openAlipayPayment(paymentUrl, outTradeNo) {
    // 在新窗口打开支付页面
    const paymentWindow = window.open(paymentUrl, 'alipay_payment', 'width=800,height=600');
    
    // 存储当前支付订单号，用于后续状态检查
    this.currentPaymentOrder = outTradeNo;
    
    // 定期检查支付状态
    this.startPaymentStatusCheck(outTradeNo);
    
    // 监听支付窗口关闭
    const checkClosed = setInterval(() => {
      if (paymentWindow.closed) {
        clearInterval(checkClosed);
        // 支付窗口关闭后，最后检查一次支付状态
        setTimeout(() => {
          this.checkPaymentStatus(outTradeNo);
        }, 2000);
      }
    }, 1000);
  }

  // 显示PayPal支付模态框
  showPaypalPaymentModal(paymentData, isRenewal) {
    const { paymentUrl, paymentId, outTradeNo, planInfo } = paymentData;
    
    const modalHtml = `
      <div class="bg-black bg-opacity-50 flex items-center justify-center min-h-screen">
        <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold">确认PayPal支付</h2>
            <button onclick="userInterface.closePaymentModal()" class="text-gray-500 hover:text-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="mb-6">
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h3 class="font-medium text-yellow-800">${planInfo.name}</h3>
              <p class="text-yellow-600 text-sm">${planInfo.description}</p>
              <div class="flex justify-between items-center mt-2">
                <span class="text-yellow-700 font-semibold">价格: ¥${planInfo.price} (≈ $${planInfo.priceUSD})</span>
                <span class="text-xs text-yellow-600">${isRenewal ? '续费' : '新订阅'}</span>
              </div>
            </div>
            
            <div class="text-sm text-gray-600 mb-4">
              <p>订单号: ${outTradeNo}</p>
              <p>支付方式: PayPal</p>
              <p>付款ID: ${paymentId}</p>
            </div>
          </div>
          
          <div class="space-y-3">
            <button onclick="userInterface.openPaypalPayment('${paymentUrl}', '${paymentId}')" 
                    class="w-full px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 flex items-center justify-center space-x-2">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a9.159 9.159 0 0 1-.444 1.823c-1.048 4.455-4.538 6.083-8.696 6.083H9.83c-.524 0-.968.382-1.05.9L7.598 21.9c-.054.26.159.5.427.5h4.19c.524 0 .968-.382 1.05-.9l.444-2.817c.082-.518.526-.9 1.05-.9h1.49c3.965 0 7.07-1.61 7.98-6.267.378-1.935.17-3.55-.607-4.599z"/>
              </svg>
              <span>前往PayPal支付</span>
            </button>
            
            <button onclick="userInterface.checkPaypalPaymentStatus('${paymentId}')" 
                    class="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
              检查PayPal支付状态
            </button>
            
            <button onclick="userInterface.closePaymentModal()" 
                    class="w-full px-4 py-2 text-red-600 hover:text-red-800 border border-red-200 rounded-md hover:bg-red-50">
              取消支付
            </button>
          </div>
          
          <div id="payment-status" class="mt-4 text-sm hidden"></div>
          <div id="payment-error" class="mt-4 text-red-600 text-sm hidden"></div>
        </div>
      </div>
    `;
    
    this.showModal(modalHtml);
  }

  // 打开PayPal支付页面
  openPaypalPayment(paymentUrl, paymentId) {
    // 在当前窗口打开PayPal支付页面
    window.location.href = paymentUrl;
    
    // 存储当前支付ID，用于后续状态检查
    this.currentPaypalPaymentId = paymentId;
  }

  // 检查PayPal支付状态
  async checkPaypalPaymentStatus(paymentId) {
    try {
      const statusElement = document.getElementById('payment-status');
      const errorElement = document.getElementById('payment-error');
      
      if (statusElement) {
        statusElement.className = 'mt-4 text-sm text-blue-600';
        statusElement.textContent = '正在查询PayPal支付状态...';
        statusElement.classList.remove('hidden');
      }
      
      if (errorElement) {
        errorElement.classList.add('hidden');
      }

      const status = await this.authManager.queryPaypalPaymentStatus(paymentId);
      
      if (statusElement) {
        if (status.state === 'approved' || status.state === 'completed') {
          statusElement.className = 'mt-4 text-sm text-green-600';
          statusElement.textContent = '✅ PayPal支付成功！订阅已激活';
          
          // 刷新用户数据和UI
          setTimeout(() => {
            this.authManager.loadUserData();
            this.updateUI();
            this.closeModal();
          }, 2000);
        } else if (status.state === 'created') {
          statusElement.className = 'mt-4 text-sm text-yellow-600';
          statusElement.textContent = '⏳ PayPal支付待确认，请完成支付';
        } else {
          statusElement.className = 'mt-4 text-sm text-gray-600';
          statusElement.textContent = `PayPal支付状态: ${status.state}`;
        }
      }
    } catch (error) {
      const errorElement = document.getElementById('payment-error');
      if (errorElement) {
        errorElement.textContent = error.message;
        errorElement.classList.remove('hidden');
      }
      
      const statusElement = document.getElementById('payment-status');
      if (statusElement) {
        statusElement.classList.add('hidden');
      }
    }
  }

  // 开始支付状态检查
  startPaymentStatusCheck(outTradeNo) {
    // 清除之前的定时器
    if (this.paymentStatusTimer) {
      clearInterval(this.paymentStatusTimer);
    }
    
    // 每5秒检查一次支付状态，最多检查24次（2分钟）
    let checkCount = 0;
    const maxChecks = 24;
    
    this.paymentStatusTimer = setInterval(async () => {
      checkCount++;
      
      try {
        const result = await this.authManager.queryPaymentStatus(outTradeNo);
        
        if (result.success && (result.tradeStatus === 'TRADE_SUCCESS' || result.tradeStatus === 'TRADE_FINISHED')) {
          // 支付成功
          clearInterval(this.paymentStatusTimer);
          this.handlePaymentSuccess(outTradeNo);
          return;
        }
      } catch (error) {
        console.warn('检查支付状态失败:', error);
      }
      
      // 超过最大检查次数，停止检查
      if (checkCount >= maxChecks) {
        clearInterval(this.paymentStatusTimer);
        this.updatePaymentStatus('支付状态检查超时，请手动检查', 'warning');
      }
    }, 5000);
  }

  // 检查支付状态
  async checkPaymentStatus(outTradeNo) {
    try {
      this.updatePaymentStatus('正在查询支付状态...', 'info');
      
      const result = await this.authManager.queryPaymentStatus(outTradeNo);
      
      if (result.success) {
        if (result.tradeStatus === 'TRADE_SUCCESS' || result.tradeStatus === 'TRADE_FINISHED') {
          this.handlePaymentSuccess(outTradeNo);
        } else if (result.tradeStatus === 'WAIT_BUYER_PAY') {
          this.updatePaymentStatus('等待支付中...', 'warning');
        } else {
          this.updatePaymentStatus(`支付状态: ${result.tradeStatus}`, 'info');
        }
      } else {
        this.updatePaymentStatus('支付订单未找到或已取消', 'error');
      }
    } catch (error) {
      this.updatePaymentStatus('查询支付状态失败: ' + error.message, 'error');
    }
  }

  // 处理支付成功
  async handlePaymentSuccess(outTradeNo) {
    try {
      // 清除定时器
      if (this.paymentStatusTimer) {
        clearInterval(this.paymentStatusTimer);
      }
      
      this.updatePaymentStatus('支付成功！正在激活订阅...', 'success');
      
      // 重新获取用户订阅信息
      await this.authManager.loadUserData();
      
      // 关闭支付模态框
      setTimeout(() => {
        this.closeModal();
        this.showSuccess('支付成功！订阅已激活');
        
        // 显示内容页面
        setTimeout(() => {
          this.showContentArea();
        }, 1000);
      }, 2000);
      
    } catch (error) {
      this.updatePaymentStatus('激活订阅失败: ' + error.message, 'error');
    }
  }

  // 取消支付
  async cancelPayment(outTradeNo) {
    if (confirm('确定要取消支付吗？')) {
      try {
        // 清除定时器
        if (this.paymentStatusTimer) {
          clearInterval(this.paymentStatusTimer);
        }
        
        await this.authManager.cancelPayment(outTradeNo);
        this.closeModal();
        this.showSuccess('支付已取消');
      } catch (error) {
        this.updatePaymentStatus('取消支付失败: ' + error.message, 'error');
      }
    }
  }

  // 更新支付状态显示
  updatePaymentStatus(message, type) {
    const statusEl = document.getElementById('payment-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `mt-4 text-sm ${
        type === 'success' ? 'text-green-600' : 
        type === 'error' ? 'text-red-600' : 
        type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
      }`;
      statusEl.classList.remove('hidden');
    }
  }

  // 关闭支付模态框
  closePaymentModal() {
    // 清除定时器
    if (this.paymentStatusTimer) {
      clearInterval(this.paymentStatusTimer);
    }
    this.closeModal();
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

    // 删除递归调用，防止栈溢出
    // this.updateUI();
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