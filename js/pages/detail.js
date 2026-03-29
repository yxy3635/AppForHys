function goHome() {
  window.location.href = 'home.html';
}

// 移除模拟数据
// const demoFeed = [
//   {user: '小明', avatar: 'img/default-avatar.png', content: '今天很开心！', type: 'text', time: '2025-06-16'},
//   {user: '小红', avatar: 'img/default-avatar.png', content: 'img/1.jpg', type: 'image', time: '2025-06-15'},
//   {user: '小刚', avatar: 'img/default-avatar.png', content: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video', time: '2025-06-14'}
// ];

function getQueryPostId() {
  const url = new URL(window.location.href);
  return parseInt(url.searchParams.get('post_id') || 0); // 获取 post_id 参数
}

// 使用统一配置中的API地址
const API_BASE_URL = APP_CONFIG.API_BASE;

// A helper function to fetch and set user avatar by user ID
async function fetchAvatarForUser(userId, imgElement) {
  if (!userId || !imgElement) {
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/profile.php?user_id=${userId}`);
    const data = await response.json();
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

async function fetchPostDetail(postId) {
  try {
    const response = await fetch(`${API_BASE_URL}/feed.php?post_id=${postId}`);
    const data = await response.json();
    return data; // 后端应该返回单个动态对象，而不是数组
  } catch (error) {
    console.error('获取动态详情失败:', error);
    return null;
  }
}

// 获取评论列表
async function fetchComments(postId) {
  try {
    const response = await fetch(`${API_BASE_URL}/comments.php?post_id=${postId}`);
    const data = await response.json();
    if (data.success) {
      return data.comments;
    } else {
      console.error('获取评论失败:', data.message);
      return [];
    }
  } catch (error) {
    console.error('获取评论时出错:', error);
    return [];
  }
}

// 渲染评论列表（主评论为卡片，回复为气泡，结构分区明显）
async function renderComments(comments) {
  const commentsListDiv = document.getElementById('comments-list');
  commentsListDiv.innerHTML = '';
  if (comments.length === 0) {
    commentsListDiv.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">还在等宝宝发评论呢~</p>';
    return;
  }
  // 构建id->评论映射，支持嵌套
  const commentMap = {};
  comments.forEach(c => commentMap[c.comment_id] = {...c, replies: []});
  const rootComments = [];
  comments.forEach(c => {
    if (c.parent_comment_id && commentMap[c.parent_comment_id]) {
      commentMap[c.parent_comment_id].replies.push(commentMap[c.comment_id]);
    } else {
      rootComments.push(commentMap[c.comment_id]);
    }
  });
  // 渲染主评论和回复
  function renderCommentItem(comment) {
    // 主评论卡片
    const cardDiv = document.createElement('div');
    cardDiv.className = 'comment-item';
    cardDiv.dataset.commentId = comment.comment_id;
    // 头像
    const avatarImg = document.createElement('img');
    avatarImg.className = 'comment-avatar';
    avatarImg.src = comment.avatar_url || 'img/default-avatar.png';
    avatarImg.alt = '用户头像';
    avatarImg.dataset.userId = comment.user_id;
    // 主内容区
    const mainContentDiv = document.createElement('div');
    mainContentDiv.className = 'comment-main-content';
    // 作者、内容、时间
    const commentAuthorDiv = document.createElement('div');
    commentAuthorDiv.className = 'comment-author';
    commentAuthorDiv.textContent = comment.user_name || '匿名用户';
    const commentTextDiv = document.createElement('p');
    commentTextDiv.className = 'comment-text';
    commentTextDiv.textContent = comment.content;
    const commentTimeDiv = document.createElement('div');
    commentTimeDiv.className = 'comment-time';
    commentTimeDiv.textContent = comment.timestamp;
    // 操作按钮
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'comment-actions';
    const replyBtn = document.createElement('button');
    replyBtn.textContent = '回复';
    replyBtn.className = 'comment-action-btn reply-btn';
    replyBtn.onclick = () => showReplyInput(comment.comment_id, comment.user_name, cardDiv);
    actionsDiv.appendChild(replyBtn);
    const currentUserId = localStorage.getItem('user_id');
    if (currentUserId && parseInt(currentUserId) === comment.user_id) {
      const editBtn = document.createElement('button');
      editBtn.textContent = '编辑';
      editBtn.className = 'comment-action-btn edit-btn';
      editBtn.onclick = () => editComment(comment.comment_id, comment.content);
      actionsDiv.appendChild(editBtn);
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '删除';
      deleteBtn.className = 'comment-action-btn delete-btn';
      deleteBtn.onclick = () => deleteComment(comment.comment_id);
      actionsDiv.appendChild(deleteBtn);
    }
    mainContentDiv.appendChild(commentAuthorDiv);
    mainContentDiv.appendChild(commentTextDiv);
    mainContentDiv.appendChild(commentTimeDiv);
    mainContentDiv.appendChild(actionsDiv);
    cardDiv.appendChild(avatarImg);
    cardDiv.appendChild(mainContentDiv);
    fetchAvatarForUser(comment.user_id, avatarImg);
    // 回复区
    if (comment.replies && comment.replies.length > 0) {
      const repliesDiv = document.createElement('div');
      repliesDiv.className = 'comment-replies';
      comment.replies.forEach(reply => {
        repliesDiv.appendChild(renderReplyItem(reply));
      });
      cardDiv.appendChild(repliesDiv);
    }
    return cardDiv;
  }
  // 渲染单条回复
  function renderReplyItem(reply) {
    const replyDiv = document.createElement('div');
    replyDiv.className = 'comment-reply';
    replyDiv.dataset.commentId = reply.comment_id;
    // 头像
    const avatarImg = document.createElement('img');
    avatarImg.className = 'comment-avatar';
    avatarImg.src = reply.avatar_url || 'img/default-avatar.png';
    avatarImg.alt = '用户头像';
    avatarImg.dataset.userId = reply.user_id;
    // 内容
    const replyContentDiv = document.createElement('div');
    replyContentDiv.className = 'comment-reply-content';
    const replyAuthorDiv = document.createElement('div');
    replyAuthorDiv.className = 'comment-author';
    replyAuthorDiv.textContent = reply.user_name || '匿名用户';
    const replyTextDiv = document.createElement('p');
    replyTextDiv.className = 'comment-text';
    replyTextDiv.textContent = reply.content;
    const replyTimeDiv = document.createElement('div');
    replyTimeDiv.className = 'comment-time';
    replyTimeDiv.textContent = reply.timestamp;
    // 操作按钮
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'comment-reply-actions';
    const replyBtn = document.createElement('button');
    replyBtn.textContent = '回复';
    replyBtn.className = 'comment-action-btn reply-btn';
    replyBtn.onclick = () => showReplyInput(reply.comment_id, reply.user_name, replyDiv);
    actionsDiv.appendChild(replyBtn);
    const currentUserId = localStorage.getItem('user_id');
    if (currentUserId && parseInt(currentUserId) === reply.user_id) {
      const editBtn = document.createElement('button');
      editBtn.textContent = '编辑';
      editBtn.className = 'comment-action-btn edit-btn';
      editBtn.onclick = () => editComment(reply.comment_id, reply.content);
      actionsDiv.appendChild(editBtn);
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '删除';
      deleteBtn.className = 'comment-action-btn delete-btn';
      deleteBtn.onclick = () => deleteComment(reply.comment_id);
      actionsDiv.appendChild(deleteBtn);
    }
    replyContentDiv.appendChild(replyAuthorDiv);
    replyContentDiv.appendChild(replyTextDiv);
    replyContentDiv.appendChild(replyTimeDiv);
    replyContentDiv.appendChild(actionsDiv);
    replyDiv.appendChild(avatarImg);
    replyDiv.appendChild(replyContentDiv);
    fetchAvatarForUser(reply.user_id, avatarImg);
    return replyDiv;
  }
  rootComments.forEach(c => {
    commentsListDiv.appendChild(renderCommentItem(c));
  });
}

// 显示回复输入框
function showReplyInput(parentCommentId, parentUserName, parentDiv) {
  // 移除已有的回复框
  const oldReplyBox = document.getElementById('reply-input-box');
  if (oldReplyBox) oldReplyBox.remove();
  // 创建回复输入框
  const replyBox = document.createElement('div');
  replyBox.id = 'reply-input-box';
  replyBox.className = 'comment-reply-box';
  replyBox.innerHTML = `
    <textarea id="reply-text" placeholder="回复@${parentUserName}"></textarea>
    <button id="send-reply-btn">发送</button>
    <button id="cancel-reply-btn" type="button" style="background:#eee;color:#333;">取消</button>
  `;
  // 插入到评论内容区的末尾
  const contentDiv = parentDiv.querySelector('.comment-main-content');
  if (contentDiv) {
    contentDiv.appendChild(replyBox);
  } else {
    parentDiv.appendChild(replyBox);
  }
  document.getElementById('send-reply-btn').onclick = async () => {
    const content = document.getElementById('reply-text').value.trim();
    if (!content) return showModal('回复内容不能为空', 'alert', '提示');
    await submitComment(content, parentCommentId, parentUserName);
    replyBox.remove();
  };
  document.getElementById('cancel-reply-btn').onclick = () => {
    replyBox.remove();
  };
}

// 修改提交评论，支持parent_comment_id
async function submitComment(content, parentCommentId = null, parentUserName = '') {
  const postId = getQueryPostId();
  const currentUserId = localStorage.getItem('user_id');
  const currentUsername = localStorage.getItem('username');
  if (!currentUserId) {
    showModal('请先登录才能发表评论。', 'alert', '未登录');
    return;
  }
  if (!content) {
    showModal('蠢蛋，什么都不输发什么！', 'alert', '内容为空');
    return;
  }
  if (postId === 0) {
    showModal('无效的动态ID，无法发表评论。', 'alert', '错误');
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/submit_comment.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: postId,
        user_id: parseInt(currentUserId),
        user_name: currentUsername,
        content: parentUserName ? `回复@${parentUserName}：${content}` : content,
        parent_comment_id: parentCommentId
      }),
    });
    const data = await response.json();
    if (data.success) {
      showModal('评论发表成功！', 'alert', '成功');
      // 清空主输入框
      if (!parentCommentId) {
        const commentTextElement = document.getElementById('comment-text');
        if (commentTextElement) commentTextElement.value = '';
      }
      // 重新加载评论
      const comments = await fetchComments(postId);
      renderComments(comments);
    } else {
      showModal(data.message || '评论发表失败。', 'alert', '失败');
    }
  } catch (error) {
    console.error('提交评论时出错:', error);
    showModal('哎呀，网不好！宝宝再试一次呢~', 'alert', '错误');
  }
}

async function renderDetail() {
  const postId = getQueryPostId();
  if (postId === 0) {
    document.getElementById('detail-main').innerHTML = '<p style="text-align: center; margin-top: 50px;">动态不存在或ID无效。</p>';
    return;
  }

  const item = await fetchPostDetail(postId);

  if (!item) {
    document.getElementById('detail-main').innerHTML = '<p style="text-align: center; margin-top: 50px;">无法加载动态详情。</p>';
    return;
  }

  let mediaHtml = '';
  // 检查post.media_urls是否存在且为数组
  if (item.media_urls && Array.isArray(item.media_urls) && item.media_urls.length > 0) {
      mediaHtml = '<div class="detail-media-container">'; // 添加一个容器来包裹所有媒体
      item.media_urls.forEach(mediaItem => {
          if (mediaItem.type === 'image') {
              mediaHtml += `<img src="${mediaItem.url}" class="detail-media-item" onclick="previewImg('${mediaItem.url}')">`;
          } else if (mediaItem.type === 'video') {
              mediaHtml += `<video src="${mediaItem.url}" controls class="detail-media-item"></video>`;
          }
      });
      mediaHtml += '</div>';
  } else if (item.media_url) { // 兼容旧的media_url字段，如果media_urls不存在
      if (item.type === 'image') {
          mediaHtml = `<div class="detail-media"><img src="${item.media_url}" class="detail-media-item" onclick="previewImg('${item.media_url}')"></div>`;
      } else if (item.type === 'video') {
          mediaHtml = `<div class="detail-media"><video src="${item.media_url}" controls class="detail-media-item"></video></div>`;
      }
  }
  let html = `<div class="detail-card">
    <div class="detail-header">
      <img class="detail-avatar" data-user-id="${item.user_id}" src="${item.avatar || 'img/default-avatar.png'}" alt="头像">
      <div class="detail-userinfo">
        <div class="detail-username">${item.user}</div>
        <div class="detail-time">${item.time}</div>
      </div>
    </div>
    <div class="detail-text">${item.content}</div>
    ${mediaHtml}
  </div>`;
  // Find the comment section element
  const commentSection = document.querySelector('.comment-section');

  // Check if commentSection exists before trying to insert HTML
  if (commentSection) {
    // Insert the post detail HTML before the comment section
    commentSection.insertAdjacentHTML('beforebegin', html);
  } else {
    // Fallback if commentSection is not found (e.g., for initial rendering before comment section is added)
    document.getElementById('detail-main').innerHTML = html;
  }

  // After rendering, fetch real-time avatar for the detail page
  const avatarElement = document.querySelector('.detail-avatar');
  if (avatarElement) {
    const userId = avatarElement.dataset.userId;
    if (userId) {
      fetchAvatarForUser(userId, avatarElement);
    }
  }

  // 获取当前登录用户的ID
  const currentUserId = localStorage.getItem('user_id');

  // 根据用户ID决定是否显示编辑和删除按钮
  if (currentUserId && parseInt(currentUserId) === item.user_id) {
    const header = document.querySelector('header');
    const actionsHtml = `
      <button id="edit-post-btn" onclick="editPostDetail(${item.id})">编辑</button>
      <button id="delete-post-btn" onclick="deletePostDetail(${item.id})">删除</button>
    `;
    // 插入到 header 中，紧随在返回按钮和标题之后
    header.insertAdjacentHTML('beforeend', actionsHtml);

    // 样式调整 (可选，也可以放在 CSS 文件中)
    const style = document.createElement('style');
    style.innerHTML = `
      #edit-post-btn, #delete-post-btn {
        background: #007aff;
        color: #fff;
        border: none;
        border-radius: 18px;
        padding: 8px 16px;
        font-size: 14px;
        cursor: pointer;
        margin-left: 10px;
        transition: background 0.2s;
      }
      #delete-post-btn {
        background: #dc3545;
      }
      #edit-post-btn:active, #delete-post-btn:active { transform: scale(0.96); }
    `;
    document.head.appendChild(style);
  }

  // 加载评论
  const comments = await fetchComments(postId);
  renderComments(comments);
}

function previewImg(url) {
  const modal = document.getElementById('image-preview-modal');
  const modalImg = document.getElementById('modal-preview-image');
  const closeBtn = modal.querySelector('.close-button');

  modalImg.src = url;
  modal.classList.add('show'); // 显示模态框

  // 点击关闭按钮隐藏模态框
  closeBtn.onclick = function() {
    modal.classList.remove('show');
  };

  // 点击模态框背景隐藏模态框
  modal.onclick = function(event) {
    if (event.target === modal) {
      modal.classList.remove('show');
    }
  };
}

// 占位符：编辑动态功能（待实现）
function editPostDetail(postId) {
  // 跳转到 post.html，并传入动态ID，以便进入编辑模式
  window.location.href = `post.html?post_id=${postId}`;
}

// 占位符：删除动态功能（待实现）
async function deletePostDetail(postId) {
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
    const response = await fetch(`${API_BASE_URL}/delete_post.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_id: postId,
        user_id: parseInt(currentUserId)
      }),
    });
    const data = await response.json();
    if (data.success) {
      await showModal(data.message, 'alert', '删除成功');
      goHome(); // 删除成功后返回主页
    } else {
      showModal(data.message || '删除失败', 'alert', '删除失败');
    }
  } catch (error) {
    console.error('删除动态时出错:', error);
    showModal('删除动态失败，请检查网络或稍后再试。', 'alert', '删除失败');
  }
}

