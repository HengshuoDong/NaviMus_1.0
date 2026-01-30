// src/plugins/UserCenter.js

export default class UserCenter {
    constructor(routePlanner) {

        this.routePlanner = routePlanner; // 🔥 关键：把它存下来！

        // 状态管理
        this.isLoggedIn = false;
        
        // 缓存 DOM 元素引用 (在 init 中获取，防止 DOM 未加载)
        this.dom = {};
    }

    /**
     * 初始化：获取 DOM 元素并绑定事件
     */
    init() {
        console.log("🔌 UserCenter Plugin Initializing...");
        
        // 1. 获取 DOM 元素
        this.dom = {
            widget: document.getElementById('user-profile-widget'),
            avatarBtn: document.getElementById('user-avatar-btn'),
            panel: document.getElementById('user-panel'),
            closeBtn: document.getElementById('close-panel-btn'),
            authDot: document.getElementById('auth-status-dot'),
            // agentToggle: document.getElementById('agent-visibility-toggle')
            themeToggle: document.getElementById('theme-toggle'),
            
            // 用户信息
            username: document.getElementById('panel-username'),
            role: document.getElementById('panel-role'),
            
            // 按钮与输入
            authBtn: document.getElementById('auth-action-btn'),
            dataToggle: document.getElementById('data-share-toggle'),
            restrictedBtns: document.querySelectorAll('.disabled-if-guest'),
            
            // Tabs
            tabs: document.querySelectorAll('.tab-btn'),
            panes: document.querySelectorAll('.tab-pane'),
            
            // 特殊按钮
            questionnaireBtn: document.getElementById('btn-open-questionnaire'),

            // 👇 新增：问卷相关的 DOM
            questModal: document.getElementById('questionnaire-modal'),
            questCloseBtn: document.getElementById('close-quest-btn'),
            questCancelBtn: document.getElementById('btn-cancel-quest'),
            questSubmitBtn: document.getElementById('btn-submit-quest'),

            // 👇 新增：Evaluation Modal 相关的 DOM
            evalBtn: document.getElementById('btn-open-eval'),
            evalModal: document.getElementById('evaluation-modal'),
            evalCloseBtn: document.getElementById('close-eval-btn'),
            evalCancelBtn: document.getElementById('btn-cancel-eval'),
            evalSubmitBtn: document.getElementById('btn-submit-eval'),
            
            // 星星容器
            starRatings: document.querySelectorAll('.star-rating')
        };

        // 安全检查：如果 HTML 结构不对，直接返回
        if (!this.dom.widget || !this.dom.panel) {
            console.warn("⚠️ UserCenter: DOM elements not found. Check index.html.");
            return;
        }

        // 2. 绑定事件
        this._bindEvents();
        
        // 3. 初始化状态
        this._updateUIState();

        this._bindRatingEvents(); // 绑定星星点击事件
    }

    /**
     * 内部方法：绑定所有交互事件
     */
    // _bindEvents() {
    //     const d = this.dom;

    //     // A. 面板开关
    //     d.avatarBtn.addEventListener('click', (e) => {
    //         e.stopPropagation();
    //         this.togglePanel();
    //     });

    //     d.closeBtn.addEventListener('click', () => this.togglePanel(false));

    //     // 点击外部关闭
    //     document.addEventListener('click', (e) => {
    //         // 只有当 Dashboard 显示时，才需要判断是否关闭
    //         if (!d.panel.classList.contains('hidden')) {
                
    //             // --- 定义所有“安全区域” (点击这些地方 Dashboard 不会关) ---
                
    //             // A. Dashboard 本体 & 头像
    //             const isClickInsidePanel = d.panel.contains(e.target);
    //             const isClickInsideAvatar = d.avatarBtn.contains(e.target);

    //             // B. 问卷弹窗 (如果存在且显示)
    //             const isClickInsideQuest = d.questModal && 
    //                                      !d.questModal.classList.contains('hidden') && 
    //                                      d.questModal.contains(e.target);
                
