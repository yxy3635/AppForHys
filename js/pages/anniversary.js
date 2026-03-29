function goHome() {
  window.location.href = 'home.html';
}

// 使用统一配置中的API地址
const API_BASE_URL = APP_CONFIG.API_BASE;

const MAIN_ANNIVERSARY_DATE = '2022-08-14'; // Hardcoded date for "我们已经在一起"

let serverAnniversaries = []; // To store anniversaries fetched from the backend
let editingAnniversaryId = null; // To keep track of the anniversary being edited
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
  updateDays();
  fetchAnniversaries();
  initializeLunarDateInputs();
  setupDateTypeHandlers();
});

// 添加页面关闭时的清理
window.addEventListener('beforeunload', () => {
  if (onlineStatusUpdateTimer) {
    clearInterval(onlineStatusUpdateTimer);
    onlineStatusUpdateTimer = null;
  }
});

function calcDays(dateStr) {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  const now = new Date();
  
  // 计算从纪念日开始到现在的天数（在一起多少天）
  const diff = now - start;
  return Math.floor(diff / (1000*60*60*24));
}

// 新增函数：计算距离纪念日的天数（用于列表显示）
function calcDaysUntil(dateStr) {
  if (!dateStr) return { days: 0, text: '' };
  
  const eventDate = new Date(dateStr);
  const today = new Date();
  
  // 精确计算天数差异
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eventDateStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const diffDaysExact = (eventDateStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24);

  let daysText = '';
  if (diffDaysExact === 0) {
    daysText = '今天';
  } else if (diffDaysExact < 0) {
    daysText = `${Math.abs(diffDaysExact)} 天前`;
  } else {
    daysText = `${diffDaysExact} 天后`;
  }
  
  return { days: Math.abs(diffDaysExact), text: daysText };
}

function animateDaysCount(target) {
  const el = document.getElementById('days-count');
  if (!el) return;
  
  // 如果目标数字很小，直接显示，不需要动画
  if (target <= 10) {
    el.textContent = target;
    return;
  }
  
  const duration = 600; // 缩短动画时长到0.6秒，减少卡顿
  const start = performance.now();
  const from = 0;
  const to = target;
  
  // 优化：根据目标数字大小动态调整更新频率
  // 对于大数字，减少更新频率；对于小数字，保持流畅
  const maxSteps = Math.min(Math.max(Math.floor(target / 20), 30), 80); // 30-80步之间
  const stepInterval = duration / maxSteps;
  let lastUpdateTime = start;
  let lastValue = from;
  
  function easeOutQuad(t) { return t*(2-t); }
  
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuad(progress);
    const value = Math.round(from + (to - from) * eased);
    
    // 只在值变化且达到时间间隔时更新DOM，大幅减少重绘
    if ((value !== lastValue && now - lastUpdateTime >= stepInterval) || progress >= 1) {
      el.textContent = value;
      lastValue = value;
      lastUpdateTime = now;
    }
    
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = to; // 确保最终值正确
      el.style.willChange = 'auto'; // 动画结束后移除 will-change
    }
  }
  
  // 使用 will-change 优化性能，提示浏览器优化
  el.style.willChange = 'contents';
  requestAnimationFrame(tick);
}

function updateDays() {
  animateDaysCount(calcDays(MAIN_ANNIVERSARY_DATE));
  renderPublicAnniversaries(); // Re-render after main anniversary update
}

// Public Anniversaries functions
// Initialize publicAnniversaries with the main anniversary, and clear other test data
// const publicAnniversaries = [
//   {id: 'main', name: '我们在一起', date: localStorage.getItem('anniv-date') || '', description: ''}
// ];

