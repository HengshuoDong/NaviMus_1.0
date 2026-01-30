import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import './style.css'
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { Viewer, 
        Ion, 
        GeoJsonDataSource,
        ScreenSpaceEventHandler,
        ScreenSpaceEventType,
        Color,
        BillboardGraphics,
        HeightReference,
        DistanceDisplayCondition,
        HeadingPitchRange,
        CallbackProperty,
        // 👇 新增这两个
        Cartesian2,
        Cartesian3,
        // 👇 新增这三个
        LabelStyle,
        VerticalOrigin,
        HorizontalOrigin,
        Cartographic
} from 'cesium';
import UserGuidePlugin from './plugins/UserGuide.js';
import LayerManager from './plugins/LayerManager.js'; // 👈 新增
import I18nManager from './plugins/i18n.js';
import UserCenter from './plugins/UserCenter.js';
import RoutePlanner from './plugins/RoutePlanner.js';
import NaviAgent from './plugins/NaviAgent.js'; // 导入新插件


// 🌍 1. 初始化 i18n
const i18n = new I18nManager();
window.i18n = i18n; // 暴露给 HTML 里的 onclick 使用


// // --- AI 服务中心 ---
const AIService = {
  isBusy: false, // 全局忙碌锁

  /**
   * 统一的 AI 请求接口
   * @param {string} query - 用户输入
   * @returns {Promise<object|null>} - 返回解析后的位置数据或 null
   */
  async ask(query) {
    if (this.isBusy) {
      console.warn('[AI Service] AI 正在思考中，请稍候...');
      alert("AI 正在思考中，请等待上一条回复完成。");
      return null;
    }

    this.isBusy = true;
    
    // 触发全局 UI 状态更新 (可选: 让所有相关按钮变灰)
    document.body.style.cursor = 'wait';

    try {
      console.log(`[AI Service] 发送请求: "${query}"`);
      
      const response = await fetch('http://localhost:3000/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query })
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const json = await response.json();
      return json.success ? json.data : null;

    } catch (err) {
      console.error('[AI Service] 请求失败:', err);
      alert("连接 AI 服务超时或失败，请检查 Ollama 是否运行。");
      return null;
    } finally {
      this.isBusy = false;
      document.body.style.cursor = 'default';
    }
  }
};


// --- 应用状态 ---
const appState = {
  currentMode: 'free',
  selectedEntity: null,
  lastInputs: { guided: null, semi: '' },
  tippyInstance: null
};

let viewer;
let museumDataSource;
let resultsList;
let resultsPanel;
let spatialHierarchy = {};

const domSemantic = {
  container: document.getElementById('query-builder-container'),
  btnAdd: document.getElementById('add-condition-btn'), // 语义加号
  btnQuery: document.getElementById('apply-filter-btn'),
  btnReset: document.getElementById('reset-all-btn')
};

// --- 4级缩放常量 ---
const DIST_LEVEL_4 = new DistanceDisplayCondition(0.0, 30000.0);
const DIST_LEVEL_3 = new DistanceDisplayCondition(30000.0, 300000.0);
const DIST_LEVEL_2 = new DistanceDisplayCondition(150000.0, 3500000.0);
const DIST_LEVEL_1 = new DistanceDisplayCondition(3500000.0, Number.MAX_VALUE);

// Define the list of available categories based on your data
const AVAILABLE_CATEGORIES = [
  "Agriculture", "Archaeology", "Architecture", "Archives", "Art", 
  "Automotive", "Crafts", "Culture", "Design", "Economy", 
  "Education", "Ethnology", "Family", "History", "Literature", 
  "Medicine", "Memorial", "Monument", "Nature", "Photography", 
  "Religion", "Research", "Science", "Service", "Social", 
  "Sports", "Technology", "Theater"
];


// 1. 语义大类映射表
const CATEGORY_MAPPING = {
    // --- Group 1: Arts & Culture ---
    "Art": "Arts & Culture",
    "Architecture": "Arts & Culture",
    "Crafts": "Arts & Culture",
    "Culture": "Arts & Culture",
    "Design": "Arts & Culture",
    "Literature": "Arts & Culture",
    "Theater": "Arts & Culture",
    "Photography": "Arts & Culture",
    
    // --- Group 2: History & Society ---
    "History": "History & Society",
    "Archaeology": "History & Society",
    "Ethnology": "History & Society",
    "Religion": "History & Society",
    "Archives": "History & Society",
    "Memorial": "History & Society",
    "Monument": "History & Society",
    "Family": "History & Society",
    "Social": "History & Society",

    // --- Group 3: Science & Tech ---
    "Science": "Science & Tech",
    "Technology": "Science & Tech",
    "Automotive": "Science & Tech",
    "Medicine": "Science & Tech",
    "Research": "Science & Tech",
    "Economy": "Science & Tech",

    // --- Group 4: Nature ---
    "Nature": "Nature & Env",
    "Agriculture": "Nature & Env",

    // --- Group 5: Others ---
    "Service": "General",
    "Education": "General",
    "Sports": "General",

    "": "Unknown"
  };

// 2. 颜色定义 (高饱和度，适合暗黑地图)
const SUPER_CATEGORY_COLORS = {
    "Arts & Culture":    "#FF006E", // 洋红
    "History & Society": "#FB5607", // 橙色
    "Science & Tech":    "#3A86FF", // 蓝色
    "Nature & Env":      "#8338EC", // 紫色
    "General":           "#FFBE0B", // 黄色
    "Unknown":           "#CCCCCC"  // 灰色
};

const CATEGORY_I18N_MAP = {
    "Arts & Culture":    "cat_arts",
    "History & Society": "cat_history",
    "Science & Tech":    "cat_science",
    "Nature & Env":      "cat_nature",
    "General":           "cat_general",
    "Unknown":           "cat_unknown"
};

const PIN_ICON = "./map_marker.svg";
// 📌 1. 外框路径 (定位针形状)
const PATH_PIN = "M12 2C7.589 2 4 5.589 4 10s0 10 8 12c8 -2 8 -8 8 -12s-3.589 -8 -8 -8z";

// 🏛️ 2. 内容路径 (博物馆/神庙图标)
// 我已经调整了大小和位置，让它正好居中显示在 Pin 的肚子里
// const PATH_MUSEUM = "M7.5 7l-5 2.5v1h10v-1l-5-2.5zm-4 8h2v-4h-2v4zm4 0h2v-4h-2v4zm4 0h2v-4h-2v4zm-8 2h10v1h-10v-1z";
const PATH_MUSEUM = "M12 7L6 11H18L12 7ZM7 12H9V16H7V12ZM11 12H13V16H11V12ZM15 12H17V16H15V12ZM6 17H18V19H6V17Z";

// 🎨 动态生成"彩色外壳 + 白色神庙"的图标
function createMuseumPinCanvas(colorCss) {
    const canvas = document.createElement('canvas');
    canvas.width = 48; 
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    
    ctx.scale(2, 2); 

    // A. 画彩色外框
    const pPin = new Path2D(PATH_PIN);
    ctx.fillStyle = colorCss; 
    ctx.fill(pPin);

    // B. 画白色神庙 (通过这里唯一的参数控制对齐)
    ctx.save();
    
    // 👇 这里是调整神庙位置的唯一地方！
    // 建议设为 (4, 4) 或者 (3.5, 4.5)，你可以微调这俩数字直到地图上的点完美为止
    // 之前的 5.5 可能太低了，我们改回 4
    ctx.translate(1, 0); 
    
    ctx.scale(0.9, 0.9); // 稍微缩放一点，留出边缘呼吸感
    
    const pMuseum = new Path2D(PATH_MUSEUM);
    ctx.fillStyle = '#000000';
    ctx.fill(pMuseum);
    
    ctx.restore();
    
    return canvas;
}

// 辅助函数：获取分类颜色
function getCategoryColor(subCategory) {
    // 处理数组情况 (有些博物馆可能有多个标签，取第一个)
    const key = Array.isArray(subCategory) ? subCategory[0] : subCategory;
    const superCat = CATEGORY_MAPPING[key] || "Unknown";
    return Color.fromCssColorString(SUPER_CATEGORY_COLORS[superCat]);
}

// --- 核心功能函数定义 ---

function clearSelection() {
  if (appState.selectedEntity) {
    if (appState.selectedEntity.billboard) {
      appState.selectedEntity.billboard.scale = 0.5;
      // appState.selectedEntity.billboard.color = Color.WHITE;
    }
  }
  appState.selectedEntity = null;
  if (viewer) viewer.selectedEntity = undefined;
  if (appState.tippyInstance) appState.tippyInstance.hide();
}

function selectMuseum(entity) {
  clearSelection();
  appState.selectedEntity = entity;
  viewer.selectedEntity = entity;
  
  if (entity.billboard) {
    entity.billboard.scale = 1.0;
    // entity.billboard.color = Color.fromCssColorString('#D90429');
  }

  const props = entity.properties;
  const general = props.general.getValue();
  const online = props.online.getValue();
  const offline = props.offline.getValue();

  // 1. 处理分类字段 (防止是数组或为空)
  // 如果是数组就用逗号连接，如果是字符串直接显示，如果没有则显示 Unknown
  let catText = 'Unknown';
  if (general.category) {
      catText = Array.isArray(general.category) ? general.category.join(', ') : general.category;
  }

  const query = encodeURIComponent(general.name);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

  const htmlContent = `
    <div style="padding: 10px; max-width: 250px; font-family: sans-serif; background-color: #2c2c2e; color: #ffffff;">
      <h3 style="font-size: 1.1em; margin-bottom: 5px; color: #D90429;">${general.name}</h3>
      <div style="font-size: 0.8em; color: #aaa; margin-bottom: 8px; font-style: italic;">
        ${catText}
      </div>
      <p style="font-size: 0.9em; margin-bottom: 8px;">${general.description}</p>
      <hr style="border: 0; border-top: 1px solid #555; margin: 8px 0;">
      <p style="font-size: 0.8em; margin: 5px 0;">
        <strong>Address:</strong> ${offline.address}
      </p>
      ${online.website ? `<a href="${online.website}" target="_blank" rel="noopener noreferrer" style="color: #007bff; font-size: 0.9em; text-decoration: none;">Visit Website</a>` : ''}
      <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="color: #4285F4; font-size: 0.9em; text-decoration: none;">
           📍 Open in Google Maps
      </a>
      </div>
  `;

  appState.tippyInstance.setContent(htmlContent);
  appState.tippyInstance.show();

  // 列表联动高亮
  const oldActive = document.querySelector('#results-list li.active');
  if (oldActive) oldActive.classList.remove('active');
  const newActive = document.querySelector(`#results-list li[data-id="${entity.id}"]`);
  if (newActive) {
    newActive.classList.add('active');
    newActive.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function switchMode(newMode) {
  if (appState.currentMode === newMode) return;
  appState.currentMode = newMode;
  console.log(`Switched to ${newMode} mode.`);
  clearSelection();
  
  // const modeIndicator = document.getElementById('mode-indicator');
  // if (modeIndicator) {
  //   let friendlyName = '';
  //   switch (newMode) {
  //     case 'free': friendlyName = 'Free Exploration'; break;
  //     case 'guided': friendlyName = 'Fully Guided Exploration'; break;
  //     case 'semi': friendlyName = 'Semi Guided Exploration'; break;
  //   }
  //   modeIndicator.textContent = `Current Mode: ${friendlyName}`;
  // }
  updateModeIndicator();
  
  const entities = museumDataSource.entities.values;
  // 根据模式控制显示逻辑
  if (newMode === 'free' || newMode === 'semi') {
    entities.forEach(entity => { entity.show = true; });
    // Free 模式隐藏结果栏
    const resultsPanel = document.getElementById('results-panel');
    if (resultsPanel) resultsPanel.classList.add('hidden');
  } else {
    // Guided/Semi 模式先隐藏所有点，等待查询
    entities.forEach(entity => { entity.show = false; });
    // 如果结果栏有内容，则显示
    const resultsList = document.getElementById('results-list');
    const resultsPanel = document.getElementById('results-panel');
    if (resultsList && resultsList.children.length > 0) {
        resultsPanel.classList.remove('hidden');
    }
  }
}

// // 辅助函数：在所有 Polygon 数据源中查找目标实体
  // function findPolygonByName(name) {
  //   if (!name || name === 'all') return null;

  //   // 优先级：城市 (详细) > 国家 > 大洲 (宏观)
  //   let target = null;
    
  //   // 1. 先查慕尼黑 (Level 3)
  //   if (dsMunich) {
  //     // 注意：我们在加载时把名字设为了 'Munich'，或者你可以根据具体行政区名查找
  //     target = dsMunich.entities.values.find(e => 
  //       e.properties.name && e.properties.name.getValue() === name
  //     );
  //   }
    
  //   // 2. 查德国 (Level 2)
  //   if (!target && dsGermany) {
  //     target = dsGermany.entities.values.find(e => 
  //       e.properties.name && e.properties.name.getValue() === name
  //     );
  //   }
    
  //   // 3. 查欧洲 (Level 1)
  //   if (!target && dsEurope) {
  //     target = dsEurope.entities.values.find(e => 
  //       e.properties.name && e.properties.name.getValue() === name
  //     );
  //   }

  //   return target;
  // }
  // --- 辅助函数：在所有 Polygon 数据源中查找目标实体 (增强版) ---
  function findPolygonByName(name) {
    if (!name || name === 'all') return null;

    const searchName = name.trim().toLowerCase();

    // 内部匹配函数：兼容各种乱七八糟的字段名
    const isMatch = (entity) => {
        // 1. 安全检查
        if (!entity.properties) return false;

        // 2. 候选字段列表 (你可以根据 GeoJSON 的实际情况往里加)
        // 比如 ArcGIS 导出常是大写 NAME/CONTINENT，其他数据源可能是 admin/sovereignt
        const keys = ['name', 'Name', 'NAME', 'CONTINENT', 'continent', 'city', 'CITY', 'admin', 'sovereignt'];

        for (const key of keys) {
            if (entity.properties.hasProperty(key)) {
                // 获取值并转字符串比对
                const val = entity.properties[key].getValue();
                if (val && String(val).toLowerCase() === searchName) {
                    return true;
                }
            }
        }
        return false;
    };

    // 优先级：城市 (详细) > 国家 > 大洲 (宏观)
    let target = null;
    
    // 1. 先查慕尼黑 (Level 3)
    if (dsMunich) {
      target = dsMunich.entities.values.find(isMatch);
    }
    
    // 2. 查德国 (Level 2)
    if (!target && dsGermany) {
      target = dsGermany.entities.values.find(isMatch);
    }
    
    // 3. 查欧洲 (Level 1)
    if (!target && dsEurope) {
      target = dsEurope.entities.values.find(isMatch);
    }

    return target;
  }

// --- 辅助函数：飞行控制 (修复 ReferenceError) ---
  function flyToLocation(name, level) {
      // 1. 先找到地图上的实体
      const target = findPolygonByName(name);
      
      if (!target) {
          console.warn(`找不到名为 ${name} 的区域，无法飞行`);
          return;
      }

      // 2. 根据层级决定飞多高 (单位：米)
      let range = 50000; // 默认城市高度 (50km)
      
      if (level === 'country') {
          range = 200000; // 国家高度 (2000km)
      } else if (level === 'continent') {
          range = 5000000; // 大洲高度 (10000km)
      }

      // 3. 执行飞行
      viewer.flyTo(target, {
          duration: 1.5,
          offset: new HeadingPitchRange(0, -Math.PI / 2, range) // 垂直俯视
      });
  }



  // --- 3. 核心：动态添加“横向”空间行 (修复级联版) ---
  function addSpatialRow() {
    const row = document.createElement('div');
    row.className = 'spatial-row'; 
    
    // 使用之前的 createSelect 辅助函数
    const selContinent = createSelect('Continent');
    const selCountry = createSelect('Country', true); // 默认禁用
    const selCity = createSelect('City', true);       // 默认禁用

    const btnDel = document.createElement('button');
    btnDel.className = 'spatial-remove-btn';
    btnDel.innerHTML = '&times;';
    btnDel.onclick = () => {
      row.remove();
      // 如果删光了，自动补一行，保证至少有一个
      const container = document.getElementById('spatial-builder-container');
      if (container && container.children.length === 0) addSpatialRow();
    };

    // --- A. 初始化大洲下拉菜单 ---
    // Object.keys 获取所有大洲名
    fillSelect(selContinent, new Set(Object.keys(spatialHierarchy)));

    // --- B. 定义飞行函数 (复用你之前的逻辑) ---
    const smartFlyTo = (name, level) => {
      const target = findPolygonByName(name);
      if (!target) return;
      
      let offset = undefined;
      if (level === 'city') {
        offset = new HeadingPitchRange(0, -Math.PI / 2, 50000);
      } else if (level === 'country') {
        offset = new HeadingPitchRange(0, -Math.PI/2, 2000000);
      } else if (level === 'continent') {
        offset = new HeadingPitchRange(0, -Math.PI/2, 10000000);
      }
      viewer.flyTo(target, { duration: 1.5, offset: offset });
    };

    // --- C. 事件绑定 (级联逻辑) ---

    // 1. 大洲 -> 筛选国家
    selContinent.addEventListener('change', () => {
      const val = selContinent.value;
      const isAll = val === 'all';
      
      // 重置后两级
      resetSelect(selCountry, 'Country', isAll);
      resetSelect(selCity, 'City', true);
      
      if (!isAll && spatialHierarchy[val]) {
        // 关键：只填充该大洲下的国家
        const countries = Object.keys(spatialHierarchy[val]);
        fillSelect(selCountry, new Set(countries));
        
        smartFlyTo(val, 'continent');
      }
    });

    // 2. 国家 -> 筛选城市
    selCountry.addEventListener('change', () => {
      const valContinent = selContinent.value;
      const valCountry = selCountry.value;
      const isAll = valCountry === 'all';
      
      resetSelect(selCity, 'City', isAll);
      
      if (!isAll && spatialHierarchy[valContinent] && spatialHierarchy[valContinent][valCountry]) {
        // 关键：只填充该国家下的城市
        const cities = spatialHierarchy[valContinent][valCountry];
        fillSelect(selCity, cities); // cities 本身就是 Set
        
        smartFlyTo(valCountry, 'country');
      } else if (isAll) {
        // 如果选回 All Country，飞回大洲视图
        smartFlyTo(valContinent, 'continent');
      }
    });

    // 3. 城市 -> 飞行
    selCity.addEventListener('change', () => {
        const val = selCity.value;
        if (val !== 'all') {
            smartFlyTo(val, 'city');
        } else {
            // 如果选回 All City，飞回国家视图
            smartFlyTo(selCountry.value, 'country');
        }
    });

    // 组装
    row.appendChild(selContinent);
    row.appendChild(selCountry);
    row.appendChild(selCity);
    row.appendChild(btnDel);

    const container = document.getElementById('spatial-builder-container');
    if (container) container.appendChild(row);
  }


// --- 动态添加语义查询行 (Updated for Dropdown) ---
  function addSemanticRow() {
    const row = document.createElement('div');
    row.className = 'query-row'; // 复用之前的样式
    // 确保行本身是 Flex 布局，且垂直居中
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px'; // 增加一点元素间距
    row.style.marginBottom = '10px';
    // 1. 字段选择
    const selField = document.createElement('select');
    selField.className = 'q-field';
    selField.style.width = '83px'; 
    selField.style.flexShrink = '0'; // 防止被挤压
    selField.style.padding = '5px';
    selField.style.backgroundColor = '#333';
    selField.style.color = '#fff';
    selField.style.border = '1px solid #555';
    selField.style.borderRadius = '4px';

    const semanticFields = [
        { label: 'Category', path: 'general.category' },
        { label: 'Name', path: 'general.name' }

    ];
    
    semanticFields.forEach(f => {
        selField.innerHTML += `<option value="${f.path}">${f.label}</option>`;
    });
    
    // 2. 运算符选择
    const selOp = document.createElement('select');
    selOp.className = 'q-op';
    selOp.style.width = '83px';
    selOp.style.flexShrink = '0';
    selOp.style.padding = '5px';
    selOp.style.backgroundColor = '#333';
    selOp.style.color = '#fff';
    selOp.style.border = '1px solid #555';
    selOp.style.borderRadius = '4px';

    selOp.innerHTML = '<option value="contains">Contains</option><option value="equals">Equals</option>';
    
    // 3. 值输入区域 (动态容器)
    // 我们用一个容器来包裹，方便在 Input 和 Select 之间切换
    const valContainer = document.createElement('div');
    valContainer.style.flex = "1"; // 占满剩余空间
    valContainer.style.display = "flex";

    // 辅助：创建文本输入框 (用于 Name)
    const createTextInput = () => {
        const inp = document.createElement('input');
        inp.className = 'q-val'; // 保持类名不变，兼容 applyHybridFilter
        inp.type = 'text';
        inp.placeholder = 'Enter name...';
        inp.style.width = '100%'; // 样式适配
        return inp;
    };

    // 辅助：创建类别下拉菜单 (用于 Category)
    const createCategorySelect = () => {
        const sel = document.createElement('select');
        sel.className = 'q-val'; // 保持类名不变
        
        // 简单的内联样式，保持和 input 一致
        // sel.style.width = "100%";
        // sel.style.padding = "5px";
        // sel.style.backgroundColor = "#333";
        // sel.style.color = "#fff";
        // sel.style.border = "1px solid #555";
        // sel.style.borderRadius = "4px";

        // 添加默认选项
        sel.innerHTML = '<option value="" disabled selected>Select Category...</option>';
        
        // 填充常量数据
        AVAILABLE_CATEGORIES.sort().forEach(cat => {
            sel.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        return sel;
    };

    // 初始化：默认是 category，所以显示文本框
    valContainer.appendChild(createCategorySelect());

    // 4. 监听字段变化，切换输入方式
    selField.addEventListener('change', () => {
        valContainer.innerHTML = ''; // 清空当前输入控件
        if (selField.value === 'general.category') {
            valContainer.appendChild(createCategorySelect());
        } else {
            valContainer.appendChild(createTextInput());
        }
    });
    
    // 5. 删除按钮
    const btnDel = document.createElement('button');
    btnDel.className = 'remove-row-btn'; // 复用样式
    btnDel.textContent = '×';
    btnDel.onclick = () => row.remove();

    // 组装
    row.appendChild(selField);
    row.appendChild(selOp);
    row.appendChild(valContainer); // 注意这里放的是容器
    row.appendChild(btnDel);
    
    // 添加到主容器
    if (domSemantic && domSemantic.container) {
        domSemantic.container.appendChild(row);
    }
  }

  // // 辅助函数
  // function createSelect(placeholder, disabled = false) {
  //   const sel = document.createElement('select');
  //   sel.innerHTML = `<option value="all">${placeholder}</option>`;
  //   sel.disabled = disabled;
  //   return sel;
  // }
  // function fillSelect(select, set) {
  //   set.forEach(val => select.innerHTML += `<option value="${val}">${val}</option>`);
  // }
  function resetSelect(select, placeholder, disabled) {
    select.innerHTML = `<option value="all">${placeholder}</option>`;
    select.disabled = disabled;
  }

  
  // --- 4. 绑定事件 (修复你提到的 "没有事件绑定" 问题) ---
  // 确保在 HTML 中添加 id="add-spatial-btn"
  const spatialAddBtn = document.getElementById('add-spatial-btn');
  if (spatialAddBtn) {
    spatialAddBtn.addEventListener('click', addSpatialRow);
  }

  // // --- 2. 数据预处理 (缓存唯一值) ---
  // function extractUniqueValues() {
  //   const data = { continents: new Set(), countries: new Set(), cities: new Set() };
  //   museumDataSource.entities.values.forEach(e => {
  //     const p = e.properties.general.getValue();
  //     const continent = p.continent || 'Europe'; // 默认值
  //     data.continents.add(continent);
  //     if (p.country) data.countries.add(p.country);
  //     if (p.city) data.cities.add(p.city);
  //   });
  //   return data;
  // }
  // const cachedUniqueData = extractUniqueValues();

  // const entities = museumDataSource.entities.values;
  // if (entities.length > 0) {
  //     const e = entities[0]; // 抓第一个博物馆来看看
  //     console.log("🔥 [调试] 博物馆实体对象:", e);
  //     console.log("🔥 [调试] 属性列表 (keys):", e.properties.propertyNames);
      
  //     // 检查是否有 general 字段
  //     if (e.properties.hasProperty('general')) {
  //         console.log("✅ 发现 general 字段:", e.properties.general.getValue());
  //     } else {
  //         console.warn("❌ 没有 general 字段！属性可能是扁平的。");
  //         // 尝试直接读 continent
  //         if (e.properties.hasProperty('continent')) {
  //             console.log("✅ 发现扁平的 continent:", e.properties.continent.getValue());
  //         }
  //     }
  // } else {
  //     console.error("❌ 严重错误：实体数量为 0，GeoJSON 可能没加载成功！");
  // }

  // // --- 2. 数据预处理 (构建层级结构：大洲 -> 国家 -> 城市) ---
  // function buildHierarchy() {
  //     const hierarchy = {};
  //     const entities = museumDataSource.entities.values;
      
  //     // 调试：看看是不是实体本身就没加载到
  //     if (entities.length === 0) {
  //         console.warn("⚠️ 警告：博物馆实体数量为 0，请检查 GeoJSON 路径是否正确");
  //         return hierarchy;
  //     }

  //     entities.forEach(e => {
  //         // 🛡️ 防御性编程：每一步都检查是否存在
  //         if (!e.properties || !e.properties.general) return;
          
  //         let p;
  //         try {
  //             p = e.properties.general.getValue(viewer.clock.currentTime);
  //         } catch (err) {
  //             return; // 取值失败就跳过
  //         }

  //         if (!p) return;

  //         // 使用默认值防止 undefined
  //         const continent = p.continent || 'Unknown'; 
  //         const country = p.country || 'Unknown';
  //         const city = p.city || 'Unknown';

  //         // 1. 大洲
  //         if (!hierarchy[continent]) hierarchy[continent] = {};
          
  //         // 2. 国家
  //         if (!hierarchy[continent][country]) hierarchy[continent][country] = new Set();
          
  //         // 3. 城市
  //         hierarchy[continent][country].add(city);
  //     });
      
  //     return hierarchy;
  // }


  // --- 3. 辅助函数: 创建干净的下拉菜单 (无 Label wrapper，适配横向布局) ---
  function createSelect(placeholder, disabled = false) {
    const select = document.createElement('select');
    select.className = 'fixed-filter'; // 复用 CSS
    select.style.flex = '1'; // 确保在横向布局中均分宽度
    select.innerHTML = `<option value="all">${placeholder}</option>`;
    select.disabled = disabled;
    return select;
  }
  
  function fillSelect(select, set) {
    set.forEach(val => select.innerHTML += `<option value="${val}">${val}</option>`);
  }



  // --- 5. 修改 applyHybridFilter 支持多行空间条件 ---
  function applyHybridFilter() {
    console.log('🔍 Executing Hybrid Query...');
    
    const spatialRows = document.querySelectorAll('.spatial-row');
    const semanticRows = document.querySelectorAll('.query-row');
    const entities = museumDataSource.entities.values;
    
    let matchCount = 0;
    
    resultsList.innerHTML = ''; 

    entities.forEach(entity => {
      const props = entity.properties.general.getValue();
      
      // A. 空间检查 (OR 逻辑：只要满足其中一行)
      // 如果没有空间行，或者第一行全是默认值，则视为“全选”
      let isSpatialMatch = false;
      
      // 检查是否所有行都是默认状态 (All)
      let isAllDefault = true;
      spatialRows.forEach(row => {
          const selects = row.querySelectorAll('select');
          if (selects[0].value !== 'all') isAllDefault = false;
      });

      if (isAllDefault) {
          isSpatialMatch = true;
      } else {
          // 只要有一行匹配，就通过
          isSpatialMatch = Array.from(spatialRows).some(row => {
            const selects = row.querySelectorAll('select');
            const ctn = selects[0].value;
            const cnt = selects[1].value;
            const cty = selects[2].value;
            
            // 如果这行没选任何东西，忽略它
            if (ctn === 'all') return false;

            // 逐级检查
            if (ctn !== 'all' && props.continent !== ctn) return false;
            if (cnt !== 'all' && props.country !== cnt) return false;
            if (cty !== 'all' && props.city !== cty) return false;
            
            return true;
          });
      }

      // B. 语义检查 (AND 逻辑)
      let isSemanticMatch = true;
      if (isSpatialMatch) {
         // ... (保持你之前的语义检查代码不变) ...
         semanticRows.forEach(row => {
            semanticRows.forEach(row => {
            // 1. 获取 DOM 元素 (使用你统一后的类名)
            const elField = row.querySelector('.q-field');
            const elOp = row.querySelector('.q-op');
            const elVal = row.querySelector('.q-val');

            // 安全检查：如果找不到元素，跳过
            if (!elField || !elOp || !elVal) return;

            const fieldPath = elField.value;
            const operator = elOp.value;
            const value = elVal.value.toLowerCase();
            
            // 如果用户没填值，忽略这一行 (视为匹配)
            if (!value) return; 

            const [group, key] = fieldPath.split('.');
            
            // --- 关键安全检查开始 ---
            // 防止因为 GeoJSON 缺字段导致整个程序崩溃
            
            // 检查 1: group (如 'general') 是否存在
            if (!entity.properties || !entity.properties[group]) { 
              isSemanticMatch = false; 
              return; 
            }
            
            // 检查 2: 获取具体的值
            const props = entity.properties[group].getValue();
            const entityValue = props ? props[key] : null;
            
            // 检查 3: 如果值是 null/undefined，肯定不匹配
            if (entityValue === undefined || entityValue === null) {
              isSemanticMatch = false;
              return;
            }
            // --- 安全检查结束 ---

            // --- 比较逻辑 (就是你发的这段) ---
            let rowMatch = false;
            if (Array.isArray(entityValue)) {
              // 如果是数组 (如 Category: ['Art', 'Design'])
              rowMatch = entityValue.some(v => String(v).toLowerCase().includes(value));
            } else {
              // 如果是字符串
              const strVal = String(entityValue).toLowerCase();
              if (operator === 'equals') {
                rowMatch = (strVal === value);
              } else {
                rowMatch = strVal.includes(value);
              }
            }
            
            // AND 逻辑：只要有一行不匹配，整体就不匹配
            if (!rowMatch) isSemanticMatch = false;
          });
         });
      } else {
          isSemanticMatch = false;
      }

      // C. 结果
      const isFinalMatch = isSpatialMatch && isSemanticMatch;
      entity.show = isFinalMatch;
      if (isFinalMatch) {
          matchCount++;
          // ... (添加列表项逻辑不变) ...
          const li = document.createElement('li');
          li.textContent = props.name;
          li.dataset.id = entity.id;
          li.addEventListener('click', () => {
             selectMuseum(entity);
             viewer.flyTo(entity, { offset: new HeadingPitchRange(0, -Math.PI*5/8, 4000) });
          });
          resultsList.appendChild(li);
      }
    });
    
    // 更新 UI
    document.getElementById('results-count').textContent = `(${matchCount})`;
    if (matchCount === 0) resultsList.innerHTML = '<li>No results</li>';
    const resultsPanel = document.getElementById('results-panel');
    if (resultsPanel) resultsPanel.classList.remove('hidden');
  }
  

  // 绑定语义部分的按钮事件
  if (domSemantic.btnAdd) {
      domSemantic.btnAdd.addEventListener('click', addSemanticRow);
  }
  if (domSemantic.btnQuery) {
      domSemantic.btnQuery.addEventListener('click', applyHybridFilter);
  }




// --- 半辅助探索：AI 驱动的 GIS (修复版) ---
  const semiInput = document.getElementById('semi-search-input');
  const semiBtn = document.getElementById('semi-search-btn');

  async function handleSemanticSearch() {
    const query = semiInput.value;
    if (!query) return;

    // 🔒 检查锁
    if (AIService.isBusy) return;

    // console.log(`[Client] 🤖 正在询问 AI: "${query}"...`);
    console.log(`[Client] Start asking AI: "${query}"...`);
    semiBtn.textContent = i18n.t('btn_thinking'); // "Thinking..."
    semiBtn.disabled = true;
    try {
        

      const loc = await AIService.ask(query);


      if (loc) {
          console.log('[Client] Semi 命中:', loc);
          
          // --- 核心匹配逻辑 ---
          let targetEntity = null;
          let flyLevel = '';

          // // 1. 定义一个通用的检查函数 (放在 findLoose 内部或外部都可以)
          // const matchEntityName = (entity, targetName) => {
          //     // 🛑 安全检查1: 实体没有属性，直接跳过
          //     if (!entity.properties) return false;

          //     // 📋 候选字段名列表 (根据你的数据情况添加)
          //     // 比如 ArcGIS 导出的数据常喜欢用大写的 NAME 或 CONTINENT
          //     const candidateKeys = ['name', 'NAME', 'Name', 'CONTINENT', 'continent', 'city', 'CITY', 'country', 'COUNTRY'];

          //     for (const key of candidateKeys) {
          //         // 🛑 安全检查2: 检查是否有这个属性
          //         if (entity.properties.hasProperty(key)) {
          //             // 获取属性值 (Cesium 需要 getValue)
          //             const val = entity.properties[key].getValue();
          //             // 比对 (转成字符串并小写)
          //             if (val && String(val).toLowerCase() === targetName) {
          //                 return true; // 找到了！
          //             }
          //         }
          //     }
          //     return false; // 找了一圈都没匹配上
          // };


          // 辅助：不区分大小写的查找函数
          // const findLoose = (name) => {
          //     // if (!name) return null;
          //     // const cleanName = name.trim().toLowerCase();
          //     // // 通用检查器：安全地获取名字
          //     // const checkEntity = (e) => {
          //     //     // 🛑 关键修复：先检查 properties 和 name 是否存在
          //     //     if (!e.properties || !e.properties.name) return false;
                  
          //     //     // Cesium 的 getValue 需要当前时间，通常传 undefined 即可获取常量
          //     //     const val = e.properties.name.getValue(Cesium.JulianDate.now());
          //     //     return val && val.toString().toLowerCase() === cleanName;
          //     // };
          //     // 依次在 3 个数据源中找 (dsMunich, dsGermany, dsEurope 必须已定义)
          //     let found = null;
          //     if (dsMunich) found = dsMunich.entities.values.find(e => e.properties.name.getValue().toLowerCase() === cleanName);
          //     // if (dsMunich) found = dsMunich.entities.values.find(e => matchEntityName(e, cleanName));
          //     if (!found && dsGermany) found = dsGermany.entities.values.find(e => e.properties.name.getValue().toLowerCase() === cleanName);
          //     if (!found && dsEurope) found = dsEurope.entities.values.find(e => e.properties.name.getValue().toLowerCase() === cleanName);
          //     return found;
          // };

          // // 1. 尝试匹配城市
          // if (loc.city) {
          //     targetEntity = findLoose(loc.city);
          //     if (targetEntity) flyLevel = 'city';
          // }
          // // 2. 没找到城市，尝试匹配国家
          // if (!targetEntity && loc.country) {
          //     targetEntity = findLoose(loc.country);
          //     if (targetEntity) flyLevel = 'country';
          // }
          // // 3. 没找到国家，尝试匹配大洲
          // if (!targetEntity && loc.continent) {
          //     targetEntity = findLoose(loc.continent);
          //     if (targetEntity) flyLevel = 'continent';
          // }

          // 🔥 核心修复：直接使用全局的 findPolygonByName
          // 不再使用那个报错的局部 findLoose 函数

          // 1. 尝试匹配城市
          if (loc.city) {
              targetEntity = findPolygonByName(loc.city);
              if (targetEntity) flyLevel = 'city';
          }
          // 2. 没找到城市，尝试匹配国家
          if (!targetEntity && loc.country) {
              targetEntity = findPolygonByName(loc.country);
              if (targetEntity) flyLevel = 'country';
          }
          // 3. 没找到国家，尝试匹配大洲
          if (!targetEntity && loc.continent) {
              targetEntity = findPolygonByName(loc.continent);
              if (targetEntity) flyLevel = 'continent';
          }

          if (targetEntity) {
            const entityName = targetEntity.properties.name ? targetEntity.properties.name.getValue() : 'Unknown Area';
            // console.log(`[Client] ✅ 命中层级: [${flyLevel}] -> ${targetEntity.properties.name.getValue()}`);
            console.log(`[Client] hits level: [${flyLevel}] -> ${targetEntity.properties.name.getValue()}`);
            // --- 飞行参数配置 ---
            let offset = undefined; // 默认自动 (国家/大洲)

            if (flyLevel === 'city') {
              // 👇 在这里修改你的城市高度！
              const CITY_HEIGHT = 40000; 
              let centerPos;
              
              console.log(`[Client] ✈️ 应用城市飞行参数: 高度 ${CITY_HEIGHT}米`);
              
              // 如果是 Polygon 实体
              if (targetEntity.polygon && targetEntity.polygon.hierarchy) {
                  const hierarchy = targetEntity.polygon.hierarchy.getValue(viewer.clock.currentTime);
                  const positions = hierarchy.positions;
                  let sumX=0, sumY=0, sumZ=0;
                  positions.forEach(p => { sumX+=p.x; sumY+=p.y; sumZ+=p.z; });
                  const count = positions.length;
                  centerPos = new Cartesian3(sumX/count, sumY/count, sumZ/count);
              } else {
                  // 如果没有多边形数据，回退到实体自身位置
                  centerPos = targetEntity.position.getValue(viewer.clock.currentTime);
              }

              // offset = new HeadingPitchRange(
              //   0,              // Heading: 北
              //   -Math.PI / 2,   // Pitch: -90度 (垂直俯视)
              //   CITY_HEIGHT     // Range: 距离
              // );
              if (centerPos) {
                    // 2. 将中心点转为经纬度 (Cartographic)，以便设置绝对高度
                    const carto = Cartographic.fromCartesian(centerPos);
                    carto.height = CITY_HEIGHT; // 🔥 强制设置高度为 40000米

                    // 3. 转回 Cartesian3 坐标
                    const dest = Cartographic.toCartesian(carto);

                    // 4. 使用 camera.flyTo (绝对命令，不会受 bounding sphere 影响)
                    viewer.camera.flyTo({
                        destination: dest,
                        duration: 2.0,
                        orientation: {
                            heading: 0,             // 北
                            pitch: -Math.PI / 2,    // 垂直俯视
                            roll: 0
                        }
                    });
                }
            } else {
                // --- 国家/大洲层级 (保持原有逻辑) ---
                // 对于大范围区域，Cesium 的自动取景通常表现更好
                let offset = undefined;
                if (flyLevel === 'country') {
                     offset = new HeadingPitchRange(0, -Math.PI / 2, 2000000);
                } else if (flyLevel === 'continent') {
                     offset = new HeadingPitchRange(0, -Math.PI / 2, 5000000); // 稍微调高大洲的高度
                }

                viewer.flyTo(targetEntity, { 
                  duration: 2.0,
                  offset: offset
                });
            }
          }
      } else {
          // // 失败处理 (AIService 内部可能已经 alert 过了，这里只需复原按钮)
          // if (!AIService.isBusy) semiBtn.textContent = 'Navigate'; // 只有非忙碌状态才复原文本
          // AI 返回了地点，但地图上没找到对应的 Polygon
          console.warn(`[Client] AI 识别出 ${loc.city || loc.country}，但地图数据中未匹配到区域。`);
          alert(i18n.t('no_result') || "Map data not found for this location.");
      }
    } catch (err) {
      console.error('[Client] 逻辑执行出错:', err);
      alert("执行过程中发生错误，请查看控制台。");
    } finally {
      // 🛑 关键修复：无论成功还是报错，最后都必须恢复按钮
      semiBtn.textContent = i18n.t('btn_navigate'); // "Navigate"
      semiBtn.disabled = false;
    }
    
    // try {
    //   const response = await fetch('http://localhost:3000/api/semantic-search', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ query: query })
    //   });
      
    //   const json = await response.json();
      
    //   if (json.success && json.data) {
    //     // console.log('[Client] 📦 AI 返回数据:', json.data);
    //     console.log('[Client] AI responses:', json.data);
    //     const loc = json.data; // { city, country, continent }

    //     // --- 核心匹配逻辑 ---
    //     let targetEntity = null;
    //     let flyLevel = '';

    //     // 辅助：不区分大小写的查找函数
    //     const findLoose = (name) => {
    //         if (!name) return null;
    //         const cleanName = name.trim().toLowerCase();
    //         // 依次在 3 个数据源中找 (dsMunich, dsGermany, dsEurope 必须已定义)
    //         let found = null;
    //         if (dsMunich) found = dsMunich.entities.values.find(e => e.properties.name.getValue().toLowerCase() === cleanName);
    //         if (!found && dsGermany) found = dsGermany.entities.values.find(e => e.properties.name.getValue().toLowerCase() === cleanName);
    //         if (!found && dsEurope) found = dsEurope.entities.values.find(e => e.properties.name.getValue().toLowerCase() === cleanName);
    //         return found;
    //     };

    //     // 1. 尝试匹配城市
    //     if (loc.city) {
    //         targetEntity = findLoose(loc.city);
    //         if (targetEntity) flyLevel = 'city';
    //     }
    //     // 2. 没找到城市，尝试匹配国家
    //     if (!targetEntity && loc.country) {
    //         targetEntity = findLoose(loc.country);
    //         if (targetEntity) flyLevel = 'country';
    //     }
    //     // 3. 没找到国家，尝试匹配大洲
    //     if (!targetEntity && loc.continent) {
    //         targetEntity = findLoose(loc.continent);
    //         if (targetEntity) flyLevel = 'continent';
    //     }

    //     if (targetEntity) {
    //       // console.log(`[Client] ✅ 命中层级: [${flyLevel}] -> ${targetEntity.properties.name.getValue()}`);
    //       console.log(`[Client] hits level: [${flyLevel}] -> ${targetEntity.properties.name.getValue()}`);
    //       // --- 飞行参数配置 ---
    //       let offset = undefined; // 默认自动 (国家/大洲)

    //       if (flyLevel === 'city') {
    //          // 👇 在这里修改你的城市高度！
    //          const CITY_HEIGHT = 40000; 
             
    //         //  console.log(`[Client] ✈️ 应用城市飞行参数: 高度 ${CITY_HEIGHT}米`);
             
    //          offset = new HeadingPitchRange(
    //            0,              // Heading: 北
    //            -Math.PI / 2,   // Pitch: -90度 (垂直俯视)
    //            CITY_HEIGHT     // Range: 距离
    //          );
    //       }

    //       viewer.flyTo(targetEntity, { 
    //         duration: 2.0,
    //         offset: offset
    //       });

    //     } else {
    //       console.warn('[Client] ❌ AI 找到了地点，但在地图数据中未匹配到 Polygon。');
    //       alert(`AI 解析为: ${loc.city || loc.country}，但地图中暂无此区域数据。`);
    //     }

    //   } else {
    //     // alert('AI 没听懂，请换个说法。');
    //     alert('AI can not understand, please clarify.');
    //   }

    // } catch (err) {
    //   console.error(err);
    //   // alert('连接 AI 服务器失败');
    //   alert('AI failed to connect to the server.');
    // } finally {
    //   semiBtn.textContent = 'Navigate';
    //   semiBtn.disabled = false;
    // }
  }

  // 绑定事件
  if (semiBtn) {
    semiBtn.addEventListener('click', handleSemanticSearch);
  }

  // ==========================================================
  //  AGENT LAYER: The "Collective Consciousness" Interface
  //  Supervised Learning 的核心交互端
  // ==========================================================

  // const AgentController = {
  //   // 状态
  //   isVisible: false,
  //   isDialogOpen: false,
  //   userRole: 'guest', // guest | audience | curator | admin


  //   // DOM 元素
  //   dom: {
  //     container: document.getElementById('agent-container'),
  //     avatar: document.getElementById('agent-avatar'),
  //     dialog: document.getElementById('agent-dialog-box'),
  //     closeBtn: document.querySelector('.close-dialog-btn'),
  //     input: document.getElementById('agent-input'),
  //     sendBtn: document.getElementById('agent-send-btn'),
  //     history: document.getElementById('chat-history')
  //   },


    
  //   // 新增 Live2D 相关属性
  //   app: null,
  //   model: null,

  //   // 1. 初始化
  //   // init() {
  //   //   // 绑定事件
  //   //   this.dom.avatar.addEventListener('click', () => this.toggleDialog());
  //   //   this.dom.closeBtn.addEventListener('click', () => this.toggleDialog(false));
      
  //   //   this.dom.sendBtn.addEventListener('click', () => this.handleSend());
  //   //   this.dom.input.addEventListener('keypress', (e) => {
  //   //     if (e.key === 'Enter') this.handleSend();
  //   //   });

  //   //   // 初始渲染
  //   //   this.render();
  //   // },
  //   async init() {
  //     this.dom.avatar.addEventListener('click', () => this.handleAvatarClick());
  //     this.dom.closeBtn.addEventListener('click', () => this.toggleDialog(false));
  //     this.dom.sendBtn.addEventListener('click', () => this.handleSend());
  //     this.dom.input.addEventListener('keypress', (e) => {
  //       if (e.key === 'Enter') this.handleSend();
  //     });
  //     // 检查 DOM 是否存在，防止报错
  //     const canvas = document.getElementById('live2d-canvas');
  //     const container = document.getElementById('agent-avatar');
      
  //     if (!canvas || !container) {
  //         console.error("❌ 找不到 Live2D 的 Canvas 或容器元素，请检查 HTML ID");
  //         return;
  //     }

  //     // 🛑 再次检查库是否加载
  //     if (!window.PIXI || !window.PIXI.live2d) {
  //         console.error("❌ Live2D 插件未加载，请检查 index.html");
  //         return;
  //     }
  //     // ✅ 在函数内部获取 Live2DModel，确保此时库已经加载完毕
  //     const { Live2DModel } = window.PIXI.live2d;

  //     // 初始化 Pixi
  //     this.app = new PIXI.Application({
  //         view: canvas,
  //         autoStart: true,
  //         backgroundAlpha: 0,
  //         width: 800,
  //         height: 800,
  //         // resizeTo: container
  //     });

  //     // 2. 加载模型 (这里使用 CDN 上的 Hiyori 模型，你也可以换成本地路径)
  //     // 推荐用 'Rice' 模型，比较可爱适合做助手: 
      
  //     const modelUrl = '/data/agent/shizuku.model.json';
  //     // const modelUrl = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json';


  //     try {
  //         console.log("⏳ 正在加载 Live2D 模型...");
  //         this.model = await Live2DModel.from(modelUrl);
          
  //         // 3. 配置模型位置
  //         this.model.anchor.set(0.5, 0.5); // 中心对齐
  //         this.model.position.set(400, 450); // 稍微往下放一点，露出上半身
  //         this.model.scale.set(0.5); // 根据模型大小调整缩放

  //         // 4. 交互设置
  //         this.model.on('hit', (hitAreas) => {
  //             if (hitAreas.includes('Body')) {
  //                 this.model.motion('TapBody');
  //                 // this.toggleDialog(); // 点击身体打开对话框
  //             }
  //         });

  //         // 5. 添加到舞台
  //         this.app.stage.addChild(this.model);
  //         console.log("Live2D Agent Loaded!");

  //     } catch (e) {
  //         console.error("Live2D Load Failed:", e);
  //         // 如果加载失败，回退到静态图片 (Fallback)
  //         // document.getElementById('agent-avatar').innerHTML = '<img src="..." ...>';
  //     }
  //   },


  //   // 新增：统一处理点击
  //   handleAvatarClick() {
  //       console.log("Avatar Clicked!"); // 调试日志
  //       this.toggleDialog();
        
  //       // 如果模型加载好了，顺便让它动一下，增加交互感
  //       if (this.model) {
  //           // 随机播放一个动作，或者指定 'TapBody'
  //           try { this.model.motion('TapBody'); } catch(e) {}
  //       }
  //   },

    
  //   // 2. 权限/状态渲染
  //   setUserRole(role) {
  //     this.userRole = role;
  //     console.log(`[Agent] User role switched to: ${role}`);
  //     this.render();
  //     if (role !== 'guest' && this.app) {
  //         // 给一点点延时让 DOM 完成 display 切换
  //         setTimeout(() => {
  //             this.app.resize(); 
  //         }, 50);
  //     }
  //   },

  //   render() {
  //     // 只有非 guest 才能看到 Agent
  //     if (this.userRole === 'guest') {
  //       this.dom.container.classList.add('hidden');
  //     } else {
  //       this.dom.container.classList.remove('hidden');
  //       // 登录后的欢迎语
  //       if (this.dom.history.children.length <= 1) { // 防止重复添加
  //            this.addMessage('system', `Welcome back, ${this.userRole}. Ready to continue your research?`);
  //       }
  //     }
  //   },

  //   // 3. 对话框开关
  //   toggleDialog(forceState) {
  //     if (typeof forceState !== 'undefined') {
  //       this.isDialogOpen = forceState;
  //     } else {
  //       this.isDialogOpen = !this.isDialogOpen;
  //     }

  //     if (this.isDialogOpen) {
  //       this.dom.dialog.classList.remove('hidden');
  //       this.dom.input.focus();
  //     } else {
  //       this.dom.dialog.classList.add('hidden');
  //     }
  //   },

  //   // 4. 消息处理
  //   async handleSend() {
  //     const text = this.dom.input.value.trim();
  //     if (!text) return;

  //     // 🔒 检查锁
  //     if (AIService.isBusy) return;

  //     // 显示用户消息
  //     this.addMessage('user', text);
  //     this.dom.input.value = '';

  //     // 模拟 "Thinking..."
  //     const thinkingId = this.addMessage('system', 'Analyzing collective data...');
      
  //     const loc = await AIService.ask(text);

  //     const thinkingNode = document.getElementById(thinkingId);
  //     if(thinkingNode) thinkingNode.remove();

  //     if (loc) {
  //         const replyText = `I've planned a route for "${text}" focusing on ${loc.city || loc.country}.`;
  //         this.addMessage('system', replyText);
          
  //         // 触发飞行 (复用之前的逻辑)
  //         const targetName = loc.city || loc.country || loc.continent;
  //         if(targetName) {
  //            const target = findPolygonByName(targetName); 
  //            if(target) viewer.flyTo(target, { duration: 2.0 });
  //         }

  //         // 动作反馈
  //         if (this.model) this.model.motion('TapBody');

  //     } else {
  //         this.addMessage('system', "I couldn't reach the knowledge base.");
  //     }

  //     // 当 AI 回复时，播放一个动作
  //     if (this.model) {
  //         this.model.motion('TapBody'); // 或者 'Speak' 如果模型有这个动作
  //     }
  //   },

  //   addMessage(type, text) {
  //     const div = document.createElement('div');
  //     div.className = `msg ${type}`;
  //     div.textContent = text;
  //     div.id = 'msg-' + Date.now();
  //     this.dom.history.appendChild(div);
  //     this.dom.history.scrollTop = this.dom.history.scrollHeight;
  //     return div.id;
  //   }
  // };

  // client/main.js


  // src/main.js

  // ♻️ 封装：根据当前状态刷新 Agent 按钮文字
  // function updateAgentButtonText() {
  //     const btn = document.getElementById('mock-login-btn');
  //     if (!btn) return;
  //     // 1. 获取当前状态
  //     // 如果 AgentController 还没初始化，默认认为是 guest (隐藏状态)
  //     const currentRole = window.AgentController ? window.AgentController.userRole : 'guest';

      
  //     // 2. 决定用哪个翻译 Key
  //     // 如果是 guest，说明 Agent 是隐藏的 -> key: btn_deactivate_ai
  //     // 如果是 user，说明 Agent 是显示的 -> key: btn_activate_ai
  //     const i18nKey = currentRole === 'guest' ? 'btn_activate_ai' : 'btn_deactivate_ai';
      
  //     // 3. 使用 i18n 获取最新语言的文本
  //     // ⚠️ 注意：这里假设你在 i18n.js 里定义了这两个 key (btn_deactivate_ai / btn_activate_ai)
  //     btn.textContent = i18n.t(i18nKey);
  //     if (currentRole !== 'guest') {
  //         btn.classList.add('btn-active-state'); // 你可以在 css 里定义这个样式
  //     } else {
  //         btn.classList.remove('btn-active-state');
  //     }
  // }
  // src/main.js



  // const AgentController = {
  //     // 状态
  //     userRole: 'guest',
  //     isLoaded: false,   // 是否已经加载过 Live2D
  //     isLoading: false,  // 是否正在加载中 (防止重复触发)
  //     // 状态增加一个锁
  //     isToggling: false, // ✨ 新增：防止狂按
      
  //     // 核心对象
  //     app: null,
  //     model: null,

  //     // DOM 缓存
  //     dom: {
  //       container: document.getElementById('agent-container'),
  //       avatar: document.getElementById('agent-avatar'),
  //       dialog: document.getElementById('agent-dialog-box'),
  //       closeBtn: document.querySelector('.close-dialog-btn'),
  //       input: document.getElementById('agent-input'),
  //       sendBtn: document.getElementById('agent-send-btn'),
  //       history: document.getElementById('chat-history')
  //     },

  //     // 1. 初始化 (仅绑定事件，不加载资源)
  //     init() {
  //       // 绑定 UI 事件
  //       this.dom.avatar.addEventListener('click', () => this.handleAvatarClick());
  //       this.dom.closeBtn.addEventListener('click', () => this.toggleDialog(false));
  //       this.dom.sendBtn.addEventListener('click', () => this.handleSend());
  //       this.dom.input.addEventListener('keypress', (e) => {
  //         if (e.key === 'Enter') this.handleSend();
  //       });

  //       console.log("[Agent] Controller initialized (Lazy Load Mode). Waiting for user login...");
  //     },

  //     // 2. 核心：切换用户身份 (触发加载逻辑)
  //     async setUserRole(role) {
  //       if (this.isToggling) return;
  //         this.isToggling = true;
        
  //       this.userRole = role;
  //       console.log(`[Agent] Role switched to: ${role}`);

  //       // 设定一个由 CSS transition 时间决定的解锁时间 (3000ms)
  //       setTimeout(() => { this.isToggling = false; }, 3000);

  //       if (role === 'guest') {
  //         // --- 切换回游客 ---
  //         this.dom.container.classList.add('hidden');
  //         this.dom.avatar.style.pointerEvents = 'none'; // 禁止点击占位符
  //         this.toggleDialog(false); // 强制关闭对话框
  //       } else {
  //         // --- 切换回注册用户 ---
  //         this.dom.container.classList.remove('hidden');
  //         this.dom.avatar.style.pointerEvents = 'auto'; // 恢复点击
          
  //         // 🛑 懒加载检查：如果还没加载过，现在加载
  //         if (!this.isLoaded) {
  //             await this.loadLive2D();
  //         }
          
  //         // 欢迎语
  //         if (this.dom.history.children.length <= 0) {
  //             this.addMessage('system', `Access granted. Welcome, ${role}.`);
  //         }
  //       }

  //       // const btn = document.getElementById('mock-login-btn');
  //       // if (btn) {
  //       //     const key = role === 'guest' ? 'btn_deactivate_ai' : 'btn_activate_ai';
  //       //     btn.textContent = i18n.t(key);
  //       // }
  //       window.AgentController = this;
  //     },

  //     // 3. 懒加载函数 (只执行一次)
  //     async loadLive2D() {
  //       if (this.isLoaded || this.isLoading) return; // 防止重复加载
        
  //       this.isLoading = true;
  //       console.log("⏳ [Agent] Starting Live2D initialization...");

  //       // 这里可以加一个简单的 Loading 动画，比如让头像转圈，或者显示 Loading 文字
  //       // this.dom.avatar.style.opacity = '0.5';

  //       const canvas = document.getElementById('live2d-canvas');
        
  //       // 检查库
  //       if (!window.PIXI || !window.PIXI.live2d) {
  //           console.error("❌ Live2D libraries missing.");
  //           this.isLoading = false;
  //           return;
  //       }

  //       const { Live2DModel } = window.PIXI.live2d;

  //       // 初始化 Pixi
  //       this.app = new PIXI.Application({
  //           view: canvas,
  //           autoStart: true,
  //           backgroundAlpha: 0,
  //           width: 400,
  //           height: 400,
  //       });

  //       // 使用 Rice 模型 (稳定推荐)
  //       const modelUrl = '/data/agent/shizuku.model.json';

  //       try {
  //           this.model = await Live2DModel.from(modelUrl);

  //           // Rice 参数
  //           this.model.anchor.set(0.5, 0.5);
  //           this.model.position.set(200, 250); 
  //           this.model.scale.set(0.4);

  //           // 交互
  //           this.model.on('hit', (hitAreas) => {
  //               this.model.motion('Tap');
  //           });

  //           this.app.stage.addChild(this.model);
            
  //           this.isLoaded = true; // ✅ 标记为已加载
  //           console.log("✅ [Agent] Live2D Loaded Successfully!");

  //       } catch (e) {
  //           console.error("❌ [Agent] Load Failed:", e);
  //       } finally {
  //           this.isLoading = false;
  //           // this.dom.avatar.style.opacity = '1';
  //       }
  //     },

  //     // 4. 其他交互函数
  //     toggleDialog(forceState) {
  //       if (typeof forceState !== 'undefined') {
  //         this.isDialogOpen = forceState;
  //       } else {
  //         this.isDialogOpen = !this.isDialogOpen;
  //       }

  //       if (this.isDialogOpen) {
  //         this.dom.dialog.classList.remove('hidden');
  //         this.dom.input.focus();
  //       } else {
  //         this.dom.dialog.classList.add('hidden');
  //       }
  //     },

  //     handleAvatarClick() {
  //         if (!this.isLoaded) return; // 没加载完不能点
  //         this.toggleDialog();
  //         if (this.model) {
  //             try { this.model.motion('Tap'); } catch(e) {}
  //         }
  //     },

  //     async handleSend() {
  //       // (复用之前的逻辑，记得加上 AIService.isBusy 锁)
  //       const text = this.dom.input.value.trim();
  //       if (!text || AIService.isBusy) return;

  //       this.addMessage('user', text);
  //       this.dom.input.value = '';
  //       const thinkingId = this.addMessage('system', 'Processing...');

  //       const loc = await AIService.ask(text);
        
  //       const thinkingNode = document.getElementById(thinkingId);
  //       if(thinkingNode) thinkingNode.remove();

  //       if (loc) {
  //           this.addMessage('system', `Route planned for ${loc.city || loc.country}.`);
  //           const target = findPolygonByName(loc.city || loc.country || loc.continent); 
  //           if(target) viewer.flyTo(target, { duration: 2.0 });
  //           if (this.model) this.model.motion('Tap');
  //       } else {
  //           this.addMessage('system', "Access denied or connection lost.");
  //       }
  //     },

  //     addMessage(type, text) {
  //       const div = document.createElement('div');
  //       div.className = `msg ${type}`;
  //       div.textContent = text;
  //       div.id = 'msg-' + Date.now();
  //       this.dom.history.appendChild(div);
  //       this.dom.history.scrollTop = this.dom.history.scrollHeight;
  //       return div.id;
  //     }
  // };




  // // 初始化 Agent
  // AgentController.init();
  // window.AgentController = AgentController; // 关键：让 updateAgentButtonText 能读到它
  // --- 模拟登录逻辑 (Dev Tool) ---
  // const mockLoginBtn = document.getElementById('mock-login-btn');
  // mockLoginBtn.addEventListener('click', () => {
  //     const current = AgentController.userRole;
  //     const next = current === 'guest' ? 'user' : 'guest';
  //     AgentController.setUserRole(next);
      
  //     // const statusText = next === 'guest' ? 'Guest (Agent Hidden)' : 'User (Agent Visible)';
  //     // mockLoginBtn.textContent = `Mode: ${statusText}`;
  //     updateAgentButtonText();
  //     // 如果切回 Guest，强制关闭对话框
  //     if (next === 'guest') AgentController.toggleDialog(false);
  // });

  // const mockLoginBtn = document.getElementById('mock-login-btn');
  // if (mockLoginBtn) {
  //     mockLoginBtn.addEventListener('click', () => {
  //         // 1. 切换角色
  //         const current = AgentController.userRole;
  //         const next = current === 'guest' ? 'user' : 'guest'; // 简化为 guest/user 切换
          
  //         AgentController.setUserRole(next);
          
  //         // 2. 刷新按钮文字
  //         updateAgentButtonText(); 
  //     });
  // }



// // 2️⃣ 新增：监听语言切换事件
// // (前提：你的 i18n.js updatePage 方法里写了 window.dispatchEvent...)
// window.addEventListener('lang-change', () => {
//     console.log("♻️ 语言变了，正在刷新动态按钮...");
//     updateAgentButtonText();
// });

// // 3️⃣ 页面加载完也跑一次 (确保初始状态正确)
// updateAgentButtonText();




// 1. ♻️ 定义刷新函数：逻辑必须清晰
function updateAgentButtonText() {
    const btn = document.getElementById('mock-login-btn');
    if (!btn) return;

    // 获取当前真实状态 (如果没有初始化，默认是 guest/隐藏)
    const currentRole = window.AgentController ? window.AgentController.userRole : 'guest';
    
    // 逻辑修正：
    // 🟢 如果是 Guest (AI隐藏)，我们要显示的动作是 "Activate" (去激活)
    // 🔴 如果是 User (AI显示)，我们要显示的动作是 "Deactivate" (去关闭)
    const i18nKey = currentRole === 'guest' ? 'btn_activate_ai' : 'btn_deactivate_ai';
    
    // 更新文字
    btn.textContent = i18n.t(i18nKey);
    
    // 可选：更新样式状态
    if (currentRole !== 'guest') {
        btn.classList.add('active'); // 激活状态
    } else {
        btn.classList.remove('active');
    }
}

// ♻️ 封装：根据当前模式刷新顶部提示文字
function updateModeIndicator() {
    const modeIndicator = document.getElementById('mode-indicator');
    if (!modeIndicator) return;

    const currentMode = appState.currentMode; // 获取当前模式 (free/guided/semi)
    
    // 1. 确定模式对应的翻译 Key
    let modeKey = '';
    switch (currentMode) {
        case 'free': modeKey = 'mode_free'; break;
        case 'guided': modeKey = 'mode_guided'; break;
        case 'semi': modeKey = 'mode_semi'; break;
        default: modeKey = 'mode_free';
    }

    // 2. 拼接翻译： "当前模式: " + "自由探索"
    // 注意：mode_label 是 "Current Mode: "
    modeIndicator.textContent = `${i18n.t('mode_label')} ${i18n.t(modeKey)}`;
}

// 2. 🖱️ 绑定点击事件 (点击后切换状态 -> 刷新文字)
const mockLoginBtn = document.getElementById('mock-login-btn');
if (mockLoginBtn) {
    mockLoginBtn.addEventListener('click', () => {
        // A. 切换逻辑
        const current = AgentController.userRole;
        const next = current === 'guest' ? 'user' : 'guest';
        
        // 执行切换
        AgentController.setUserRole(next);
        
        // B. ✅ 关键：手动调用刷新函数，更新按钮文字
        updateAgentButtonText(); 
    });
}

// 3. 🌐 绑定语言切换事件 (收到 i18n 的通知 -> 刷新文字)
window.addEventListener('lang-change', () => {
  // 1. 刷新 Agent 按钮  
  updateAgentButtonText();
    // 2. ✅ 刷新顶部模式提示
  updateModeIndicator();
  // 3. ✅ 刷新动态图例 (新增)
  updateLegendUI();
});

// 4. 🚀 初始化时调用一次 (防止页面刚加载时文字不对)
updateAgentButtonText();











// --- 初始化 Viewer ---
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkZGJiMWRmYS03MzdhLTQyMWYtYjAxMS0yNTg2OTc3ZjVkOTciLCJpZCI6MzMzMjk1LCJpYXQiOjE3NTU1OTUwMzJ9.eQAIvY4xLQw-H2Q1GAZ1yWL8afkTQeVhsWfBPQJOUkU';

viewer = new Viewer('cesium-container', {
  timeline: false,
  animation: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  baseLayerPicker: false,
  navigationHelpButton: false,
  infoBox: false,
  selectionIndicator: false
});

viewer.camera.setView({
    destination: Cartesian3.fromDegrees(11.576124, 48.137154, 15000000),
    orientation: {
        heading: 0.0,           // 北
        pitch: -Math.PI / 2,    // -90度，垂直俯视
        roll: 0.0
    }
});

const layerManager = new LayerManager();
layerManager.init(viewer); // 传入 viewer 实例

// 绑定 Google 模式切换开关
const googleSwitch = document.getElementById('google-mode-toggle');
if (googleSwitch) {
    googleSwitch.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        layerManager.toggleGoogleMode(isChecked);
    });
}

// --- 加载数据 ---
museumDataSource = new GeoJsonDataSource('museums');
viewer.dataSources.add(museumDataSource);

// const levelsDataSource = new GeoJsonDataSource('levels_polygons');
// viewer.dataSources.add(levelsDataSource);
// 👇 删除旧的 let levelsDataSource;
// 👇 新增三个独立的变量
let dsEurope;
let dsGermany;
let dsMunich;
// let dsGermanyCounties;

// // 1. 加载 Levels (Polygon)
// levelsDataSource.load('/data/levels.geojson', {
//   stroke: Color.WHITE,
//   fill: Color.WHITE.withAlpha(0.3),
//   strokeWidth: 3
// }).then(() => {
//   levelsDataSource.entities.values.forEach(entity => {
//     const level = entity.properties.level.getValue();
//     const colorHex = entity.properties.color.getValue();
//     entity.polygon.material = Color.fromCssColorString(colorHex).withAlpha(0.4);
//     if (level === 1) entity.polygon.distanceDisplayCondition = DIST_LEVEL_1;
//     else if (level === 2) entity.polygon.distanceDisplayCondition = DIST_LEVEL_2;
//     else if (level === 3) entity.polygon.distanceDisplayCondition = DIST_LEVEL_3;
//   });
// });

// --- 3. 加载分级行政区划 (Level 1-3 Polygons) ---

// --- 3. 加载分级行政区划 (优化版：自动映射 Name) ---

// 定义三个数据源
dsEurope = new GeoJsonDataSource('europe');
dsGermany = new GeoJsonDataSource('germany');
dsMunich = new GeoJsonDataSource('munich'); // 或者是 dsGermanyCounties

viewer.dataSources.add(dsEurope);
viewer.dataSources.add(dsGermany);
viewer.dataSources.add(dsMunich);

// // ♻️ 通用加载函数：自动修补 name 属性
// function loadPolygonLayer(dataSource, url, color, distCondition) {
//     dataSource.load(url, {
//         stroke: Color.WHITE.withAlpha(0.5),
//         strokeWidth: 2,
//         fill: color
//     }).then(ds => {
//         ds.entities.values.forEach(entity => {
//             // 1. 设置视距
//             if (entity.polygon) {
//                 entity.polygon.distanceDisplayCondition = distCondition;
//             }

//             // 2. 核心修复：把各种乱七八糟的字段名统一映射给 'name'
//             if (!entity.properties) return;

//             // 如果已经有 name 且不为空，就不动了
//             if (entity.properties.hasProperty('name') && entity.properties.name.getValue()) {
//                 return; 
//             }

//             // 备选字段列表 (根据你的 GeoJSON 情况添加)
//             const candidateKeys = ['CONTINENT', 'continent', 'NAME', 'Name', 'admin', 'sovereignt', 'city', 'CITY'];
            
//             for (const key of candidateKeys) {
//                 if (entity.properties.hasProperty(key)) {
//                     const val = entity.properties[key].getValue();
//                     // 找到了有效值，复制给 'name'
//                     if (val) {
//                         entity.properties.addProperty('name', val);
//                         // console.log(`Mapped ${key}: ${val} -> name`); // 调试用
//                         break; // 找到了就停，防止覆盖
//                     }
//                 }
//             }
//         });
//     }).catch(err => console.error(`Failed to load ${url}:`, err));
// }


// --- 新版：基于地图图层构建层级 ---
function buildHierarchyFromMaps() {
    const hierarchy = {};

    // 🟢 第一层：遍历大洲 (L1)
    dsEurope.entities.values.forEach(e => {
        const name = getEntityName(e); // 封装一个获取名字的函数
        if (name && !hierarchy[name]) {
            hierarchy[name] = {}; 
        }
    });

    // 🟡 第二层：遍历国家 (L2)
    dsGermany.entities.values.forEach(e => {
        const countryName = getEntityName(e);
        // 这里需要你在 ArcGIS 里加的 'continent' 字段！
        // 如果没有，暂时默认放到 'Europe' 或者 'World' 下
        const parentContinent = getEntityProperty(e, 'continent') || 'Others';

        // 只有当大洲存在时才放进去（或者自动创建大洲）
        if (!hierarchy[parentContinent]) hierarchy[parentContinent] = {};
        if (!hierarchy[parentContinent][countryName]) {
            hierarchy[parentContinent][countryName] = new Set();
        }
    });

    // 🟠 第三层：遍历城市 (L3)
    dsMunich.entities.values.forEach(e => {
        const cityName = getEntityName(e);
        const parentContinent = getEntityProperty(e, 'continent') || 'Europe';
        const parentCountry = getEntityProperty(e, 'country') || 'Germany';

        if (!hierarchy[parentContinent]) hierarchy[parentContinent] = {};
        if (!hierarchy[parentContinent][parentCountry]) hierarchy[parentContinent][parentCountry] = new Set();
        
        hierarchy[parentContinent][parentCountry].add(cityName);
    });

    console.log("🗺️ 地图驱动的层级结构:", hierarchy);
    return hierarchy;
}

// 辅助工具：获取实体名字 (兼容各种字段名)
function getEntityName(entity) {
    const keys = ['name', 'NAME', 'Name', 'CONTINENT', 'admin', 'sovereignt'];
    for (const k of keys) {
        if (entity.properties && entity.properties.hasProperty(k)) {
            return entity.properties[k].getValue();
        }
    }
    return null;
}

// 辅助工具：获取属性
function getEntityProperty(entity, keyName) {
    if (entity.properties && entity.properties.hasProperty(keyName)) {
        return entity.properties[keyName].getValue();
    }
    return null;
}


// --- 通用加载函数 (经典回归版) ---
// --- 通用加载函数 (软隐藏版：隐身但不消失) ---
function loadPolygonLayer(dataSource, url, color, distCondition, isVisible = true) {
    // 1. 基础配置
    // 如果 isVisible 为 false，我们就强制把透明度设为 0，并且不显示边框
    const finalFill = isVisible ? color : Color.TRANSPARENT;
    const finalStrokeWidth = isVisible ? 3 : 0; // 隐身时去掉边框

    return dataSource.load(url, {
        stroke: Color.fromCssColorString('#ffffff'),
        strokeWidth: finalStrokeWidth,
        fill: finalFill,
        // ❌ 坚决不写 clampToGround: true
    }).then(ds => {
        const entities = ds.entities.values;
        console.log(`📂 加载: ${url} (Visible: ${isVisible}, Count: ${entities.length})`);

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];

            // ✅ 关键修改：永远保持 entity.show = true
            // 这样能确保所有数据逻辑（如 buildHierarchyFromMaps）都能读到它
            entity.show = true; 

            // 2. 如果要求“隐身”，我们就把它的多边形轮廓关掉
            if (entity.polygon) {
                entity.polygon.distanceDisplayCondition = distCondition;
                entity.polygon.heightReference = HeightReference.CLAMP_TO_GROUND;
                
                // 如果 isVisible 是 false，我们确保边框是关掉的
                if (!isVisible) {
                    entity.polygon.outline = false; 
                } else {
                    entity.polygon.outline = true;
                }
            }

            // 3. 数据清洗 (这段逻辑现在绝对安全了，因为 entity 肯定是 show 的)
            if (entity.properties && !entity.properties.hasProperty('name')) {
                const keys = ['CONTINENT', 'continent', 'NAME', 'Name', 'admin', 'sovereignt', 'city', 'CITY'];
                for (const key of keys) {
                    if (entity.properties.hasProperty(key)) {
                        entity.properties.addProperty('name', entity.properties[key].getValue());
                        break; 
                    }
                }
            }
        }
        return ds;
    }).catch(err => console.error(`❌ 失败: ${url}`, err));
}

// --- 执行加载 ---

// // 3.1 Level 1: Europe (对应下拉菜单 Continents)
// // 假设你的文件里属性叫 CONTINENT
// loadPolygonLayer(
//     dsEurope, 
//     '/data/World_Continen_FeaturesToJSO.geojson', // 或者是 World_Continents.geojson
//     Color.fromCssColorString('#2a9d8f').withAlpha(0.3),
//     DIST_LEVEL_1
// );

// // 3.2 Level 2: Germany (对应下拉菜单 Countries)
// // 假设你的文件里属性叫 NAME 或 admin
// loadPolygonLayer(
//     dsGermany, 
//     '/data/worldadministr_FeaturesToJSO1.geojson', 
//     Color.fromCssColorString('#e6b63cff').withAlpha(0.3),
//     DIST_LEVEL_2
// );

// // 3.3 Level 3: Munich (对应下拉菜单 Cities)
// // 假设你的文件里属性叫 name 或 city
// loadPolygonLayer(
//     dsMunich, 
//     '/data/germany_counti_FeaturesToJSO1.geojson', // 或者是 germany_counties.geojson
//     Color.fromCssColorString('#f4a261').withAlpha(0.3),
//     DIST_LEVEL_3
// );


// 1. 定义所有加载任务
const p1 = loadPolygonLayer(
    dsEurope, 
    './data/World_Continen_FeaturesToJSO2.geojson', 
    Color.fromCssColorString('#ffffff').withAlpha(0.05),
    DIST_LEVEL_1,
    false
);

const p2 = loadPolygonLayer(
    dsGermany, 
    './data/worldadministr_FeaturesToJSO1.geojson', 
    Color.fromCssColorString('#ffffff').withAlpha(0.05),
    DIST_LEVEL_2,
    false
);

const p3 = loadPolygonLayer(
    dsMunich, 
    './data/germany_counti_FeaturesToJSO1.geojson', 
    Color.fromCssColorString('#ffffff').withAlpha(0.05),
    DIST_LEVEL_3,
    true
);

// 博物馆数据也算一个任务
const pMuseum = museumDataSource.load('./data/Munich_museums(en)_updated1.geojson', {
  // markerSymbol: 'museum',
  markerSize: 24,
  // markerColor: Color.WHITE,
  // stroke: Color.RED,
  // strokeWidth: 2,
  // clampToGround: true
}).then(async (dataSource) => {
  console.log('博物馆数据加载完毕!');
  resultsList = document.getElementById('results-list');
  resultsPanel = document.getElementById('results-panel');


  // =========================================================
  // 1. 定义视距分级阈值 (LOD Thresholds)
  // =========================================================
  // 这些数值决定了什么时候“变身”
  const RANGE_L1_CONTINENT = 3000000; // 3000km 以上看大洲
  const RANGE_L2_COUNTRY   = 500000;  // 500km - 3000km 看国家
  const RANGE_L3_CITY      = 40000;   // 20km - 500km 看城市 (20km以内看具体的点)

  // 定义每个层级的显示区间
  const DIST_BADGE_L1 = new DistanceDisplayCondition(RANGE_L1_CONTINENT, Number.MAX_VALUE);
  const DIST_BADGE_L2 = new DistanceDisplayCondition(RANGE_L2_COUNTRY, RANGE_L1_CONTINENT);
  const DIST_BADGE_L3 = new DistanceDisplayCondition(RANGE_L3_CITY, RANGE_L2_COUNTRY);
  const DIST_POINT_L4 = new DistanceDisplayCondition(0, RANGE_L3_CITY);

  // =========================================================
  // 2. 数据聚合：同时统计三个层级的数据
  // =========================================================
  // 结构: { "Europe": {count:0, positions:[]}, "Germany": {...}, "Munich": {...} }
  const stats = {
      continents: {},
      countries: {},
      cities: {}
  };

  const entities = dataSource.entities.values;


  // 1. 定义一个纯白色的 SVG 图标 (你可以替换成 '/icons/museum.svg')
  // 这里我放一个简单的白色圆点+博物馆柱子的 SVG Base64
  // const SVG_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZmZmZiI+PHBhdGggZD0iTTEyIDJMNiA5aDEydjFoLTJ2OGgydjFIOV2LTJ2OGgyVjEwaC0yejEiLz48cGF0aCBkPSJNMCAwdjI0aDI0VjBIMHptMTIgMmwtNiA3aDEydjFoLTJ2OGgydjFIOV2LTJ2OGgyVjEwaC0yeiIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==";
    
  // 或者用这个更通用的"定位针"形状 (也是纯白)
  // const PIN_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZmZmZiI+PHBhdGggZD0iTTEyIDJDNy41ODkgMiA0IDUuNTg5IDQgMTBzMCAxMCA4IDEyYzggLTIgOCAtOCA4IC0xMnMtMy41ODkgLTggLTggLTh6bTAgMTJjLTIuMjA5IDAgLTQgLTEuNzkxIC00IC00czEuNzkxIC00IDQgLTQgNCAxLjc5MSA0IDQgLTEuNzkxIDQgLTQgNHoiLz48L3N2Zz4=";
  

  entities.forEach(entity => {
      // A. 安全获取属性
      let p = {};
      if (entity.properties.hasProperty('general')) {
          p = entity.properties.general.getValue();
      } else {
          // 兼容扁平属性
          p = {
              continent: entity.properties.continent ? entity.properties.continent.getValue() : 'Unknown',
              country: entity.properties.country ? entity.properties.country.getValue() : 'Unknown',
              city: entity.properties.city ? entity.properties.city.getValue() : 'Unknown'
          };
      }

      // B. 获取坐标
      const position = entity.position.getValue(viewer.clock.currentTime);
      if (!position) return;

      // C. 辅助函数：累加数据
      const accumulate = (dict, key, pos) => {
          if (!key) return;
          if (!dict[key]) dict[key] = { count: 0, positions: [] };
          dict[key].count++;
          dict[key].positions.push(pos);
      };
      // D. 分别存入三个层级的统计桶
      accumulate(stats.continents, p.continent, position);
      accumulate(stats.countries, p.country, position);
      accumulate(stats.cities, p.city, position);
      // // E. 设置原始点的可见性 (L4)
      // if (entity.billboard) {
      //     entity.billboard.distanceDisplayCondition = DIST_POINT_L4;
      // }
      // A. 获取分类
      let cat = 'Unknown';
      if (entity.properties.hasProperty('general')) {
          const g = entity.properties.general.getValue();
          if (g && g.category) cat = g.category;
      }
      
      // B. 🔥 核心修改：根据分类设置颜色
      // 注意：我们只修改具体点位(L4)的颜色，不修改静态统计牌(Badge)的颜色
      // 因为Badge的颜色已经用来表示 L1/L2/L3 的层级了
      if (entity.billboard) {
          // 设置颜色
          entity.billboard.color = getCategoryColor(cat);
          // 保持原本的缩放
          entity.billboard.scale = 0.8; 
          
          // 设置视距 (保持之前的逻辑)
          entity.billboard.distanceDisplayCondition = DIST_POINT_L4;
      }

      // 获取分类颜色
      const categoryColor = getCategoryColor(cat);

      // 🔥 核心修改：使用自定义 SVG + 颜色叠加
      if (entity.billboard) {
          // 1. 设置图片为你的 SVG
          // 你可以写本地路径: entity.billboard.image = './assets/icons/my-icon.svg';
          entity.billboard.image = PIN_ICON; 
          
          // 2. 关键：设置颜色
          // 因为图标是白色的，设置什么颜色，它就会变成什么颜色
          entity.billboard.color = categoryColor;
          
          // 3. 调整大小 (SVG通常比较清晰，可以适当放大)
          entity.billboard.scale = 0.5; 
          
          // 4. 设定锚点 (VerticalOrigin.BOTTOM 让图标的尖尖对准坐标点)
          entity.billboard.verticalOrigin = VerticalOrigin.BOTTOM;

          // 5. 设置视距 (保持之前的逻辑)
          entity.billboard.distanceDisplayCondition = DIST_POINT_L4;
          
          // 6. 防止被地形遮挡 (可选)
          entity.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
      }

      
  });
  // =========================================================
  // 3. 生成各层级公告牌 (Badges)
  // =========================================================
// 📍 定义固定中心点 (解决“数学平均值”导致的偏移问题)
  // 可以在这里添加任何您想“纠偏”的城市
  const FIXED_CENTERS = {
      // 慕尼黑市中心 (Marienplatz) 坐标
      'München': Cartesian3.fromDegrees(11.576124, 48.137154, 100),
      
      // 如果数据里混用了 Munich，也可以加进去
      'Munich': Cartesian3.fromDegrees(11.576124, 48.137154, 100)
  };


  // 通用生成函数
  const createBadge = (name, data, levelDist, colorCss, scale = 1.0) => {
      // // 计算质心
      // let sumX = 0, sumY = 0, sumZ = 0;
      // data.positions.forEach(pos => { sumX += pos.x; sumY += pos.y; sumZ += pos.z; });
      // const count = data.positions.length;
      // const centerPos = new Cartesian3(sumX / count, sumY / count, sumZ / count);
      // // 算出圆圈的半径 (pixelSize 是直径，所以除以 2)

      let centerPos;

      // 🔥 核心修改：先查表，如果有固定坐标，直接用！
      if (FIXED_CENTERS[name]) {
          centerPos = FIXED_CENTERS[name];
      } else {
          // 否则才使用数学计算 (质心)
          let sumX = 0, sumY = 0, sumZ = 0;
          data.positions.forEach(pos => { sumX += pos.x; sumY += pos.y; sumZ += pos.z; });
          const count = data.positions.length;
          // 防止除以0
          if (count === 0) return; 
          centerPos = new Cartesian3(sumX / count, sumY / count, sumZ / count);
      }


      const pointSize = 30 * scale;
      const radius = pointSize / 2;

      viewer.entities.add({
            position: centerPos,
            point: {
                pixelSize: pointSize, 
                color: Color.fromCssColorString(colorCss),
                outlineColor: Color.WHITE,
                outlineWidth: 3,
                distanceDisplayCondition: levelDist,
                heightReference: HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
                text: `${name}\n${data.count}`,
                font: `bold ${14 * scale}px sans-serif`,
                
                // 1. 样式优化
                // ❌ 错误: style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                // ✅ 正确:
                style: LabelStyle.FILL_AND_OUTLINE,
                
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK,
                outlineWidth: 2,
                
                // 2. 背景板
                showBackground: true,
                backgroundColor: Color.fromCssColorString('#000000').withAlpha(0.6),
                backgroundPadding: new Cartesian2(7, 5),

                // 3. 位置偏移
                // ❌ 错误: horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                // ✅ 正确:
                horizontalOrigin: HorizontalOrigin.CENTER,
                
                // ❌ 错误: verticalOrigin: Cesium.VerticalOrigin.TOP,
                // ✅ 正确:
                verticalOrigin: VerticalOrigin.TOP,
                
                // Y轴向下偏移
                pixelOffset: new Cartesian2(0, radius + 5), 

                distanceDisplayCondition: levelDist,
                heightReference: HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
        });
  };

  // --- L1: 大洲 (深紫色/蓝色，代表宏观) ---
  Object.keys(stats.continents).forEach(key => {
      createBadge(key, stats.continents[key], DIST_BADGE_L1, '#7209b7', 1.2);
  });

  // --- L2: 国家 (橙色，醒目) ---
  Object.keys(stats.countries).forEach(key => {
      createBadge(key, stats.countries[key], DIST_BADGE_L2, '#f4a261', 1.1);
  });

  // --- L3: 城市 (红色，警告色/热点色) ---
  Object.keys(stats.cities).forEach(key => {
      createBadge(key, stats.cities[key], DIST_BADGE_L3, '#D90429', 1.0);
  });

  console.log("📊 全层级静态统计生成完毕!");



  // // =========================================================
  // // 1. 配置 EntityCluster (点聚合)
  // // =========================================================
  // const pixelRange = 10; // 聚合范围：数值越大，聚合得越厉害（越早合并）
  // const minimumClusterSize = 10; // 至少 3 个点才开始聚合，否则显示原图标

  dataSource.clustering.enabled = false;
  // dataSource.clustering.pixelRange = pixelRange;
  // dataSource.clustering.minimumClusterSize = minimumClusterSize;
  // dataSource.clustering.clusterBillboards = true;
  // dataSource.clustering.clusterLabels = false; // 我们把数字画在图标里，不单独显示 Label

  // // 设定阈值：比如相机高度低于 20,000 米时，强制关闭聚合，显示原始点
  // // 这个高度建议比 DIST_LEVEL_4 的最大距离 (30000) 稍微小一点，保证无缝衔接
  // const CLUSTER_DISABLE_HEIGHT = 50000; 

  // // 监听相机移动结束 (节省性能，不动不算)
  // // 如果想要更丝滑，可以用 viewer.scene.preRender.addEventListener
  // viewer.camera.changed.addEventListener(() => {
  //     const height = viewer.camera.positionCartographic.height;
      
  //     // 如果高度很低（微观视角），且当前聚合是开启的 -> 关掉它
  //     if (height < CLUSTER_DISABLE_HEIGHT && dataSource.clustering.enabled) {
  //         dataSource.clustering.enabled = false;
  //         console.log("📉 进入微观层级，关闭聚合，显示原点");
  //     } 
  //     // 如果高度很高（宏观视角），且当前聚合是关闭的 -> 开启它
  //     else if (height >= CLUSTER_DISABLE_HEIGHT && !dataSource.clustering.enabled) {
  //         dataSource.clustering.enabled = true;
  //         console.log("📈 进入宏观层级，开启聚合");
  //     }
  // });
  
  // // 初始化时先检查一次
  // const initialHeight = viewer.camera.positionCartographic.height;
  // dataSource.clustering.enabled = initialHeight >= CLUSTER_DISABLE_HEIGHT;


  // // 监听聚合事件，自定义聚合图标的样式
  // dataSource.clustering.clusterEvent.addEventListener(function (entities, cluster) {
  //     cluster.label.show = false; // 隐藏默认的 Label
  //     cluster.billboard.show = true;
  //     cluster.billboard.id = cluster.label.id; // 关键：赋予 ID 以便交互
      
  //     // 根据聚合数量决定样式
  //     const count = entities.length;
  //     let radius = 20;
  //     let color = '#D90429'; // 主题红
  //     let text = count.toString();

  //     // 分级样式 (Level Logic)
  //     if (count > 50) {
  //         radius = 35; // 宏观：超大圈
  //         text = '50+'; 
  //     } else if (count > 10) {
  //         radius = 28; // 中观：中圈
  //     } else {
  //         radius = 22; // 微观：小圈
  //     }

  //     // 动态绘制 Canvas 图标 (红底白字)
  //     cluster.billboard.image = drawClusterIcon(text, radius, color);
      
  //     // 这里的 heightReference 很重要，防止聚合图标被地形埋没
  //     cluster.billboard.heightReference = HeightReference.CLAMP_TO_GROUND;
  //     // 稍微抬高一点点，防止与地面穿插
  //     cluster.billboard.pixelOffset = new Cartesian2(0, -10);
  

  
  // 为所有 Level 4 的点应用可见距离
  museumDataSource.entities.values.forEach(entity => {
    if (entity.billboard) {
      entity.billboard.distanceDisplayCondition = DIST_LEVEL_4;
    }
  });

  // 初始化 Tippy
  appState.tippyInstance = tippy(document.body, {
    content: 'Loading...',
    trigger: 'manual',
    allowHTML: true,
    interactive: true,
    placement: 'right-start',
    arrow: true,
    getReferenceClientRect: () => new DOMRect(0, 0, 0, 0),
  });

  // 绑定 Tippy 位置同步
  viewer.scene.preRender.addEventListener(function() {
    if (appState.selectedEntity) {
      const entityPosition = appState.selectedEntity.position.getValue(viewer.clock.currentTime);
      const canvasPosition = viewer.scene.cartesianToCanvasCoordinates(entityPosition);
      if (canvasPosition) {
        appState.tippyInstance.setProps({
          getReferenceClientRect: () => new DOMRect(canvasPosition.x, canvasPosition.y, 0, 0),
        });
      }
    } else {
      // 如果选中的点被聚合收进去了，应该隐藏 Tippy
      if (appState.tippyInstance) appState.tippyInstance.hide();
    }
  });

  // --- 侧边栏基础交互 ---
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    toggleBtn.title = sidebar.classList.contains('collapsed') ? 'Expand Menu' : 'Collapse Menu';
    // 折叠时关闭所有参数区
    if (sidebar.classList.contains('collapsed')) {
      closeAllParameterAreas();
    }
  });

  const toggleButtons = document.querySelectorAll('.sidebar-toggle');
  const parameterAreas = document.querySelectorAll('.parameter-area');
  
  function closeAllParameterAreas() {
    parameterAreas.forEach(area => area.classList.remove('active'));
    toggleButtons.forEach(btn => btn.classList.remove('active-toggle'));
  }
  
  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 自动展开侧边栏
      if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
      }

      const targetId = button.id.replace('btn-', 'params-');
      const targetArea = document.getElementById(targetId);

      if (!targetArea) { // 自由探索
         closeAllParameterAreas();
      } else {
         const isAlreadyOpen = targetArea.classList.contains('active');
         closeAllParameterAreas();
         if (!isAlreadyOpen) {
           targetArea.classList.add('active');
           button.classList.add('active-toggle');
         }
      }

      if (button.id === 'btn-guided') switchMode('guided');
      else if (button.id === 'btn-semi') switchMode('semi');
      else if (button.id === 'btn-free') switchMode('free');
    });
  });

  // 自由探索按钮
  document.getElementById('btn-free').addEventListener('click', () => {
    if (sidebar.classList.contains('collapsed')) return; // 防止误触
    closeAllParameterAreas();
    switchMode('free');
  });

  // 地图点击
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(function(click) {
    const pickedObject = viewer.scene.pick(click.position);
    if (pickedObject && pickedObject.id && museumDataSource.entities.contains(pickedObject.id)) {
      selectMuseum(pickedObject.id);
    } else {
      clearSelection();
    }
  }, ScreenSpaceEventType.LEFT_CLICK);

  spatialHierarchy = buildHierarchyFromMaps();
  console.log('📊 层级数据构建结果:', spatialHierarchy);
  // ==========================================
  //  全辅助探索：纯 JS 生成 UI + 级联逻辑
  // ==========================================

  // 1. 获取父容器
  const spatialContainer = document.getElementById('spatial-builder-container');
  if (spatialContainer) {
      spatialContainer.innerHTML = ''; // 清空
      addSpatialRow(); // 现在调用，下拉菜单里就有东西了
  }
  // 2. 定义一个辅助函数：动态创建带标签的下拉菜单
  function createFilterUI(id, labelText, isDisabled = false) {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '10px'; // 间距

    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.display = 'block';
    label.style.fontSize = '0.85em';
    label.style.color = '#aaa';
    label.style.marginBottom = '5px';

    const select = document.createElement('select');
    select.id = id;
    select.className = 'fixed-filter'; // 复用你 style.css 里的样式
    select.disabled = isDisabled;
    
    // 简单的内联样式，确保它好看 (或者依赖 style.css 的 .fixed-filter)
    select.style.width = '100%';
    select.style.padding = '8px';
    select.style.backgroundColor = '#333';
    select.style.color = 'white';
    select.style.border = '1px solid #444';
    select.style.borderRadius = '4px';

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    
    return { wrapper, select };
  }

  // 3. 清空容器并生成 3 个组件
  if (spatialContainer) {
    spatialContainer.innerHTML = ''; // 清理旧内容
    
    // 创建组件
    const uiContinent = createFilterUI('spatial-continent', 'Continent');
    const uiCountry = createFilterUI('spatial-country', 'Country', true); // 默认禁用
    const uiCity = createFilterUI('spatial-city', 'City/Area', true);     // 默认禁用

    // 插入到页面
    spatialContainer.appendChild(uiContinent.wrapper);
    spatialContainer.appendChild(uiCountry.wrapper);
    spatialContainer.appendChild(uiCity.wrapper);

    // --- 4. 重新定义 domSpatial 变量 (指向新生成的元素) ---
    // 注意：这里不能用 const，因为我们是在这里动态赋值的
    var domSpatial = {
      continent: uiContinent.select,
      country: uiCountry.select,
      city: uiCity.select
    };
  }

  // --- 5. 初始化逻辑 (保持之前的逻辑不变，只是放在这里) ---
  function initSpatialFilters() {
    // 如果容器没找到，直接退出防止报错
    if (!domSpatial) return; 

    const hierarchy = {};

    museumDataSource.entities.values.forEach(e => {
      const p = e.properties.general.getValue();
      const continent = p.continent;
      const country = p.country;
      const city = p.city;

      if (!hierarchy[continent]) hierarchy[continent] = {};
      if (country) {
        if (!hierarchy[continent][country]) hierarchy[continent][country] = new Set();
        if (city) hierarchy[continent][country].add(city);
      }
    });

    // 填充大洲
    domSpatial.continent.innerHTML = '<option value="all">All Continents</option>';
    Object.keys(hierarchy).forEach(c => {
      domSpatial.continent.innerHTML += `<option value="${c}">${c}</option>`;
    });

    // 绑定事件 (和之前一样)
    domSpatial.continent.addEventListener('change', () => {
      const valContinent = domSpatial.continent.value;
      const isAll = valContinent === 'all';

      domSpatial.country.innerHTML = '<option value="all">All Countries</option>';
      domSpatial.country.disabled = isAll;
      domSpatial.city.innerHTML = '<option value="all">All Cities</option>';
      domSpatial.city.disabled = true;

      if (!isAll && hierarchy[valContinent]) {
        Object.keys(hierarchy[valContinent]).forEach(c => {
          domSpatial.country.innerHTML += `<option value="${c}">${c}</option>`;
        });
        flyToLocation(valContinent);
      }
    });

    domSpatial.country.addEventListener('change', () => {
      const valContinent = domSpatial.continent.value;
      const valCountry = domSpatial.country.value;
      const isAll = valCountry === 'all';

      domSpatial.city.innerHTML = '<option value="all">All Cities</option>';
      domSpatial.city.disabled = isAll;

      if (!isAll && hierarchy[valContinent][valCountry]) {
        hierarchy[valContinent][valCountry].forEach(c => {
          domSpatial.city.innerHTML += `<option value="${c}">${c}</option>`;
        });
        flyToLocation(valCountry);
      } else if (isAll) {
        flyToLocation(valContinent);
      }
    });

    domSpatial.city.addEventListener('change', () => {
      const valCity = domSpatial.city.value;
      if (valCity !== 'all') flyToLocation(valCity);
      else flyToLocation(domSpatial.country.value);
    });
  }

  // 执行初始化
  initSpatialFilters();


  const btnAddSpatial = document.getElementById('add-condition-btn'); // 修正：这里可能是指添加空间的按钮
  // 注意：你的 HTML 里可能有 add-spatial-btn (空间) 和 add-condition-btn (语义) 两个加号
  // 请确保 HTML 里的 ID 对应。假设空间加号是 add-spatial-btn
  const btnAddSpatialReal = document.getElementById('add-spatial-btn') || document.getElementById('add-condition-btn'); 




