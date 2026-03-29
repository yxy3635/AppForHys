document.addEventListener('DOMContentLoaded', async function() {
  const userListDiv = document.getElementById('user-list');
  const loadingDiv = document.getElementById('user-list-loading');
  const emptyDiv = document.getElementById('user-list-empty');
  const currentUserId = localStorage.getItem('user_id');
  // 使用统一配置中的头像基础地址
const AVATAR_BASE_URL = APP_CONFIG.AVATAR_BASE;
  const DEFAULT_AVATAR = 'img/default-avatar.png';
  try {
    const res = await fetch(APP_CONFIG.API_BASE + '/user_list.php?current_user_id=' + currentUserId);
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      const filtered = data.users.filter(user => user.id != currentUserId);
      if (filtered.length === 0) {
        emptyDiv.style.display = '';
        userListDiv.innerHTML = '';
        return;
      }
      emptyDiv.style.display = 'none';
      userListDiv.innerHTML = filtered.map(user => {
        let avatarUrl = user.avatar_url;
        if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) {
          avatarUrl = AVATAR_BASE_URL + avatarUrl.replace(/^\/+/, '');
        }
        let unreadHtml = '';
        if (user.unread_count > 0) {
          unreadHtml = '<span class="userlist-unread-dot"></span><span class="userlist-unread-text">宝宝有新消息拉~</span>';
        }
        return `<div class="userlist-item" onclick="goChat(${user.id}, '${user.username}', '${avatarUrl}')">
          <img class="userlist-avatar" src="${avatarUrl}" alt="头像" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'">
          <span class="userlist-username">${user.username}</span>
          ${unreadHtml}
        </div>`;
      }).join('');
      // 检查是否有未读消息，动态显示底部互动感叹号
      const hasUnread = filtered.some(user => user.unread_count > 0);
      const navBtns = document.querySelectorAll('nav button');
      navBtns.forEach(btn => {
        let label = btn.querySelector('.nav-label');
        if (label) {
          let ex = label.querySelector('.interaction-exclaim');
          if (hasUnread) {
            if (!ex) {
              const exSpan = document.createElement('span');
              exSpan.className = 'interaction-exclaim';
              exSpan.textContent = '！';
              label.appendChild(exSpan);
            }
          } else {
            if (ex) ex.remove();
          }
        }
      });
    } else {
      emptyDiv.style.display = '';
      userListDiv.innerHTML = '';
    }
  } catch (e) {
    emptyDiv.style.display = '';
    userListDiv.innerHTML = '';
  }
});

window.goChat = function(userId, username, avatarUrl) {
  // 跳转到聊天页面，带上对方用户id
  window.location.href = `chat.html?user_id=${userId}&username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatarUrl)}`;
} 