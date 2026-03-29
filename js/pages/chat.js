// 使用统一配置中的API地址
const API_BASE_URL = APP_CONFIG.API_BASE;

// 格式化消息时间显示
function formatMessageTime(createdAt) {
  if (!createdAt) return '';
  
  const messageDate = new Date(createdAt);
  const now = new Date();
  
  // 检查是否是同一天
  const isSameDay = messageDate.toDateString() === now.toDateString();
  
  if (isSameDay) {
    // 同一天只显示小时和分钟
    return messageDate.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  } else {
    // 不是同一天显示年月日
    return messageDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }) + ' ' + messageDate.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }
}

// 获取URL参数
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

const peerId = getQueryParam('user_id');
const peerUsername = decodeURIComponent(getQueryParam('username') || '');
const peerAvatar = decodeURIComponent(getQueryParam('avatar') || 'img/default-avatar.png');

const myId = localStorage.getItem('user_id');
const myUsername = localStorage.getItem('username') || '我';
const myAvatar = localStorage.getItem('avatar') || 'img/default-avatar.png';

// 头像地址规范化：相对路径补全为服务器静态资源根
function resolveAvatarUrl(url) {
  if (!url) return 'img/default-avatar.png';
  const val = String(url).trim();
  if (/^https?:\/\//i.test(val) || /^data:image\//i.test(val)) return val;
  // 去掉可能的前导斜杠，拼到 AVATAR_BASE 下
  const clean = val.replace(/^\/+/, '');
  return APP_CONFIG.AVATAR_BASE + clean;
}

// 从本地缓存获取指定用户的头像，优先几个常见key
function getCachedAvatarFor(userId, fallbackUrl) {
  if (!userId) return fallbackUrl || 'img/default-avatar.png';
  const keysToTry = [
    `user_avatar_${userId}`,
    `avatar_${userId}`,
    `user_${userId}_avatar`,
    `profile_${userId}` // 可能是一个JSON
  ];
  for (const key of keysToTry) {
    const val = localStorage.getItem(key);
    if (!val) continue;
    // 尝试解析JSON
    try {
      const obj = JSON.parse(val);
      if (obj && (obj.avatar || obj.avatar_url)) {
        return obj.avatar || obj.avatar_url;
      }
    } catch (_) {
      // 非JSON，直接作为URL使用
      return val;
    }
  }
  return fallbackUrl || 'img/default-avatar.png';
}

// 顶部展示对方信息
window.addEventListener('DOMContentLoaded', () => {
  const avatarImg = document.getElementById('chat-peer-avatar');
  // 进入页面时把URL里带来的头像存入缓存，便于后续使用
  if (peerId && peerAvatar && peerAvatar !== 'img/default-avatar.png') {
    localStorage.setItem(`user_avatar_${peerId}`, peerAvatar);
  }
  const peerCachedAvatar = getCachedAvatarFor(peerId, peerAvatar);
  avatarImg.src = resolveAvatarUrl(peerCachedAvatar);
  avatarImg.onerror = function() {
    this.onerror = null;
    this.src = 'img/default-avatar.png';
  };
  document.getElementById('chat-peer-username').textContent = peerUsername;
});

const emojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '', '🙁', '☹️', '😣'
];

let chatData = [];
let chatPollingTimer = null;
let firstLoad = true; // 标记是否首次加载
let longPressTimer = null; // 长按定时器
let currentMessageId = null; // 当前操作的消息ID
let currentMessageElement = null; // 当前操作的消息元素
let lastMessageCount = 0; // 记录上次的消息数量，用于检测新消息

let userEmojis = []; // 存储用户上传的表情

