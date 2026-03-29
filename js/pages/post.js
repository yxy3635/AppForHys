console.log('js/pages/post.js 文件已加载并开始执行！'); // 调试：在文件最顶部添加此行

function goHome() {
  window.location.href = 'home.html';
}

// 使用统一配置中的API地址
const API_BASE_URL = APP_CONFIG.API_BASE;
let editingPostId = null; // 用于存储当前编辑的动态ID

// 异步函数：从服务器获取用户头像
async function fetchUserAvatar() {
  const userId = localStorage.getItem('user_id');
  const userAvatarElement = document.getElementById('user-avatar');

  if (!userId) {
    if (userAvatarElement) {
      userAvatarElement.src = 'img/default-avatar.png'; // 未登录使用默认头像
    }
    return;
  }

  try {
    console.log(`尝试从服务器获取用户头像，用户ID: ${userId}`);
    const response = await fetch(`${API_BASE_URL}/profile.php?user_id=${userId}`);
    const data = await response.json();

    if (data.success && data.user && data.user.avatar_url) {
      if (userAvatarElement) {
        userAvatarElement.src = data.user.avatar_url;
      }
    } else {
      // 如果获取失败，仍然使用默认头像
      if (userAvatarElement) {
        userAvatarElement.src = 'img/default-avatar.png';
      }
      console.error('获取用户头像失败:', data.message || '未知错误');
    }
  } catch (error) {
    console.error('获取用户头像时出错:', error);
    if (userAvatarElement) {
      userAvatarElement.src = 'img/default-avatar.png';
    }
  }
}

// 获取URL中的post_id参数，判断是否为编辑模式
function getQueryPostId() {
  const url = new URL(window.location.href);
  return parseInt(url.searchParams.get('post_id') || 0);
}

// 异步函数：从服务器获取单个动态详情
async function fetchPostDetail(postId) {
  try {
    const response = await fetch(`${API_BASE_URL}/feed.php?post_id=${postId}`);
    const data = await response.json();
    return data; // 后端应该返回单个动态对象
  } catch (error) {
    console.error('获取动态详情失败:', error);
    return null;
  }
}

// 预填充编辑表单
async function loadPostForEdit(postId) {
  const post = await fetchPostDetail(postId);
  if (post) {
    // 始终填充文本内容
    document.getElementById('post-text').value = post.content || '';
    // 预加载媒体预览
    const mediaPreview = document.getElementById('media-preview');
    mediaPreview.innerHTML = ''; // 清空现有预览

    // 优先使用 media_urls 字段来加载媒体
    let hasMedia = false;
    let mediaUrls = []; // 确保 mediaUrls 始终被定义
    if (post.media_urls) {
      try {
        // 检查 media_urls 是否已经是数组，如果不是，尝试解析
        if (Array.isArray(post.media_urls)) {
          mediaUrls = post.media_urls;
        } else {
          // 只有当 media_urls 是字符串时才尝试 JSON.parse
          mediaUrls = JSON.parse(post.media_urls);
        }
        
        if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
          mediaUrls.forEach(mediaItem => {
            if (mediaItem.type === 'image') {
              const img = document.createElement('img');
              img.src = mediaItem.url;
              img.className = 'preview-img';
              mediaPreview.appendChild(img);
              hasMedia = true;
            } else if (mediaItem.type === 'video') {
              const video = document.createElement('video');
              video.src = mediaItem.url;
              video.controls = true;
              video.className = 'preview-video';
              mediaPreview.appendChild(video);
              hasMedia = true;
            }
          });
        }
      } catch (e) {
        console.error("解析media_urls失败:", e);
        // Fallback to old media_url if parsing fails
        if (post.content && (post.type === 'image' || post.type === 'video')) {
          if (post.type === 'image') {
            const img = document.createElement('img');
            img.src = post.content;
            img.className = 'preview-img';
            mediaPreview.appendChild(img);
          } else {
            const video = document.createElement('video');
            video.src = post.content;
            video.controls = true;
            video.className = 'preview-video';
            mediaPreview.appendChild(video);
          }
          hasMedia = true;
        }
      }
    } else if (post.content && (post.type === 'image' || post.type === 'video')) {
      // Fallback if media_urls is not present but old media_url is
      if (post.type === 'image') {
        const img = document.createElement('img');
        img.src = post.content;
        img.className = 'preview-img';
        mediaPreview.appendChild(img);
      } else {
        const video = document.createElement('video');
        video.src = post.content;
        video.controls = true;
        video.className = 'preview-video';
        mediaPreview.appendChild(video);
      }
      hasMedia = true;
    }

    const imgUploadInput = document.getElementById('img-upload');
    const videoUploadInput = document.getElementById('video-upload');
    const imgUploadButton = document.querySelector('button[onclick="document.getElementById(\'img-upload\').click()"]');
    const videoUploadButton = document.querySelector('button[onclick="document.getElementById(\'video-upload\').click()"]');

    // 根据已加载的媒体类型禁用另一个上传按钮
    if (hasMedia) {
        // 确保 mediaUrls 已定义且是数组
        const currentMediaType = Array.isArray(mediaUrls) && mediaUrls.length > 0 ? mediaUrls[0].type : post.type;
        if (currentMediaType === 'image') {
            videoUploadInput.disabled = true;
            if (videoUploadButton) videoUploadButton.disabled = true;
        } else if (currentMediaType === 'video') {
            imgUploadInput.disabled = true;
            if (imgUploadButton) imgUploadButton.disabled = true;
        }
    } else {
        // 如果没有媒体，确保两个上传按钮都启用
        imgUploadInput.disabled = false;
        videoUploadInput.disabled = false;
        if (imgUploadButton) imgUploadButton.disabled = false;
        if (videoUploadButton) videoUploadButton.disabled = false;
    }

  } else {
    showModal('无法加载动态，请重试。', 'alert', '编辑失败');
    goHome(); // 如果加载失败，返回主页
  }
}

