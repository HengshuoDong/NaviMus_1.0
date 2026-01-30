// // // src/plugins/RoutePlanner.js

// // import * as Cesium from 'cesium';

// // export default class RoutePlanner {
// //     constructor(viewer, dataSource) {
// //         this.viewer = viewer;
// //         this.dataSource = dataSource;
// //         this.routeEntities = []; 
        
// //         // 🔥 新增：用于存储博物馆原本的颜色和大小
// //         this.originalStats = new Map(); 
        
// //         console.log("🗺️ RoutePlanner: Service Initialized");
// //     }

// //     async generateRoute(preferences) {
// //         console.log("🤖 RoutePlanner: Calling AI...", preferences);
        
// //         if (window.AgentController) {
// //             window.AgentController.addMessage('system', 'Thinking... 🧠');
// //             if (window.AgentController.userRole === 'guest') {
// //                 window.AgentController.setUserRole('user');
// //             }
// //         }

// //         try {
// //             const response = await fetch('http://localhost:3000/api/plan-route', {
// //                 method: 'POST',
// //                 headers: { 'Content-Type': 'application/json' },
// //                 body: JSON.stringify(preferences)
// //             });
// //             const result = await response.json();

// //             if (result.success && result.data) {
// //                 const { reasoning, route } = result.data;
                
// //                 // Agent 说话逻辑交给 NaviAgent 自己处理，这里专注地图
// //                 this.visualizeRoute(route);

// //             } else {
// //                 if (window.AgentController) 
// //                     window.AgentController.addMessage('system', "Sorry, I got confused.");
// //             }
// //         } catch (error) {
// //             console.error("Route Error:", error);
// //             if (window.AgentController) 
// //                 window.AgentController.addMessage('system', "Server connection failed.");
// //         }
// //     }

// //     /**
// //      * 🎨 画路线 + 视觉降噪
// //      */
// //     visualizeRoute(routeList) {
// //         // 1. 先恢复之前的状态（如果有的话），确保我们在干净的画布上操作
// //         this.resetMapVisuals(); 

// //         if (!this.dataSource) return;

// //         const entities = this.dataSource.entities.values;
// //         const waypoints = [];
// //         const matchedIds = new Set(); 
// //         const now = Cesium.JulianDate.now();

// //         console.log("🔍 Starting Visual Matching...");

// //         // 🔥 2. 关键步骤：在修改任何东西之前，先存档！
// //         // 只有第一次运行到这里时，Entities 还是 main.js 设置的原始彩色状态
// //         entities.forEach(entity => {
// //             if (entity.billboard && !this.originalStats.has(entity.id)) {
// //                 // 获取当前颜色（这时的颜色是正确的分类颜色）
// //                 let currentColor = entity.billboard.color;
// //                 if (currentColor && currentColor.getValue) {
// //                     currentColor = currentColor.getValue(now);
// //                 }
                
// //                 // 获取当前大小
// //                 let currentScale = entity.billboard.scale;
// //                 if (currentScale && currentScale.getValue) {
// //                     currentScale = currentScale.getValue(now);
// //                 }

// //                 // 存入 Map
// //                 this.originalStats.set(entity.id, {
// //                     color: currentColor ? currentColor.clone() : Cesium.Color.WHITE.clone(),
// //                     scale: currentScale || 0.6
// //                 });
// //             }
// //         });

// //         // 3. 匹配逻辑 (找出哪些是路线上的点)
// //         routeList.forEach((stop, index) => {
// //             const aiName = stop.name.trim().toLowerCase();
// //             let targetEntity = null;

// //             const getEntityName = (e) => {
// //                 let name = e.name || "";
// //                 if (e.properties && e.properties.general) {
// //                     const g = e.properties.general.getValue(now);
// //                     if (g && g.name) name = g.name;
// //                 }
// //                 return name.trim().toLowerCase();
// //             };

// //             // 精确匹配 -> 模糊匹配
// //             targetEntity = entities.find(e => getEntityName(e) === aiName);
// //             if (!targetEntity) {
// //                 targetEntity = entities.find(e => getEntityName(e).includes(aiName));
// //             }