function renderPublicAnniversaries() {
  const listDiv = document.getElementById('public-anniversaries-list');
  listDiv.innerHTML = '';

  const anniversariesToRender = [];

  // Add the hardcoded "我们在一起" anniversary
  anniversariesToRender.push({
    id: 'main',
    title: '我们在一起',
    date: MAIN_ANNIVERSARY_DATE,
    description: ''
  });

  // Add server anniversaries
  serverAnniversaries.forEach(anniv => {
    anniversariesToRender.push(anniv);
  });

  if (anniversariesToRender.length === 0) {
    listDiv.innerHTML = '<p style="text-align: center; color: #888;">暂无纪念日</p>';
    return;
  }

  anniversariesToRender.sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date

  anniversariesToRender.forEach(anniv => {
    const annivDiv = document.createElement('div');
    annivDiv.className = 'anniversary-item';
    
    let daysText = '';
    let dateDisplayText = anniv.date;
    
    // 对于主纪念日（我们在一起），显示已经在一起的天数
    if (anniv.id === 'main') {
      const daysTogether = calcDays(anniv.date);
      daysText = `已经在一起 ${daysTogether} 天`;
    } else {
      // 检查是否为农历纪念日
      if (anniv.is_lunar && anniv.lunar_year && anniv.lunar_month && anniv.lunar_day) {
        // 农历纪念日
        const lunarDisplay = lunarCalendar.formatLunarDate(anniv.lunar_year, anniv.lunar_month, anniv.lunar_day, anniv.lunar_leap);
        const daysInfo = calcLunarDaysUntil(anniv.lunar_year, anniv.lunar_month, anniv.lunar_day, anniv.lunar_leap);
        const currentYear = new Date().getFullYear();
        const thisYearSolar = lunarCalendar.lunar2solar(currentYear, anniv.lunar_month, anniv.lunar_day, anniv.lunar_leap);
        
        dateDisplayText = `${lunarDisplay}`;
        if (thisYearSolar) {
          dateDisplayText += ` (${currentYear}年公历: ${thisYearSolar.cMonth}月${thisYearSolar.cDay}日)`;
        }
        daysText = daysInfo.text;
      } else {
        // 公历纪念日
        const daysInfo = calcDaysUntil(anniv.date);
        daysText = daysInfo.text;
        dateDisplayText = anniv.date;
      }
    }

    annivDiv.innerHTML = `
      <h3>${anniv.title}</h3>
      <p class="date-info">${dateDisplayText}</p>
      <p class="days-info">${daysText}</p>
      ${anniv.description ? `<p class="description">${anniv.description}</p>` : ''}
      <div class="anniversary-actions">
        ${anniv.id !== 'main' ? `<button onclick="editAnniversary(${typeof anniv.id === 'number' ? anniv.id : `'${anniv.id}'`})" class="edit-btn">编辑</button>` : ''}
        ${anniv.id !== 'main' ? `<button onclick="deleteAnniversary(${typeof anniv.id === 'number' ? anniv.id : `'${anniv.id}'`})" class="delete-btn">删除</button>` : ''}
      </div>
    `;
    listDiv.appendChild(annivDiv);
  });
}