// 新增或调整 resetMediaInputs 函数以管理输入框状态和清空预览
function resetMediaInputs(selectedInputId) {
  const imgUploadInput = document.getElementById('img-upload');
  const videoUploadInput = document.getElementById('video-upload');
  const imgUploadButton = document.querySelector('button[onclick="document.getElementById(\'img-upload\').click()"]');
  const videoUploadButton = document.querySelector('button[onclick="document.getElementById(\'video-upload\').click()"]');
  const mediaPreview = document.getElementById('media-preview');

  mediaPreview.innerHTML = ''; // 清空现有预览

  // 根据当前选择的输入，禁用另一个输入
  if (selectedInputId === 'img-upload') {
    videoUploadInput.value = ''; // 清空视频选择
    videoUploadInput.disabled = true;
    if (videoUploadButton) videoUploadButton.disabled = true;
    imgUploadInput.disabled = false;
    if (imgUploadButton) imgUploadButton.disabled = false;
  } else if (selectedInputId === 'video-upload') {
    imgUploadInput.value = ''; // 清空图片选择
    imgUploadInput.disabled = true;
    if (imgUploadButton) imgUploadButton.disabled = true;
    videoUploadInput.disabled = false;
    if (videoUploadButton) videoUploadButton.disabled = false;
  } else { // 当没有选择任何文件时，都启用
    imgUploadInput.value = '';
    videoUploadInput.value = '';
    imgUploadInput.disabled = false;
    videoUploadInput.disabled = false;
    if (imgUploadButton) imgUploadButton.disabled = false;
    if (videoUploadButton) videoUploadButton.disabled = false;
  }
}

function previewImages(event) {
  const files = event.target.files;
  const preview = document.getElementById('media-preview');
  resetMediaInputs('img-upload'); // 调用重置函数并指定当前选择的是图片

  for (let file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.className = 'preview-img';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  }
}

function previewVideo(event) {
  const files = event.target.files; // 获取所有选定的文件
  const preview = document.getElementById('media-preview');
  resetMediaInputs('video-upload'); // 调用重置函数并指定当前选择的是视频

  for (let file of files) {
    if (!file.type.startsWith('video/')) continue;
    // 强制只允许上传一个视频
    if (files.length > 1) {
        showModal('一次只能上传一个视频文件。', 'alert', '发布失败');
        event.target.value = ''; // 清空文件选择
        resetMediaInputs(''); // 重置状态
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      const video = document.createElement('video');
      video.src = e.target.result;
      video.controls = true;
      video.className = 'preview-video';
      preview.appendChild(video);
    };
    reader.readAsDataURL(file);
  }
}

let isSubmitting = false; // 添加一个标志位