// // --- 3. 核心：动态添加“横向”空间行 (带优化的 FlyTo) ---
//   function addSpatialRow() {
//     const row = document.createElement('div');
//     row.className = 'spatial-row'; 
    
//     const selContinent = createSelect('Continent');
//     const selCountry = createSelect('Country', true);
//     const selCity = createSelect('City', true);

//     const btnDel = document.createElement('button');
//     btnDel.className = 'spatial-remove-btn';
//     btnDel.innerHTML = '&times;';
//     btnDel.onclick = () => {
//       row.remove();
//       if (spatialContainer.children.length === 0) addSpatialRow();
//     };

//     // --- 填充数据 ---
//     fillSelect(selContinent, cachedUniqueData.continents);

//     // --- 定义一个智能飞行函数 ---
//     const smartFlyTo = (name, level) => {
//       const target = findPolygonByName(name);
//       if (!target) return;

//       // 根据层级决定飞行高度 (Range)
//       // Level 3 (City) -> 50,000米 (你的设定)
//       // Level 2 (Country) -> 自动 (或者设为 2,000,000)
//       // Level 1 (Continent) -> 自动 (或者设为 5,000,000)
      
//       let offset = undefined; // 默认为 undefined，让 Cesium 自动计算最佳全景

//       if (level === 'city') {
//         offset = new HeadingPitchRange(
//           0,              // Heading (方向): 北
//           -Math.PI / 2,   // Pitch (俯仰): -90度 (垂直向下，标准的地图视角)
//           // -Math.PI*7/8 // (注: -Math.PI*7/8 约为 -157度，这在 Cesium 里可能是仰视或无效值，通常垂直向下是 -Math.PI/2)
//           50000           // Range (距离): 50km
//         );
//       } 
//       // 如果你也想定制国家的高度：
//       else if (level === 'country') {
//         offset = new HeadingPitchRange(0, -Math.PI/2, 1500000);
//       }
//       else if (level === 'continent') {
//         offset = new HeadingPitchRange(0, -Math.PI/2, 3000000);
//       }

