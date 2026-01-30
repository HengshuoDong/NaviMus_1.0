// // src/plugins/NaviAgent.js
// // import RouteOverlay from './RouteOverlay.js';
// // 假设你有一个简单的 EventBus 或直接操作 DOM，这里为了简洁直接操作 DOM

// export default class NaviAgent {
//     constructor(viewer, dataSource) {
//         this.viewer = viewer;
//         this.dataSource = dataSource; // 博物馆 GeoJSON 数据源
        
//         // 状态
//         this.userRole = 'guest';
//         this.isLoaded = false;
//         // this.isLoading = false;
        
//         // 视觉组件
//         // this.overlay = new RouteOverlay(viewer);
//         this.app = null; // PIXI App
//         this.model = null; // Live2D Model

//         // DOM 缓存
//         this.dom = {
//             container: document.getElementById('agent-container'),
//             avatar: document.getElementById('agent-avatar'),
//             dialog: document.getElementById('agent-dialog-box'),
//             closeBtn: document.querySelector('.close-dialog-btn'),
//             input: document.getElementById('agent-input'),
//             sendBtn: document.getElementById('agent-send-btn'),
//             history: document.getElementById('chat-history')
//         };


//     }

//     // init() {
//     //     // 绑定基础事件
//     //     this.dom.avatar.addEventListener('click', () => this.handleAvatarClick());
//     //     this.dom.closeBtn.addEventListener('click', () => this.toggleDialog(false));
//     //     this.dom.sendBtn.addEventListener('click', () => this.handleSend());
//     //     this.dom.input.addEventListener('keypress', (e) => {
//     //         if (e.key === 'Enter') this.handleSend();
//     //     });

//     //     // 🔥 新增：输入框自适应高度逻辑
//     //     inputEl.addEventListener('input', () => {
//     //         inputEl.style.height = 'auto'; // 先重置，让它能缩回去
//     //         inputEl.style.height = (inputEl.scrollHeight) + 'px'; // 再撑开
//     //     });

//     //     // 🔥 修改：回车发送逻辑
//     //     // 使用 keydown 而不是 keypress，为了更好地捕捉 Shift 键
//     //     inputEl.addEventListener('keydown', (e) => {
//     //         if (e.key === 'Enter') {
//     //             if (e.shiftKey) {
//     //                 // Shift + Enter: 允许换行 (默认行为)，不做任何事
//     //                 return;
//     //             } else {
//     //                 // Enter: 发送
//     //                 e.preventDefault(); // 阻止默认的换行
//     //                 this.handleSend();
//     //             }
//     //         }
//     //     });

//     //     console.log("[NaviAgent] Initialized. Waiting for login...");
//     // }

//     // --- 1. 角色与加载逻辑 ---
    
//     init() {
//         // 安全检查：如果关键元素找不到，就在控制台报个警，别崩断程序
//         if (!this.dom.input || !this.dom.sendBtn) {
//             console.error("❌ [NaviAgent] Critical DOM elements missing! Check index.html IDs: naviai-input, naviai-send-btn");
//             return;
//         }

//         // 绑定基础事件
//         if (this.dom.avatar) {
//             // this.dom.avatar.addEventListener('click', () => this.handleAvatarClick());
//             this.dom.avatar.addEventListener('click', () => {
//                 const isHidden = this.dom.container.classList.contains('hidden');
//                 if (isHidden) {
//                     this.toggleDialog(true);
//                     this.addMessage('system', "I'm back! Where to next? 🗺️");
//                 }
//                 if (this.model) this.model.motion('Tap');
//             });
//         }
//         // // 1. 修正头像点击逻辑：只开，不关
//         // if (this.dom.avatar) {
//         //     this.dom.avatar.addEventListener('click', () => {
//         //         // 如果是关着的，就打开；如果是开着的，就只播放动作
//         //         const isHidden = this.dom.container.classList.contains('hidden');
//         //         if (isHidden) {
//         //             this.handleAvatarClick();
//         //             this.toggleDialog(true); // 强制打开
//         //             this.addMessage('system', "I'm back! Where to next? 🗺️");
//         //         }
                