// 上拉加载相关状态
let oldestMessageId = null; // 当前列表中最早一条消息的ID
let hasMoreHistory = true; // 是否还有更早的消息
let isLoadingMore = false; // 是否正在加载更多
const PAGE_LIMIT = 100; // 每次加载条数
// 加载更多守卫与滚动状态
let allowLoadMore = false; // 初次渲染完毕后再允许加载更多
let userInitiatedUpScroll = false; // 仅用户上滑到顶部时才触发
let lastScrollTop = 0; // 记录上一次scrollTop
// 检测是否刷新进入
const isPageReload = (() => {
  const nav = (performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
  return nav && nav.type === 'reload';
})();
let disableAutoScroll = isPageReload; // 刷新进入时禁用首帧自动滚动

async function fetchChatHistory() {
  if (!myId || !peerId) return;
  try {
    const res = await fetch(`${API_BASE_URL}/get_messages.php?user_id=${myId}&peer_id=${peerId}&limit=${PAGE_LIMIT}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.messages)) {
      const oldLen = chatData.length;
      const newChatData = data.messages.map(msg => ({
        id: msg.id, // 添加消息ID
        from: msg.from_user_id == myId ? myUsername : peerUsername,
        avatar: msg.from_user_id == myId 
          ? resolveAvatarUrl(myAvatar)
          : resolveAvatarUrl(getCachedAvatarFor(peerId, peerAvatar)),
        type: msg.content.startsWith('data:image/') ? 'image' : 'text',
        content: msg.content,
        time: formatMessageTime(msg.created_at),
        unread: msg.unread === 1 || msg.unread === true, // 需后端返回 unread 字段
        isMyMessage: msg.from_user_id == myId, // 添加是否是自己的消息
        from_user_id: msg.from_user_id // 保留原始用户ID
      }));

      // 更新最早消息ID与是否还有更多
      hasMoreHistory = !!data.has_more;
      if (newChatData.length > 0) {
        oldestMessageId = newChatData[0].id;
      }

      // 将接口返回与本地数据合并，避免覆盖历史
      const existingIds = new Set(chatData.map(m => m.id));
      newChatData.forEach(m => { if (!existingIds.has(m.id)) chatData.push(m); });
      // 按ID升序排序
      chatData.sort((a, b) => a.id - b.id);

      // 注意：通知功能已转移到全局通知检查器(GlobalNotificationChecker)
      // 聊天页面不再负责发送通知，只负责显示聊天内容

      if (oldLen === 0) {
        renderChat(false); // 首次全量渲染
        // 刷新进入则不自动滚动；非刷新进入时再自动滚动到底部
        if (!isPageReload) {
          forceScrollToBottom();
        }
        // 首次渲染完成后，延迟开启“加载更多”能力，避免误触
        setTimeout(() => { allowLoadMore = true; }, 200);
      } else {
        renderChat(true); // 只增量渲染新消息
      }
      markMessagesRead();
    }
  } catch (e) {
    chatData = [];
    renderChat(false);
  }
}

// 上拉加载更早消息
async function loadMoreHistory() {
  if (!myId || !peerId || !hasMoreHistory || isLoadingMore || !oldestMessageId) return;
  if (!allowLoadMore || !userInitiatedUpScroll) return; // 只有用户上滑才允许
  isLoadingMore = true;
  const list = document.getElementById('chat-list');
  const prevScrollHeight = list.scrollHeight;
  const prevScrollTop = list.scrollTop;
  // 显示顶部加载动画
  const loader = document.getElementById('chat-top-loader');
  if (loader) loader.classList.add('show');
  try {
    const res = await fetch(`${API_BASE_URL}/get_messages.php?user_id=${myId}&peer_id=${peerId}&limit=${PAGE_LIMIT}&before_id=${oldestMessageId}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
      const moreData = data.messages.map(msg => ({
        id: msg.id,
        from: msg.from_user_id == myId ? myUsername : peerUsername,
        avatar: msg.from_user_id == myId 
          ? resolveAvatarUrl(myAvatar) 
          : resolveAvatarUrl(getCachedAvatarFor(peerId, peerAvatar)),
        type: msg.content.startsWith('data:image/') ? 'image' : 'text',
        content: msg.content,
        time: formatMessageTime(msg.created_at),
        unread: msg.unread === 1 || msg.unread === true,
        isMyMessage: msg.from_user_id == myId,
        from_user_id: msg.from_user_id
      }));

      // 记录新的最老ID与是否还有更多
      hasMoreHistory = !!data.has_more;
      oldestMessageId = moreData[0].id;

      // 将更早消息插入到前面（避免重复）
      const existingIds = new Set(chatData.map(m => m.id));
      const toPrepend = moreData.filter(m => !existingIds.has(m.id));
      chatData = [...toPrepend, ...chatData];

      // 重新渲染并保持可视位置不跳动
      const renderedAtBottom = isAtBottom(list);
      renderChat(false);
      if (!renderedAtBottom) {
        const newScrollHeight = list.scrollHeight;
        list.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
      }
    } else {
      hasMoreHistory = false;
    }
  } catch (e) {
    // 忽略错误，保持状态
  } finally {
    isLoadingMore = false;
    // 隐藏顶部加载动画
    const loader2 = document.getElementById('chat-top-loader');
    if (loader2) loader2.classList.remove('show');
    // 等待下一次上滑
    userInitiatedUpScroll = false;
  }
}

// 多次强制滚动到底部，确保初次进入即在底部
function forceScrollToBottom() {
  const list = document.getElementById('chat-list');
  if (!list) return;
  const doScroll = () => { list.scrollTop = list.scrollHeight; };
  // 立即一次
  setTimeout(doScroll, 0);
  // 图片/字体渲染后再滚几次
  setTimeout(doScroll, 50);
  setTimeout(doScroll, 150);
  requestAnimationFrame(doScroll);
}

function isAtBottom(list, threshold = 20) {
  // threshold像素内都算在底部，防止浮点误差
  return list.scrollHeight - list.scrollTop - list.clientHeight < threshold;
}

function renderChat(onlyMessages = false) {
  const list = document.getElementById('chat-list');
  // 确保顶部加载动画容器存在
  let topLoader = document.getElementById('chat-top-loader');
  if (!topLoader) {
    topLoader = document.createElement('div');
    topLoader.id = 'chat-top-loader';
    topLoader.className = 'chat-top-loader';
    topLoader.innerHTML = '<div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    list.prepend(topLoader);
  }
  let shouldScroll = false;
  if (onlyMessages) {
    shouldScroll = isAtBottom(list);
  }
  if (!onlyMessages) {
    // 清空并保留loader
    list.innerHTML = '';
    list.appendChild(topLoader);
    chatData.forEach(item => {
      const isMe = item.from === myUsername;
      let contentHtml = '';
      if (item.type === 'text') {
        // 检查是否为GIF img标签
        if (/^<img src=['"]https?:.*\.gif['"][^>]*>$/i.test(item.content.trim())) {
          contentHtml = item.content;
        } else {
          contentHtml = item.content.replace(/(\ud83c[\udf00-\udfff]|\ud83d[\udc00-\udfff]|\ud83e[\udc00-\udfff])/g, '<span class="chat-emoji">$&</span>');
        }
      } else if (item.type === 'image') {
        contentHtml = `<img class="chat-image" src="${item.content}" alt="图片">`;
      }
      let html = `<div class="chat-row ${isMe ? 'me' : 'other'}" data-message-id="${item.id}">\n        <img class="chat-avatar" src="${item.avatar}" alt="头像" onerror="this.onerror=null;this.src='img/default-avatar.png'">\n        <div>\n          <div class="chat-bubble">${contentHtml}</div>\n          <div class="chat-meta">${item.from} · ${item.time}</div>\n        </div>\n      </div>`;
      list.innerHTML += html;
    });
    // 添加长按事件监听
    addLongPressListeners();
  }
  // 增量渲染部分
  const renderedCount = list.querySelectorAll('.chat-row').length;
  if (chatData.length > renderedCount) {
    for (let i = renderedCount; i < chatData.length; i++) {
      const item = chatData[i];
      const isMe = item.from === myUsername;
      let contentHtml = '';
      if (item.type === 'text') {
        // 检查是否为GIF img标签
        if (/^<img src=['"]https?:.*\.gif['"][^>]*>$/i.test(item.content.trim())) {
          contentHtml = item.content;
        } else {
          contentHtml = item.content.replace(/(\ud83c[\udf00-\udfff]|\ud83d[\udc00-\udfff]|\ud83e[\udc00-\udfff])/g, '<span class="chat-emoji">$&</span>');
        }
      } else if (item.type === 'image') {
        contentHtml = `<img class="chat-image" src="${item.content}" alt="图片">`;
      }
      let html = `<div class="chat-row ${isMe ? 'me' : 'other'}" data-message-id="${item.id}">\n        <img class="chat-avatar" src="${item.avatar}" alt="头像" onerror="this.onerror=null;this.src='img/default-avatar.png'">\n        <div>\n          <div class="chat-bubble">${contentHtml}</div>\n          <div class="chat-meta">${item.from} · ${item.time}</div>\n        </div>\n      </div>`;
      list.innerHTML += html;
    }
    // 为新增的消息添加长按事件监听
    addLongPressListeners();
  }
  // 渲染后，如果首次加载，或本来就在底部，则自动滚动
  if (!disableAutoScroll && (firstLoad || shouldScroll)) {
    setTimeout(() => {
      list.scrollTop = list.scrollHeight;
      firstLoad = false;
    }, 0);
  } else if (firstLoad) {
    // 刷新首帧：仅标记已完成，避免任何位移
    firstLoad = false;
  }
}

function populateEmojiPanel() {
  const emojiGrid = document.querySelector('#emoji-panel .emoji-grid');
  emojiGrid.innerHTML = '';
  emojis.forEach(emoji => {
    const span = document.createElement('span');
    span.textContent = emoji;
    span.onclick = (e) => {
      e.stopPropagation();
      insertEmoji(emoji);
    };
    emojiGrid.appendChild(span);
  });
}

function toggleEmojiPanel(forceHide) {
  const emojiPanel = document.getElementById('emoji-panel');
  if (forceHide === true) {
    emojiPanel.style.display = 'none';
  } else if (forceHide === false) {
    emojiPanel.style.display = 'block';
  } else {
    // 切换显示/隐藏
    emojiPanel.style.display = (emojiPanel.style.display === 'block') ? 'none' : 'block';
  }
  if (emojiPanel.style.display !== 'none') {
    document.getElementById('chat-input').focus();
  }
}

function insertEmoji(emoji) {
  const input = document.getElementById('chat-input');
  input.value += emoji;
}

async function sendMsg() {
  const input = document.getElementById('chat-input');
  const textMsg = input.value.trim();
  if (!textMsg) {
    showModal('请输入消息', 'alert', '发送失败');
    return;
  }
  // 发送文本消息
  await fetch(`${API_BASE_URL}/send_message.php`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      from_user_id: myId,
      to_user_id: peerId,
      content: textMsg
    })
  });
  input.value = '';
  await fetchChatHistory();
  toggleEmojiPanel(true);
}