// //             if (targetEntity) {
// //                 matchedIds.add(targetEntity.id);
// //                 const position = targetEntity.position.getValue(now);
// //                 waypoints.push(position);

// //                 // 添加红点
// //                 this.routeEntities.push(this.viewer.entities.add({
// //                     position: position,
// //                     point: {
// //                         pixelSize: 20,
// //                         color: Cesium.Color.fromCssColorString('#D90429'),
// //                         outlineColor: Cesium.Color.WHITE,
// //                         outlineWidth: 2,
// //                         disableDepthTestDistance: Number.POSITIVE_INFINITY,
// //                         heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
// //                     }
// //                 }));

// //                 // 添加数字
// //                 this.routeEntities.push(this.viewer.entities.add({
// //                     position: position,
// //                     label: {
// //                         text: `${index + 1}`,
// //                         font: 'bold 16px sans-serif',
// //                         fillColor: Cesium.Color.WHITE,
// //                         style: Cesium.LabelStyle.FILL_AND_OUTLINE,
// //                         outlineWidth: 4,
// //                         outlineColor: Cesium.Color.fromCssColorString('#D90429'),
// //                         verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
// //                         pixelOffset: new Cesium.Cartesian2(0, -15),
// //                         disableDepthTestDistance: Number.POSITIVE_INFINITY,
// //                         heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
// //                     }
// //                 }));
// //             }
// //         });

// //         // 4. 视觉降噪 (Dimming)
// //         entities.forEach(entity => {
// //             if (entity.billboard) {
// //                 if (matchedIds.has(entity.id)) {
// //                     // 选中项：读取原始颜色并设为完全不透明 (Restore original color)
// //                     if (this.originalStats.has(entity.id)) {
// //                         const original = this.originalStats.get(entity.id);
// //                         entity.billboard.color = original.color; // 使用原始分类颜色
// //                         entity.billboard.scale = 1.0; // 稍微放大
// //                     }
// //                 } else {
// //                     // 未选中项：变暗变小 (Dimmed)
// //                     // 这里我们还是用白色做底色加透明度，或者用原始颜色加透明度
// //                     // 简单起见，用半透明白让它退居幕后
// //                     entity.billboard.color = new Cesium.Color(1.0, 1.0, 1.0, 0.2); 
// //                     entity.billboard.scale = 0.5; 
// //                 }
// //             }
// //         });

// //         // 5. 画线
// //         if (waypoints.length > 1) {
// //             this.routeEntities.push(this.viewer.entities.add({
// //                 polyline: {
// //                     positions: waypoints,
// //                     width: 5,
// //                     material: new Cesium.PolylineDashMaterialProperty({
// //                         color: Cesium.Color.fromCssColorString('#D90429'),
// //                         dashLength: 20.0
// //                     }),
// //                     clampToGround: true 
// //                 }
// //             }));
// //         }

// //         // 6. 飞行
// //         if (waypoints.length > 0) {
// //             const boundingSphere = Cesium.BoundingSphere.fromPoints(waypoints);
// //             this.viewer.camera.flyToBoundingSphere(boundingSphere, {
// //                 offset: new Cesium.HeadingPitchRange(0, -Cesium.Math.PI_OVER_FOUR*2, boundingSphere.radius * 2.5),
// //                 duration: 2
// //             });
// //         }
// //     }

// //     /**
// //      * 🔥 修正：恢复地图状态 (Unsupervised Mode)
// //      * 使用 originalStats 恢复原本的分类颜色
// //      */
// //     resetMapVisuals() {
// //         // 1. 清除红线、数字标签
// //         this.routeEntities.forEach(e => this.viewer.entities.remove(e));
// //         this.routeEntities = [];

// //         // 2. 恢复所有博物馆图标
// //         if (this.dataSource) {
// //             const entities = this.dataSource.entities.values;
// //             entities.forEach(entity => {
// //                 if (entity.billboard) {
// //                     // 只有当我们在 originalStats 里存过，说明我们修改过它，才需要恢复
// //                     // 如果没存过，说明它还是原始状态，不要动它（防止变成白色）
// //                     if (this.originalStats.has(entity.id)) {
// //                         const stats = this.originalStats.get(entity.id);
// //                         entity.billboard.color = stats.color; // 恢复原始分类颜色
// //                         entity.billboard.scale = stats.scale; // 恢复原始大小
// //                     }
// //                 }
// //             });
// //         }
        
