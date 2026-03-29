// 底部导航栏指示器动画
(function() {
  function initNavIndicator() {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    
    const activeButton = nav.querySelector('button.active');
    if (!activeButton) return;
    
    // 创建指示器元素
    let indicator = nav.querySelector('.nav-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'nav-indicator';
      nav.appendChild(indicator);
    }
    
    // 更新指示器位置
    function updateIndicator(immediate = false) {
      const activeButton = nav.querySelector('button.active');
      if (!activeButton) return;
      
      const navRect = nav.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      
      // 计算位置：居中于按钮，蓝条宽度为按钮宽度的35%
      const buttonWidth = buttonRect.width;
      const indicatorWidth = buttonWidth * 0.35;
      const buttonCenter = buttonRect.left - navRect.left + buttonWidth / 2;
      const left = buttonCenter - indicatorWidth / 2;
      
      if (immediate) {
        // 立即设置位置和宽度，无动画
        indicator.style.transition = 'none';
        indicator.style.width = indicatorWidth + 'px';
        indicator.style.transform = `translateX(${left}px)`;
        // 强制重绘
        indicator.offsetHeight;
        // 恢复动画
        indicator.style.transition = '';
      } else {
        // 先更新宽度（无动画），然后更新位置（有动画）
        const currentWidth = parseFloat(indicator.style.width) || 0;
        if (Math.abs(currentWidth - indicatorWidth) > 1) {
          indicator.style.transition = 'none';
          indicator.style.width = indicatorWidth + 'px';
          indicator.offsetHeight; // 强制重绘
          indicator.style.transition = '';
        }
        // 使用requestAnimationFrame确保在下一帧执行，避免卡顿
        requestAnimationFrame(() => {
          indicator.style.transform = `translateX(${left}px)`;
        });
      }
    }
    
    // 初始化位置（立即显示，无动画）
    updateIndicator(true);
    
    // 延迟一帧后恢复动画，确保初始位置正确
    requestAnimationFrame(() => {
      updateIndicator();
    });
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      updateIndicator(true);
      setTimeout(() => updateIndicator(), 50);
    });
    
    // 监听按钮点击，添加过渡效果
    const buttons = nav.querySelectorAll('button');
    buttons.forEach(button => {
      button.addEventListener('click', function(e) {
        // 移除所有active类
        buttons.forEach(btn => btn.classList.remove('active'));
        // 添加active类到当前按钮
        this.classList.add('active');
        // 使用requestAnimationFrame确保在下一帧执行，避免卡顿
        requestAnimationFrame(() => {
          updateIndicator();
        });
      });
    });
  }
  
  // DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavIndicator);
  } else {
    // 如果DOM已经加载，立即初始化
    initNavIndicator();
  }
})();