async function markMessagesRead() {
  if (!myId || !peerId) return;
  await fetch(`${API_BASE_URL}/mark_messages_read.php`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({user_id: myId, peer_id: peerId})
  });
}

// 隐藏表情面板点击监听

document.addEventListener('click', function(event) {
  const emojiPanel = document.getElementById('emoji-panel');
  const emojiBtn = document.getElementById('emoji-btn');
  if (emojiPanel && emojiBtn && emojiPanel.style.display !== 'none') {
    if (!emojiPanel.contains(event.target) && !emojiBtn.contains(event.target)) {
      toggleEmojiPanel(true);
    }
  }
  const gifPanel = document.getElementById('gif-panel');
  const gifBtn = document.getElementById('gif-btn');
  if (gifPanel && gifBtn && gifPanel.style.display !== 'none') {
    if (!gifPanel.contains(event.target) && !gifBtn.contains(event.target)) {
      toggleGifPanel(true);
    }
  }
  
  // 隐藏长按菜单
  const longPressMenu = document.getElementById('long-press-menu');
  if (longPressMenu && longPressMenu.style.display !== 'none') {
    if (!longPressMenu.contains(event.target)) {
      hideLongPressMenu();
    }
  }
});

function startChatPolling() {
  if (chatPollingTimer) clearInterval(chatPollingTimer);
  chatPollingTimer = setInterval(fetchChatHistory, 500); // 每0.5秒轮询
}
function stopChatPolling() {
  if (chatPollingTimer) clearInterval(chatPollingTimer);
  chatPollingTimer = null;
}