//         //         // 无论开关，点我就动一下
//         //         if (this.model) this.model.motion('Tap');
//         //     });
//         // }
        
//         // if (this.dom.closeBtn) {
//         //     // this.dom.closeBtn.addEventListener('click', () => this.toggleDialog(false));
//         //     this.dom.closeBtn.addEventListener('click', () => {
//         //         this.toggleDialog(false); // 1. 关窗口
//         //         this.exitSupervisedMode(); // 2. 退模式 (清理地图)
//         //     });
//         // }

//         // 2. 修正关闭按钮逻辑：既关窗，又清图 (二合一)
//         if (this.dom.closeBtn) {
//             this.dom.closeBtn.addEventListener('click', (e) => {
//                 e.stopPropagation(); // 防止冒泡
//                 this.toggleDialog(false); // 关窗
//                 this.exitSupervisedMode(); // 🔥 退出 AI 模式 (清空地图)
//             });
//         }

//         this.dom.sendBtn.addEventListener('click', () => this.handleSend());

//         // 🔥 自适应高度逻辑
//         const inputEl = this.dom.input;
//         inputEl.addEventListener('input', () => {
//             inputEl.style.height = 'auto'; 
//             inputEl.style.height = (inputEl.scrollHeight) + 'px';
//         });

//         // 🔥 回车发送，Shift+Enter 换行
//         inputEl.addEventListener('keydown', (e) => {
//             if (e.key === 'Enter') {
//                 if (e.shiftKey) {
//                     return; // 允许换行
//                 } else {
//                     e.preventDefault(); // 阻止默认换行，执行发送
//                     this.handleSend();
//                 }
//             }
//         });

//         console.log("[NaviAgent] Online & IDs Linked.");
//     }

//     /**
//      * 🔥 新增：退出 AI 模式，恢复自由探索
//      */
//     exitSupervisedMode() {
//         console.log("👋 Exiting Supervised Mode...");
        
//         // // 1. 清除 2D 流光层
//         // if (this.overlay) {
//         //     this.overlay.clear();
//         // }

//         // 2. 清除 3D 地图路线并恢复图标
//         if (window.UserCenter && window.UserCenter.routePlanner) {
//             window.UserCenter.routePlanner.resetMapVisuals();
//         }
        
//         // 可选：如果要让 Live2D 说句话
//         // if (this.model) this.model.motion('Tap');
//     }

//     async setUserRole(role) {
//         this.userRole = role;
//         console.log(`[NaviAgent] Role switched to: ${role}`);

//         if (role === 'guest') {
//             // this.dom.container.classList.add('hidden');
//             if (this.dom.container) this.dom.container.classList.add('hidden');
//             if (this.dom.avatar) this.dom.avatar.classList.add('hidden');
//             // this.toggleDialog(false);
//             this.exitSupervisedMode(); // 清理地图
//             // this.overlay.clear(); // 退出登录时清除线条
//         } else {
//             // this.dom.container.classList.remove('hidden');
//             // if (!this.isLoaded) await this.loadLive2D();
            
//             // // 欢迎语
//             // if (this.dom.history.children.length <= 0) {
//             //     this.addMessage('system', `Hello! I am NaviAI. Where would you like to go today?`);
//             // }
//             if (this.dom.container) this.dom.container.classList.remove('hidden');
//             if (this.dom.avatar) this.dom.avatar.classList.remove('hidden');
            
//             if (!this.isLoaded) await this.loadLive2D();
//         }
        
//         // 更新全局引用，以便 UserCenter 能读到状态
//         window.AgentController = this;
//     }



//     async loadLive2D() {
//         if (this.isLoaded || this.isLoading) return;
//         this.isLoading = true;