//       viewer.flyTo(target, { 
//         duration: 1.5,
//         offset: offset 
//       });
//     };

//     // --- 事件绑定 ---

//     // 1. 大洲 -> 国家
//     selContinent.addEventListener('change', () => {
//       const val = selContinent.value;
//       const isAll = val === 'all';
      
//       resetSelect(selCountry, 'Country', isAll);
//       resetSelect(selCity, 'City', true);
      
//       if (!isAll) {
//         fillSelect(selCountry, cachedUniqueData.countries);
//         smartFlyTo(val, 'continent'); // 飞向大洲
//       }
//     });

//     // 2. 国家 -> 城市
//     selCountry.addEventListener('change', () => {
//       const val = selCountry.value;
//       const isAll = val === 'all';
      
//       resetSelect(selCity, 'City', isAll);
      
//       if (!isAll) {
//         fillSelect(selCity, cachedUniqueData.cities);
//         smartFlyTo(val, 'country'); // 飞向国家
//       } else {
//         smartFlyTo(selContinent.value, 'continent'); // 回退
//       }
//     });

//     // 3. 城市 -> 飞行 (这里应用你的 50000m 设置)
//     selCity.addEventListener('change', () => {
//         const val = selCity.value;
//         if (val !== 'all') {
//             smartFlyTo(val, 'city'); // 飞向城市 (应用 offset)
//         } else {
//             smartFlyTo(selCountry.value, 'country'); // 回退
//         }
//     });