// 使用统一配置中的GIF相关地址
const SERVER_GIF_BASE = APP_CONFIG.GIF_BASE;
const SERVER_USER_EMOJI_BASE = APP_CONFIG.USER_EMOJI_BASE;
const localGifs = [
  {file: 'smile.gif', label: '微笑'},
  {file: 'clap.gif', label: '鼓掌'},
  {file: 'clap2.gif', label: '鼓掌2'},
  {file: 'cheer.gif', label: '加油'},
  {file: 'angry.gif', label: '生气'},
  {file: 'cry.gif', label: '哭泣'},
  {file: 'cry2.gif', label: '哭泣2'},
  {file: 'cry3.gif', label: '哭泣3'},
  {file: 'happy.gif', label: '开心'},
  {file: 'bye.gif', label: '拜拜'},
  {file: 'like.gif', label: '赞'},
  {file: 'heart.gif', label: '比心'},
  {file: 'haha.gif', label: '哈哈'},
  {file: 'wow.gif', label: '惊讶'},
  {file: 'wronged.gif', label: '委屈'},
  {file: 'cold.jpg', label: '冷漠'},
  {file: 'question.gif', label: '疑问'},
  {file: 'buguan.gif', label: '不管'}
];

function toggleGifPanel(forceHide) {
  const gifPanel = document.getElementById('gif-panel');
  if (forceHide === true) {
    gifPanel.style.display = 'none';
  } else if (forceHide === false) {
    gifPanel.style.display = 'block';
    loadGifGrid();
  } else {
    gifPanel.style.display = (gifPanel.style.display === 'block') ? 'none' : 'block';
    if (gifPanel.style.display === 'block') loadGifGrid();
  }
  if (gifPanel.style.display !== 'none') {
    document.getElementById('chat-input').focus();
  }
}

