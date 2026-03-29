function goHome() {
  window.location.href = 'home.html';
}

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

// Profile data (will be populated from localStorage first, then backend)
let userProfile = {
  username: localStorage.getItem('username') || '默认用户',
  signature: localStorage.getItem('signature') || '欢迎来到我的个人主页！',
  avatar: localStorage.getItem('avatar') || 'img/default-avatar.png'
};

async function fetchUserProfile() {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    showModal('用户未登录，无法获取个人资料。', 'alert', '错误');
    // 可以选择跳转到登录页
    // window.location.href = 'index.html';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/profile.php?user_id=${userId}`);
    const data = await response.json();

    if (data.success && data.user) {
      userProfile.username = data.user.username || '默认用户';
      userProfile.signature = data.user.signature || '欢迎来到我的个人主页！';
      userProfile.avatar = data.user.avatar_url || 'img/default-avatar.png';
      // 同步更新localStorage，确保下次加载时有缓存，即使服务器请求失败
      localStorage.setItem('username', userProfile.username);
      localStorage.setItem('signature', userProfile.signature);
      localStorage.setItem('avatar', userProfile.avatar);
      renderProfile();
    } else {
      showModal(data.message || '获取个人资料失败。', 'alert', '错误');
      // 此时可能使用localStorage的旧数据，或者保持默认值
      renderProfile(); // 渲染当前userProfile（可能是默认值或旧的localStorage数据）
    }
  } catch (error) {
    console.error('获取个人资料时出错:', error);
    showModal('网络错误，无法获取个人资料。', 'alert', '错误');
    // 此时可能使用localStorage的旧数据，或者保持默认值
    renderProfile(); // 渲染当前userProfile（可能是默认值或旧的localStorage数据）
  }
}

function renderProfile() {
  document.getElementById('display-username').innerText = userProfile.username;
  document.getElementById('display-signature').innerText = userProfile.signature;
  document.getElementById('avatar').src = userProfile.avatar;

  // Also update edit fields
  document.getElementById('edit-username').value = userProfile.username;
  document.getElementById('edit-signature').value = userProfile.signature;
}

function toggleEditMode() {
  const isInViewMode = !document.getElementById('edit-profile-btn').classList.contains('hide');
  const profileCard = document.querySelector('.profile-card');
  // Get all elements with the class 'edit-field'
  const editFields = document.querySelectorAll('.edit-field');

  if (isInViewMode) { // Currently in view mode, switch to edit mode
    // Hide display elements
    document.getElementById('display-username').classList.add('hide');
    document.getElementById('display-signature').classList.add('hide');
    // Show edit fields and their corresponding labels
    editFields.forEach(field => {
      field.classList.remove('hide');
      field.classList.add('animate-fadein');
      setTimeout(() => field.classList.remove('animate-fadein'), 600); // 动画后移除class
    });
    // Hide '编辑资料' button, show '保存' and '取消' buttons
    document.getElementById('edit-profile-btn').classList.add('hide');
    document.getElementById('save-profile-btn').classList.remove('hide');
    document.getElementById('cancel-edit-btn').classList.remove('hide');
    // 新增：编辑态美化
    if (profileCard) profileCard.classList.add('edit-mode');
  } else { // Currently in edit mode, switch to view mode
    // Show display elements
    document.getElementById('display-username').classList.remove('hide');
    document.getElementById('display-signature').classList.remove('hide');
    // Hide edit fields and their corresponding labels
    editFields.forEach(field => {
      field.classList.add('hide');
    });
    // Show '编辑资料' button, hide '保存' and '取消' buttons
    document.getElementById('edit-profile-btn').classList.remove('hide');
    document.getElementById('save-profile-btn').classList.add('hide');
    document.getElementById('cancel-edit-btn').classList.add('hide');
    // 新增：退出编辑态
    if (profileCard) profileCard.classList.remove('edit-mode');
  }
}

function saveProfile() {
  const newUsername = document.getElementById('edit-username').value.trim();
  const newSignature = document.getElementById('edit-signature').value.trim();
  const userId = localStorage.getItem('user_id');

  if (!userId) {
    showModal('用户未登录，无法保存资料。', 'alert', '保存失败');
    return;
  }

  if (!newUsername) {
    showModal('用户名不能为空！', 'alert', '输入错误');
    return;
  }

  // 创建 FormData 对象来发送数据
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('username', newUsername);
  formData.append('signature', newSignature);

  fetch(`${API_BASE_URL}/update_profile.php`, {
    method: 'POST',
    body: formData, // 使用 FormData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      userProfile.username = newUsername;
      userProfile.signature = newSignature;
      localStorage.setItem('username', newUsername);
      localStorage.setItem('signature', newSignature);
      renderProfile();
      toggleEditMode(); // Exit edit mode
      showModal(data.message || '资料已保存！', 'alert', '保存成功');
    } else {
      showModal(data.message || '保存失败', 'alert', '保存失败');
    }
  })
  .catch(error => {
    console.error('保存个人资料时出错:', error);
    showModal('网络错误，无法保存资料。', 'alert', '保存失败');
  });
}