// 编辑评论功能
async function editComment(commentId, currentContent) {
  const currentUserId = localStorage.getItem('user_id');
  if (!currentUserId) {
    showModal('请先登录才能编辑评论。', 'alert', '未登录');
    return;
  }

  const newContent = await showModal('请输入新的评论内容：', 'prompt', '编辑评论', currentContent); // 使用 showModal 的 prompt 模式
  if (newContent === null || (typeof newContent !== 'string') || newContent.trim() === '') {
    // 用户取消或输入空内容
    if (newContent !== null && (typeof newContent === 'string')) {
      showModal('评论内容不能为空。', 'alert', '内容为空');
    }
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/edit_comment.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment_id: commentId,
        user_id: parseInt(currentUserId),
        content: newContent.trim()
      }),
    });
    const data = await response.json();
    if (data.success) {
      showModal('评论编辑成功！', 'alert', '成功');
      const postId = getQueryPostId();
      const comments = await fetchComments(postId);
      renderComments(comments);
    } else {
      showModal(data.message || '评论编辑失败。', 'alert', '失败');
    }
  } catch (error) {
    console.error('编辑评论时出错:', error);
    showModal('编辑评论失败，请检查网络或稍后再试。', 'alert', '错误');
  }
}

// 删除评论功能
async function deleteComment(commentId) {
  const currentUserId = localStorage.getItem('user_id');
  if (!currentUserId) {
    showModal('请先登录才能删除评论。', 'alert', '未登录');
    return;
  }

  const confirmed = await showModal('确定要删除这条评论吗？此操作不可撤销！', 'confirm', '确认删除');
  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/delete_comment.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment_id: commentId,
        user_id: parseInt(currentUserId)
      }),
    });
    const data = await response.json();
    if (data.success) {
      showModal('评论删除成功！', 'alert', '成功');
      const postId = getQueryPostId();
      const comments = await fetchComments(postId);
      renderComments(comments);
    } else {
      showModal(data.message || '评论删除失败。', 'alert', '失败');
    }
  } catch (error) {
    console.error('删除评论时出错:', error);
    showModal('删除评论失败，请检查网络或稍后再试。', 'alert', '错误');
  }
}

// 在页面加载完成后绑定事件监听器
document.addEventListener('DOMContentLoaded', function() {
  renderDetail();

  const submitCommentBtn = document.getElementById('submit-comment-btn');
  if (submitCommentBtn) {
    submitCommentBtn.addEventListener('click', function() {
      const content = document.getElementById('comment-text').value.trim();
      submitComment(content);
    });
  }
}); 