function submitPost() {
  if (isSubmitting) {
    console.log('正在提交，请勿重复点击。');
    return; // 如果正在提交，则直接返回
  }

  const submitBtn = document.getElementById('submit-btn');
  const uploadProgressDiv = document.getElementById('upload-progress');

  isSubmitting = true; // 设置为正在提交
  submitBtn.disabled = true; // 禁用发布按钮
  uploadProgressDiv.style.display = 'block'; // 显示进度条
  uploadProgressDiv.textContent = '上传中... 0%'; // 初始化进度文本

  const text = document.getElementById('post-text').value.trim();
  const imgFiles = document.getElementById('img-upload').files;
  const videoFiles = document.getElementById('video-upload').files;

  // 检查是否有内容或文件
  if (!text && imgFiles.length === 0 && videoFiles.length === 0) {
    showModal('请填写内容或添加图片/视频', 'alert', '发布动态');
    return;
  }

  // 确保图片和视频不能同时上传
  if (imgFiles.length > 0 && videoFiles.length > 0) {
    showModal('不能同时上传图片和视频。', 'alert', '发布失败');
    return;
  }

  // 强制只允许上传一个视频 (即使在 previewVideo 中已经检查过，这里也再检查一次作为双重保险)
  if (videoFiles.length > 1) {
      showModal('一次只能上传一个视频文件。', 'alert', '发布失败');
      return;
  }

  const formData = new FormData();
  formData.append('content', text);

  // 从 localStorage 获取用户ID和用户名
  const userId = localStorage.getItem('user_id');
  const username = localStorage.getItem('username');

  if (!userId || !username) {
    showModal('用户未登录，无法发布动态。', 'alert', '发布失败');
    return;
  }

  formData.append('user_id', userId);
  formData.append('username', username);

  let mediaSent = false;
  // 遍历所有图片文件并添加到FormData
  if (imgFiles.length > 0) {
    for (let i = 0; i < imgFiles.length; i++) {
      formData.append('media[]', imgFiles[i]);
    }
    mediaSent = true;
  }

  // 遍历所有视频文件并添加到FormData
  if (videoFiles.length > 0) {
    formData.append('media[]', videoFiles[0]); // 只需要发送第一个视频文件
    mediaSent = true;
  }

  // 如果处于编辑模式，并且用户清除了所有媒体文件（即没有选择任何新文件）
  // 需要告知后端清除媒体
  if (editingPostId && !mediaSent) {
    // 检查媒体预览区是否为空，如果为空说明用户清除了媒体
    const mediaPreview = document.getElementById('media-preview');
    if (mediaPreview.children.length === 0) {
      formData.append('clear_media', 'true'); // 添加一个标志，告知后端清除媒体
    }
  }

  let apiUrl = '';
  let successMessage = '';
  let errorMessage = '';

  if (editingPostId) {
    // 编辑模式
    apiUrl = `${API_BASE_URL}/edit_post.php`;
    formData.append('post_id', editingPostId);
    successMessage = '动态编辑成功！';
    errorMessage = '动态编辑失败，请检查网络或稍后再试。';
  } else {
    // 发布模式
    apiUrl = `${API_BASE_URL}/upload_post.php`;
    successMessage = '动态发布成功！';
    errorMessage = '动态发布失败，请检查网络或稍后再试。';
  }

  // 使用 XMLHttpRequest 处理文件上传和进度
  const xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl, true);

  // 监听上传进度
  xhr.upload.onprogress = function(event) {
    if (event.lengthComputable) {
      const percentComplete = (event.loaded / event.total) * 100;
      uploadProgressDiv.textContent = `上传中... ${Math.round(percentComplete)}%`;
    }
  };

  // 监听请求完成
  xhr.onload = function() {
    isSubmitting = false; // 重置标志位
    submitBtn.disabled = false; // 启用发布按钮
    uploadProgressDiv.style.display = 'none'; // 隐藏进度条

    if (xhr.status === 200) {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.success) {
          showModal(data.message, 'alert', '操作成功').then(() => {
            // 注意：动态通知功能已转移到全局通知检查器(GlobalNotificationChecker)
            // 动态发布页面不再负责发送通知，全局检查器会自动检测新动态
            
            goHome(); // 在弹窗关闭后才跳转
          });
        } else {
          showModal(data.message || '操作失败', 'alert', '操作失败');
        }
      } catch (e) {
        console.error('解析服务器响应失败:', e);
        showModal('服务器响应格式错误。', 'alert', '操作失败');
      }
    } else {
      console.error('请求失败，状态码:', xhr.status);
      showModal(errorMessage, 'alert', '操作失败');
    }
  };

  // 监听请求错误
  xhr.onerror = function() {
    isSubmitting = false; // 重置标志位
    submitBtn.disabled = false; // 启用发布按钮
    uploadProgressDiv.style.display = 'none'; // 隐藏进度条
    console.error('网络错误或请求失败。');
    showModal(errorMessage, 'alert', '操作失败');
  };

  // 监听请求中止
  xhr.onabort = function() {
    isSubmitting = false; // 重置标志位
    submitBtn.disabled = false; // 启用发布按钮
    uploadProgressDiv.style.display = 'none'; // 隐藏进度条
    console.warn('上传已取消。');
    showModal('上传已取消。', 'alert', '操作提示');
  };

  xhr.send(formData); // 发送FormData
}

window.onload = async () => {
  // 临时调试：确认js/pages/post.js是否执行
  // const headerElement = document.querySelector('header');
  // if (headerElement) {
  //   headerElement.style.backgroundColor = '#FF0000'; // 临时设置为红色
  //   console.log('js/pages/post.js: window.onload executed, header set to red.');
  // }

  editingPostId = getQueryPostId();
  if (editingPostId !== 0) {
    // 进入编辑模式
    document.title = '编辑动态';
    document.querySelector('header span').textContent = '编辑动态';
    await loadPostForEdit(editingPostId);
  } else {
    // 如果不是编辑模式，确保媒体输入是可用的（默认状态）
    resetMediaInputs('');
  }

  // 设置用户头像：从服务器获取
  await fetchUserAvatar();

  // 为文件输入框添加change事件监听器
  document.getElementById('img-upload').addEventListener('change', previewImages);
  document.getElementById('video-upload').addEventListener('change', previewVideo);
}; 