function cancelEdit() {
  // Revert edit fields to original values by re-rendering from userProfile
  renderProfile();
  toggleEditMode(); // Exit edit mode
  // 新增：退出编辑态
  const profileCard = document.querySelector('.profile-card');
  if (profileCard) profileCard.classList.remove('edit-mode');
}

function chooseAvatar() {
  document.getElementById('avatar-input').click();
}

async function updateAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;

  const userId = localStorage.getItem('user_id');
  if (!userId) {
    showModal('用户未登录，无法上传头像。', 'alert', '上传失败');
    return;
  }

  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('avatar', file); // 'avatar' 是后端接收文件的字段名

  try {
    showModal('正在上传头像...', 'alert', '上传中');
    const response = await fetch(`${API_BASE_URL}/upload_avatar.php`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (data.success && data.avatar_url) {
      userProfile.avatar = data.avatar_url;
      localStorage.setItem('avatar', data.avatar_url);
      document.getElementById('avatar').src = data.avatar_url;
      showModal(data.message || '头像上传成功！', 'alert', '上传成功');
    } else {
      showModal(data.message || '头像上传失败。', 'alert', '上传失败');
    }
  } catch (error) {
    console.error('上传头像时出错:', error);
    showModal('网络错误，无法上传头像。', 'alert', '上传失败');
  }
}