// 获取用户上传的表情
async function fetchUserEmojis() {
  try {
    const response = await fetch(`${API_BASE_URL}/get_user_emojis.php`);
    const data = await response.json();
    if (data.success) {
      userEmojis = data.emojis || [];
    }
  } catch (error) {
    console.error('获取用户表情失败:', error);
    userEmojis = [];
  }
}

function loadGifGrid(query) {
  const grid = document.querySelector('#gif-panel .gif-grid');
  grid.innerHTML = '';
  
  // 合并系统表情和用户表情
  let allGifs = [...localGifs];
  
  // 添加用户上传的表情
  userEmojis.forEach(emoji => {
    allGifs.push({
      file: emoji.file,
      label: emoji.label,
      isUserEmoji: true
    });
  });
  
  let gifs = allGifs;
  if (query) {
    gifs = gifs.filter(g => g.label.includes(query));
  }
  if (gifs.length === 0) {
    grid.innerHTML = '<div style="text-align:center;color:#aaa;">没有找到相关表情</div>';
    return;
  }
  gifs.forEach(gif => {
    const img = document.createElement('img');
    if (gif.isUserEmoji) {
      img.src = SERVER_USER_EMOJI_BASE + gif.file;
      img.onclick = () => sendUserEmojiMsg(SERVER_USER_EMOJI_BASE + gif.file);
    } else {
      img.src = SERVER_GIF_BASE + gif.file;
      img.onclick = () => insertGif(gif.file);
    }
    img.alt = gif.label;
    img.className = 'gif-thumb';
    img.title = gif.label;
    grid.appendChild(img);
  });
}

document.getElementById('gif-search').addEventListener('input', function() {
  loadGifGrid(this.value.trim());
});

function insertGif(gifFile) {
  // 发送服务器gif目录下的gif
  sendGifMsg(SERVER_GIF_BASE + gifFile);
  toggleGifPanel(true);
}

async function sendGifMsg(gifUrl) {
  if (!gifUrl) return;
  await fetch(`${API_BASE_URL}/send_message.php`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      from_user_id: myId,
      to_user_id: peerId,
      content: `<img src='${gifUrl}' class='chat-gif'>`
    })
  });
  await fetchChatHistory();
  // 发送后自动滚动到底部
  setTimeout(() => {
    const list = document.getElementById('chat-list');
    list.scrollTop = list.scrollHeight;
  }, 100);
}

// 发送用户自定义表情
async function sendUserEmojiMsg(emojiUrl) {
  if (!emojiUrl) return;
  await fetch(`${API_BASE_URL}/send_message.php`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      from_user_id: myId,
      to_user_id: peerId,
      content: `<img src='${emojiUrl}' class='chat-gif'>`
    })
  });
  await fetchChatHistory();
  toggleGifPanel(true);
  // 发送后自动滚动到底部
  setTimeout(() => {
    const list = document.getElementById('chat-list');
    list.scrollTop = list.scrollHeight;
  }, 100);
}