//     // 组装
//     row.appendChild(selContinent);
//     row.appendChild(selCountry);
//     row.appendChild(selCity);
//     row.appendChild(btnDel);

//     spatialContainer.appendChild(row);
//   }

}); // <--- .then() 结束

// 2. 等待所有任务完成
Promise.all([p1, p2, p3, pMuseum]).then(() => {
    // console.log("🌍 地图全家桶加载完毕，开始构建系统...");

    // // A. 基于地图构建导航树 (保证下拉菜单里有全世界，而不仅仅是博物馆所在的城市)
    // spatialHierarchy = buildHierarchyFromMaps(); 
    
    // B. 初始化下拉菜单 UI
    const spatialContainer = document.getElementById('spatial-builder-container');
    if (spatialContainer) {
        spatialContainer.innerHTML = ''; 
        addSpatialRow(); 
    }
    
    // console.log("🔌 初始化 UserGuide 插件...");
    const guide = new UserGuidePlugin(); // 1. 实例化
    guide.init();                        // 2. 初始化配置
    guide.start();                       // 3. 尝试启动

    // ---------------------------------------------------------
    // 1. 初始化 Fully Guided Mode (全辅助导航 UI)
    // ---------------------------------------------------------
    try {
        // 构建层级数据
        if (typeof buildHierarchyFromMaps === 'function') {
            spatialHierarchy = buildHierarchyFromMaps();
        }
        // 渲染下拉菜单
        const spatialContainer = document.getElementById('spatial-builder-container');
        if (spatialContainer && typeof addSpatialRow === 'function') {
            spatialContainer.innerHTML = ''; 
            addSpatialRow(); 
        }
    } catch (e) {
        console.error("❌ Guided Mode Init Failed:", e);
    }

    // ---------------------------------------------------------
    // 2. 初始化 AI 路线规划器 (RoutePlanner)
    // ---------------------------------------------------------
    // 它是 UserCenter 的“大脑”，负责跟后端通信和画线
    // 注意：确保 museumDataSource 是你加载 GeoJSON 后的变量名 (通常在 pMuseum 或全局变量里)
    const routePlanner = new RoutePlanner(viewer, museumDataSource);
    // console.log("🌍 Data loaded...");

    // 1. 初始化用户中心
    const userCenter = new UserCenter(routePlanner);
    userCenter.init();
    window.UserCenter = userCenter;

    // 2. 初始化智能体 (NaviAI)
    // 注意：NaviAgent 需要 viewer 和 museumDataSource
    const naviAgent = new NaviAgent(viewer, museumDataSource);
    naviAgent.init();
    
    // 挂载到 window，因为 UserCenter 里会调用 window.AgentController.setUserRole
    // 这样就保持了兼容性！
    window.AgentController = naviAgent; 

    // 3. 刷新 UI 状态
    if (typeof updateAgentButtonText === 'function') updateAgentButtonText();

    // ... 其他初始化逻辑 ...
}).catch(err => {
    console.error(err);
});