    //             // C. 评价弹窗 (如果存在且显示) - 修复新问卷关闭问题
    //             const isClickInsideEval = d.evalModal && 
    //                                     !d.evalModal.classList.contains('hidden') && 
    //                                     d.evalModal.contains(e.target);

    //             // --- 核心判断 ---
    //             // 如果点击的地方既不在面板里，也不在头像里，也不在任何一个弹窗里 -> 关！
    //             if (!isClickInsidePanel && !isClickInsideAvatar && !isClickInsideQuest && !isClickInsideEval) {
    //                 this.togglePanel(false);
    //             }
    //         }
    //     });

    //     // B. Tab 切换逻辑
    //     d.tabs.forEach(tab => {
    //         tab.addEventListener('click', () => {
    //             // UI 切换
    //             d.tabs.forEach(t => t.classList.remove('active'));
    //             tab.classList.add('active');

    //             // 内容切换
    //             const allPanes = document.querySelectorAll('.tab-pane');
    //             allPanes.forEach(p => {
    //                 p.classList.remove('active');
    //                 p.style.display = 'none';
    //             });

    //             const targetId = `tab-${tab.dataset.tab}`;
    //             const targetPane = document.getElementById(targetId);
    //             if (targetPane) {
    //                 targetPane.classList.add('active');
    //                 targetPane.style.display = 'block';
    //             }
    //         });
    //     });

    //     // C. 登录/登出按钮
    //     d.authBtn.addEventListener('click', () => {
    //         // 切换状态
    //         this.setLoginState(!this.isLoggedIn);
    //     });

    //     // D. 拦截未登录操作
    //     d.restrictedBtns.forEach(btn => {
    //         btn.addEventListener('click', (e) => {
    //             if (!this.isLoggedIn) {
    //                 e.preventDefault();
    //                 e.stopPropagation();
    //                 alert("🔒 Login Required\n\nPlease log in to submit VGI data or comments.");
    //             } else {
    //                 // 这里未来可以对接实际的 API
    //                 alert("✅ Submitted Successfully (Mock)!");
    //             }
    //         });
    //     });

    //     // E. 打开问卷
    //     if (d.questionnaireBtn) {
    //         d.questionnaireBtn.addEventListener('click', () => {
    //             // this.togglePanel(false);
    //             // 这里可以触发一个自定义事件，通知 main.js 打开问卷
    //             // 或者直接在这里调用问卷逻辑
    //             console.log("📝 Open Questionnaire requested");
    //             // alert("Opening Supervised AI Route Planner...");
                
    //             // 比如：window.dispatchEvent(new CustomEvent('open-questionnaire'));
    //             // ✅ 只保留这一行：打开问卷 Modal
    //             if (d.questModal) {
    //                 d.questModal.classList.remove('hidden');
    //             }
    //         });
    //     }

    //     // 🔥 2. 关闭问卷逻辑 (X 按钮 & Cancel 按钮)
    //     const closeQuest = () => {
    //         if (d.questModal) d.questModal.classList.add('hidden');
    //     };

    //     if (d.questCloseBtn) d.questCloseBtn.addEventListener('click', closeQuest);
    //     if (d.questCancelBtn) d.questCancelBtn.addEventListener('click', closeQuest);

    //     // 🔥 3. 提交问卷逻辑 (AI 的入口)
    //     if (d.questSubmitBtn) {
    //         d.questSubmitBtn.addEventListener('click', () => {
    //             // A. 收集数据
    //             const interests = Array.from(document.querySelectorAll('.tag-checkbox input:checked')).map(cb => cb.value);
    //             const duration = document.getElementById('quest-duration').value;
    //             const pace = document.querySelector('input[name="pace"]:checked').value;

    //             const userPreferences = { interests, duration, pace };
                
    //             console.log("🚀 Collecting User Preferences:", userPreferences);

    //             // B. 关闭弹窗
    //             closeQuest();

    //             // C. 触发后续流程 (这里是未来的 AI 接口)
    //             // alert(`AI Route Generation Started!\n\nInterests: ${interests.join(', ')}\nDuration: ${duration}`);
                