// //         console.log("🔄 Map Visuals Restored to Original Categories");
// //     }
    
// //     // 兼容旧代码
// //     clearRoute() {
// //         this.resetMapVisuals();
// //     }
// // }

// // src/plugins/RoutePlanner.js

// import * as Cesium from 'cesium';

// // 1. 动态生成“发光箭头” Canvas
// function createGlowingArrowCanvas() {
//     // 稍微缩小画布尺寸，也可以帮助减小视觉大小
//     const size = 96; 
//     const canvas = document.createElement('canvas');
//     canvas.width = size;
//     canvas.height = size;
//     const ctx = canvas.getContext('2d');
    
//     const center = size / 2;
    
//     // 调整坐标系，让箭头画在中心，指向上方
//     ctx.translate(center, center);

//     // A. 绘制外部发光 (Glow)
//     ctx.shadowColor = '#D90429'; // 主题红
//     ctx.shadowBlur = 20; // 发光半径略微减小

//     // B. 绘制箭头形状 (指向上方)
//     ctx.fillStyle = '#FFFFFF'; 
//     ctx.beginPath();
//     // 稍微调整箭头比例，让它更修长一点
//     ctx.moveTo(0, -40); // 顶点
//     ctx.lineTo(30, 30); // 右下角
//     ctx.lineTo(0, 15);  // 底部内凹点
//     ctx.lineTo(-30, 30); // 左下角
//     ctx.closePath();
//     ctx.fill();

//     return canvas.toDataURL();
// }

// const ARROW_URI = createGlowingArrowCanvas();

// export default class RoutePlanner {
//     constructor(viewer, dataSource) {
//         this.viewer = viewer;
//         this.dataSource = dataSource;
//         this.routeEntities = []; 
//         this.originalStats = new Map(); 
        
//         console.log("🗺️ RoutePlanner: Entity Animation Mode Ready (Fine-tuned)");
//     }

//     // ... (generateRoute 方法保持不变，为了节省篇幅省略) ...
//     async generateRoute(preferences) {
//         if (window.AgentController) {
//             window.AgentController.addMessage('system', 'Thinking... 🧠');
//             if (window.AgentController.userRole === 'guest') window.AgentController.setUserRole('user');
//         }
//         try {
//             const response = await fetch('http://localhost:3000/api/plan-route', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(preferences)
//             });
//             const result = await response.json();
//             if (result.success && result.data) {
//                 this.visualizeRoute(result.data.route);
//             } else {
//                 if (window.AgentController) window.AgentController.addMessage('system', "Sorry, I got confused.");
//             }
//         } catch (error) {
//             console.error("Route Error:", error);
//             if (window.AgentController) window.AgentController.addMessage('system', "Server connection failed.");
//         }
//     }

//     /**
//      * 🎨 核心：绘制路线 + 启动实体动画
//      */
//     visualizeRoute(routeList) {
//         this.resetMapVisuals(); 

//         if (!this.dataSource) return;

//         const entities = this.dataSource.entities.values;
//         const waypoints = []; 
//         const matchedIds = new Set(); 
//         const now = Cesium.JulianDate.now();

//         console.log("🔍 Visualizing Route with Fine-tuned Arrow...");

//         // 1. 存档原始图标状态
//         entities.forEach(entity => {
//             if (entity.billboard && !this.originalStats.has(entity.id)) {
//                 let c = entity.billboard.color;
//                 if (c && c.getValue) c = c.getValue(now);
//                 let s = entity.billboard.scale;
//                 if (s && s.getValue) s = s.getValue(now);

//                 this.originalStats.set(entity.id, {
//                     color: c ? c.clone() : Cesium.Color.WHITE.clone(),
//                     scale: s || 0.6
//                 });
//             }
//         });

//         // 2. 匹配路线并收集坐标点
//         routeList.forEach((stop, index) => {
//             const aiName = stop.name.trim().toLowerCase();
//             let targetEntity = entities.find(e => {
//                 let name = e.name || "";
//                 if (e.properties?.general?.getValue(now)?.name) name = e.properties.general.getValue(now).name;
//                 return name.trim().toLowerCase().includes(aiName);
//             });