//         const canvas = document.getElementById('live2d-canvas');
//         if (!window.PIXI || !window.PIXI.live2d) {
//             console.error("❌ PIXI/Live2D libraries not loaded.");
//             return;
//         }

//         const { Live2DModel } = window.PIXI.live2d;
//         this.app = new PIXI.Application({
//             view: canvas,
//             autoStart: true,
//             backgroundAlpha: 0,
//             width: 400, 
//             height: 400,
//         });

//         const modelUrl = '/data/agent/shizuku.model.json'; 

//         try {
//             this.model = await Live2DModel.from(modelUrl);
//             this.model.anchor.set(0.5, 0.5);
//             this.model.position.set(200, 250);
//             this.model.scale.set(0.4);
            
//             // 点击互动
//             this.model.on('hit', () => this.model.motion('Tap'));
            
//             this.app.stage.addChild(this.model);
//             this.isLoaded = true;
//             console.log("✅ [NaviAgent] Live2D Ready!");
//         } catch (e) {
//             console.error("Live2D Error:", e);
//         } finally {
//             this.isLoading = false;
//         }
//     }





//     toggleDialog(state) {
//         if (!this.dom.container) return;
//         const newState = typeof state !== 'undefined' ? state : !this.dom.dialog.classList.contains('hidden');
//         if (!newState) {
//             this.dom.dialog.classList.remove('hidden'); // 显示
//             this.dom.input.focus();
//         } else {
//             this.dom.dialog.classList.add('hidden'); // 隐藏
//         }
//     }

//     handleAvatarClick() {
//         if (!this.isLoaded) return;
//         this.toggleDialog(); // 切换对话框
//         if (this.model) this.model.motion('Tap');


//     }

//     // async handleSend() {
//     //     const text = this.dom.input.value.trim();
//     //     if (!text) return;

//     //     // UI 反馈
//     //     this.addMessage('user', text);
//     //     this.dom.input.value = '';
//     //     const thinkingId = this.addMessage('system', 'Planning route...');

//     //     try {
//     //         // 🔥 调用后端 Gamma 3 接口
//     //         // 注意：这里我们复用 /api/plan-route，但传 userMessage
//     //         const response = await fetch('http://localhost:3000/api/plan-route', {
//     //             method: 'POST',
//     //             headers: { 'Content-Type': 'application/json' },
//     //             body: JSON.stringify({ 
//     //                 userMessage: text, // "我想去宝马博物馆"
//     //                 // 如果后端需要 interests 等字段，这里可以传默认值或空
//     //                 interests: [], 
//     //                 duration: "4h", 
//     //                 pace: "relaxed" 
//     //             })
//     //         });

//     //         const result = await response.json();
            
//     //         // 移除 "Planning..." 消息
//     //         const thinkingNode = document.getElementById(thinkingId);
//     //         if(thinkingNode) thinkingNode.remove();

//     //         if (result.success && result.data) {
//     //             // 假设后端返回格式为: { reasoning: "...", route: [...] }
//     //             // 或者我们之后优化后端返回 { chat_response: "...", route_data: [...] }
//     //             // 这里暂时兼容现有的 route 格式
                
//     //             const route = result.data.route;
//     //             const reply = result.data.reasoning || `I found ${route.length} stops for you.`;
                
//     //             this.addMessage('system', reply);

//     //             // 🎬 触发 2D 动画
//     //             if (route && route.length > 0) {
//     //                 this.overlay.animateRoute(route, this.dataSource.entities.values);
//     //             }
                
//     //             // 动作反馈
//     //             if (this.model) this.model.motion('Tap');
//     //         } else {
//     //             this.addMessage('system', "Sorry, I couldn't plan a route.");
//     //         }

//     //     } catch (e) {
//     //         console.error(e);
//     //         this.addMessage('system', "Connection error.");
//     //     }
//     // }

    


//     /**
//      * 🔥 核心：处理发送消息
//      */

