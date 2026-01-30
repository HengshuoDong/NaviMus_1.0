// // src/plugins/RouteOverlay.js
// import * as Cesium from 'cesium';

// export default class RouteOverlay {
//     constructor(viewer) {
//         this.viewer = viewer;
//         this.svg = document.getElementById('route-overlay-layer');
//         this.routePoints = []; 
//         this.isActive = false;
//         this.currentPathEl = null;

//         // 绑定渲染循环：地图一动，线就得跟着动
//         this.viewer.scene.postRender.addEventListener(() => this.update());
//     }

//     /**
//      * 🎬 开始动画流程
//      * @param {Array} routeData - 后端返回的路线数组 [{name: "BMW"}, {name: "Deutsches..."}]
//      * @param {Object} allEntities - Cesium GeoJSON entities values
//      */
//     animateRoute(routeData, allEntities) {
//         this.isActive = true;
//         this.routePoints = [];
//         this.svg.innerHTML = ''; // 清空旧画布

//         console.log("🎨 Overlay: Starting animation for", routeData);

//         // 1. 找到所有点的 3D 坐标
//         routeData.forEach(stop => {
//             // 模糊匹配名字
//             const entity = allEntities.find(e => 
//                 e.properties && e.properties.name && 
//                 e.properties.name.getValue().toLowerCase().includes(stop.name.toLowerCase())
//             );
            
//             if (entity) {
//                 const pos = entity.position.getValue(this.viewer.clock.currentTime);
//                 this.routePoints.push(pos);
//             }
//         });

//         if (this.routePoints.length < 2) return;

//         // 2. 飞到最佳视角 (确保点都在屏幕内)
//         const boundingSphere = Cesium.BoundingSphere.fromPoints(this.routePoints);
//         this.viewer.camera.flyToBoundingSphere(boundingSphere, {
//             duration: 1.5,
//             offset: new Cesium.HeadingPitchRange(0, -Cesium.Math.PI_OVER_FOUR, boundingSphere.radius * 2.5),
//             complete: () => {
//                 // 3. 视角到位后，开始画线
//                 this.playAnimeSequence();
//             }
//         });
//     }

//     playAnimeSequence() {
//         // 创建 SVG Path
//         const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
//         pathEl.setAttribute("stroke", "#D90429"); // 你的主题红
//         pathEl.setAttribute("stroke-width", "4");
//         pathEl.setAttribute("fill", "none");
//         pathEl.setAttribute("stroke-linecap", "round");
//         pathEl.setAttribute("filter", "drop-shadow(0 0 8px rgba(217, 4, 41, 0.8))"); // 发光效果
//         this.svg.appendChild(pathEl);

//         this.currentPathEl = pathEl;
//         this.updatePathD(); // 初始绘制一次

//         // Anime.js: 线条生长动画 + 循环呼吸
//         anime({
//             targets: pathEl,
//             strokeDashoffset: [anime.setDashoffset, 0],
//             easing: 'easeInOutSine',
//             duration: 2000,
//             direction: 'alternate',
//             loop: true
//         });

//         // 绘制端点圆圈
//         this.routePoints.forEach((pos, index) => {
//             const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
//             circle.setAttribute("r", "0");
//             circle.setAttribute("fill", "#fff");
//             circle.setAttribute("stroke", "#D90429");
//             circle.setAttribute("stroke-width", "3");
//             this.svg.appendChild(circle);

//             // 存入 domElement 以便 update 更新位置
//             // 这里简单处理，实际上应该建立一个对象数组映射
//             pos._svgCircle = circle; 

//             // 弹跳出现
//             anime({
//                 targets: circle,
//                 r: 8,
//                 delay: 1500 + (index * 500),
//                 duration: 800,
//                 easing: 'spring(1, 80, 10, 0)'
//             });
//         });
//     }

//     update() {
//         if (!this.isActive || this.routePoints.length < 2 || !this.currentPathEl) return;

//         // 将 3D 世界坐标转为 2D 屏幕坐标
//         const screenPoints = this.routePoints.map(pos => 
//             Cesium.SceneTransforms.wgs84ToWindowCoordinates(this.viewer.scene, pos)
//         );

//         // 如果有点在屏幕背面 (undefined)，暂停渲染防止乱画
//         if (screenPoints.some(p => !p)) return;

//         // 生成 SVG Path 字符串 (M x y L x y ...)
//         const d = screenPoints.reduce((acc, p, i) => {
//             return acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
//         }, "");

//         this.currentPathEl.setAttribute("d", d);

//         // 更新端点位置
//         this.routePoints.forEach((pos, i) => {
//             const p = screenPoints[i];
//             if (pos._svgCircle) {
//                 pos._svgCircle.setAttribute("cx", p.x);
//                 pos._svgCircle.setAttribute("cy", p.y);
//             }
//         });
//     }
    
