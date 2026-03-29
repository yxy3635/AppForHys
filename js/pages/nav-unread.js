// 公共函数：只检测一次未读消息并显示感叹号
function updateInteractionExclaimOnce(currentUserId, apiBase = APP_CONFIG.API_BASE + '/') {
  if (!currentUserId) return;
  fetch(apiBase + 'user_list.php?current_user_id=' + currentUserId)
    .then(res => res.json())
    .then(data => {
      let hasUnread = false;
      if (data.success && Array.isArray(data.users)) {
        hasUnread = data.users.some(user => user.unread_count > 0);
      }
      document.querySelectorAll('nav button').forEach(btn => {
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
    });
} 