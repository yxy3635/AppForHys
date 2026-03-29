function goPost() {
  window.location.href = 'post.html';
}
function goHome() {
  window.location.href = 'home.html';
}
function goChat() {
  window.location.href = 'chat.html';
}
function goAnniversary() {
  window.location.href = 'anniversary.html';
}
function goProfile() {
  window.location.href = 'profile.html';
}

// 使用统一配置中的API地址
const API_BASE_URL = APP_CONFIG.API_BASE;

// 分页相关变量
let currentPage = 1;
const pageSize = 5; // 每页显示5条动态
let isLoading = false;
let hasMoreData = true;
let allFeedData = []; // 存储所有已加载的动态数据

// A helper function to fetch and set user avatar by user ID
async function fetchAvatarForUser(userId, imgElement) {
  if (!userId || !imgElement) {
    return;
  }
  try {
    const data = await commonFetch(`${API_BASE_URL}/profile.php?user_id=${userId}`);
    if (data.success && data.user && data.user.avatar_url) {
      imgElement.src = data.user.avatar_url;
    } else {
      imgElement.src = 'img/default-avatar.png'; // Fallback to default
    }
  } catch (error) {
    console.error(`Error fetching avatar for user ${userId}:`, error);
    imgElement.src = 'img/default-avatar.png'; // Fallback to default on error
  }
}

// 修改后的异步函数：从服务器获取动态数据（支持分页）
async function fetchFeedData(page = 1, limit = pageSize) {
  try {
    const data = await commonFetch(`${API_BASE_URL}/feed.php?page=${page}&limit=${limit}`);
    
    // 如果后端返回的是对象格式（包含分页信息）
    if (data.success && data.feeds && Array.isArray(data.feeds)) {
      return {
        feeds: data.feeds,
        pagination: data.pagination || {},
        hasMore: data.pagination ? data.pagination.page < data.pagination.pages : false
      };
    }
    // 如果后端返回的是数组格式（兼容原有格式）
    else if (Array.isArray(data)) {
      return {
        feeds: data,
        pagination: {},
        hasMore: data.length === limit // 如果返回的数据量等于limit，可能还有更多数据
      };
    }
    
    return {
      feeds: [],
      pagination: {},
      hasMore: false
    };
  } catch (error) {
    console.error('获取动态数据失败:', error);
    return {
      feeds: [],
      pagination: {},
      hasMore: false
    };
  }
}

// 格式化时间的函数
function formatTime(timestamp) {
  if (!timestamp) {
    return '';
  }
  
  const now = new Date();
  const postDate = new Date(timestamp);
  const diff = now.getTime() - postDate.getTime(); // 毫秒差
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  // 格式化具体时间
  const year = postDate.getFullYear();
  const month = String(postDate.getMonth() + 1).padStart(2, '0');
  const day = String(postDate.getDate()).padStart(2, '0');
  const hour = String(postDate.getHours()).padStart(2, '0');
  const minute = String(postDate.getMinutes()).padStart(2, '0');
  const second = String(postDate.getSeconds()).padStart(2, '0');
  const fullTimeStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  
  if (seconds < 60) {
    return `刚刚 (${fullTimeStr})`;
  } else if (minutes < 60) {
    return `${minutes}分钟前 (${fullTimeStr})`;
  } else if (hours < 24) {
    return `${hours}小时前 (${fullTimeStr})`;
  } else if (days < 7) {
    return `${days}天前 (${fullTimeStr})`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}周前 (${fullTimeStr})`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months}个月前 (${fullTimeStr})`;
  } else {
    const years = Math.floor(days / 365);
    return `${years}年前 (${fullTimeStr})`;
  }
}

