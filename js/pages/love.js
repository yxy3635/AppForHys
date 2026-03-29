// 使用统一配置中的API地址
const API_BASE_URL = APP_CONFIG.API_BASE;

let onlineStatusUpdateTimer = null; // 用于存储在线状态更新定时器

// 更新用户在线状态
async function updateOnlineStatus() {
  const userId = localStorage.getItem('user_id');
  if (!userId) return;

  try {
    const response = await fetch(`${API_BASE_URL}/update_online_status.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: parseInt(userId)
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (!data.success) {
      console.error('更新在线状态失败:', data.message);
    }
  } catch (error) {
    console.error('更新在线状态失败:', error);
  }
}

// 启动在线状态更新
function startOnlineStatusUpdate() {
  // 清除可能存在的旧定时器
  if (onlineStatusUpdateTimer) {
    clearInterval(onlineStatusUpdateTimer);
  }
  
  // 立即更新一次
  updateOnlineStatus();
  
  // 设置定时更新（每30秒更新一次）
  onlineStatusUpdateTimer = setInterval(updateOnlineStatus, 30000);
}

// 在页面加载完成后启动在线状态更新
document.addEventListener('DOMContentLoaded', () => {
  startOnlineStatusUpdate();
});

// 添加页面关闭时的清理
window.addEventListener('beforeunload', () => {
  if (onlineStatusUpdateTimer) {
    clearInterval(onlineStatusUpdateTimer);
    onlineStatusUpdateTimer = null;
  }
});

// 超梦幻动态爱心流光背景
const canvas = document.getElementById('love-bg');
const ctx = canvas.getContext('2d');
let W = window.innerWidth, H = window.innerHeight;
canvas.width = W;
canvas.height = H;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}
window.addEventListener('resize', resize);

// 彩色流光带
function drawAurora(time) {
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(time/1200 + i);
    const grad = ctx.createLinearGradient(0, H*0.2*i, W, H*0.8);
    grad.addColorStop(0, `hsl(${(time/10+i*60)%360},100%,85%)`);
    grad.addColorStop(1, `hsl(${(time/10+i*60+120)%360},100%,90%)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(W/2, H/2 + Math.sin(time/1800+i)*H/6, W*0.7, H*0.18+Math.sin(time/900+i)*30, Math.PI/8*i, 0, 2*Math.PI);
    ctx.fill();
    ctx.restore();
  }
}

// 漂浮爱心
function drawFloatingHearts(time) {
  for (let i = 0; i < 18; i++) {
    const t = (time/1800 + i*0.2) % (2*Math.PI);
    const x = W/2 + Math.sin(t+i)*W*0.38 + Math.sin(time/900+i)*30;
    const y = H/2 + Math.cos(t+i)*H*0.38 + Math.cos(time/1200+i)*30;
    const size = 22 + 16*Math.sin(time/1000+i*2);
    drawHeart(x, y, size, `rgba(255,${120+Math.sin(i)*80|0},${180+Math.cos(i)*60|0},0.18)`);
  }
}

// 爱心绘制函数
function drawHeart(x, y, size, color) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  for(let t=0;t<=Math.PI*2;t+=0.05){
    const hx = x + size*16*Math.pow(Math.sin(t),3)/18;
    const hy = y - size*(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/18;
    ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size*0.7;
  ctx.fill();
  ctx.restore();
}

// 中央心形粒子
const particles = [];
const particleCount = 120;
function randomHeartPos(scale = 12) {
  const t = Math.random() * Math.PI * 2;
  const x = scale * 16 * Math.pow(Math.sin(t), 3);
  const y = -scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return {x, y};
}
function createParticle() {
  const scale = Math.random() * 0.5 + 0.8;
  const base = randomHeartPos(Math.min(W, H) / (10 + Math.random()*10));
  return {
    baseX: W/2 + base.x,
    baseY: H/2 + base.y,
    x: W/2 + base.x,
    y: H/2 + base.y,
    r: 8 + Math.random() * 10,
    alpha: 0.5 + Math.random() * 0.5,
    color: `rgba(${255},${80+Math.random()*100|0},${120+Math.random()*100|0},`,
    t: Math.random() * Math.PI * 2,
    speed: 0.008 + Math.random() * 0.012,
    float: 20 + Math.random() * 40
  };
}
if (particles.length === 0) {
  for (let i = 0; i < particleCount; i++) {
    particles.push(createParticle());
  }
}

function drawParticles(time) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.t += p.speed;
    const floatX = Math.cos(p.t) * p.float;
    const floatY = Math.sin(p.t*1.2) * p.float * 0.6;
    ctx.beginPath();
    ctx.arc(p.baseX + floatX, p.baseY + floatY, p.r * (0.8 + 0.2*Math.sin(p.t*2)), 0, 2 * Math.PI);
    ctx.fillStyle = p.color + (p.alpha * (0.7 + 0.3 * Math.sin(time / 800 + i))) + ')';
    ctx.shadowColor = '#ff5e62';
    ctx.shadowBlur = 32;
    ctx.fill();
  }
}

// 光晕
function drawGlow(time) {
  ctx.save();
  const grad = ctx.createRadialGradient(W/2, H/2, 60, W/2, H/2, Math.max(W,H)/2);
  grad.addColorStop(0, 'rgba(255,180,200,0.18)');
  grad.addColorStop(1, 'rgba(255,180,200,0)');
  ctx.globalAlpha = 0.7 + 0.2*Math.sin(time/1200);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(W/2, H/2, Math.max(W,H)/2, 0, 2*Math.PI);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// 动态烟雾
function drawSmoke(time) {
  for (let i = 0; i < 4; i++) {
    ctx.save();
    const cx = W/2 + Math.sin(time/3000 + i)*W*0.18 + Math.cos(time/1700 + i*2)*W*0.22;
    const cy = H/2 + Math.cos(time/2500 + i)*H*0.18 + Math.sin(time/2100 + i*2)*H*0.22;
    const r = Math.max(W, H) * (0.28 + 0.08*Math.sin(time/2000+i));
    const grad = ctx.createRadialGradient(cx, cy, r*0.2, cx, cy, r);
    grad.addColorStop(0, `rgba(255,255,255,${0.10+0.08*Math.sin(time/1800+i)})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.22 + 0.08*Math.sin(time/1600+i);
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2*Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }
}

function animate(time) {
  ctx.clearRect(0, 0, W, H);
  drawAurora(time);
  drawSmoke(time);
  drawFloatingHearts(time);
  drawParticles(time);
  drawGlow(time);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate); 