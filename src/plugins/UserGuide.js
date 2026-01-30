// src/plugins/UserGuide.js
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';

export default class UserGuidePlugin {
  constructor() {
    this.tour = null;
  }

  init() {
    this.tour = new Shepherd.Tour({
      useModalOverlay: true, // 开启黑色遮罩，聚焦高亮
      defaultStepOptions: {
        classes: 'shepherd-theme-custom',
        scrollTo: false, // Cesium 应用通常不需要滚动，设为 false 防止抖动
        cancelIcon: { enabled: true }
      }
    });

    // --- 基于你截图布局的全新步骤 ---
    this.tour.addSteps([
      // Step 1: 欢迎 (中央)
      {
        id: 'welcome',
        title: 'Welcome to Navimus',
        text: 'This is your interactive 3D platform to explore museum data.',
        // attachTo: { element: '#cesium-container', on: 'center' }, // 聚焦整个地图
        buttons: [
          { text: 'Skip', action: this.tour.cancel, classes: 'shepherd-button-secondary' },
          { text: 'Start Tour', action: this.tour.next, classes: 'shepherd-button' }
        ]
      },

      // Step 2: 侧边栏 (左侧) - 对应图中 "1, 2, 3"
      {
        id: 'sidebar-modes',
        title: 'Switch Modes',
        text: 'Use this sidebar to toggle between <b>Free</b>, <b>Guided</b>, and <b>Semi-Guided</b> exploration modes.',
        attachTo: { element: '#sidebar-toggle-btn', on: 'right' }, // 指向左侧侧边栏，框在右边显示
        buttons: [
          { text: 'Back', action: this.tour.back, classes: 'shepherd-button-secondary' },
          { text: 'Next', action: this.tour.next, classes: 'shepherd-button' }
        ]
      },

      // Step 3: 状态栏 (顶部居中) - 对应图中 "Current Mode: ..."
      {
        id: 'mode-indicator',
        title: 'Current Status',
        text: 'Ideally located here, you can always see which mode is currently active.',
        // ⚠️ 请确认 index.html 里这个元素的 ID 是 mode-indicator
        attachTo: { element: '#mode-indicator', on: 'bottom' }, 
        buttons: [
          { text: 'Back', action: this.tour.back, classes: 'shepherd-button-secondary' },
          { text: 'Next', action: this.tour.next, classes: 'shepherd-button' }
        ]
      },

      // Step 4: 登录与图例 (右上角)
      {
        id: 'legend-area',
        title: 'Legend & User',
        text: 'Check map symbols here, or toggle the "Agent" visibility by changing your user role.',
        // ⚠️ 建议给右上角的容器加个 ID，比如 right-panel-container
        // 如果没有，暂时先指向图例
        attachTo: { element: '#mock-login-btn', on: 'left' },
        buttons: [
          { text: 'Back', action: this.tour.back, classes: 'shepherd-button-secondary' },
          { text: 'Next', action: this.tour.next, classes: 'shepherd-button' }
        ]
      },
      
      // Step 5: 空间筛选 (左侧弹出层) - 如果当前有显示的话
      {
        id: 'spatial-filter',
        title: 'Spatial Navigation',
        text: 'When in Guided Mode, dropdown menus will appear here to help you filter by Continent, Country, or City.',
        // 这里指向你的 spatial-builder-container
        attachTo: { element: '#spatial-builder-container', on: 'right' },
        buttons: [
          { text: 'Done', action: this.tour.complete, classes: 'shepherd-button' }
        ]
      }
    ]);
  }

  start() {
    if (!this.tour) this.init();
    // 调试期间先注释掉 localStorage 检查，方便每次刷新都看效果
    // if (!localStorage.getItem('has_seen_guide')) {
        this.tour.start();
    //    localStorage.setItem('has_seen_guide', 'true');
    // }
  }
}