function toggleTheme() {
  // Theme logic is now in js/theme.js
  const currentTheme = localStorage.getItem('app-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('app-theme', newTheme);
  // applyTheme(newTheme); // applyTheme is now handled by theme.js
  // Manually apply for immediate feedback if not navigating
  if (newTheme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

window.onload = async function() {
  // 1. 立即渲染页面，使用localStorage中的缓存数据
  renderProfile();

  // 2. 如果用户已登录，异步从服务器获取最新资料并更新缓存和UI
  const userId = localStorage.getItem('user_id');
  if (userId) {
    fetchUserProfile(); // 不使用 await，使其在后台执行，不阻塞页面加载
  } else {
    showModal('您尚未登录，请先登录！', 'alert', '未登录');
    // window.location.href = 'index.html'; // 可以取消注释以跳转到登录页
  }

  // Initialize theme toggle switch based on saved theme
  const savedTheme = localStorage.getItem('app-theme');
  if (savedTheme) {
    document.getElementById('theme-toggle').checked = (savedTheme === 'dark');
  } else { // Default to light theme
    document.getElementById('theme-toggle').checked = false;
  }
  document.getElementById('theme-toggle').addEventListener('change', toggleTheme);

  // Initialize snow effect toggle
  const snowEnabled = localStorage.getItem('snow_effect_enabled') !== 'false'; // Default to true
  document.getElementById('snow-toggle').checked = snowEnabled;
  document.getElementById('snow-toggle').addEventListener('change', function() {
    localStorage.setItem('snow_effect_enabled', this.checked);
  });

  // 在页面加载完成后启动在线状态更新
  startOnlineStatusUpdate();
}

async function logout() {
  const confirmed = await showModal('确定要退出登录吗？', 'confirm', '退出登录', '确认退出', '取消');
  if (confirmed) {
    // Clear user data from localStorage
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('signature');
    localStorage.removeItem('avatar');
    localStorage.removeItem('anniv-date'); // Also clear anniversary date if it's stored locally

    // Redirect to the login page
    window.location.href = 'index.html';
  }
}

// 下载并显示进度条
async function downloadAndShowProgress(downloadUrl) {
  const bar = document.getElementById('update-progress-bar');
  const inner = document.getElementById('update-progress-inner');
  const text = document.getElementById('update-progress-text');
  bar.style.display = 'flex';
  inner.style.width = '0';
  text.textContent = '0%';

  if (!window.plus || !plus.downloader) {
    showModal('请在App内使用此功能！', 'alert', '提示');
    bar.style.display = 'none';
    return;
  }

  const dtask = plus.downloader.createDownload(downloadUrl, {}, function(d, status) {
    if (status == 200) {
      bar.style.display = 'none';
      plus.runtime.install(d.filename, {}, function() {
        showModal('安装成功！', 'alert', '更新');
      }, function(e) {
        showModal('安装失败: ' + e.message, 'alert', '更新');
      });
    } else {
      bar.style.display = 'none';
      showModal('下载失败，请重试', 'alert', '更新');
    }
  });

  dtask.addEventListener('statechanged', function(task, status) {
    if (task.state == 3 && task.totalSize > 0) { // 下载中
      const percent = Math.floor((task.downloadedSize / task.totalSize) * 100);
      inner.style.width = percent + '%';
      text.textContent = percent + '%';
    }
  }, false);

  dtask.start();
}

// 修改检测更新逻辑，集成进度条
async function checkAppUpdate() {
     			const API_URL = APP_CONFIG.VERSION_CHECK_URL;
  let currentVersion = '未知';
  if (window.plus && plus.runtime && plus.runtime.getProperty) {
    plus.runtime.getProperty(plus.runtime.appid, function(inf) {
      currentVersion = inf.version;
      fetchAndShow(currentVersion);
    });
  } else {
    currentVersion = localStorage.getItem('app_version') || '0.0.0';
    fetchAndShow(currentVersion);
  }

  function fetchAndShow(currentVersion) {
    fetch(API_URL)
      .then(response => response.json())
      .then(data => {
        if (data && data.version) {
          const latestVersion = data.version;
          const changelog = data.changelog || '';
          const releaseDate = data.releaseDate || '';
          let msg = `当前版本：${currentVersion}<br>最新版本：${latestVersion}<br>发布日期：${releaseDate}`;
          if (changelog) {
            let formattedChangelog = changelog
              .replace(/\n/g, '<br>')
              .replace(/\n/g, '<br>')
              .replace(/(^|<br>)[\-•\d]+[\.、]*/g, '<br>• ');
            msg += `<br><br><b>更新内容：</b>${formattedChangelog}`;
          }
          if (compareVersions(currentVersion, latestVersion)) {
            showModal(msg, 'confirm', '发现新版本', '去下载', '取消').then(go => {
              if (go && data.downloadUrl) {
                downloadAndShowProgress(data.downloadUrl);
              }
            });
          } else {
            showModal(msg, 'alert', '检测更新');
          }
        } else {
          showModal('未获取到版本信息', 'alert', '检测更新');
        }
      })
      .catch(() => {
        showModal('检测更新失败，请检查网络。', 'alert', '检测更新');
      });
  }
}

// 版本号对比函数
function compareVersions(current, latest) {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  for (let i = 0; i < latestParts.length; i++) {
    if (currentParts[i] === undefined || currentParts[i] < latestParts[i]) {
      return true; // 需要更新
    } else if (latestParts[i] < currentParts[i]) {
      return false; // 当前比最新还高
    }
  }
  return false; // 相等
}

document.addEventListener('DOMContentLoaded', function() {
  const updateBtn = document.getElementById('check-update-btn');
  if (updateBtn) {
    updateBtn.onclick = checkAppUpdate;
  }
});

// 添加页面关闭时的清理
window.addEventListener('beforeunload', () => {
  if (onlineStatusUpdateTimer) {
    clearInterval(onlineStatusUpdateTimer);
    onlineStatusUpdateTimer = null;
  }
  if (serverStatusUpdateTimer) {
    clearInterval(serverStatusUpdateTimer);
    serverStatusUpdateTimer = null;
  }
});

// 服务器状态相关函数
let serverStatusUpdateTimer = null;

async function showServerStatus() {
  const modal = document.getElementById('server-status-modal');
  const content = document.getElementById('server-status-content');
  
  // 显示模态框
  modal.style.display = 'flex';
  
  // 显示加载状态
  content.innerHTML = `
    <div class="server-status-loading">
      <div class="loading-spinner"></div>
      <p>正在获取服务器状态...</p>
    </div>
  `;
  
  // 开始自动更新
  startServerStatusAutoUpdate();
  
  try {
    // 获取服务器状态
    const response = await fetch(`${API_BASE_URL}/server_status.php`);
    const data = await response.json();
    
    if (data.success) {
      // 显示服务器状态信息
      content.innerHTML = `
        <div class="server-status-info">
          <!-- 基础状态 -->
          <div class="status-section">
            <h4 class="section-title">🖥️ 基础状态</h4>
            <div class="status-item">
              <span class="status-label">服务器状态</span>
              <span class="status-value ${data.status === 'online' ? 'status-online' : 'status-offline'}">
                ${data.status === 'online' ? '🟢 在线' : '🔴 离线'}
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">⚡ 响应时间</span>
              <span class="status-value">${data.response_time || 'N/A'} ms</span>
            </div>
            <div class="status-item">
              <span class="status-label">👥 在线用户</span>
              <span class="status-value">${data.online_users || 0} 人</span>
            </div>
            <div class="status-item">
              <span class="status-label">🌍 服务器IP</span>
              <span class="status-value">${data.server_ip || 'N/A'}</span>
            </div>
            <div class="status-item">
              <span class="status-label">📍 服务器地区</span>
              <span class="status-value">${data.server_location || 'N/A'}</span>
            </div>
            <div class="status-item">
              <span class="status-label">⏱️ 运行时间</span>
              <span class="status-value">${data.server_uptime || 'N/A'}</span>
            </div>
          </div>

          <!-- 系统资源 -->
          <div class="status-section">
            <h4 class="section-title">📊 系统资源</h4>
            <div class="status-item">
              <span class="status-label">🖥️ CPU使用率</span>
              <span class="status-value">
                <div class="progress-bar">
                  <div class="progress-fill ${getUsageClass(data.cpu_usage)}" style="width: ${data.cpu_usage && data.cpu_usage !== 'N/A' ? parseFloat(data.cpu_usage) : 0}%"></div>
                  <span class="progress-text">${data.cpu_usage || 'N/A'}</span>
                </div>
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">📊 系统负载</span>
              <span class="status-value">
                <div class="progress-bar">
                  <div class="progress-fill ${getLoadClass(data.system_load)}" style="width: ${data.system_load ? Math.min(data.system_load * 20, 100) : 0}%"></div>
                  <span class="progress-text">${data.system_load}</span>
                </div>
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">💾 内存使用</span>
              <span class="status-value">${data.memory_usage || 'N/A'}</span>
            </div>
            <div class="status-item">
              <span class="status-label">💿 磁盘使用</span>
              <span class="status-value">
                <div class="progress-bar">
                  <div class="progress-fill ${getDiskUsageClass(data.disk_usage)}" style="width: ${data.disk_usage ? parseFloat(data.disk_usage.split('%')[0]) : 0}%"></div>
                  <span class="progress-text">${data.disk_usage ? data.disk_usage.split('(')[0].trim() : 'N/A'}</span>
                </div>
              </span>
            </div>
            <div class="status-item disk-details">
              <span class="status-label"></span>
              <span class="status-value disk-info">
                ${data.disk_usage ? data.disk_usage.split('(')[1]?.replace(')', '') : ''}
              </span>
            </div>
          </div>

          <!-- 服务器配置 -->
          <div class="status-section">
            <h4 class="section-title">⚙️ 服务器配置</h4>
            <div class="status-item">
              <span class="status-label">🔧 PHP版本</span>
              <span class="status-value">${data.server_info?.php_version || 'N/A'}</span>
            </div>
            <div class="status-item">
              <span class="status-label">🌐 服务器软件</span>
              <span class="status-value">${data.server_info?.server_software || 'N/A'}</span>
            </div>
            <div class="status-item">
              <span class="status-label">💾 内存限制</span>
              <span class="status-value">${data.server_info?.php_memory_limit || 'N/A'}</span>
            </div>
            <div class="status-item">
              <span class="status-label">⏱️ 执行时间限制</span>
              <span class="status-value">${data.server_info?.max_execution_time || 'N/A'} 秒</span>
            </div>
            <div class="status-item">
              <span class="status-label">🖥️ 操作系统</span>
              <span class="status-value">${data.server_info?.os_info || 'N/A'}</span>
            </div>
            <div class="status-item">
              <span class="status-label">🌍 服务器名称</span>
              <span class="status-value">${data.server_info?.server_name || 'N/A'}</span>
            </div>
          </div>

          <!-- 时间信息 -->
          <div class="status-section">
            <h4 class="section-title">🕒 时间信息</h4>
            <div class="status-item">
              <span class="status-label">🕒 最后更新</span>
              <span class="status-value" id="last-update-time">${data.last_update || 'N/A'}</span>
            </div>
            <div class="status-item">
              <span class="status-label">🌍 时区</span>
              <span class="status-value">${data.server_info?.server_timezone || 'N/A'}</span>
            </div>
            <div class="status-item">
              <span class="status-label">🔄 自动更新</span>
              <span class="status-value">每30秒</span>
            </div>
          </div>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="server-status-error">
          <p>❌ 获取服务器状态失败</p>
          <p>${data.message || '未知错误'}</p>
          ${data.debug_info ? `
          <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 12px; color: #666;">
            <strong>调试信息:</strong><br>
            错误: ${data.debug_info.error}<br>
            文件: ${data.debug_info.file}<br>
            行号: ${data.debug_info.line}
          </div>
          ` : ''}
        </div>
      `;
    }
  } catch (error) {
    console.error('获取服务器状态失败:', error);
    content.innerHTML = `
      <div class="server-status-error">
        <p>❌ 网络错误</p>
        <p>无法连接到服务器，请检查网络连接</p>
        <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 12px; color: #666;">
          <strong>错误详情:</strong><br>
          ${error.message}
        </div>
      </div>
    `;
  }
}

function closeServerStatusModal() {
  const modal = document.getElementById('server-status-modal');
  modal.style.display = 'none';
  
  // 停止自动更新
  stopServerStatusAutoUpdate();
}

// 开始自动更新服务器状态
function startServerStatusAutoUpdate() {
  // 清除之前的定时器
  if (serverStatusUpdateTimer) {
    clearInterval(serverStatusUpdateTimer);
  }
  
  // 每30秒自动更新一次
  serverStatusUpdateTimer = setInterval(async () => {
    await refreshServerStatus();
  }, 30000);
}

// 停止自动更新
function stopServerStatusAutoUpdate() {
  if (serverStatusUpdateTimer) {
    clearInterval(serverStatusUpdateTimer);
    serverStatusUpdateTimer = null;
  }
}

async function refreshServerStatus() {
  const content = document.getElementById('server-status-content');
  
  try {
    // 获取服务器状态
    const response = await fetch(`${API_BASE_URL}/server_status.php`);
    const data = await response.json();
    
    if (data.success) {
      // 更新最后更新时间
      const lastUpdateElement = document.getElementById('last-update-time');
      if (lastUpdateElement) {
        lastUpdateElement.textContent = data.last_update || 'N/A';
      }
      
      // 更新进度条
      updateProgressBars(data);
    }
  } catch (error) {
    console.error('刷新服务器状态失败:', error);
  }
}

// 更新进度条
function updateProgressBars(data) {
  // 更新CPU使用率
  const cpuItems = document.querySelectorAll('.status-item');
  cpuItems.forEach(item => {
    const label = item.querySelector('.status-label');
    if (label && label.textContent.includes('CPU使用率')) {
      const progressFill = item.querySelector('.progress-fill');
      const progressText = item.querySelector('.progress-text');
      if (progressFill && progressText && data.cpu_usage) {
        const value = parseFloat(data.cpu_usage);
        progressFill.style.width = value + '%';
        progressFill.className = `progress-fill ${getUsageClass(data.cpu_usage)}`;
        progressText.textContent = data.cpu_usage;
      }
    }
  });
  
  // 更新系统负载
  cpuItems.forEach(item => {
    const label = item.querySelector('.status-label');
    if (label && label.textContent.includes('系统负载')) {
      const progressFill = item.querySelector('.progress-fill');
      const progressText = item.querySelector('.progress-text');
      if (progressFill && progressText && data.system_load) {
        const value = Math.min(parseFloat(data.system_load) * 20, 100);
        progressFill.style.width = value + '%';
        progressFill.className = `progress-fill ${getLoadClass(data.system_load)}`;
        progressText.textContent = data.system_load;
      }
    }
  });
  
  // 更新磁盘使用率
  cpuItems.forEach(item => {
    const label = item.querySelector('.status-label');
    if (label && label.textContent.includes('磁盘使用')) {
      const progressFill = item.querySelector('.progress-fill');
      const progressText = item.querySelector('.progress-text');
      if (progressFill && progressText && data.disk_usage) {
        const value = parseFloat(data.disk_usage.split('%')[0]);
        progressFill.style.width = value + '%';
        progressFill.className = `progress-fill ${getDiskUsageClass(data.disk_usage)}`;
        progressText.textContent = data.disk_usage;
      }
    }
  });
}

// 获取使用率样式类
function getUsageClass(usage) {
  if (!usage || usage === 'N/A') return '';
  const value = parseFloat(usage);
  if (value >= 80) return 'critical-usage';
  if (value >= 60) return 'high-usage';
  return '';
}

// 获取负载样式类
function getLoadClass(load) {
  if (!load || load === 'N/A') return '';
  const value = parseFloat(load);
  if (value >= 2.0) return 'critical-usage';
  if (value >= 1.0) return 'high-usage';
  return '';
}

// 获取磁盘使用率样式类
function getDiskUsageClass(usage) {
  if (!usage || usage === 'N/A') return '';
  const value = parseFloat(usage.split('%')[0]);
  if (value >= 90) return 'critical-usage';
  if (value >= 80) return 'high-usage';
  return '';
} 