async function fetchAnniversaries() {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    showModal('用户未登录，无法加载纪念日。请先登录。', 'alert', '加载失败');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/anniversary.php?user_id=${userId}`);
    const data = await response.json();
    if (data.success) {
      serverAnniversaries = data.data; // Update serverAnniversaries
      renderPublicAnniversaries(); // Re-render everything
    } else {
      showModal(data.message || '获取纪念日失败。请检查网络或稍后再试。', 'alert', '加载失败');
    }
  } catch (error) {
    console.error('获取纪念日时出错:', error);
    showModal('获取纪念日失败，请检查网络。', 'alert', '加载失败');
  }
}

function showAddAnniversaryModal(anniv = null) {
  const modal = document.getElementById('add-anniversary-modal');
  const titleInput = document.getElementById('new-anniv-name');
  const dateInput = document.getElementById('new-anniv-date-input');
  const descriptionTextarea = document.getElementById('new-anniv-description');
  const solarRadio = document.getElementById('solar-date');
  const lunarRadio = document.getElementById('lunar-date');
  const solarSection = document.getElementById('solar-date-section');
  const lunarSection = document.getElementById('lunar-date-section');

  if (anniv) { // Editing an existing anniversary
    editingAnniversaryId = anniv.id;
    titleInput.value = anniv.title;
    dateInput.value = anniv.date;
    descriptionTextarea.value = anniv.description || '';
    
    // 设置日期类型
    if (anniv.is_lunar) {
      lunarRadio.checked = true;
      solarSection.style.display = 'none';
      lunarSection.style.display = 'block';
      
      // 填充农历字段
      document.getElementById('lunar-year').value = anniv.lunar_year;
      document.getElementById('lunar-month').value = anniv.lunar_month;
      document.getElementById('lunar-day').value = anniv.lunar_day;
      document.getElementById('lunar-leap').checked = anniv.lunar_leap;
      updateLunarPreview();
    } else {
      solarRadio.checked = true;
      solarSection.style.display = 'block';
      lunarSection.style.display = 'none';
    }
    
    modal.querySelector('h2').innerText = '编辑纪念日';
  } else { // Adding a new anniversary
    editingAnniversaryId = null;
    titleInput.value = '';
    dateInput.value = '';
    descriptionTextarea.value = '';
    
    // 重置为公历
    solarRadio.checked = true;
    solarSection.style.display = 'block';
    lunarSection.style.display = 'none';
    
    // 重置农历字段
    document.getElementById('lunar-year').value = new Date().getFullYear();
    document.getElementById('lunar-month').value = '';
    document.getElementById('lunar-day').value = '';
    document.getElementById('lunar-leap').checked = false;
    document.getElementById('lunar-preview').innerHTML = '';
    
    modal.querySelector('h2').innerText = '添加新纪念日';
  }
  modal.classList.remove('hide');
}

function hideAddAnniversaryModal() {
  document.getElementById('add-anniversary-modal').classList.add('hide');
  editingAnniversaryId = null; // Clear editing state
}

function editAnniversary(id) {
  let annivToEdit;
  annivToEdit = serverAnniversaries.find(anniv => anniv.id === id);

  if (annivToEdit) {
    showAddAnniversaryModal(annivToEdit);
  } else {
    showModal('未找到该纪念日。', 'alert', '查找失败');
  }
}

async function deleteAnniversary(id) {
  if (id === 'main') {
    const confirmed = await showModal('确定要删除"我们在一起"纪念日吗？此操作将清除本地记录。\n\n该操作仅清除本地数据，不会影响其他纪念日。', 'confirm', '确认删除', '删除', '取消');
    if (confirmed) {
      localStorage.removeItem('anniv-date');
      updateDays(); // Clear and re-render main anniversary display
      showModal('"我们在一起"纪念日已删除。', 'alert', '删除成功');
      return;
    }
  }

  const confirmed = await showModal('确定要删除这个纪念日吗？此操作不可撤销！', 'confirm', '确认删除', '删除', '取消');
  if (!confirmed) {
    return;
  }

  const userId = localStorage.getItem('user_id');
  if (!userId) {
    showModal('用户未登录，无法删除纪念日。', 'alert', '删除失败');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/anniversary.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        id: id,
        user_id: parseInt(userId)
      }),
    });
    const data = await response.json();

    if (data.success) {
      showModal(data.message, 'alert', '删除成功');
      fetchAnniversaries(); // Re-fetch and re-render after successful deletion
    } else {
      showModal(data.message || '删除失败。请检查网络或稍后再试。', 'alert', '删除失败');
    }
  } catch (error) {
    console.error('删除纪念日时出错:', error);
    showModal('删除纪念日失败，请检查网络。', 'alert', '删除失败');
  }
}

async function saveAnniversary() {
  const title = document.getElementById('new-anniv-name').value.trim();
  const date = document.getElementById('new-anniv-date-input').value;
  const description = document.getElementById('new-anniv-description').value.trim();
  const userId = localStorage.getItem('user_id');
  const isLunar = document.getElementById('lunar-date').checked;

  if (!userId) {
    showModal('用户未登录，无法保存纪念日。请先登录。', 'alert', '保存失败');
    return;
  }

  if (!title || !date) {
    showModal('事件名称和日期不能为空！', 'alert', '输入错误');
    return;
  }

  const payload = {
    user_id: parseInt(userId),
    title: title,
    date: date,
    description: description,
    is_lunar: isLunar
  };



  // 如果是农历，添加农历字段
  if (isLunar) {
    const lunarYear = parseInt(document.getElementById('lunar-year').value);
    const lunarMonth = parseInt(document.getElementById('lunar-month').value);
    const lunarDay = parseInt(document.getElementById('lunar-day').value);
    const lunarLeap = document.getElementById('lunar-leap').checked;

    if (!lunarYear || !lunarMonth || !lunarDay) {
      showModal('农历日期不完整！', 'alert', '输入错误');
      return;
    }

    payload.lunar_year = lunarYear;
    payload.lunar_month = lunarMonth;
    payload.lunar_day = lunarDay;
    payload.lunar_leap = lunarLeap;
  }

  const method = 'POST';
  let action = '';

  if (editingAnniversaryId) {
    // Update existing anniversary
    payload.id = editingAnniversaryId;
    action = 'update';
  } else {
    // Add new anniversary
    action = 'add';
  }
  payload.action = action; // Add action to payload



  try {
    const response = await fetch(`${API_BASE_URL}/anniversary.php`, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      console.error('服务器返回的内容:', responseText);
      showModal('服务器返回了无效的响应格式，请检查后端配置。', 'alert', '保存失败');
      return;
    }

    if (data.success) {
      showModal(data.message, 'alert', '保存成功');
      hideAddAnniversaryModal();
      fetchAnniversaries(); // Re-fetch and re-render after successful save/update
    } else {
      showModal(data.message || '保存失败。请检查网络或稍后再试。', 'alert', '保存失败');
    }
  } catch (error) {
    console.error('保存纪念日时出错:', error);
    showModal('保存纪念日失败，请检查网络。', 'alert', '保存失败');
  }
}

// 初始化农历日期选择器
function initializeLunarDateInputs() {
  const currentYear = new Date().getFullYear();
  const lunarYearSelect = document.getElementById('lunar-year');
  const lunarMonthSelect = document.getElementById('lunar-month');
  const lunarDaySelect = document.getElementById('lunar-day');

  // 填充年份选项（1900-2100）
  for (let year = 1900; year <= 2100; year++) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year + '年';
    if (year === currentYear) {
      option.selected = true;
    }
    lunarYearSelect.appendChild(option);
  }

  // 填充月份选项
  const monthNames = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  for (let month = 1; month <= 12; month++) {
    const option = document.createElement('option');
    option.value = month;
    option.textContent = monthNames[month - 1];
    lunarMonthSelect.appendChild(option);
  }

  // 填充日期选项
  for (let day = 1; day <= 30; day++) {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = getLunarDayChinese(day);
    lunarDaySelect.appendChild(option);
  }

  // 添加农历输入变化监听器
  [lunarYearSelect, lunarMonthSelect, lunarDaySelect, document.getElementById('lunar-leap')].forEach(element => {
    element.addEventListener('change', updateLunarPreview);
  });
}

// 获取农历日期的中文表示
function getLunarDayChinese(day) {
  const nStr2 = ['初', '十', '廿', '卅'];
  const nStr3 = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  
  let s;
  switch (day) {
    case 10:
      s = '初十'; break;
    case 20:
      s = '二十'; break;
    case 30:
      s = '三十'; break;
    default:
      s = nStr2[Math.floor(day/10)];
      s += nStr3[day%10-1];
  }
  return s;
}

// 设置日期类型处理器
function setupDateTypeHandlers() {
  const solarRadio = document.getElementById('solar-date');
  const lunarRadio = document.getElementById('lunar-date');
  const solarSection = document.getElementById('solar-date-section');
  const lunarSection = document.getElementById('lunar-date-section');

  solarRadio.addEventListener('change', () => {
    if (solarRadio.checked) {
      solarSection.style.display = 'block';
      lunarSection.style.display = 'none';
    }
  });

  lunarRadio.addEventListener('change', () => {
    if (lunarRadio.checked) {
      solarSection.style.display = 'none';
      lunarSection.style.display = 'block';
      updateLunarPreview();
    }
  });
}

// 更新农历预览
function updateLunarPreview() {
  const year = parseInt(document.getElementById('lunar-year').value);
  const month = parseInt(document.getElementById('lunar-month').value);
  const day = parseInt(document.getElementById('lunar-day').value);
  const isLeap = document.getElementById('lunar-leap').checked;
  const previewElement = document.getElementById('lunar-preview');

  if (!year || !month || !day) {
    previewElement.innerHTML = '';
    return;
  }

  try {
    const solarDate = lunarCalendar.lunar2solar(year, month, day, isLeap);
    if (solarDate) {
      const lunarDisplay = lunarCalendar.formatLunarDate(year, month, day, isLeap);
      previewElement.innerHTML = `
        <div style="margin-top: 8px; padding: 8px; background-color: #f5f5f5; border-radius: 4px; font-size: 14px;">
          <div><strong>${lunarDisplay}</strong></div>
          <div>对应公历：${solarDate.cYear}-${String(solarDate.cMonth).padStart(2, '0')}-${String(solarDate.cDay).padStart(2, '0')}</div>
        </div>
      `;
      // 自动填充对应的公历日期
      document.getElementById('new-anniv-date-input').value = `${solarDate.cYear}-${String(solarDate.cMonth).padStart(2, '0')}-${String(solarDate.cDay).padStart(2, '0')}`;
    } else {
      previewElement.innerHTML = '<div style="color: red; margin-top: 8px;">无效的农历日期</div>';
    }
  } catch (error) {
    previewElement.innerHTML = '<div style="color: red; margin-top: 8px;">日期转换错误</div>';
  }
}

// 计算农历纪念日距离当年对应公历日期的天数
function calcLunarDaysUntil(lunarYear, lunarMonth, lunarDay, isLeap) {
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // 获取今年农历日期对应的公历日期
  const thisYearSolar = lunarCalendar.lunar2solar(currentYear, lunarMonth, lunarDay, isLeap);
  if (!thisYearSolar) {
    // 如果今年没有这个农历日期（比如闰月），尝试明年
    const nextYearSolar = lunarCalendar.lunar2solar(currentYear + 1, lunarMonth, lunarDay, isLeap);
    if (nextYearSolar) {
      const targetDate = new Date(nextYearSolar.cYear, nextYearSolar.cMonth - 1, nextYearSolar.cDay);
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { days: diffDays, text: `${diffDays} 天后（${nextYearSolar.cYear}年）` };
    }
    return { days: 0, text: '无法计算' };
  }
  
  const targetDate = new Date(thisYearSolar.cYear, thisYearSolar.cMonth - 1, thisYearSolar.cDay);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    // 已经过了，显示明年的
    const nextYearSolar = lunarCalendar.lunar2solar(currentYear + 1, lunarMonth, lunarDay, isLeap);
    if (nextYearSolar) {
      const nextTargetDate = new Date(nextYearSolar.cYear, nextYearSolar.cMonth - 1, nextYearSolar.cDay);
      const nextDiffTime = nextTargetDate.getTime() - today.getTime();
      const nextDiffDays = Math.ceil(nextDiffTime / (1000 * 60 * 60 * 24));
      return { days: nextDiffDays, text: `${nextDiffDays} 天后（${nextYearSolar.cYear}年）` };
    }
  } else if (diffDays === 0) {
    return { days: 0, text: '今天' };
  }
  
  return { days: diffDays, text: `${diffDays} 天后` };
}

// Initial fetch when the page loads
document.addEventListener('DOMContentLoaded', fetchAnniversaries); 