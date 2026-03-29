// 自动初始化雪花效果
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否在排除列表中 (游戏页面)
  const path = window.location.pathname;
  if (path.includes('gomoku') || path.includes('draw-guess') || path.includes('shoot-guess')) {
    return;
  }

  // 检查用户设置，默认为开启
  const snowEnabled = localStorage.getItem('snow_effect_enabled') !== 'false';
  
  if (snowEnabled && window.SnowEffect) {
    // 仅在非深色模式或者根据喜好开启，这里默认开启
    const isDark = document.body.classList.contains('dark-theme');
    
    // 如果页面已有实例，不重复创建（防止多次由于事件触发）
    if (window._snowInstance) return;

    window._snowInstance = new SnowEffect({
      count: 40, // 粒子数量
      speedMultiplier: 0.8, // 速度
      colors: isDark ? ['#ffffff44', '#aaddff44'] : ['#aaddff', '#e6f0ff', '#ffffff']
    });
  }
});
