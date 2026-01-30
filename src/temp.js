// --- 4. 核心：动态添加空间行 (合并版) ---
  function addSpatialRow() {
    const row = document.createElement('div');
    row.className = 'spatial-row'; // 对应 CSS 的横向 flex 布局
    
    // 创建 3 个下拉菜单
    const selContinent = createSelect('Continent');
    const selCountry = createSelect('Country', true);
    const selCity = createSelect('City', true);

    // 创建删除按钮
    const btnDel = document.createElement('button');
    btnDel.className = 'spatial-remove-btn'; // 对应 CSS
    btnDel.innerHTML = '&times;';
    btnDel.onclick = () => {
      row.remove();
      // 逻辑优化：如果删光了，自动补一行，保证至少有一行存在
      if (spatialContainer.children.length === 0) addSpatialRow();
    };

    // --- 填充数据 & 绑定级联事件 ---
    
    // A. 初始化第一级
    fillSelect(selContinent, cachedUniqueData.continents);

    // B. 级联: 大洲 -> 国家
    selContinent.addEventListener('change', () => {
      const val = selContinent.value;
      const isAll = val === 'all';
      
      // 重置下级
      selCountry.innerHTML = `<option value="all">All Countries</option>`;
      selCountry.disabled = isAll;
      selCity.innerHTML = `<option value="all">All Cities</option>`;
      selCity.disabled = true;
      
      if (!isAll) {
        // 真实场景应根据 val 筛选。这里简化：显示所有缓存的国家
        fillSelect(selCountry, cachedUniqueData.countries);
        
        // 触发飞行反馈 (可选)
        const target = findPolygonByName(val);
        if (target) viewer.flyTo(target, { duration: 1.5 });
      }
    });

    // C. 级联: 国家 -> 城市
    selCountry.addEventListener('change', () => {
      const val = selCountry.value;
      const isAll = val === 'all';
      
      // 重置下级
      selCity.innerHTML = `<option value="all">All Cities</option>`;
      selCity.disabled = isAll;
      
      if (!isAll) {
        fillSelect(selCity, cachedUniqueData.cities);
        
        // 触发飞行反馈
        const target = findPolygonByName(val);
        if (target) viewer.flyTo(target, { duration: 1.5 });
      } else {
        // 回退飞行到大洲
        const target = findPolygonByName(selContinent.value);
        if (target) viewer.flyTo(target, { duration: 1.5 });
      }
    });

    // D. 城市 -> 飞行
    selCity.addEventListener('change', () => {
        const val = selCity.value;
        if (val !== 'all') {
            const target = findPolygonByName(val);
            if (target) viewer.flyTo(target, { duration: 1.5 });
        } else {
            // 回退飞行到国家
            const target = findPolygonByName(selCountry.value);
            if (target) viewer.flyTo(target, { duration: 1.5 });
        }
    });

    // --- 组装 UI ---
    row.appendChild(selContinent);
    row.appendChild(selCountry);
    row.appendChild(selCity);
    row.appendChild(btnDel);

    // 插入页面
    if (spatialContainer) spatialContainer.appendChild(row);
  }