//     clear() {
//         this.isActive = false;
//         this.svg.innerHTML = '';
//     }
// }


// src/plugins/RoutePlanner.js

import * as Cesium from 'cesium';

// 🎨 1. 动态生成一个“发光箭头”的 Canvas 图片
// 这样你就不需要找图片文件了，代码自动生成
function createGlowingArrowCanvas() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const center = size / 2;
    
    // 调整坐标系：Cesium 默认旋转 0 度是指向“上方”
    // 所以我们画一个指向上方的箭头
    ctx.translate(center, center);

    // A. 绘制外部发光 (Glow)
    ctx.shadowColor = '#D90429'; // 你的主题红
    ctx.shadowBlur = 25; // 发光模糊半径

    // B. 绘制箭头形状
    ctx.fillStyle = '#FFFFFF'; // 纯白核心
    ctx.beginPath();
    ctx.moveTo(0, -50); // 顶点
    ctx.lineTo(40, 40); // 右下角
    ctx.lineTo(0, 20);  // 底部内凹点
    ctx.lineTo(-40, 40); // 左下角
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
        
        console.log("🗺️ RoutePlanner: Entity Animation Mode Ready");
    }

    async generateRoute(preferences) {
        // ... (保持和之前一样的 AI 请求逻辑)
        // 为了简洁，这里省略 fetch 部分，只保留 result 处理
        // 请保留你原有的 generateRoute 代码，重点是最后调用 this.visualizeRoute(route)
        
        // 假设这里是请求代码...
        // const result = await response.json();
        // this.visualizeRoute(result.data.route);
        
        // 👇 这是一个模拟的占位符，请用你真实的代码替换它
        console.error("⚠️ 请保留你原有的 generateRoute fetch 逻辑！");
    }
    
    // 为了防止你复制粘贴出错，我把你之前的 generateRoute 完整补在这里
    async generateRoute(preferences) {
        if (window.AgentController) {
            window.AgentController.addMessage('system', 'Thinking... 🧠');
            if (window.AgentController.userRole === 'guest') {
                window.AgentController.setUserRole('user');
            }
        }

        try {
            const response = await fetch('http://localhost:3000/api/plan-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferences)
            });
            const result = await response.json();

            if (result.success && result.data) {
                const { route } = result.data;
                this.visualizeRoute(route);
            } else {
                if (window.AgentController) 
                    window.AgentController.addMessage('system', "Sorry, I got confused.");
            }
        } catch (error) {
            console.error("Route Error:", error);
            if (window.AgentController) 
                window.AgentController.addMessage('system', "Server connection failed.");
        }
    }

    /**
     * 🎨 核心：绘制路线 + 启动实体动画
     */
    visualizeRoute(routeList) {
        this.resetMapVisuals(); 

        if (!this.dataSource) return;

        const entities = this.dataSource.entities.values;
        const waypoints = []; // 存储所有路线点的 3D 坐标
        const matchedIds = new Set(); 
        const now = Cesium.JulianDate.now();

        console.log("🔍 Visualizing Route with Entity Animation...");

        // 1. 存档原始图标状态 (用于后续恢复)
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

        // 2. 匹配路线并收集坐标点
        routeList.forEach((stop, index) => {
            const aiName = stop.name.trim().toLowerCase();
            let targetEntity = entities.find(e => {
                let name = e.name || "";
                if (e.properties?.general?.getValue(now)?.name) name = e.properties.general.getValue(now).name;
                return name.trim().toLowerCase().includes(aiName);
            });

            if (targetEntity) {
                matchedIds.add(targetEntity.id);
                const position = targetEntity.position.getValue(now);
                
                // 简单去重：如果两个点距离太近(<5米)，就不添加了
                if (waypoints.length === 0 || Cesium.Cartesian3.distance(waypoints[waypoints.length-1], position) > 5) {
                    waypoints.push(position);
                }

                // 添加静态标记 (红点 + 数字)
                this.addStaticMarker(position, index + 1);
            }
        });

        // 3. 视觉降噪 (未选中的变暗)
        entities.forEach(entity => {
            if (entity.billboard) {
                if (matchedIds.has(entity.id)) {
                    // 恢复原始高亮
                    if (this.originalStats.has(entity.id)) {
                        const original = this.originalStats.get(entity.id);
                        entity.billboard.color = original.color; 
                        entity.billboard.scale = 1.0; 
                    }
                } else {
                    // 变暗
                    entity.billboard.color = new Cesium.Color(1.0, 1.0, 1.0, 0.2); 
                    entity.billboard.scale = 0.5; 
                }
            }
        });

        // 4. 画静态连接线 (虚线)
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
            
            // 🔥🔥🔥 5. 启动箭头动画
            this.startEntityAnimation(waypoints);
        }

        // 6. 调整视角
        if (waypoints.length > 0) {
            const boundingSphere = Cesium.BoundingSphere.fromPoints(waypoints);
            this.viewer.camera.flyToBoundingSphere(boundingSphere, {
                offset: new Cesium.HeadingPitchRange(0, -Cesium.Math.PI_OVER_FOUR, boundingSphere.radius * 2.5),
                duration: 2
            });
        }
    }

    /**
     * 🔥 核心动画逻辑：使用 CallbackProperty 驱动 Entity
     */
    startEntityAnimation(waypoints) {
        if (waypoints.length < 2) return;

        // A. 预计算路段信息
        let totalDistance = 0;
        const segments = []; // 存每一段的 { startDist, length, p1, p2 }

        for (let i = 0; i < waypoints.length - 1; i++) {
            const p1 = waypoints[i];
            const p2 = waypoints[i+1];
            const dist = Cesium.Cartesian3.distance(p1, p2);
            segments.push({
                startDist: totalDistance,
                length: dist,
                p1: p1,
                p2: p2
            });
            totalDistance += dist;
        }

        // B. 动画参数
        const DURATION = 10000; // 跑完全程需要 10000 毫秒 (10秒)
        const startTime = Date.now();

        // C. 创建箭头 Entity
        const arrowEntity = this.viewer.entities.add({
            // 1. 动态位置
            position: new Cesium.CallbackProperty(() => {
                const now = Date.now();
                // 计算进度 0.0 ~ 1.0 (取余数实现循环)
                const timeProgress = ((now - startTime) % DURATION) / DURATION;
                const currentDist = timeProgress * totalDistance;

                // 找到当前在哪一段
                let seg = segments.find(s => currentDist >= s.startDist && currentDist < s.startDist + s.length);
                if (!seg) seg = segments[segments.length - 1]; // 防止溢出

                // 计算段内进度
                const segProgress = (currentDist - seg.startDist) / seg.length;

                // 线性插值计算坐标
                return Cesium.Cartesian3.lerp(seg.p1, seg.p2, segProgress, new Cesium.Cartesian3());
            }, false),

            // 2. 动态旋转 (始终车头朝前)
            billboard: {
                image: ARROW_URI, // 使用 Canvas 生成的图片
                scale: 0.8,
                color: Cesium.Color.WHITE,
                // 抬高一点点，防止被红线盖住，或者被地面遮挡
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, 
                pixelOffset: new Cesium.Cartesian2(0, -10), // 微调
                disableDepthTestDistance: Number.POSITIVE_INFINITY, // 永远在最上层，不被建筑遮挡
                
                // 旋转逻辑
                rotation: new Cesium.CallbackProperty(() => {
                    const now = Date.now();
                    const timeProgress = ((now - startTime) % DURATION) / DURATION;
                    const currentDist = timeProgress * totalDistance;

                    let seg = segments.find(s => currentDist >= s.startDist && currentDist < s.startDist + s.length);
                    if (!seg) seg = segments[segments.length - 1];

                    // 计算方位角 (Bearing)
                    // 将 Cartesian3 转为 Cartographic (经纬度)
                    const c1 = Cesium.Cartographic.fromCartesian(seg.p1);
                    const c2 = Cesium.Cartographic.fromCartesian(seg.p2);

                    const y = Math.sin(c2.longitude - c1.longitude) * Math.cos(c2.latitude);
                    const x = Math.cos(c1.latitude) * Math.sin(c2.latitude) -
                              Math.sin(c1.latitude) * Math.cos(c2.latitude) * Math.cos(c2.longitude - c1.longitude);
                    const bearing = Math.atan2(y, x);

                    // Cesium Billboard 旋转是以正北为 0，顺时针为正
                    // 数学计算的 bearing 通常是以正北为 0，顺时针为正
                    // 需要取反并加上校正值，通常是 -bearing + PI/2
                    return -bearing + Cesium.Math.PI_OVER_TWO;
                }, false),
                
                alignedAxis: Cesium.Cartesian3.UNIT_Z // 绕 Z 轴旋转
            }
        });

        this.routeEntities.push(arrowEntity);
    }

    // 辅助：添加红点和数字
    addStaticMarker(position, number) {
        // 红点
        this.routeEntities.push(this.viewer.entities.add({
            position: position,
            point: {
                pixelSize: 16,
                color: Cesium.Color.fromCssColorString('#D90429'),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        }));
        // 数字
        this.routeEntities.push(this.viewer.entities.add({
            position: position,
            label: {
                text: `${number}`,
                font: 'bold 16px sans-serif',
                fillColor: Cesium.Color.WHITE,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 4,
                outlineColor: Cesium.Color.fromCssColorString('#D90429'),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -15),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        }));
    }

    resetMapVisuals() {
        // 清理所有 Entity
        this.routeEntities.forEach(e => this.viewer.entities.remove(e));
        this.routeEntities = [];

        // 恢复图标颜色
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
    
    // 兼容旧接口
    clearRoute() {
        this.resetMapVisuals();
    }
}