// 修改渲染函数，支持追加模式
function renderFeed(feedData, append = false) {
  const list = document.getElementById('feed-list');
  
  // 如果不是追加模式，清空现有内容
  if (!append) {
    list.innerHTML = '';
  }
  
  const currentUserId = localStorage.getItem('user_id');
  let feedItemsHtml = '';
  
  feedData.forEach((item) => {
    let mediaHtml = '';
    if (item.media_urls && Array.isArray(item.media_urls) && item.media_urls.length > 0) {
      const firstMediaItem = item.media_urls[0];
      if (firstMediaItem.type === 'image') {
        mediaHtml = `<div class="feed-media"><img src="${firstMediaItem.url}" class="feed-media-item" loading="lazy"></div>`;
      } else if (firstMediaItem.type === 'video') {
        mediaHtml = `<div class="feed-media"><video src="${firstMediaItem.url}" class="feed-media-item feed-video" controls playsinline muted preload="metadata"></video></div>`;
      }
    } else if (item.media_url) {
      if (item.type === 'image') {
        mediaHtml = `<div class="feed-media"><img src="${item.media_url}" class="feed-media-item" loading="lazy"></div>`;
      } else if (item.type === 'video') {
        mediaHtml = `<div class="feed-media"><video src="${item.media_url}" class="feed-media-item feed-video" controls playsinline muted preload="metadata"></video></div>`;
      }
    }
    
    let actionsHtml = '';
    // 调试信息
    console.log('当前用户ID:', currentUserId, '动态用户ID:', item.user_id, '比较结果:', parseInt(currentUserId) === item.user_id);
    
    if (currentUserId && parseInt(currentUserId) === parseInt(item.user_id)) {
      actionsHtml = `
        <div class="feed-actions">
          <button onclick="event.stopPropagation(); editPost(${item.id})">编辑</button>
          <button onclick="event.stopPropagation(); deletePost(${item.id})">删除</button>
        </div>
      `;
    }
    
    feedItemsHtml += `<div class="feed-item" onclick="goDetail(${item.id})">
      <img class="feed-avatar" data-user-id="${item.user_id}" src="${item.avatar || 'img/default-avatar.png'}" alt="头像" onclick="event.stopPropagation();onAvatarClick(${item.user_id})">
      <div class="feed-content">
        <div class="feed-header">
          <span class="feed-username" onclick="event.stopPropagation();onUserClick(${item.user_id})">${item.user}</span>
          ${actionsHtml}
        </div>
        <div class="feed-text">${item.content}</div>
		${mediaHtml}
		<span class="feed-time">${formatTime(item.time)}</span>
      </div>
    </div>`;
  });
  
  // 追加或替换内容
  if (append) {
    list.insertAdjacentHTML('beforeend', feedItemsHtml);
  } else {
    list.innerHTML = feedItemsHtml;
  }
  
  // 更新头像
  const avatarElements = list.querySelectorAll('.feed-avatar');
  avatarElements.forEach(imgElement => {
    const userId = imgElement.dataset.userId;
    if (userId) {
      fetchAvatarForUser(userId, imgElement);
    }
  });
  
  // 更新分页控件
  updatePaginationControls();
}

// 新增：更新分页控件
function updatePaginationControls() {
  let paginationDiv = document.getElementById('pagination-controls');
  
  if (!paginationDiv) {
    // 创建分页控件容器
    paginationDiv = document.createElement('div');
    paginationDiv.id = 'pagination-controls';
    paginationDiv.className = 'pagination-controls';
    
    // 插入到feed-list之后
    const feedList = document.getElementById('feed-list');
    feedList.parentNode.insertBefore(paginationDiv, feedList.nextSibling);
  }
  
  let controlsHtml = '';
  
  // 显示当前页信息
  if (allFeedData.length > 0) {
    controlsHtml += `<div class="pagination-info">已加载 ${allFeedData.length} 条动态，当前第 ${currentPage} 页</div>`;
  }
  
  // 加载更多按钮
  if (hasMoreData && !isLoading) {
    controlsHtml += `<button class="load-more-btn" onclick="loadMoreFeed()">加载更多</button>`;
  } else if (isLoading) {
    controlsHtml += `<button class="load-more-btn loading" disabled>加载中...</button>`;
  } else if (allFeedData.length > 0) {
    controlsHtml += `<div class="no-more-data">没有更多动态了</div>`;
  }
  
  paginationDiv.innerHTML = controlsHtml;
}