//             if (targetEntity) {
//                 matchedIds.add(targetEntity.id);
//                 const position = targetEntity.position.getValue(now);
                
//                 if (waypoints.length === 0 || Cesium.Cartesian3.distance(waypoints[waypoints.length-1], position) > 5) {
//                     waypoints.push(position);
//                 }

//                 // 添加静态标记
//                 this.addStaticMarker(position, index + 1);
//             }
//         });

//         // 3. 视觉降噪
//         entities.forEach(entity => {
//             if (entity.billboard) {
//                 if (matchedIds.has(entity.id)) {
//                     if (this.originalStats.has(entity.id)) {
//                         const original = this.originalStats.get(entity.id);
//                         entity.billboard.color = original.color; 
//                         entity.billboard.scale = 1.0; 
//                     }
//                 } else {
//                     entity.billboard.color = new Cesium.Color(1.0, 1.0, 1.0, 0.2); 
//                     entity.billboard.scale = 0.5; 
//                 }
//             }
//         });

//         // 4. 画连接线
//         if (waypoints.length > 1) {
//             this.routeEntities.push(this.viewer.entities.add({
//                 polyline: {
//                     positions: waypoints,
//                     width: 5,
//                     material: new Cesium.PolylineDashMaterialProperty({
//                         color: Cesium.Color.fromCssColorString('#D90429'),
//                         dashLength: 20.0
//                     }),
//                     clampToGround: true 
//                 }
//             }));
            
//             // 启动动画
//             this.startEntityAnimation(waypoints);
//         }

//         // 6. 调整视角
//         if (waypoints.length > 0) {
//             const boundingSphere = Cesium.BoundingSphere.fromPoints(waypoints);
//             this.viewer.camera.flyToBoundingSphere(boundingSphere, {
//                 offset: new Cesium.HeadingPitchRange(0, -Cesium.Math.PI_OVER_FOUR * 2, boundingSphere.radius * 2.5),
//                 duration: 2
//             });
//         }
//     }

//     /**
//      * 🔥 核心动画逻辑 (微调版)
//      */
//     startEntityAnimation(waypoints) {
//         if (waypoints.length < 2) return;

//         let totalDistance = 0;
//         const segments = []; 
//         for (let i = 0; i < waypoints.length - 1; i++) {
//             const p1 = waypoints[i];
//             const p2 = waypoints[i+1];
//             const dist = Cesium.Cartesian3.distance(p1, p2);
//             segments.push({ startDist: totalDistance, length: dist, p1: p1, p2: p2 });
//             totalDistance += dist;
//         }

//         const DURATION = 10000; 
//         const startTime = Date.now();

//         const arrowEntity = this.viewer.entities.add({
//             // 1. 动态位置 (不变)
//             position: new Cesium.CallbackProperty(() => {
//                 const now = Date.now();
//                 const timeProgress = ((now - startTime) % DURATION) / DURATION;
//                 const currentDist = timeProgress * totalDistance;
//                 let seg = segments.find(s => currentDist >= s.startDist && currentDist < s.startDist + s.length);
//                 if (!seg) seg = segments[segments.length - 1];
//                 const segProgress = (currentDist - seg.startDist) / seg.length;
//                 return Cesium.Cartesian3.lerp(seg.p1, seg.p2, segProgress, new Cesium.Cartesian3());
//             }, false),

//             // 2. 动态旋转 & 大小调整
//             billboard: {
//                 image: ARROW_URI, 
//                 // 🔥 修改点 1：缩小尺寸
//                 scale: 0.5,  // 原来是 0.8，现在改小到 0.5，您可以继续微调这个值
                
//                 color: Cesium.Color.WHITE,
//                 heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, 
//                 pixelOffset: new Cesium.Cartesian2(0, -5), // 偏移量也相应减小
//                 disableDepthTestDistance: Number.POSITIVE_INFINITY, 
                
//                 // 🔥 修改点 2：修正方向
//                 rotation: new Cesium.CallbackProperty(() => {
//                     const now = Date.now();
//                     const timeProgress = ((now - startTime) % DURATION) / DURATION;
//                     const currentDist = timeProgress * totalDistance;
//                     let seg = segments.find(s => currentDist >= s.startDist && currentDist < s.startDist + s.length);
//                     if (!seg) seg = segments[segments.length - 1];

