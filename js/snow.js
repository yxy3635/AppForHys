class SnowEffect {
  constructor(options = {}) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.particles = [];
    this.active = true;
    
    // 配置
    this.options = Object.assign({
      count: 50,           // 粒子数量
      speedMultiplier: 0.8, // 整体速度倍率
      wind: 0,             // 基础风向
    }, options);

    this.init();
  }

  init() {
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    document.body.appendChild(this.canvas);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.createParticles();
    this.animate();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.options.count; i++) {
      this.particles.push(this.createParticle(true)); // true 表示初始化，随机分布在屏幕上
    }
  }

  createParticle(init = false) {
    // 深度因子 0.1 (远) - 1.0 (近)
    const depth = Math.random() * 0.9 + 0.1; 
    
    return {
      x: Math.random() * this.width,
      y: init ? Math.random() * this.height : -20, // 初始化时满屏，后续从顶部生成
      // 近大远小：大小范围 2px - 6px
      size: (depth * 4) + 1.5,
      // 近快远慢：速度范围
      speedY: (depth * 1.5 + 0.5) * this.options.speedMultiplier,
      // 左右摇摆参数
      oscillationSpeed: Math.random() * 0.02 + 0.01,
      oscillationDistance: Math.random() * 40 + 20,
      oscillationOffset: Math.random() * Math.PI * 2,
      // 透明度：远处略淡
      opacity: Math.random() * 0.4 + 0.4,
      depth: depth
    };
  }

  animate() {
    if (!this.active) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    this.particles.forEach((p, i) => {
      // 更新位置
      // Y轴下落
      p.y += p.speedY;
      
      // X轴根据正弦波摇摆，模拟飘落
      const oscillation = Math.sin(Date.now() * 0.001 * p.speedY + p.oscillationOffset);
      p.x += oscillation * 0.3 + this.options.wind;

      // 边界检查
      if (p.y > this.height + 10) {
        this.particles[i] = this.createParticle();
      }
      
      // 简单的循环边界，防止风把雪花吹光
      if (p.x > this.width + 20) p.x = -20;
      if (p.x < -20) p.x = this.width + 20;

      // 绘制 - 使用径向渐变模拟柔和的雪球
      const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      
      // 雪花核心颜色
      gradient.addColorStop(0, `rgba(255, 255, 255, ${p.opacity})`);
      // 边缘模糊
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${p.opacity * 0.5})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    requestAnimationFrame(() => this.animate());
  }

  destroy() {
    this.active = false;
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

window.SnowEffect = SnowEffect;