// // 3.1 加载 Level 1: 欧洲
// dsEurope = new GeoJsonDataSource('europe');
// viewer.dataSources.add(dsEurope);

// dsEurope.load('/data/World_Continen_FeaturesToJSO.geojson', {
//   stroke: Color.WHITE,
//   strokeWidth: 2,
//   fill: Color.fromCssColorString('#2a9d8f').withAlpha(0.3)
// }).then(ds => {
//   ds.entities.values.forEach(entity => {
//     if (entity.properties && entity.properties.CONTINENT) {
//         entity.properties.addProperty('name', entity.properties.CONTINENT.getValue());
//         entity.polygon.distanceDisplayCondition = DIST_LEVEL_1;
//     }
//     // console.log(entity);
//   });

// });

// // 3.2 加载 Level 2: 德国
// dsGermany = new GeoJsonDataSource('germany');
// viewer.dataSources.add(dsGermany);

// dsGermany.load('/data/worldadministr_FeaturesToJSO1.geojson', {
//   stroke: Color.WHITE,
//   strokeWidth: 2,
//   fill: Color.fromCssColorString('#e6b63cff').withAlpha(0.3)
// }).then(ds => {
//   ds.entities.values.forEach(entity => {
//     if (entity.properties && entity.properties.name) {
//       // entity.properties.addProperty('name', entity.properties.name.getValue());
//       entity.polygon.distanceDisplayCondition = DIST_LEVEL_2;
//       // entity.properties.addProperty('name', 'Germany');
//     }
//     // console.log(entity);
//   });