//     // src/plugins/NaviAgent.js

//     async handleSend() {
//         const text = this.dom.input.value.trim();
//         if (!text) return;

//         this.addMessage('user', text);
//         this.dom.input.value = '';
//         this.dom.input.style.height = 'auto'; // 瞬间变回单行
        
//         const thinkingId = this.addMessage('system', 'Thinking... 🧠');
//         if (this.model) this.model.motion('Tap'); 

//         try {
//             const response = await fetch('http://localhost:3000/api/plan-route', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ 
//                     specificPlaces: text, 
//                     interests: [],        
//                     duration: "4h"        
//                 })
//             });

//             const result = await response.json();
            
//             // 移除思考气泡
//             const thinkingNode = document.getElementById(thinkingId);
//             if(thinkingNode) thinkingNode.remove();

//             if (result.success && result.data) {
//                 const { reasoning, route } = result.data; // 不再读取 AI 返回的 total_duration_display

//                 // 构建详细的路线清单
//                 let routeListText = "";
//                 let calculatedTotal = "Calculating..."; // 默认值

//                 if (route && route.length > 0) {
//                     // 1. 生成列表文本
//                     routeListText = route.map((stop, index) => {
//                         const timeStr = stop.visit_time ? ` (${stop.visit_time})` : "";
//                         return `\n${index + 1}. ${stop.name}${timeStr}`;
//                     }).join("");

//                     // 2. 🔥 前端自己算总时间 (更准确)
//                     calculatedTotal = calculateTotalTime(route);
//                 }

//                 // 组装最终回复
//                 let replyText = reasoning;
                
//                 if (route && route.length > 0) {
//                     replyText += `\n\n📍 **Route Plan:**${routeListText}`;
//                     // 使用我们算的 calculatedTotal
//                     replyText += `\n\n⏱️ **Est. Total:** ${calculatedTotal}`;
//                 }

//                 this.addMessage('system', replyText);

//                 // 调用地图画线
//                 if (route && route.length > 0) {
//                     if (window.UserCenter && window.UserCenter.routePlanner) {
//                         window.UserCenter.routePlanner.visualizeRoute(route);
//                     }
//                 } else {
//                     // 如果是纯聊天，且没有路线，可以选择是否清空地图
//                     // window.UserCenter.routePlanner.clearRoute(); 
//                 }
                
//                 if (this.model) this.model.motion('Tap');

//             } else {
//                 this.addMessage('system', "Server error: Invalid format.");
//             }

//         } catch (e) {
//             console.error(e);
//             const thinkingNode = document.getElementById(thinkingId);
//             if(thinkingNode) thinkingNode.remove();
//             this.addMessage('system', "Network error. Is the server running? 🔌");
//         }
//     }

//     addMessage(type, text) {
//         const div = document.createElement('div');
//         div.className = `msg ${type}`;
//         div.textContent = text;
//         div.id = 'msg-' + Date.now();
//         this.dom.history.appendChild(div);
//         this.dom.history.scrollTop = this.dom.history.scrollHeight;
//         return div.id;
//     }

    
// }

// // 解析时间字符串并累加分钟数
// function calculateTotalTime(route) {
//     let totalMinutes = 0;
//     route.forEach(stop => {
//         const timeStr = stop.visit_time || "";
//         // 简单正则提取 h 和 m
//         const hMatch = timeStr.match(/(\d+)\s*h/);
//         const mMatch = timeStr.match(/(\d+)\s*m/);
        
//         if (hMatch) totalMinutes += parseInt(hMatch[1]) * 60;
//         if (mMatch) totalMinutes += parseInt(mMatch[1]);
//     });
    
//     // 转回 x hours y mins
//     const h = Math.floor(totalMinutes / 60);
//     const m = totalMinutes % 60;
    
//     if (h > 0 && m > 0) return `${h}h ${m}m`;
//     if (h > 0) return `${h} Hours`;
//     return `${m} Mins`;
// }


