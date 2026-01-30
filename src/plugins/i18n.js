// src/plugins/i18n.js

export default class I18nManager {
    constructor() {
        this.currentLang = 'en'; // 默认语言
        
        // 📚 字典：基于你的 index.html 内容定制
        this.dictionary = {
            en: {
                // --- 侧边栏按钮 ---
                "mode_guided": "Fully Guided Exploration",
                "mode_semi": "Semi Guided Exploration",
                "mode_free": "Free Exploration",

                // --- 全辅助模式 (Guided) ---
                "header_spatial": "1. Spatial Filters",
                "btn_add_location": "+ Add Location",
                "header_semantic": "2. Semantic Filters",
                "btn_query": "Query",
                "btn_add_condition": "+", // 那个小加号

                // --- 半辅助模式 (Semi) ---
                "label_destination": "Destination:",
                "placeholder_semi": "e.g. Science Museum",
                "btn_navigate": "Navigate",
                "btn_thinking": "Thinking...", // JS动态状态

                // --- 结果面板 ---
                "header_results": "Query Results",
                "no_results": "No results found",

                // --- 辅助控件 (图例/开关) ---
                "legend_title": "Legend",
                "legend_selected": "Selected",
                "legend_museum": "Museum",
                "legend_city": "City Area",
                "google_mode": "Google 3D Mode",

                // --- 动态按钮 (JS中用到) ---
                "btn_deactivate_ai": "Deactivate AI",
                "btn_activate_ai": "Activate AI",

                // --- Agent 对话框 (初始欢迎语) ---
                "agent_name": "Navi-AI",
                "agent_welcome": "Hello! I am the collective consciousness of this museum space. How can I guide your research today?",
                "placeholder_agent": "Type your learning goal...",
                "agent_reset_result": "×",

                // 当前状态栏
                "mode_label": "Current Mode: ",

                "legend_level_continent": "Continent Level",
                "legend_level_country": "Country Level",
                "legend_level_city": "City Level",

                // --- 图例分类 ---
                "legend_type_title": "Museum Types",
                "cat_arts": "Arts & Culture",
                "cat_history": "History & Society",
                "cat_science": "Science & Tech",
                "cat_nature": "Nature & Env",
                "cat_general": "General & Service",
                "cat_unknown": "Other / Unknown"

                
            },
            zh: {
                "mode_guided": "全辅助导览模式",
                "mode_semi": "AI 半辅助模式",
                "mode_free": "自由探索模式",

                "header_spatial": "1. 空间筛选",
                "btn_add_location": "+ 添加地点",
                "header_semantic": "2. 语义筛选",
                "btn_query": "查询",
                "btn_add_condition": "+",

                "label_destination": "目的地:",
                "placeholder_semi": "例：科学博物馆",
                "btn_navigate": "开始导航",
                "btn_thinking": "思考中...",

                "header_results": "查询结果",
                "no_results": "未找到结果",

                "legend_title": "图例",
                "legend_selected": "选中高亮",
                "legend_museum": "博物馆",
                "legend_city": "城市区域",
                "google_mode": "谷歌3D模式",

                "btn_deactivate_ai": "关闭AI助手",
                "btn_activate_ai": "激活AI助手",

                "agent_name": "Navi-AI 助手",
                "agent_welcome": "您好！我是这座博物馆空间的集体意识。今天我能为您做什么？",
                "placeholder_agent": "输入您的探索目标...",
                "agent_reset_result": "×",
                "mode_label": "当前模式: ",

                "legend_level_continent": "大洲层级",
                "legend_level_country": "国家层级",
                "legend_level_city": "城市层级",

                "legend_type_title": "博物馆分类",
                "cat_arts": "艺术与文化",
                "cat_history": "历史与社会",
                "cat_science": "科技与工业",
                "cat_nature": "自然与环境",
                "cat_general": "综合与服务",
                "cat_unknown": "其他 / 未知"
            },
            de: {
                "mode_guided": "Geführte Erkundung",
                "mode_semi": "KI-Assistenz",
                "mode_free": "Freie Erkundung",

                "header_spatial": "1. Räumliche Filter",
                "btn_add_location": "+ Ort hinzufügen",
                "header_semantic": "2. Semantische Filter",
                "btn_query": "Suchen",
                "btn_add_condition": "+",

                "label_destination": "Zielort:",
                "placeholder_semi": "z.B. Deutsches Museum",
                "btn_navigate": "Navigieren",
                "btn_thinking": "Nachdenken...",

                "header_results": "Ergebnisse",
                "no_results": "Keine Ergebnisse",

                "legend_title": "Legende",
                "legend_selected": "Ausgewählt",
                "legend_museum": "Museum",
                "legend_city": "Stadtgebiet",
                "google_mode": "Google 3D Modus",

                "btn_deactivate_ai": "KI Deaktivieren",
                "btn_activate_ai": "KI Aktivieren",

                "agent_name": "Navi-KI",
                "agent_welcome": "Hallo! Ich bin das kollektive Bewusstsein dieses Museums. Wie kann ich helfen?",
                "placeholder_agent": "Geben Sie Ihr Ziel ein...",
                "agent_reset_result": "×",
                "mode_label": "Aktueller Modus: ",

                "legend_level_continent": "Kontinent-Ebene",
                "legend_level_country": "Länder-Ebene",
                "legend_level_city": "Stadt-Ebene",

                "legend_type_title": "Museumstypen",
                "cat_arts": "Kunst & Kultur",
                "cat_history": "Geschichte & Gesellschaft",
                "cat_science": "Wissenschaft & Technik",
                "cat_nature": "Natur & Umwelt",
                "cat_general": "Allgemeines & Service",
                "cat_unknown": "Sonstige / Unbekannt"
            }
        };
    }