//                     // 计算方位角
//                     const c1 = Cesium.Cartographic.fromCartesian(seg.p1);
//                     const c2 = Cesium.Cartographic.fromCartesian(seg.p2);
//                     const y = Math.sin(c2.longitude - c1.longitude) * Math.cos(c2.latitude);
//                     const x = Math.cos(c1.latitude) * Math.sin(c2.latitude) -
//                               Math.sin(c1.latitude) * Math.cos(c2.latitude) * Math.cos(c2.longitude - c1.longitude);
//                     const bearing = Math.atan2(y, x);

//                     // 🔥 关键修改：去掉了 + Cesium.Math.PI_OVER_TWO
//                     // 如果之前的方向歪了90度，去掉这个应该就正了。
//                     return -bearing; 
//                 }, false),
                
//                 alignedAxis: Cesium.Cartesian3.UNIT_Z 
//             }
//         });

//         this.routeEntities.push(arrowEntity);
//     }

//     // 辅助：添加红点和数字 (保持不变)
//     addStaticMarker(position, number) {
//         this.routeEntities.push(this.viewer.entities.add({
//             position: position,
//             point: {
//                 pixelSize: 16, color: Cesium.Color.fromCssColorString('#D90429'),
//                 outlineColor: Cesium.Color.WHITE, outlineWidth: 2,
//                 heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
//             }
//         }));
//         this.routeEntities.push(this.viewer.entities.add({
//             position: position,
//             label: {
//                 text: `${number}`, font: 'bold 16px sans-serif',
//                 fillColor: Cesium.Color.WHITE, style: Cesium.LabelStyle.FILL_AND_OUTLINE,
//                 outlineWidth: 4, outlineColor: Cesium.Color.fromCssColorString('#D90429'),
//                 verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -15),
//                 heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
//             }
//         }));
//     }

//     resetMapVisuals() {
//         this.routeEntities.forEach(e => this.viewer.entities.remove(e));
//         this.routeEntities = [];
//         if (this.dataSource) {
//             const entities = this.dataSource.entities.values;
//             entities.forEach(entity => {
//                 if (entity.billboard && this.originalStats.has(entity.id)) {
//                     const stats = this.originalStats.get(entity.id);
//                     entity.billboard.color = stats.color; 
//                     entity.billboard.scale = stats.scale; 
//                 }
//             });
//         }
//         console.log("🔄 Map Visuals Restored");
//     }
//     clearRoute() { this.resetMapVisuals(); }
// }


// src/plugins/RoutePlanner.js

import * as Cesium from 'cesium';

// 1. 动态生成“发光箭头” Canvas
function createGlowingArrowCanvas() {
    const size = 96; 
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const center = size / 2;
    ctx.translate(center, center);

    // 发光
    ctx.shadowColor = '#D90429'; 
    ctx.shadowBlur = 20; 

    // 箭头形状
    ctx.fillStyle = '#FFFFFF'; 
    ctx.beginPath();
    ctx.moveTo(0, -40); 
    ctx.lineTo(30, 30); 
    ctx.lineTo(0, 15);  
    ctx.lineTo(-30, 30); 
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL();
}

const ARROW_URI = createGlowingArrowCanvas();

export default class RoutePlanner {
    constructor(viewer, dataSource) {
        this.viewer = viewer;
        this.dataSource = dataSource;
        this.routeEntities = []; 
        this.originalStats = new Map(); 
        console.log("🗺️ RoutePlanner: Smart Matching Ready");
    }