    //             // TODO: 调用 AIService.generateRoute(userPreferences);
    //         });
    //     }

    //     if (this.dom.agentToggle) {
    //         this.dom.agentToggle.addEventListener('change', (e) => {
    //             const show = e.target.checked;
    //             if (window.AgentController) {
    //                 // 只有这里才真正控制显隐
    //                 // 我们可以借用 user/guest 角色来控制显示，或者在该类里加个独立的 toggleVisibility 方法
    //                 // 假设 guest = 隐, user = 显
    //                 window.AgentController.setUserRole(show ? 'user' : 'guest');
    //             }
    //         });
    //     }

    //     // 🔥 新增：深色模式切换逻辑
    //     if (d.themeToggle) {
    //         d.themeToggle.addEventListener('change', (e) => {
    //             const isDarkMode = e.target.checked;
                
    //             if (isDarkMode) {
    //                 d.panel.classList.add('dark-mode');
    //                 console.log("🌙 Theme: Dark Mode Activated");
    //             } else {
    //                 d.panel.classList.remove('dark-mode');
    //                 console.log("☀️ Theme: Light Mode Activated");
    //             }

    //             // (可选) 这里可以把偏好存入 localStorage，下次刷新记住
    //             // localStorage.setItem('dashboard_theme', isDarkMode ? 'dark' : 'light');
    //         });
    //     }

    //     // 🔥 Evaluation Modal 开关逻辑
    //     if (d.evalBtn) {
    //         d.evalBtn.addEventListener('click', (e) => {
    //             e.stopPropagation();
    //             // 同样不关闭 Dashboard，直接叠加显示
    //             if (d.evalModal) d.evalModal.classList.remove('hidden');
    //         });
    //     }

    //     const closeEval = () => {
    //         if (d.evalModal) d.evalModal.classList.add('hidden');
    //     };

    //     if (d.evalCloseBtn) d.evalCloseBtn.addEventListener('click', closeEval);
    //     if (d.evalCancelBtn) d.evalCancelBtn.addEventListener('click', closeEval);

    //     // 🔥 提交评价
    //     if (d.evalSubmitBtn) {
    //         d.evalSubmitBtn.addEventListener('click', () => {
    //             // 收集数据
    //             const efficiency = document.getElementById('eval-efficiency').value;
    //             const unsupervisedScore = document.getElementById('eval-unsupervised').value;
    //             const supervisedScore = document.getElementById('eval-supervised').value;
    //             const immersion = document.getElementById('eval-immersion').value;
                
    //             // 简单的 Alert 反馈
    //             console.log("📊 System Eval Submitted:", { efficiency, unsupervisedScore, supervisedScore, immersion });
    //             alert("Thank you for your feedback!\nYour input helps us improve NaviMus.");
                
    //             closeEval();
    //         });
    //     }
        
    //     // // ... (点击 document 外部关闭逻辑，记得加上 !d.evalModal.contains(e.target)) ...
    //     // document.addEventListener('click', (e) => {
    //     //      // ... 前面的判断 ...
    //     //      const isClickInsideEval = d.evalModal && d.evalModal.contains(e.target);
             
    //     //      // 如果点击在 Eval Modal 里面，也不要关 Dashboard
    //     //      if (!isClickInsidePanel && !isClickInsideAvatar && !isClickInsideQuest && !isClickInsideEval) {
    //     //          this.togglePanel(false);
    //     //      }
    //     // });



    // }




    // ⭐ 处理星星打分逻辑

// src/plugins/UserCenter.js

// src/plugins/UserCenter.js