    t(key) {
        const text = this.dictionary[this.currentLang][key];
        return text || key;
    }

    setLanguage(lang) {
        if (!this.dictionary[lang]) return;
        this.currentLang = lang;
        console.log(`🌐 Language switched to: ${lang}`);
        this.updatePage();
    }

    // updatePage() {
    //     const texts = this.dictionary[this.currentLang];
        
    //     // 1. 更新所有 data-i18n 元素
    //     document.querySelectorAll('[data-i18n]').forEach(el => {
    //         const key = el.getAttribute('data-i18n');
    //         if (texts[key]) {
    //             if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    //                 el.placeholder = texts[key];
    //             } else {
    //                 // 如果里面有图标span，要小心不要覆盖它 (针对 Sidebar 按钮)
    //                 // 你的 HTML 结构是 <span class="text">...</span>，直接改这个 span 即可
    //                 el.textContent = texts[key];
    //             }
    //         }
    //         // ✅ 必须有这行，才能通知 main.js 刷新动态按钮
    //         window.dispatchEvent(new CustomEvent('lang-change', { detail: this.currentLang }));
    //     });

    //     // 2. 刷新一些特殊的 JS 动态按钮
    //     this.refreshDynamicElements(texts);
    // }
    updatePage() {
        const texts = this.dictionary[this.currentLang];
        
        // 1. 更新所有静态 data-i18n 元素
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (texts[key]) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = texts[key];
                } else {
                    el.textContent = texts[key];
                }
            }
        });

        // 2. ✅ 发送广播通知 main.js (移到循环外面！)
        // 告诉 main.js: "语言字典已经换了，你把那些动态按钮刷新一下"
        window.dispatchEvent(new CustomEvent('lang-change', { detail: this.currentLang }));
        
        // ❌ 删除 refreshDynamicElements 调用
        // ❌ 删除 refreshDynamicElements 函数定义
        // 让 main.js 自己去处理，不要在这里瞎猜
    }

    // refreshDynamicElements(texts) {
    //     // 刷新登录按钮
    //     const loginBtn = document.getElementById('mock-login-btn');
    //     if (loginBtn) {
    //         // 简单判断当前是 Guest 还是 User (这里只是更新文字，不改逻辑)
    //         const isGuest = loginBtn.textContent.includes('Guest') || loginBtn.textContent.includes('访客') || loginBtn.textContent.includes('Gast');
    //         loginBtn.textContent = isGuest ? texts['btn_deactivate_ai'] : texts['btn_activate_ai'];
    //     }
    // }
}