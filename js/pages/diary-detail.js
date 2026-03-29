document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const diaryId = urlParams.get('id');
  const currentUserId = localStorage.getItem('user_id');
  const container = document.getElementById('diary-detail-container');

  if (!diaryId) {
    showModal('无效的手记ID', 'alert', '错误').then(() => {
      window.location.href = 'diary.html';
    });
    return;
  }

      fetch(`${APP_CONFIG.API_BASE}/diaries.php?user_id=${currentUserId}&diary_id=${diaryId}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
    .then(data => {
      if (!data.success || !data.diaries || !data.diaries.length) {
        showModal('手记不存在或已被删除', 'alert', '错误').then(() => {
          window.location.href = 'diary.html';
        });
        return;
      }
      const diary = data.diaries[0];
      try {
        renderDiaryDetail(diary, currentUserId);
      } catch(renderError) {
        console.error('渲染手记详情失败:', renderError);
        showModal('渲染失败，请刷新重试', 'alert', '错误');
      }
    })
    .catch((error) => {
      console.error('加载手记详情失败:', error);
      showModal('加载失败，请检查网络', 'alert', '错误').then(() => {
        window.location.href = 'diary.html';
      });
    });

  function renderDiaryDetail(diary, currentUserId) {
    let html = `<div class="diary-item diary-detail">
      <div class="diary-header-row">
        <span class="diary-date">${formatDate(diary.created_at)}</span>
        <span class="diary-mood">${diary.mood}</span>
      </div>
      <div class="diary-title">${diary.title}</div>
      <div class="diary-content">${diary.content.replace(/\n/g, '<br>')}</div>
      ${diary.images && diary.images.length > 0 ? `
        <div class="diary-images">
                          ${diary.images.map(img => {
                            try {
                              const imgPath = img.startsWith('http') ? img : `${APP_CONFIG.SERVER_BASE}/${img.replace(/^\//, '')}`;
                              return `<img src="${imgPath}" class="diary-image" alt="手记图片" onclick="showImagePreview('${imgPath}')" onerror="this.onerror=null;this.style.display='none';" loading="lazy">`;
                            } catch(e) {
                              console.error('图片路径构建失败:', e, img);
                              return '';
                            }
                          }).filter(html => html).join('')}
        </div>
      ` : ''}
      <div class="diary-footer">
        <div class="diary-author">
          <img src="${diary.author_avatar ? APP_CONFIG.AVATAR_BASE + diary.author_avatar : 'img/default-avatar.png'}" class="diary-author-avatar" alt="头像">
          <span>${diary.author_name}</span>
        </div>
        ${diary.tags && diary.tags.length > 0 ? `
          <div class="diary-tags">
            ${diary.tags.map(tag => `<span class="diary-tag">${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>`;
    // 编辑和删除按钮（仅作者可见）
    if (parseInt(diary.user_id) === parseInt(currentUserId)) {
      html += `<div class="diary-detail-actions">
        <button class="diary-edit-btn" onclick="editDiary(${diary.id})">编辑</button>
        <button class="diary-delete-btn" onclick="deleteDiary(${diary.id})">删除</button>
      </div>`;
    }
    container.innerHTML = html;
    // 插入图片预览容器（只插入一次）
    if (!document.getElementById('image-preview-modal')) {
      const modal = document.createElement('div');
      modal.id = 'image-preview-modal';
      modal.style.display = 'none';
      modal.innerHTML = `<div class="image-preview-backdrop" style="position:fixed;z-index:9999;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;">
        <img id="image-preview-big" src="" style="max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 4px 32px #000;">
      </div>`;
      document.body.appendChild(modal);
      modal.onclick = function() { modal.style.display = 'none'; };
    }
  }
});

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

window.editDiary = function(id) {
  window.location.href = `diary-new.html?edit=1&id=${id}`;
};

window.deleteDiary = function(id) {
  showModal('确定要删除这篇手记吗？', 'confirm', '删除确认').then(res => {
    if (res) {
      const userId = localStorage.getItem('user_id');
      fetch(APP_CONFIG.API_BASE + '/diaries.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user_id: userId })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showModal('删除成功', 'alert', '提示').then(() => {
            window.location.href = 'diary.html';
          });
        } else {
          showModal('删除失败: ' + data.message, 'alert', '错误');
        }
      })
      .catch(() => {
        showModal('网络错误，删除失败', 'alert', '错误');
      });
    }
  });
};

// 图片预览函数
window.showImagePreview = function(src) {
  const modal = document.getElementById('image-preview-modal');
  const bigImg = document.getElementById('image-preview-big');
  if (modal && bigImg) {
    bigImg.src = src;
    modal.style.display = 'flex';
  }
}; 