// 添加长按事件监听器
function addLongPressListeners() {
  const chatRows = document.querySelectorAll('.chat-row');
  chatRows.forEach(row => {
    const messageId = row.getAttribute('data-message-id');
    const isMyMessage = row.classList.contains('me');
    
    // 移除之前的事件监听器（如果存在）
    row.removeEventListener('touchstart', handleTouchStart);
    row.removeEventListener('touchend', handleTouchEnd);
    row.removeEventListener('mousedown', handleMouseDown);
    row.removeEventListener('mouseup', handleMouseUp);
    row.removeEventListener('mouseleave', handleMouseLeave);
    
    // 添加新的事件监听器
    row.addEventListener('touchstart', handleTouchStart);
    row.addEventListener('touchend', handleTouchEnd);
    row.addEventListener('mousedown', handleMouseDown);
    row.addEventListener('mouseup', handleMouseUp);
    row.addEventListener('mouseleave', handleMouseLeave);
    
    // 存储消息信息到元素上
    row.messageId = messageId;
    row.isMyMessage = isMyMessage;
  });
}

// 触摸开始
function handleTouchStart(e) {
  clearTimeout(longPressTimer);
  currentMessageElement = this;
  currentMessageId = this.messageId;
  
  longPressTimer = setTimeout(() => {
    showLongPressMenu(e.touches[0].clientX, e.touches[0].clientY);
  }, 500); // 500ms长按
}

// 触摸结束
function handleTouchEnd(e) {
  clearTimeout(longPressTimer);
}

// 鼠标按下
function handleMouseDown(e) {
  clearTimeout(longPressTimer);
  currentMessageElement = this;
  currentMessageId = this.messageId;
  
  longPressTimer = setTimeout(() => {
    showLongPressMenu(e.clientX, e.clientY);
  }, 500); // 500ms长按
}

// 鼠标松开
function handleMouseUp(e) {
  clearTimeout(longPressTimer);
}

// 鼠标离开
function handleMouseLeave(e) {
  clearTimeout(longPressTimer);
}

// 显示长按菜单
function showLongPressMenu(x, y) {
  const menu = document.getElementById('long-press-menu');
  const recallItem = document.getElementById('recall-message');
  
  // 只有自己的消息才显示撤回选项
  if (currentMessageElement && currentMessageElement.isMyMessage) {
    recallItem.style.display = 'block';
  } else {
    recallItem.style.display = 'none';
  }
  
  // 设置菜单位置
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
  
  // 确保菜单不超出屏幕边界
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }
  }, 0);
}

// 隐藏长按菜单
function hideLongPressMenu() {
  const menu = document.getElementById('long-press-menu');
  menu.style.display = 'none';
  currentMessageId = null;
  currentMessageElement = null;
}

// 复制消息
function copyMessage() {
  if (!currentMessageElement) return;
  
  const bubble = currentMessageElement.querySelector('.chat-bubble');
  let textContent = '';
  
  // 如果是图片消息
  const img = bubble.querySelector('img');
  if (img) {
    textContent = '[图片]';
  } else {
    // 获取纯文本内容
    textContent = bubble.textContent || bubble.innerText;
  }
  
  // 复制到剪贴板
  if (navigator.clipboard) {
    navigator.clipboard.writeText(textContent).then(() => {
      showModal('复制成功', 'alert', '提示');
    }).catch(() => {
      fallbackCopyText(textContent);
    });
  } else {
    fallbackCopyText(textContent);
  }
  
  hideLongPressMenu();
}

// 降级复制方法
function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    showModal('复制成功', 'alert', '提示');
  } catch (err) {
    showModal('复制失败', 'alert', '错误');
  }
  document.body.removeChild(textArea);
}