// 新增：加载更多动态
async function loadMoreFeed() {
  if (isLoading || !hasMoreData) {
    return;
  }
  
  isLoading = true;
  updatePaginationControls();
  
  try {
    const nextPage = currentPage + 1;
    const result = await fetchFeedData(nextPage, pageSize);
    
    if (result.feeds && result.feeds.length > 0) {
      // 添加新数据到已有数据中
      allFeedData = allFeedData.concat(result.feeds);
      
      // 追加渲染新数据
      renderFeed(result.feeds, true);
      
      // 更新分页状态
      currentPage = nextPage;
      hasMoreData = result.hasMore;
      
      console.log(`加载第 ${currentPage} 页成功，获取 ${result.feeds.length} 条动态`);
    } else {
      hasMoreData = false;
      console.log('没有更多动态数据');
    }
  } catch (error) {
    console.error('加载更多动态失败:', error);
    showModal('加载更多动态失败，请稍后重试', 'alert', '错误');
  } finally {
    isLoading = false;
    updatePaginationControls();
  }
}

// 更新用户在线时间显示
function updateLastOnlineText(lastOnlineTime) {
  // 使用固定的参考时间点
  const lastOnlineDate = new Date(lastOnlineTime);
  
  // 计算动态更新的时间差
  const now = new Date();
  const diffSeconds = Math.floor((now - lastOnlineDate) / 1000);
  
  // 格式化最后在线时间（用于显示具体时间）
  const year = lastOnlineDate.getFullYear();
  const month = String(lastOnlineDate.getMonth() + 1).padStart(2, '0');
  const day = String(lastOnlineDate.getDate()).padStart(2, '0');
  const hour = String(lastOnlineDate.getHours()).padStart(2, '0');
  const minute = String(lastOnlineDate.getMinutes()).padStart(2, '0');
  const second = String(lastOnlineDate.getSeconds()).padStart(2, '0');
  const fullTimeStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  
  let onlineStatusClass = 'offline';
  let lastOnlineText = '';
  
  if (diffSeconds < 60) { // 1分钟内
    onlineStatusClass = 'online';
    lastOnlineText = `${diffSeconds}秒前在线 (${fullTimeStr})`;
  } else if (diffSeconds < 3600) { // 1小时内
    onlineStatusClass = 'online';
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    lastOnlineText = `${minutes}分${seconds}秒前在线 (${fullTimeStr})`;
  } else if (diffSeconds < 86400) { // 24小时内
    onlineStatusClass = 'recently';
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    lastOnlineText = `${hours}小时${minutes}分前在线 (${fullTimeStr})`;
  } else {
    const days = Math.floor(diffSeconds / 86400);
    if (days < 7) {
      const hours = Math.floor((diffSeconds % 86400) / 3600);
      lastOnlineText = `${days}天${hours}小时前在线 (${fullTimeStr})`;
    } else {
      lastOnlineText = `${fullTimeStr}`;
    }
  }
  
  // 更新DOM
  const statusDot = document.querySelector('.online-status');
  const lastOnlineTextElement = document.querySelector('.last-online-text');
  if (statusDot) {
    statusDot.className = `online-status ${onlineStatusClass}`;
  }
  if (lastOnlineTextElement) {
    lastOnlineTextElement.textContent = lastOnlineText;
  }
  
  return { onlineStatusClass, lastOnlineText };
}