// });

// // 3.2.5 加载 Level 2.5: 慕尼黑
// dsGermanyCounties = new GeoJsonDataSource('germany_counties');
// viewer.dataSources.add(dsGermanyCounties);

// dsGermanyCounties.load('/data/germany_counti_FeaturesToJSO.geojson', {
//   stroke: Color.WHITE.withAlpha(0.5),
//   strokeWidth: 1,
//   fill: Color.fromCssColorString('#f4a261').withAlpha(0.3)
// }).then(ds => {
//   ds.entities.values.forEach(entity => {
//     if (entity.properties && entity.properties.name) {
//       entity.polygon.distanceDisplayCondition = DIST_LEVEL_3;
//       // 简单起见，把所有行政区都标记为 Munich，或者保留原名
//       // if (!entity.properties.hasProperty('name')) {
//       //    entity.properties.addProperty('name', 'Munich');
//       // } else {
//          // 如果你想保留行政区名(如 Maxvorstadt)，就注释掉下面这行
//         //  entity.properties.name = 'Munich'; 
//       // }
      
//     }
//     // console.log(entity);
//   });

// });

// // 3.3 加载 Level 3: 慕尼黑
// dsMunich = new GeoJsonDataSource('munich');
// viewer.dataSources.add(dsMunich);

// dsMunich.load('/data/germany_counti_FeaturesToJSO.geojson', {
//   stroke: Color.WHITE.withAlpha(0.5),
//   strokeWidth: 1,
//   fill: Color.fromCssColorString('#f4a261').withAlpha(0.3)
// }).then(ds => {
//   ds.entities.values.forEach(entity => {
//     if (entity.properties && entity.properties.name) {
//       entity.polygon.distanceDisplayCondition = DIST_LEVEL_3;
//       // 简单起见，把所有行政区都标记为 Munich，或者保留原名
//       // if (!entity.properties.hasProperty('name')) {
//       //    entity.properties.addProperty('name', 'Munich');
//       // } else {
//          // 如果你想保留行政区名(如 Maxvorstadt)，就注释掉下面这行
//         //  entity.properties.name = 'Munich'; 
//       // }
      