    _bindEvents() {
        const d = this.dom;

        // 1. 面板开关 (头像点击)
        d.avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });

        // 2. 面板关闭 (X 按钮)
        d.closeBtn.addEventListener('click', () => this.togglePanel(false));

        // 3. 全局点击监听 (点击外部关闭)
        document.addEventListener('click', (e) => {
            if (!d.panel.classList.contains('hidden')) {
                // 定义安全区域
                const isClickInsidePanel = d.panel.contains(e.target);
                const isClickInsideAvatar = d.avatarBtn.contains(e.target);
                
                // 检查问卷是否显示且点击在内部
                const isClickInsideQuest = d.questModal && 
                                         !d.questModal.classList.contains('hidden') && 
                                         d.questModal.contains(e.target);
                
                // 检查评价是否显示且点击在内部
                const isClickInsideEval = d.evalModal && 
                                        !d.evalModal.classList.contains('hidden') && 
                                        d.evalModal.contains(e.target);

                // 如果点击既不在面板，也不在头像，也不在任何开启的弹窗里 -> 关闭面板
                if (!isClickInsidePanel && !isClickInsideAvatar && !isClickInsideQuest && !isClickInsideEval) {
                    this.togglePanel(false);
                }
            }
        });

        // 4. Tab 切换
        d.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                d.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const allPanes = document.querySelectorAll('.tab-pane');
                allPanes.forEach(p => {
                    p.classList.remove('active');
                    p.style.display = 'none';
                });

                const targetId = `tab-${tab.dataset.tab}`;
                const targetPane = document.getElementById(targetId);
                if (targetPane) {
                    targetPane.classList.add('active');
                    targetPane.style.display = 'block';
                }
            });
        });

        // 5. Auth & Restricted Buttons
        d.authBtn.addEventListener('click', () => this.setLoginState(!this.isLoggedIn));
        d.restrictedBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!this.isLoggedIn) {
                    e.preventDefault(); e.stopPropagation();
                    alert("🔒 Login Required");
                } else {
                    alert("✅ Submitted Successfully!");
                }
            });
        });

        // 6. Theme Toggle
        if (d.themeToggle) {
            d.themeToggle.addEventListener('change', (e) => {
                if (e.target.checked) d.panel.classList.add('dark-mode');
                else d.panel.classList.remove('dark-mode');
            });
        }

        // ============================================================
        // 📝 问卷 1: User Preferences (修复关闭问题)
        // ============================================================
        
        // 打开按钮
        if (d.questionnaireBtn) {
            d.questionnaireBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止冒泡
                if (d.questModal) d.questModal.classList.remove('hidden');
            });
        }

        // 定义关闭函数 1
        const closeQuest = () => { 
            if (d.questModal) d.questModal.classList.add('hidden'); 
        };

        // 关闭按钮 (X)
        if (d.questCloseBtn) {
            d.questCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 🔥 关键修复
                closeQuest();
            });
        }
        // 取消按钮
        if (d.questCancelBtn) {
            d.questCancelBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 🔥 关键修复
                closeQuest();
            });
        }
        // 提交按钮
        if (d.questSubmitBtn) {
            d.questSubmitBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 🔥 关键修复
                // closeQuest();
                alert("Suggestion preference updated!");
            });
        }

        // ============================================================
        // 📊 问卷 2: System Evaluation (修复关闭问题 & 启用逻辑)
        // ============================================================
        
        // 打开按钮
        if (d.evalBtn) {
            d.evalBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止冒泡
                if (d.evalModal) d.evalModal.classList.remove('hidden');
            });
        }

        // 定义关闭函数 2
        const closeEval = () => { 
            if (d.evalModal) d.evalModal.classList.add('hidden'); 
        };

        // 关闭按钮 (X)
        if (d.evalCloseBtn) {
            d.evalCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 🔥 关键修复
                closeEval();
            });
        }
        // 取消按钮
        if (d.evalCancelBtn) {
            d.evalCancelBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 🔥 关键修复
                closeEval();
            });
        }
        // 提交按钮
        if (d.evalSubmitBtn) {
            // d.evalSubmitBtn.addEventListener('click', (e) => {
            //     e.stopPropagation(); // 🔥 关键修复
                
            //     // 这里可以添加收集数据的逻辑...
            //     // const val = document.getElementById('eval-efficiency').value;
                
            //     // closeEval(); 
            //     alert("Thank you for your feedback!");
            // });

            d.evalSubmitBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                // 收集 DOM 数据
                const feedback = {
                    efficiency: document.getElementById('eval-efficiency').value,
                    // ... 其他字段
                };

                // 发送
                await fetch('http://localhost:3000/api/submit-evaluation', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(feedback)
                });

                // 反馈给用户 (用 NaviAI 说话)
                // this.togglePanel(false); // 关掉 Dashboard
                
                alert("Thank you for your feedback!");

                if (window.AgentController) {
                    window.AgentController.addMessage('system', "Thank you! Your feedback helps me learn. 📝");
                }
            });
        }

        // // 🔥 检查这段代码是否存在
        // const quickInput = document.getElementById('quick-target-input');
        // const quickBtn = document.getElementById('btn-quick-go');

        // if (quickBtn && quickInput) {
        //     quickBtn.addEventListener('click', (e) => {
        //         e.stopPropagation();
        //         const target = quickInput.value.trim();
                
        //         if (!target) {
        //             alert("Please enter a destination name first!");
        //             return;
        //         }

        //         // 1. 关闭面板
        //         // this.togglePanel(false);

        //         // 2. 调用 RoutePlanner (机制 2)
        //         if (this.routePlanner) {
        //             this.routePlanner.generateRoute({
        //                 specificPlaces: target, // 传给后端
        //                 interests: [],
        //                 duration: "4h",
        //                 pace: "relaxed"
        //             });
        //         } else {
        //             console.error("RoutePlanner missing in UserCenter!");
        //         }
        //     });
        // }



    }


    _bindRatingEvents() {
        if (!this.dom.starRatings) return;

        this.dom.starRatings.forEach(container => {
            const stars = container.querySelectorAll('span');
            const hiddenInput = container.querySelector('input');

            stars.forEach((star, index) => {
                // 点击星星
                star.addEventListener('click', () => {
                    const val = index + 1;
                    hiddenInput.value = val;
                    
                    // 更新视觉状态
                    stars.forEach((s, i) => {
                        if (i < val) s.classList.add('selected');
                        else s.classList.remove('selected');
                    });
                });
            });
        });
    }



    /**
     * 公共方法：开关面板
     */
    togglePanel(forceState) {
        const panel = this.dom.panel;
        if (typeof forceState !== 'undefined') {
            if (forceState) panel.classList.remove('hidden');
            else panel.classList.add('hidden');
        } else {
            panel.classList.toggle('hidden');
        }
    }

    /**
     * 公共方法：设置登录状态
     * @param {boolean} state - true 为登录, false 为登出
     */
    setLoginState(state) {
        this.isLoggedIn = state;
        this._updateUIState();
        
        // // 联动 AgentController (如果存在)
        // if (window.AgentController) {
        //     window.AgentController.setUserRole(state ? 'user' : 'guest');
        // }
        
        console.log(`[UserCenter] Auth State Changed: ${state ? 'Logged In' : 'Guest'}`);
    }

    /**
     * 内部方法：根据状态刷新 UI
     */
    _updateUIState() {
        const d = this.dom;
        
        if (this.isLoggedIn) {
            // === 登录态 ===
            d.username.textContent = "Traveler Alpha";
            d.role.textContent = "Contributor";
            d.role.classList.add('active');
            d.authDot.classList.remove('offline');
            d.authDot.classList.add('online');
            
            d.authBtn.textContent = "Log Out";
            d.authBtn.classList.add('logout');
            
            d.dataToggle.disabled = false;
            d.dataToggle.checked = true;
            
            d.restrictedBtns.forEach(btn => {
                btn.classList.remove('disabled-if-guest');
            });
        } else {
            // === 游客态 ===
            d.username.textContent = "Guest Visitor";
            d.role.textContent = "Local Mode";
            d.role.classList.remove('active');
            d.authDot.classList.remove('online');
            d.authDot.classList.add('offline');
            
            d.authBtn.textContent = "Log In / Sign Up";
            d.authBtn.classList.remove('logout');
            
            d.dataToggle.disabled = true;
            d.dataToggle.checked = false;
            
            d.restrictedBtns.forEach(btn => {
                btn.classList.add('disabled-if-guest');
            });
        }
    }
}