// 显示用户信息卡片
function showUserInfoCard(user) {
  // 移除已存在的用户信息卡片和定时器
  const existingCard = document.getElementById('user-info-card');
  if (existingCard) {
    if (window._lastOnlineUpdateTimer) {
      clearInterval(window._lastOnlineUpdateTimer);
    }
    existingCard.remove();
  }
  
  // 获取用户信息
  const username = user.username || '';
  const signature = user.signature || '这个人很神秘，还没有写签名~';
  const avatarUrl = user.avatar_url || 'img/default-avatar.png';
  
  // 格式化注册时间
  const registrationDate = new Date(user.created_at);
  const regYear = registrationDate.getFullYear();
  const regMonth = String(registrationDate.getMonth() + 1).padStart(2, '0');
  const regDay = String(registrationDate.getDate()).padStart(2, '0');
  const regHour = String(registrationDate.getHours()).padStart(2, '0');
  const regMinute = String(registrationDate.getMinutes()).padStart(2, '0');
  const regSecond = String(registrationDate.getSeconds()).padStart(2, '0');
  const registrationText = user.created_at ? 
    `注册于 ${regYear}-${regMonth}-${regDay} ${regHour}:${regMinute}:${regSecond}` : '';
  
  // 初始化在线状态
  let { onlineStatusClass, lastOnlineText } = user.last_online ? 
    updateLastOnlineText(user.last_online) : 
    { onlineStatusClass: 'offline', lastOnlineText: '从未在线' };
  
  // 创建用户信息卡片
  const cardHtml = `
    <div id="user-info-card" class="user-info-card">
      <div class="user-info-overlay" onclick="closeUserInfoCard()"></div>
      <div class="user-info-content">
        <div class="user-info-header">
          <div class="user-avatar-container">
            <img src="${avatarUrl}" alt="头像" class="user-info-avatar">
            <div class="online-status ${onlineStatusClass}"></div>
          </div>
          <div class="user-basic-info">
            <h3 class="user-info-username">${username}</h3>
            <p class="user-info-signature">${signature}</p>
          </div>
          <button class="close-btn" onclick="closeUserInfoCard()">×</button>
        </div>
        <div class="user-info-footer">
          <div class="last-online-info">
            <span class="last-online-icon ${onlineStatusClass === 'online' ? '🟢' : onlineStatusClass === 'recently' ? '🟡' : '⭕'}</span>
            <span class="last-online-text">${lastOnlineText}</span>
          </div>
          <div class="registration-info">
            <span class="registration-icon">📅</span>
            <span class="registration-text">${registrationText}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // 添加到页面
  document.body.insertAdjacentHTML('beforeend', cardHtml);
  
  // 添加显示动画
  setTimeout(() => {
    const card = document.getElementById('user-info-card');
    if (card) {
      card.classList.add('show');
    }
  }, 10);
  
  // 如果用户有最后在线时间，启动定时更新
  if (user.last_online) {
    // 每秒更新一次时间显示
    window._lastOnlineUpdateTimer = setInterval(() => {
      updateLastOnlineText(user.last_online);
    }, 1000);
  }
}

// 关闭用户信息卡片
function closeUserInfoCard() {
  const card = document.getElementById('user-info-card');
  if (card) {
    // 清除定时器
    if (window._lastOnlineUpdateTimer) {
      clearInterval(window._lastOnlineUpdateTimer);
      window._lastOnlineUpdateTimer = null;
    }
    
    card.classList.remove('show');
    setTimeout(() => {
      card.remove();
    }, 300);
  }
}

async function onAvatarClick(userId) {
  try {
    const data = await commonFetch(`${API_BASE_URL}/profile.php?user_id=${userId}`);
    if (data.success && data.user) {
      showUserInfoCard(data.user);
    } else {
      showModal('获取用户信息失败', 'alert', '错误');
    }
  } catch (e) {
    showModal('网络错误，无法获取用户信息', 'alert', '错误');
  }
}

async function onUserClick(userId) {
  return onAvatarClick(userId);
}

function goDetail(id) {
  window.location.href = `detail.html?post_id=${id}`;
}

// 占位符：编辑动态功能（待实现）
function editPost(postId) {
  // 跳转到 post.html，并传入动态ID，以便进入编辑模式
  window.location.href = `post.html?post_id=${postId}`;
}

// 占位符：删除动态功能（待实现）
async function deletePost(postId) {
  const confirmed = await showModal('确定要删除这条动态吗？此操作不可撤销！', 'confirm', '确认删除');
  if (!confirmed) {
    return;
  }

  const currentUserId = localStorage.getItem('user_id');
  if (!currentUserId) {
    showModal('未登录用户无法删除动态。', 'alert', '删除失败');
    return;
  }

  try {
    const data = await commonFetch(`${API_BASE_URL}/delete_post.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_id: postId,
        user_id: parseInt(currentUserId)
      }),
    });
    
    if (data.success) {
      showModal(data.message, 'alert', '删除成功');
      refreshFeed(); // 删除成功后刷新动态列表
    } else {
      showModal(data.message || '删除失败', 'alert', '删除失败');
    }
  } catch (error) {
    console.error('删除动态时出错:', error);
    showModal('删除动态失败，请检查网络或稍后再试。', 'alert', '删除失败');
  }
}