// 撤回消息
async function recallMessage() {
  if (!currentMessageId || !currentMessageElement || !currentMessageElement.isMyMessage) {
    showModal('只能撤回自己的消息', 'alert', '提示');
    hideLongPressMenu();
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/recall_message.php`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        message_id: currentMessageId,
        user_id: myId
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showModal('撤回成功', 'alert', '提示');
      
      // 从本地数据中移除被撤回的消息
      chatData = chatData.filter(msg => msg.id != currentMessageId);
      
      // 重新渲染聊天列表
      renderChat(false);
      
      // 滚动到底部（如果之前在底部的话）
      setTimeout(() => {
        const list = document.getElementById('chat-list');
        if (isAtBottom(list, 100)) { // 放宽一点判断范围
          list.scrollTop = list.scrollHeight;
        }
      }, 0);
    } else {
      showModal(result.message || '撤回失败', 'alert', '错误');
    }
  } catch (error) {
    showModal('撤回失败，请重试', 'alert', '错误');
  }
  
  hideLongPressMenu();
}

// 将文件转换为base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 上传表情包
async function uploadEmoji(file) {
  if (!file) return;
  
  // 获取表情名称
  const nameInput = document.getElementById('emoji-name-input');
  const emojiName = nameInput.value.trim();
  
  if (!emojiName) {
    showModal('请先给表情起个名字', 'alert', '提示');
    nameInput.focus();
    return;
  }
  
  // 检查文件类型
  const allowedTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showModal('只支持 GIF、PNG、JPG、WEBP 格式的图片', 'alert', '格式错误');
    return;
  }
  
  // 检查文件大小 (5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showModal('文件大小不能超过5MB', 'alert', '文件太大');
    return;
  }
  
  try {
    showModal('正在上传...', 'alert', '上传中');
    
    // 转换文件为base64
    const base64Data = await fileToBase64(file);
    
    // 使用简单的POST请求（表单格式）
    const formData = `name=${encodeURIComponent(emojiName)}&data=${encodeURIComponent(base64Data)}`;
    
    const response = await fetch(`${API_BASE_URL}/upload_emoji_simple.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      showModal('上传成功！', 'alert', '成功');
      // 清空输入框
      nameInput.value = '';
      // 重新获取用户表情列表
      await fetchUserEmojis();
      // 重新加载表情网格
      loadGifGrid();
    } else {
      showModal(result.message || '上传失败', 'alert', '错误');
    }
  } catch (error) {
    console.error('上传错误:', error);
    showModal('上传失败，请重试', 'alert', '错误');
  }
}

// 测试CORS连接
async function testCors() {
  try {
    // 先测试GET请求
    const response = await fetch(`${API_BASE_URL}/get_user_emojis.php`);
    const result = await response.json();
    console.log('GET请求测试成功:', result);
    
    // 再测试POST请求
    try {
      const postResponse = await fetch(`${API_BASE_URL}/test_cors.php`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({test: 'data'})
      });
      const postResult = await postResponse.json();
      console.log('POST请求测试成功:', postResult);
    } catch (postError) {
      console.error('POST请求失败，但GET请求正常:', postError);
    }
    
    // 测试upload_emoji_simple.php文件是否存在
    try {
      const uploadTestResponse = await fetch(`${API_BASE_URL}/upload_emoji_simple.php`);
      const uploadTestResult = await uploadTestResponse.json();
      console.log('upload_emoji_simple.php测试:', uploadTestResult);
    } catch (uploadError) {
      console.error('upload_emoji_simple.php不存在或有错误:', uploadError);
    }
  } catch (error) {
    console.error('所有请求都失败:', error);
  }
}

window.onload = function() {
  populateEmojiPanel();
  fetchChatHistory();
  startChatPolling();
  
  // 测试CORS连接
  testCors();
  
  // 获取用户上传的表情
  fetchUserEmojis();
  
  // 支持回车发送
  document.getElementById('chat-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  });
  // 表情按钮点击切换面板
  document.getElementById('emoji-btn').onclick = function(e) {
    e.stopPropagation();
    toggleEmojiPanel();
  };
  
  // 添加长按菜单按钮事件监听
  document.getElementById('copy-message').addEventListener('click', copyMessage);
  document.getElementById('recall-message').addEventListener('click', recallMessage);
  
  // 添加文件上传事件监听
  document.getElementById('emoji-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      uploadEmoji(file);
      // 清空input，允许重复上传同一文件
      e.target.value = '';
    }
  });

  // 监听上拉加载更多
  const list = document.getElementById('chat-list');
  list.addEventListener('scroll', function() {
    // 判断是否为用户上滑到接近顶部
    if (list.scrollTop < lastScrollTop && list.scrollTop <= 10) {
      userInitiatedUpScroll = true;
    }
    lastScrollTop = list.scrollTop;
    if (list.scrollTop <= 10) loadMoreHistory();
  });
};
window.onbeforeunload = stopChatPolling; 