// 影片卡片墙功能
class MovieCardWall {
    constructor() {
        this.movieCards = [];
        this.init();
    }

    init() {
        this.generateSampleMovies();
        this.bindEvents();
        this.updateVisibility();
        
        // 监听登录状态变化
        window.addEventListener('authStateChanged', () => {
            this.updateVisibility();
        });
    }

    // 生成示例影片数据
    generateSampleMovies() {
        this.movieCards = [
            {
                title: "肖申克的救赎",
                year: "1994",
                type: "剧情",
                poster: "🎬",
                rating: "9.7"
            },
            {
                title: "霸王别姬",
                year: "1993", 
                type: "剧情",
                poster: "🎭",
                rating: "9.6"
            },
            {
                title: "阿甘正传",
                year: "1994",
                type: "剧情",
                poster: "🏃",
                rating: "9.5"
            },
            {
                title: "这个杀手不太冷",
                year: "1994",
                type: "剧情",
                poster: "🔫",
                rating: "9.4"
            },
            {
                title: "美丽人生",
                year: "1997",
                type: "剧情",
                poster: "🌹",
                rating: "9.5"
            },
            {
                title: "泰坦尼克号",
                year: "1997",
                type: "爱情",
                poster: "🚢",
                rating: "9.4"
            },
            {
                title: "千与千寻",
                year: "2001",
                type: "动画",
                poster: "🐉",
                rating: "9.4"
            },
            {
                title: "辛德勒的名单",
                year: "1993",
                type: "剧情",
                poster: "📋",
                rating: "9.5"
            },
            {
                title: "盗梦空间",
                year: "2010",
                type: "科幻",
                poster: "🌀",
                rating: "9.3"
            },
            {
                title: "忠犬八公的故事",
                year: "2009",
                type: "剧情",
                poster: "🐕",
                rating: "9.4"
            },
            {
                title: "海上钢琴师",
                year: "1998",
                type: "剧情",
                poster: "🎹",
                rating: "9.3"
            },
            {
                title: "楚门的世界",
                year: "1998",
                type: "科幻",
                poster: "📺",
                rating: "9.3"
            },
            {
                title: "三傻大闹宝莱坞",
                year: "2009",
                type: "喜剧",
                poster: "🎓",
                rating: "9.2"
            },
            {
                title: "机器人总动员",
                year: "2008",
                type: "动画",
                poster: "🤖",
                rating: "9.3"
            },
            {
                title: "放牛班的春天",
                year: "2004",
                type: "剧情",
                poster: "🎵",
                rating: "9.3"
            },
            {
                title: "大话西游之大圣娶亲",
                year: "1995",
                type: "喜剧",
                poster: "🐒",
                rating: "9.2"
            },
            {
                title: "熔炉",
                year: "2011",
                type: "剧情",
                poster: "⚖️",
                rating: "9.3"
            },
            {
                title: "疯狂动物城",
                year: "2016",
                type: "动画",
                poster: "🦊",
                rating: "9.2"
            }
        ];
    }

    // 绑定事件
    bindEvents() {
        // 登录按钮点击事件
        const loginBtn = document.getElementById('loginFromCards');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                if (window.userInterface) {
                    window.userInterface.showLoginModal();
                }
            });
        }
    }

    // 更新卡片墙可见性
    updateVisibility() {
        const movieCardWall = document.getElementById('movieCardWall');
        if (!movieCardWall) return;

        // 检查用户是否已登录
        const isLoggedIn = window.authManager && window.authManager.isLoggedIn();
        
        if (isLoggedIn) {
            // 已登录，隐藏卡片墙
            movieCardWall.style.display = 'none';
        } else {
            // 未登录，显示卡片墙
            movieCardWall.style.display = 'block';
            this.renderMovieCards();
        }
    }

    // 渲染影片卡片
    renderMovieCards() {
        const container = document.getElementById('movieCards');
        if (!container) return;

        container.innerHTML = '';

        this.movieCards.forEach((movie, index) => {
            const card = this.createMovieCard(movie, index);
            container.appendChild(card);
        });
    }

    // 创建单个影片卡片
    createMovieCard(movie, index) {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.setAttribute('data-index', index);

        card.innerHTML = `
            <div class="movie-card-image">
                <span style="font-size: 2.5rem;">${movie.poster}</span>
                <div class="movie-card-overlay">
                    <button class="movie-card-play-button">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="movie-card-content">
                <div class="movie-card-title" title="${this.escapeHtml(movie.title)}">
                    ${this.escapeHtml(movie.title)}
                </div>
                <div class="movie-card-info">
                    <div class="movie-card-year">${movie.year}</div>
                    <div class="movie-card-type">${movie.type} • ⭐ ${movie.rating}</div>
                </div>
            </div>
        `;

        // 添加点击事件
        card.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCardClick(movie);
        });

        return card;
    }

    // 处理卡片点击
    handleCardClick(movie) {
        // 显示登录提示
        if (window.userInterface) {
            // 创建自定义提示框
            this.showLoginPrompt(movie.title);
        } else {
            alert('请先登录后观看完整内容');
        }
    }

    // 显示登录提示框
    showLoginPrompt(movieTitle) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md mx-4 text-center">
                <div class="mb-4">
                    <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">需要登录观看</h3>
                    <p class="text-gray-600">《${this.escapeHtml(movieTitle)}》需要登录后才能观看完整内容</p>
                </div>
                <div class="space-y-3">
                    <button id="promptLogin" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                        立即登录
                    </button>
                    <button id="promptRegister" class="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">
                        注册新账户
                    </button>
                    <button id="promptCancel" class="w-full px-4 py-2 text-gray-600 hover:text-gray-800">
                        取消
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 绑定事件
        modal.querySelector('#promptLogin').addEventListener('click', () => {
            document.body.removeChild(modal);
            if (window.userInterface) {
                window.userInterface.showLoginModal();
            }
        });

        modal.querySelector('#promptRegister').addEventListener('click', () => {
            document.body.removeChild(modal);
            if (window.userInterface) {
                window.userInterface.showRegisterModal();
            }
        });

        modal.querySelector('#promptCancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // HTML转义函数
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 刷新卡片墙
    refresh() {
        this.updateVisibility();
    }
}

// 创建全局实例
window.movieCardWall = new MovieCardWall();