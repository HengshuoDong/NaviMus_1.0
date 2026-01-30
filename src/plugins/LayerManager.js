// src/plugins/LayerManager.js
import { 
    UrlTemplateImageryProvider, 
    ArcGisMapServerImageryProvider, 
    OpenStreetMapImageryProvider, // 👈 1. 新增这个引用
    GoogleMaps,
    Cesium3DTileset
} from 'cesium';

export default class LayerManager {
    constructor() {
        this.viewer = null;
        this.layerOSM = null;
        this.layerSat = null;
        this.googleTileset = null;
        this.isGoogleMode = false;
        
        // 配置参数
        this.BLEND_HEIGHT_START = 200000; 
        this.BLEND_HEIGHT_END = 100000;   
    }

    // 1. 初始化 (改为 async !)
    async init(viewer) {
        this.viewer = viewer;
        
        try {
            // // A. 准备开源底图 (OSM / CartoDB) - 这个可以用 new
            // const providerOSM = new UrlTemplateImageryProvider({
            //     url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            //     subdomains: ['a', 'b', 'c', 'd']
            // });

            // // ✅ 2. 换成标准 OSM (彩色版)
            // const providerOSM = new OpenStreetMapImageryProvider({
            //     url : 'https://a.tile.openstreetmap.org/'
            // });

            // ✅ 换成 Esri 国家地理风格
            const providerOSM = await ArcGisMapServerImageryProvider.fromUrl(
                'https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer'
                // 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
            );
            
            // B. 准备开源底图 (卫星) - ⚠️ 关键修改：必须用 await fromUrl
            const providerSat = await ArcGisMapServerImageryProvider.fromUrl(
                'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
                // 'https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer'
            );

            // C. 添加到 Viewer (注意顺序：先加卫星，再加OSM)
            this.layerSat = viewer.imageryLayers.addImageryProvider(providerSat);
            this.layerOSM = viewer.imageryLayers.addImageryProvider(providerOSM);
            
            // 初始状态
            this.layerSat.alpha = 0.0; 
            this.layerOSM.alpha = 1.0; 

            // D. 绑定渲染事件
            this.viewer.scene.preRender.addEventListener(() => {
                if (this.isGoogleMode) return; 
                this.updateBlending();
            });

            console.log("🧩 LayerManager: Layers loaded successfully.");

        } catch (err) {
            console.error("❌ LayerManager Init Failed:", err);
        }
    }

    // 2. 核心逻辑：根据高度计算透明度 (保持不变)
    updateBlending() {
        if (!this.layerOSM || !this.layerSat) return; // 保护一下

        const cameraHeight = this.viewer.camera.positionCartographic.height;
        let ratio = (cameraHeight - this.BLEND_HEIGHT_END) / (this.BLEND_HEIGHT_START - this.BLEND_HEIGHT_END);
        
        if (ratio > 1.0) ratio = 1.0;
        if (ratio < 0.0) ratio = 0.0;

        this.layerOSM.alpha = ratio;      
        this.layerSat.alpha = 1.0 - ratio; 
    }

    // 3. 切换模式 (保持不变)
    async toggleGoogleMode(enable) {
        this.isGoogleMode = enable;

        if (enable) {
            // ... (Google 模式逻辑) ...
            console.log("🔒 Switching to Google...");
            if (this.layerOSM) this.layerOSM.show = false;
            if (this.layerSat) this.layerSat.show = false;
            this.viewer.scene.globe.show = false;

            if (!this.googleTileset) {
                try {
                    GoogleMaps.defaultApiKey = 'YOUR_GOOGLE_API_KEY'; // 记得填 Key
                    this.googleTileset = await Cesium3DTileset.fromUrl(
                        "https://tile.googleapis.com/v1/3dtiles/root.json"
                    );
                    this.viewer.scene.primitives.add(this.googleTileset);
                } catch (err) {
                    console.error("Google Load Failed", err);
                    return;
                }
            }
            this.googleTileset.show = true;
        } else {
            // ... (开源模式逻辑) ...
            console.log("🔓 Back to Open Source...");
            if (this.googleTileset) this.googleTileset.show = false;
            this.viewer.scene.globe.show = true;
            if (this.layerOSM) this.layerOSM.show = true;
            if (this.layerSat) this.layerSat.show = true;
            this.updateBlending(); 
        }
    }
}