//     }
//     // console.log(entity);
//   });

// });



// 2. 加载 Museums (Points) 并初始化所有逻辑


// --- 辅助函数：用 Canvas 画聚合图标 ---
// 把它放在 loadPolygonLayer 或者 main.js 底部都可以
function drawClusterIcon(text, radius, colorCss) {
    const canvas = document.createElement('canvas');
    const size = radius * 2;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 1. 画圆
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fillStyle = colorCss;
    ctx.fill();
    
    // 2. 画边框 (白色光晕)
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.stroke();

    // 3. 画文字
    ctx.font = `bold ${radius * 0.9}px sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, radius, radius);

    return canvas;
}


// 动态生成图例 (多语言版)
function updateLegendUI() {
    const legendContainer = document.getElementById('legend-panel');
    if (!legendContainer) return;

    // 1. 标题 (使用 i18n)
    let html = `<h4 data-i18n="legend_title">${i18n.t('legend_title')}</h4>`;
    
    // 2. 层级说明 (文字也建议用 i18n，这里暂时手动保留英文结构，你可以给它们也加 Key)
    html += `
    <div style="margin-bottom:8px; border-bottom:1px solid #555; padding-bottom:5px;">
        <div class="legend-item">
            <span class="symbol" style="background:#7209b7; border:2px solid white;"></span> 
            <span style="font-size:0.8em">${i18n.t('legend_level_continent')}</span>
        </div>
        <div class="legend-item">
            <span class="symbol" style="background:#f4a261; border:2px solid white;"></span> 
            <span style="font-size:0.8em">${i18n.t('legend_level_country')}</span>
        </div>
        <div class="legend-item">
            <span class="symbol" style="background:#D90429; border:2px solid white;"></span> 
            <span style="font-size:0.8em">${i18n.t('legend_level_city')}</span>
        </div>
    </div>
    `;

    // 3. 语义分类说明标题 (使用 i18n)
    html += `<div style="font-size:0.8em; color:#aaa; margin-bottom:5px;">${i18n.t('legend_type_title')}</div>`;
    
    // 获取颜色键并排序 (Unknown 放最后)
    const keys = Object.keys(SUPER_CATEGORY_COLORS);
    const sortedKeys = keys.filter(k => k !== 'Unknown');
    sortedKeys.push('Unknown'); 

    sortedKeys.forEach(originalKey => {
        // const color = SUPER_CATEGORY_COLORS[originalKey];
        const colorObj = SUPER_CATEGORY_COLORS[originalKey];
        // const colorObj = getCategoryColor(originalKey); // 注意：这里需要获取 Cesium Color 对象
        // 如果你的 getCategoryColor 返回的是对象，用 .toCssColorString()
        // 如果直接是字符串，就直接用。这里假设是 Cesium Color 对象：
        
        
        // 🔥 核心：通过映射表找到 translation key，然后翻译
        const i18nKey = CATEGORY_I18N_MAP[originalKey];
        const label = i18n.t(i18nKey); 

        // 🔥 核心修改：让图例直接使用 Canvas 生成的图片
        // 1. 调用绘图函数
        const canvas = createMuseumPinCanvas(colorObj);
        // 2. 转为 Base64 图片地址
        const iconUrl = canvas.toDataURL();

        html += `
        <div class="legend-item" style="display:flex; align-items:center; margin-bottom: 6px;">
            <img src="${iconUrl}" style="width: 20px; height: 20px; margin-right: 8px; filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.3));" />
            
            <span style="font-size: 0.9em;">${label}</span>
        </div>
        `;
    });

    legendContainer.innerHTML = html;
}

// 记得在数据加载完成后调用一次
updateLegendUI();


// document.addEventListener('DOMContentLoaded', () => {
//     // 初始化用户中心插件
//     const userCenter = new UserCenter();
//     userCenter.init();
    
//     // 把实例挂载到 window，方便调试或其他组件调用 (比如 Agent 想主动打开面板)
//     window.UserCenter = userCenter;
// });


// src/main.js - 替换底部的 initAutoRotation 函数

/**
 * 🌍 智能地球自转系统 (UI 区域限定版)
 * - 仅在操作地图 或 鼠标进入特定 UI 区域 (Sidebar/NaviAI) 时停止
 * - 持续 1 分钟无操作后，自动恢复旋转
 */
function initAutoRotation(viewer) {
    console.log("🎬 Smart Auto-rotation initialized (Targeted UI).");

    const SPIN_RATE = 0.7;      // 自转速度
    const IDLE_TIMEOUT = 60000; // 1分钟无操作后恢复
    // const IDLE_TIMEOUT = 3000; // 调试用：3秒

    let rotationRemover = null; 
    let idleTimer = null;       
    let lastNow = Date.now();

    // --- 1. 开始旋转 ---
    const startRotation = () => {
        if (rotationRemover) return;
        
        console.log("♻️ Resuming auto-rotation...");
        lastNow = Date.now(); 

        const rotateCallback = () => {
            const now = Date.now();
            const delta = (now - lastNow) / 1000; 
            lastNow = now;
            const radians = - (SPIN_RATE * (Math.PI / 180)) * delta;
            viewer.camera.rotate(Cartesian3.UNIT_Z, radians);
        };
        rotationRemover = viewer.scene.postUpdate.addEventListener(rotateCallback);
    };

    // --- 2. 停止旋转 ---
    const stopRotation = () => {
        if (rotationRemover) {
            rotationRemover();
            rotationRemover = null;
            console.log("🛑 Interaction detected. Rotation paused.");
        }
    };

    // --- 3. 活跃检测 (重置倒计时) ---
    const handleUserActivity = () => {
        stopRotation(); // 立即停
        if (idleTimer) clearTimeout(idleTimer); // 清理旧倒计时
        idleTimer = setTimeout(() => { startRotation(); }, IDLE_TIMEOUT); // 设新倒计时
    };

    // --- 4. 挂载全局方法 ---
    window.stopEarthRotation = handleUserActivity;

    // --- 5. 监听地图本身的交互 (必须) ---
    const mapHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    [
        ScreenSpaceEventType.LEFT_DOWN,
        ScreenSpaceEventType.RIGHT_DOWN,
        ScreenSpaceEventType.MIDDLE_DOWN,
        ScreenSpaceEventType.WHEEL,
        ScreenSpaceEventType.PINCH_START
    ].forEach(type => mapHandler.setInputAction(handleUserActivity, type));

    // --- 6. 🔥 核心修改：只监听特定 UI 区域的交互 ---
    const targetIds = [
        'sidebar',          // 左侧栏
        'agent-container',  // NaviAI 对话框
        'agent-avatar',     // NaviAI 头像 (Shizuku)
        'user-profile-widget' // 右上角用户中心 (建议也加上，否则操作登录时地球还在转)
    ];

    targetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // 当鼠标进入、移动、点击、滚动、输入时，都视为“用户在忙”，停止自转
            el.addEventListener('mouseenter', handleUserActivity);
            el.addEventListener('mousemove', handleUserActivity);
            el.addEventListener('click', handleUserActivity);
            el.addEventListener('wheel', handleUserActivity);
            el.addEventListener('keydown', handleUserActivity); // 针对输入框
            el.addEventListener('touchstart', handleUserActivity); // 针对触摸屏
        }
    });

    // 7. 立即启动
    startRotation();
}

// 启动
initAutoRotation(viewer);