    async generateRoute(preferences) {
        if (window.AgentController) {
            window.AgentController.addMessage('system', 'Thinking... 🧠');
            if (window.AgentController.userRole === 'guest') window.AgentController.setUserRole('user');
        }
        try {
            const response = await fetch('http://localhost:3000/api/plan-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferences)
            });
            const result = await response.json();
            if (result.success && result.data) {
                this.visualizeRoute(result.data.route);
            } else {
                if (window.AgentController) window.AgentController.addMessage('system', "Sorry, I got confused.");
            }
        } catch (error) {
            console.error("Route Error:", error);
            if (window.AgentController) window.AgentController.addMessage('system', "Server connection failed.");
        }
    }

    /**
     * 🔥 核心修复：更智能的模糊匹配算法
     */
    findBestMatchingEntity(entities, aiName) {
        const search = aiName.trim().toLowerCase();
        let bestEntity = null;
        let maxScore = -1;

        const now = Cesium.JulianDate.now();

        entities.forEach(entity => {
            // 获取实体的名字
            let name = entity.name || "";
            if (entity.properties && entity.properties.general) {
                const g = entity.properties.general.getValue(now);
                if (g && g.name) name = g.name;
            }
            const target = name.trim().toLowerCase();

            // --- 评分逻辑 ---
            let score = 0;

            if (target === search) {
                // 1. 完全相等：最高分
                score = 100;
            } else if (target.startsWith(search)) {
                // 2. 以它开头：次高分 (比如搜 "BMW", 匹配 "BMW Museum")
                score = 80;
            } else if (target.includes(search)) {
                // 3. 包含：及格分 (比如搜 "Deutsches", 匹配 "Sudetendeutsches")
                score = 50;
            } else {
                // 不匹配
                return;
            }

            // 4. 长度惩罚 (关键！)
            // 目标名字越长，分数扣得越多。
            // 例子：搜 "Deutsches Museum"
            // "Deutsches Museum" (长度差0) -> 100分
            // "Sudetendeutsches Museum" (长度差8) -> 50 - 8 = 42分
            const lengthDiff = Math.abs(target.length - search.length);
            score -= lengthDiff; 

            // 更新最佳匹配
            if (score > maxScore) {
                maxScore = score;
                bestEntity = entity;
            }
        });

        return bestEntity;
    }

    visualizeRoute(routeList) {
        this.resetMapVisuals(); 

        if (!this.dataSource) return;

        const entities = this.dataSource.entities.values;
        const waypoints = []; 
        const matchedIds = new Set(); 
        const now = Cesium.JulianDate.now();

        console.log("🔍 Visualizing Route (Smart Match)...");

        // 1. 存档原始状态
        entities.forEach(entity => {
            if (entity.billboard && !this.originalStats.has(entity.id)) {
                let c = entity.billboard.color;
                if (c && c.getValue) c = c.getValue(now);
                let s = entity.billboard.scale;
                if (s && s.getValue) s = s.getValue(now);

                this.originalStats.set(entity.id, {
                    color: c ? c.clone() : Cesium.Color.WHITE.clone(),
                    scale: s || 0.6
                });
            }
        });

        // 2. 匹配路线
        routeList.forEach((stop, index) => {
            // 🔥 使用新的匹配函数
            const targetEntity = this.findBestMatchingEntity(entities, stop.name);

            if (targetEntity) {
                matchedIds.add(targetEntity.id);
                const position = targetEntity.position.getValue(now);
                
                if (waypoints.length === 0 || Cesium.Cartesian3.distance(waypoints[waypoints.length-1], position) > 5) {
                    waypoints.push(position);
                }

                this.addStaticMarker(position, index + 1);
            } else {
                console.warn(`⚠️ Could not find location for: ${stop.name}`);
            }
        });

        // 3. 视觉降噪
        entities.forEach(entity => {
            if (entity.billboard) {
                if (matchedIds.has(entity.id)) {
                    if (this.originalStats.has(entity.id)) {
                        const original = this.originalStats.get(entity.id);
                        entity.billboard.color = original.color; 
                        entity.billboard.scale = 1.0; 
                    }
                } else {
                    entity.billboard.color = new Cesium.Color(1.0, 1.0, 1.0, 0.2); 
                    entity.billboard.scale = 0.5; 
                }
            }
        });

        // 4. 连接线与动画
        if (waypoints.length > 1) {
            this.routeEntities.push(this.viewer.entities.add({
                polyline: {
                    positions: waypoints,
                    width: 5,
                    material: new Cesium.PolylineDashMaterialProperty({
                        color: Cesium.Color.fromCssColorString('#D90429'),
                        dashLength: 20.0
                    }),
                    clampToGround: true 
                }
            }));
            
            this.startEntityAnimation(waypoints);
        }

        // 5. 视角飞行
        if (waypoints.length > 0) {
            const boundingSphere = Cesium.BoundingSphere.fromPoints(waypoints);
            this.viewer.camera.flyToBoundingSphere(boundingSphere, {
                offset: new Cesium.HeadingPitchRange(0, -Cesium.Math.PI_OVER_FOUR * 2, boundingSphere.radius * 2.5),
                duration: 2
            });
        }
    }

    startEntityAnimation(waypoints) {
        if (waypoints.length < 2) return;

        let totalDistance = 0;
        const segments = []; 
        for (let i = 0; i < waypoints.length - 1; i++) {
            const p1 = waypoints[i];
            const p2 = waypoints[i+1];
            const dist = Cesium.Cartesian3.distance(p1, p2);
            segments.push({ startDist: totalDistance, length: dist, p1: p1, p2: p2 });
            totalDistance += dist;
        }

        const DURATION = 10000; 
        const startTime = Date.now();

        const arrowEntity = this.viewer.entities.add({
            position: new Cesium.CallbackProperty(() => {
                const now = Date.now();
                const timeProgress = ((now - startTime) % DURATION) / DURATION;
                const currentDist = timeProgress * totalDistance;
                let seg = segments.find(s => currentDist >= s.startDist && currentDist < s.startDist + s.length);
                if (!seg) seg = segments[segments.length - 1];
                const segProgress = (currentDist - seg.startDist) / seg.length;
                return Cesium.Cartesian3.lerp(seg.p1, seg.p2, segProgress, new Cesium.Cartesian3());
            }, false),

            billboard: {
                image: ARROW_URI, 
                scale: 0.5, 
                color: Cesium.Color.WHITE,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, 
                pixelOffset: new Cesium.Cartesian2(0, -5), 
                disableDepthTestDistance: Number.POSITIVE_INFINITY, 
                
                rotation: new Cesium.CallbackProperty(() => {
                    const now = Date.now();
                    const timeProgress = ((now - startTime) % DURATION) / DURATION;
                    const currentDist = timeProgress * totalDistance;
                    let seg = segments.find(s => currentDist >= s.startDist && currentDist < s.startDist + s.length);
                    if (!seg) seg = segments[segments.length - 1];

                    const c1 = Cesium.Cartographic.fromCartesian(seg.p1);
                    const c2 = Cesium.Cartographic.fromCartesian(seg.p2);
                    const y = Math.sin(c2.longitude - c1.longitude) * Math.cos(c2.latitude);
                    const x = Math.cos(c1.latitude) * Math.sin(c2.latitude) -
                              Math.sin(c1.latitude) * Math.cos(c2.latitude) * Math.cos(c2.longitude - c1.longitude);
                    const bearing = Math.atan2(y, x);
                    return -bearing; 
                }, false),
                
                alignedAxis: Cesium.Cartesian3.UNIT_Z 
            }
        });
        this.routeEntities.push(arrowEntity);
    }

    addStaticMarker(position, number) {
        this.routeEntities.push(this.viewer.entities.add({
            position: position,
            point: {
                pixelSize: 16, color: Cesium.Color.fromCssColorString('#D90429'),
                outlineColor: Cesium.Color.WHITE, outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        }));
        this.routeEntities.push(this.viewer.entities.add({
            position: position,
            label: {
                text: `${number}`, font: 'bold 16px sans-serif',
                fillColor: Cesium.Color.WHITE, style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 4, outlineColor: Cesium.Color.fromCssColorString('#D90429'),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -15),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        }));
    }

    resetMapVisuals() {
        this.routeEntities.forEach(e => this.viewer.entities.remove(e));
        this.routeEntities = [];
        if (this.dataSource) {
            const entities = this.dataSource.entities.values;
            entities.forEach(entity => {
                if (entity.billboard && this.originalStats.has(entity.id)) {
                    const stats = this.originalStats.get(entity.id);
                    entity.billboard.color = stats.color; 
                    entity.billboard.scale = stats.scale; 
                }
            });
        }
        console.log("🔄 Map Visuals Restored");
    }
    clearRoute() { this.resetMapVisuals(); }
}