// src/plugins/NaviAgent.js

export default class NaviAgent {
    constructor(viewer, dataSource) {
        this.viewer = viewer;
        this.dataSource = dataSource;
        
        // 状态
        this.userRole = 'guest';
        this.isLoaded = false;
        
        // 渲染相关
        this.app = null; 
        this.model = null;

        // ✅ [以此为准] 使用您指定的 DOM 结构
        this.dom = {
            container: document.getElementById('agent-container'),
            avatar: document.getElementById('agent-avatar'),
            dialog: document.getElementById('agent-dialog-box'),
            closeBtn: document.querySelector('.close-dialog-btn'),
            input: document.getElementById('agent-input'),
            sendBtn: document.getElementById('agent-send-btn'),
            history: document.getElementById('chat-history')
        };
    }

    init() {
        // 安全检查
        if (!this.dom.input || !this.dom.sendBtn) {
            console.error("❌ [NaviAgent] 缺少必要的 DOM 元素，请检查 index.html ID 是否为 agent-input / agent-send-btn");
            return;
        }

        // 1. 绑定头像点击事件
        if (this.dom.avatar) {
            this.dom.avatar.addEventListener('click', (e) => {
                // 阻止冒泡，防止触发地图点击
                e.stopPropagation(); 
                
                // 🔥 修复核心：直接切换对话框，不要判断容器是否隐藏
                this.toggleDialog(); 
                
                // 播放动作
                if (this.model) {
                    try { this.model.motion('Tap'); } catch(e) {}
                }
            });
        }
        
        // 2. 绑定关闭按钮事件
        if (this.dom.closeBtn) {
            this.dom.closeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                this.toggleDialog(false); // 关窗
                this.exitSupervisedMode(); // 清理地图箭头
            });
        }

        // 3. 发送按钮
        this.dom.sendBtn.addEventListener('click', () => this.handleSend());

        // 4. 输入框自适应 & 回车发送
        const inputEl = this.dom.input;
        inputEl.addEventListener('input', () => {
            inputEl.style.height = 'auto'; 
            inputEl.style.height = (inputEl.scrollHeight) + 'px';
        });

        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) return; 
                e.preventDefault(); 
                this.handleSend();
            }
        });

        console.log("[NaviAgent] Online & Ready.");
    }

    /**
     * 切换对话框的显示/隐藏
     * @param {boolean} [forceState] - 强制指定开(true)或关(false)
     */
    toggleDialog(forceState) {
        if (!this.dom.dialog) return;
        
        // 当前是否显示（没有 hidden 类就是显示）
        const isVisible = !this.dom.dialog.classList.contains('hidden');
        
        // 如果没传参，就取反
        const shouldShow = (typeof forceState !== 'undefined') ? forceState : !isVisible;
        
        if (shouldShow) {
            this.dom.dialog.classList.remove('hidden');
            // 聚焦输入框
            if (this.dom.input) setTimeout(() => this.dom.input.focus(), 50);
            
            // 如果是重新打开，可以发个欢迎语（可选）
            // this.addMessage('system', "I'm here! Where to next? 🗺️");
        } else {
            this.dom.dialog.classList.add('hidden');
        }
    }

    /**
     * 退出 AI 模式 (清理地图上的箭头和路线)
     */
    exitSupervisedMode() {
        console.log("👋 Exiting Supervised Mode...");
        if (window.UserCenter && window.UserCenter.routePlanner) {
            window.UserCenter.routePlanner.resetMapVisuals();
        }
    }

    /**
     * 设置用户角色 (Guest / User)
     */
    async setUserRole(role) {
        this.userRole = role;
        console.log(`[NaviAgent] Role switched to: ${role}`);
        
        if (role === 'guest') {
            // Guest 模式：隐藏整个容器 (包含头像和对话框)
            if (this.dom.container) this.dom.container.classList.add('hidden');
            
            // 强制关闭对话框
            this.toggleDialog(false);
            
            // 清理地图
            this.exitSupervisedMode(); 
            
        } else {
            // User 模式：显示容器 (显示头像)
            if (this.dom.container) this.dom.container.classList.remove('hidden');
            
            // 确保对话框是关闭的，等待用户点击头像打开
            // this.toggleDialog(false); 
            
            // 懒加载 Live2D
            if (!this.isLoaded) await this.loadLive2D();
        }
        
        // 更新全局引用
        window.AgentController = this;
    }

    async loadLive2D() {
        if (this.isLoaded) return;
        if (!window.PIXI || !window.PIXI.live2d) {
            console.warn("PIXI/Live2D not found");
            return;
        }

        try {
            const canvas = document.getElementById('live2d-canvas');
            if (!canvas) return;

            const { Live2DModel } = window.PIXI.live2d;
            this.app = new PIXI.Application({
                view: canvas,
                autoStart: true,
                backgroundAlpha: 0,
                width: 400, height: 400,
            });

            // ⚠️ 确保路径正确
            const modelUrl = './data/agent/shizuku.model.json'; 
            this.model = await Live2DModel.from(modelUrl);
            
            this.model.anchor.set(0.5, 0.5);
            this.model.position.set(200, 250);
            this.model.scale.set(0.4);
            
            this.model.on('hit', () => this.model.motion('Tap'));
            this.app.stage.addChild(this.model);
            
            this.isLoaded = true;
            console.log("✅ Live2D Model Loaded");
        } catch (e) {
            console.warn("Live2D Load Failed:", e);
        }
    }

    async handleSend() {
        // 🔥🔥🔥 新增：只要发送消息，就强制停止地球自转
        if (typeof window.stopEarthRotation === 'function') {
            window.stopEarthRotation();
        }
        
        const text = this.dom.input.value.trim();
        if (!text) return;

        this.addMessage('user', text);
        this.dom.input.value = '';
        this.dom.input.style.height = 'auto'; 
        
        const thinkingId = this.addMessage('system', 'Thinking... 🧠');
        if (this.model) this.model.motion('Tap'); 

        try {
            const response = await fetch('http://localhost:3000/api/plan-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    specificPlaces: text, 
                    interests: [],        
                    duration: "4h"        
                })
            });

            const result = await response.json();
            
            const thinkingNode = document.getElementById(thinkingId);
            if(thinkingNode) thinkingNode.remove();

            if (result.success && result.data) {
                const { reasoning, route } = result.data; 

                // 构建路线清单
                let routeListText = "";
                if (route && route.length > 0) {
                    routeListText = route.map((stop, index) => {
                        const timeStr = stop.visit_time ? ` (${stop.visit_time})` : "";
                        return `\n${index + 1}. ${stop.name}${timeStr}`;
                    }).join("");
                }

                // 组装回复
                let replyText = reasoning;
                if (route && route.length > 0) {
                    replyText += `\n\n📍 **Plan:**${routeListText}`;
                    
                    // 调用 RoutePlanner 画图
                    if (window.UserCenter && window.UserCenter.routePlanner) {
                        window.UserCenter.routePlanner.visualizeRoute(route);
                    }
                }

                this.addMessage('system', replyText);
                if (this.model) this.model.motion('Tap');

            } else {
                this.addMessage('system', "Sorry, I couldn't understand that.");
            }

        } catch (e) {
            console.error(e);
            const thinkingNode = document.getElementById(thinkingId);
            if(thinkingNode) thinkingNode.remove();
            this.addMessage('system', "Server Offline 🔌");
        }
    }

    addMessage(type, text) {
        if (!this.dom.history) return null;
        const div = document.createElement('div');
        div.className = `msg ${type}`;
        div.textContent = text;
        div.id = 'msg-' + Date.now();
        this.dom.history.appendChild(div);
        this.dom.history.scrollTop = this.dom.history.scrollHeight;
        return div.id;
    }
}