// 修改刷新动态的函数
async function refreshFeed() {
  // 重置分页状态
  currentPage = 1;
  hasMoreData = true;
  allFeedData = [];
  isLoading = false;
  
  // 显示加载状态
  const list = document.getElementById('feed-list');
  list.innerHTML = '<div class="loading-message">正在加载动态...</div>';
  
  try {
    const result = await fetchFeedData(1, pageSize);
    
    if (result.feeds && result.feeds.length > 0) {
      allFeedData = result.feeds;
      renderFeed(result.feeds, false);
      hasMoreData = result.hasMore;
      
      console.log(`刷新成功，获取 ${result.feeds.length} 条动态`);
    } else {
      list.innerHTML = '<div class="empty-message">暂无动态</div>';
    }
  } catch (error) {
    console.error('刷新动态失败:', error);
    list.innerHTML = '<div class="error-message">加载失败，请稍后重试</div>';
  }
}

async function checkNotifications() {
  const userId = localStorage.getItem('user_id');
  if (!userId) return;
  try {
    const data = await commonFetch(`${API_BASE_URL}/get_notifications.php?user_id=${userId}`);
    if (data.success && data.notifications && data.notifications.length > 0) {
      const latest = data.notifications[0];
      showModal(
        latest.content,
        'confirm',
        '新消息提醒',
        '去查看',
        '稍后再看'
      ).then(go => {
        if (go) {
          window.location.href = `detail.html?post_id=${latest.post_id}`;
          commonFetch(`${API_BASE_URL}/mark_notification_read.php?id=${latest.id}`);
        }
      });
    }
  } catch (e) {
    // 可选：处理网络异常
    console.error('通知检查失败', e);
  }
}

// 检查并引导通知权限（仅首次访问）
function checkNotificationPermissionOnFirstVisit() {
  // 检查是否已经询问过权限
  const hasAskedPermission = localStorage.getItem('notification_permission_asked');
  
  console.log('权限检查 - 已询问过:', hasAskedPermission);
  console.log('权限检查 - NativeNotificationManager:', window.NativeNotificationManager);
  console.log('权限检查 - isReady:', window.NativeNotificationManager ? window.NativeNotificationManager.isReady : 'N/A');
  
  if (!hasAskedPermission) {
    // 等待通知管理器准备就绪
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      console.log(`权限检查重试 ${checkCount}/10`);
      
      if (window.NativeNotificationManager && window.NativeNotificationManager.isReady) {
        clearInterval(checkInterval);
        
        const hasPermission = window.NativeNotificationManager.checkNotificationPermission();
        console.log('权限检查 - 当前权限状态:', hasPermission);
        
        if (!hasPermission) {
          console.log('权限检查 - 准备显示权限弹窗');
          // 延迟显示，让用户先看到主页内容
          setTimeout(() => {
            console.log('权限检查 - 1秒后显示弹窗');
            console.log('权限检查 - plus对象:', typeof plus);
            console.log('权限检查 - plus.nativeUI:', typeof plus !== 'undefined' ? plus.nativeUI : 'N/A');
            
            if (typeof plus !== 'undefined' && plus.nativeUI) {
              console.log('权限检查 - 调用plus.nativeUI.confirm');
              plus.nativeUI.confirm(
                '为了及时接收新消息和动态提醒，建议开启通知权限。\n\n开启后您将收到：\n• 新消息提醒\n• 新动态提醒\n\n您随时可以在设置中修改此选项。',
                (e) => {
                  console.log('权限检查 - 用户选择:', e.index);
                  if (e.index === 0) {
                    // 用户选择开启
                    console.log('权限检查 - 用户选择开启，调用权限请求');
                    window.NativeNotificationManager.requestNotificationPermissionWithDialog();
                  }
                  // 标记已询问过
                  localStorage.setItem('notification_permission_asked', 'true');
                  console.log('权限检查 - 已标记为已询问');
                },
                '开启通知提醒',
                ['开启通知', '稍后再说']
              );
            } else {
              console.log('权限检查 - plus.nativeUI不可用，使用降级方案');
              // 降级使用alert
              const confirmed = confirm('为了及时接收新消息和动态提醒，建议开启通知权限。\n\n点击"确定"去设置开启权限。');
              if (confirmed) {
                window.NativeNotificationManager.requestNotificationPermissionWithDialog();
              }
              localStorage.setItem('notification_permission_asked', 'true');
            }
          }, 1000); // 1秒后显示
        } else {
          console.log('权限检查 - 已有权限，标记为已询问');
          // 已有权限，标记为已询问
          localStorage.setItem('notification_permission_asked', 'true');
        }
      } else if (checkCount >= 10) {
        // 超时停止检查
        clearInterval(checkInterval);
        console.log('权限检查超时，通知管理器未准备就绪');
      }
    }, 500); // 每500ms检查一次
  }
}

// 添加测试函数检查用户登录状态
function checkLoginStatus() {
  const userId = localStorage.getItem('user_id');
  const username = localStorage.getItem('username');
  console.log('用户登录状态检查:');
  console.log('用户ID:', userId);
  console.log('用户名:', username);
  
  if (!userId) {
    console.warn('用户未登录，编辑/删除按钮将不会显示');
    // 为了测试，可以设置一个临时的用户ID
    // localStorage.setItem('user_id', '1'); // 解开注释来测试
  }
}

// 更新在线状态
async function updateOnlineStatus() {
  try {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    
    const response = await fetch(`${API_BASE_URL}/update_online_status.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `user_id=${userId}`
    });
    
    const data = await response.json();
    if (!data.success) {
      console.error('更新在线状态失败:', data.message);
    }
  } catch (error) {
    console.error('更新在线状态出错:', error);
  }
}

// 启动在线状态更新
function startOnlineStatusUpdate() {
  const userId = localStorage.getItem('user_id');
  if (!userId) return;
  
  // 立即更新一次在线状态
  updateOnlineStatus();
  
  // 每5分钟更新一次在线状态
  const intervalId = setInterval(updateOnlineStatus, 5 * 60 * 1000);
  
  // 在页面即将关闭时也更新一次在线状态
  window.addEventListener('beforeunload', updateOnlineStatus);
  
  // 存储interval ID以便需要时清除
  window._onlineStatusInterval = intervalId;
}

window.onload = async () => {
  checkLoginStatus(); // 检查用户登录状态
  refreshFeed(); // 页面加载时立即加载第一页动态
  checkNotifications(); // 检查未读消息并弹窗
  startOnlineStatusUpdate(); // 启动在线状态更新
  
  // 临时清除权限询问记录，方便测试
  localStorage.removeItem('notification_permission_asked');
  
  // 检查通知权限（仅首次访问）
  setTimeout(checkNotificationPermissionOnFirstVisit, 500);
}; 