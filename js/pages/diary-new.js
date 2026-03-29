// 新建手记页面逻辑
let currentUserId = null;
let selectedImages = [];
let isEditMode = false;
let editDiaryId = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    currentUserId = localStorage.getItem('user_id');
    if (!currentUserId) {
        window.location.href = 'index.html';
        return;
    }
    
    // 检查是否为编辑模式
    const urlParams = new URLSearchParams(window.location.search);
    const edit = urlParams.get('edit');
    const diaryId = urlParams.get('id');
    
    if (edit === '1' && diaryId) {
        isEditMode = true;
        editDiaryId = diaryId;
        loadDiaryForEdit(diaryId);
        // 修改页面标题
        document.title = '编辑手记';
        const headerTitle = document.querySelector('.header-main');
        if (headerTitle) {
            headerTitle.textContent = '编辑手记';
        }
    } else {
        document.querySelector('.mood-option').classList.add('selected');
        // 初始化图片预览区域
        updateImagePreview();
    }
    
    updateCharCount();
});

function updateCharCount() {
    const textarea = document.getElementById('diary-content');
    const count = textarea.value.length;
    document.getElementById('char-count').textContent = count;
    const charCountElement = document.getElementById('char-count');
    if (count > 1800) {
        charCountElement.style.color = '#ff6b6b';
    } else if (count > 1500) {
        charCountElement.style.color = '#ffa726';
    } else {
        charCountElement.style.color = 'var(--text-color-medium)';
    }
}

document.getElementById('diary-content').addEventListener('input', updateCharCount);

function selectMood(element) {
    document.querySelectorAll('.mood-option').forEach(option => {
        option.classList.remove('selected');
    });
    element.classList.add('selected');
}

function chooseImage() {
    const imageInput = document.getElementById('image-input');
    if (imageInput) {
        // 确保input元素存在且可见（虽然display:none，但应该可以点击）
        try {
            imageInput.click();
        } catch (error) {
            console.error('点击文件选择器失败:', error);
            // 如果click()失败，尝试使用plus.gallery（如果是App环境）
            if (typeof plus !== 'undefined' && plus.gallery) {
                plus.gallery.pick(function(paths) {
                    if (paths && paths.length > 0) {
                        handleSelectedImages(paths);
                    }
                }, function(error) {
                    console.error('选择图片失败:', error);
                    showModal('选择图片失败，请重试', 'alert', '提示');
                }, {
                    maximum: 6 - selectedImages.length,
                    filter: 'image'
                });
            } else {
                showModal('无法打开图片选择器，请检查浏览器权限', 'alert', '提示');
            }
        }
    } else {
        console.error('找不到图片输入元素');
        showModal('图片上传功能异常，请刷新页面重试', 'alert', '提示');
    }
}

function updateImagePreview() {
    const preview = document.getElementById('image-preview');
    const placeholder = preview.querySelector('.upload-placeholder');
    
    // 如果图片数量少于6张且没有上传占位符，则添加占位符
    if (selectedImages.length < 6 && !placeholder) {
        const uploadPlaceholder = document.createElement('div');
        uploadPlaceholder.className = 'upload-placeholder';
        uploadPlaceholder.onclick = chooseImage;
        uploadPlaceholder.innerHTML = `
            <span class="upload-icon">📷</span>
            <span class="upload-text">点击添加图片</span>
        `;
        preview.appendChild(uploadPlaceholder);
    }
    
    // 如果图片数量已达到6张，则移除占位符
    if (selectedImages.length >= 6 && placeholder) {
        placeholder.remove();
    }
}

function handleSelectedImages(paths) {
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';
    selectedImages = [];
    paths.forEach((path, index) => {
        if (index < 6) {
            const img = document.createElement('img');
            img.src = path;
            img.className = 'preview-image';
            img.onclick = function() {
                this.remove();
                selectedImages = selectedImages.filter(img => img !== path);
                updateImagePreview();
            };
            preview.appendChild(img);
            selectedImages.push(path);
        }
    });
    updateImagePreview();
}

// 压缩图片函数
function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 计算压缩后的尺寸
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为base64，使用JPEG格式以减小文件大小
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function handleImageUpload(event) {
    const files = event.target.files;
    const preview = document.getElementById('image-preview');
    
    // 如果没有选择文件，重置input并返回
    if (!files || files.length === 0) {
        // 重置input，以便下次选择相同文件时也能触发change事件
        event.target.value = '';
        return;
    }
    
    // 在编辑模式下不清空已有图片，只添加新图片
    if (!isEditMode) {
        preview.innerHTML = '';
        selectedImages = [];
    } else {
        // 移除上传占位符，但保留已有图片
        const placeholder = preview.querySelector('.upload-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
    }
    
    const remainingSlots = 6 - selectedImages.length;
    const filesToProcess = Math.min(files.length, remainingSlots);
    
    if (filesToProcess === 0) {
        showModal('最多只能添加6张图片', 'alert', '提示');
        // 重置input
        event.target.value = '';
        // 如果图片数量少于6张，重新添加占位符
        updateImagePreview();
        return;
    }
    
    // 显示加载提示
    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = '正在处理图片...';
    loadingMsg.style.cssText = 'text-align:center;padding:10px;color:#666;';
    preview.appendChild(loadingMsg);
    
    let processedCount = 0;
    const totalFiles = filesToProcess;
    
    for (let i = 0; i < filesToProcess; i++) {
        const file = files[i];
        
        // 如果文件小于500KB，直接使用原图；否则压缩
        if (file.size < 500 * 1024) {
            const reader = new FileReader();
            reader.onload = function(e) {
                addImageToPreview(e.target.result);
                processedCount++;
                if (processedCount === totalFiles) {
                    loadingMsg.remove();
                    updateImagePreview();
                }
            };
            reader.onerror = function() {
                console.error('读取文件失败');
                processedCount++;
                if (processedCount === totalFiles) {
                    loadingMsg.remove();
                    updateImagePreview();
                }
            };
            reader.readAsDataURL(file);
        } else {
            // 压缩大图片
            compressImage(file).then(compressedDataUrl => {
                addImageToPreview(compressedDataUrl);
                processedCount++;
                if (processedCount === totalFiles) {
                    loadingMsg.remove();
                    updateImagePreview();
                }
            }).catch(error => {
                console.error('压缩图片失败:', error);
                // 压缩失败时使用原图
                const reader = new FileReader();
                reader.onload = function(e) {
                    addImageToPreview(e.target.result);
                    processedCount++;
                    if (processedCount === totalFiles) {
                        loadingMsg.remove();
                        updateImagePreview();
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    }
    
    if (filesToProcess < files.length) {
        showModal(`最多只能添加6张图片，已添加${filesToProcess}张`, 'alert', '提示');
    }
    
    // 重置input，以便下次选择相同文件时也能触发change事件
    event.target.value = '';
}

function addImageToPreview(dataUrl) {
    const preview = document.getElementById('image-preview');
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'preview-image';
    img.onclick = function() {
        this.remove();
        selectedImages = selectedImages.filter(img => img !== dataUrl);
        updateImagePreview();
    };
    preview.appendChild(img);
    selectedImages.push(dataUrl);
}

function handleTagInput(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addTag();
    }
}

function addTag() {
    const input = document.getElementById('tag-input');
    const tagText = input.value.trim();
    if (tagText && tagText.length <= 10) {
        const tagList = document.getElementById('tag-list');
        const existingTags = Array.from(tagList.children).map(tag => 
            tag.textContent.replace('×', '').trim()
        );
        if (!existingTags.includes(tagText)) {
            const tag = document.createElement('span');
            tag.className = 'diary-tag';
            tag.innerHTML = tagText + '<span class="tag-remove" onclick="removeTag(this)">×</span>';
            tagList.appendChild(tag);
            input.value = '';
        } else {
            showModal('标签已存在', 'alert', '提示');
        }
    } else if (tagText.length > 10) {
        showModal('标签不能超过10个字符', 'alert', '提示');
    }
}

function addSuggestionTag(tagText) {
    const tagList = document.getElementById('tag-list');
    const existingTags = Array.from(tagList.children).map(tag => 
        tag.textContent.replace('×', '').trim()
    );
    if (!existingTags.includes(tagText)) {
        const tag = document.createElement('span');
        tag.className = 'diary-tag';
        tag.innerHTML = tagText + '<span class="tag-remove" onclick="removeTag(this)">×</span>';
        tagList.appendChild(tag);
    } else {
        showModal('标签已存在', 'alert', '提示');
    }
}

function removeTag(element) {
    element.parentElement.remove();
}

function saveDiary() {
    const title = document.getElementById('diary-title').value.trim();
    const content = document.getElementById('diary-content').value.trim();
    const selectedMood = document.querySelector('.mood-option.selected');
    const mood = selectedMood ? selectedMood.dataset.mood : '😊';
    if (!title) {
        showModal('请输入标题', 'alert', '提示');
        document.getElementById('diary-title').focus();
        return;
    }
    if (!content) {
        showModal('请输入内容', 'alert', '提示');
        document.getElementById('diary-content').focus();
        return;
    }
    if (content.length > 2000) {
        showModal('内容不能超过2000个字符', 'alert', '提示');
        return;
    }
    const tags = Array.from(document.getElementById('tag-list').children).map(tag => 
        tag.textContent.replace('×', '').trim()
    );
    const username = localStorage.getItem('username') || '用户';
    const userAvatar = localStorage.getItem('user_avatar') || 'img/default-avatar.png';
    const diaryData = {
        title: title,
        content: content,
        mood: mood,
        tags: tags,
        images: selectedImages,
        authorName: username,
        authorAvatar: userAvatar,
        timestamp: Date.now()
    };
    const saveBtn = document.getElementById('save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '保存中...';
    saveBtn.disabled = true;
    
    if (window.saveDiaryData) {
        window.saveDiaryData(diaryData);
    } else {
        const method = isEditMode ? 'PUT' : 'POST';
        const url = APP_CONFIG.API_BASE + '/diaries.php';
        
        if (isEditMode) {
            diaryData.id = editDiaryId;
        }
        
        const requestBody = JSON.stringify({
            user_id: currentUserId,
            ...diaryData
        });
        
        // 检查请求体大小（base64图片可能很大）
        const requestSize = new Blob([requestBody]).size;
        console.log('请求体大小:', (requestSize / 1024 / 1024).toFixed(2), 'MB');
        
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: requestBody
        })
        .then(async res => {
            // 检查响应状态
            if (!res.ok) {
                const errorText = await res.text().catch(() => '');
                console.error('HTTP错误响应:', errorText.substring(0, 500));
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            // 检查内容类型
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // 如果不是JSON，读取文本内容用于调试
                const text = await res.text();
                console.error('服务器返回非JSON响应:', text.substring(0, 500));
                throw new Error('服务器返回格式错误，请检查服务器日志');
            }
            return res.json();
        })
        .then(data => {
            if (data.success) {
                const successMsg = isEditMode ? '更新成功！' : '保存成功！';
                showModal(successMsg, 'alert', '提示').then(() => {
                    clearDraft();
                    window.location.href = 'diary.html';
                });
            } else {
                const errorMsg = isEditMode ? '更新失败: ' : '保存失败: ';
                showModal(errorMsg + (data.message || '未知错误'), 'alert', '提示');
            }
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        })
        .catch(error => {
            console.error('保存失败:', error);
            const errorMsg = error.message || '网络错误，请检查网络连接';
            showModal(errorMsg, 'alert', '提示');
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        });
    }
}

let autoSaveTimer = null;
function startAutoSave() {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = setTimeout(() => {
        const title = document.getElementById('diary-title').value.trim();
        const content = document.getElementById('diary-content').value.trim();
        if (title || content) {
            const draft = {
                title: title,
                content: content,
                timestamp: Date.now()
            };
            localStorage.setItem('diary_draft', JSON.stringify(draft));
            console.log('草稿已自动保存');
        }
    }, 30000);
}

function loadDraft() {
    const draft = localStorage.getItem('diary_draft');
    if (draft) {
        try {
            const draftData = JSON.parse(draft);
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            if (now - draftData.timestamp < oneDay) {
                document.getElementById('diary-title').value = draftData.title || '';
                document.getElementById('diary-content').value = draftData.content || '';
                updateCharCount();
            }
        } catch (e) {
            console.error('加载草稿失败:', e);
            localStorage.removeItem('diary_draft');
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadDraft();
    document.getElementById('diary-title').addEventListener('input', startAutoSave);
    document.getElementById('diary-content').addEventListener('input', startAutoSave);
});

function clearDraft() {
    localStorage.removeItem('diary_draft');
}

// 加载手记内容用于编辑
function loadDiaryForEdit(diaryId) {
            fetch(`${APP_CONFIG.API_BASE}/diaries.php?user_id=${currentUserId}&diary_id=${diaryId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.diaries && data.diaries.length > 0) {
                const diary = data.diaries[0];
                
                // 填充表单
                document.getElementById('diary-title').value = diary.title || '';
                document.getElementById('diary-content').value = diary.content || '';
                
                // 设置心情
                document.querySelectorAll('.mood-option').forEach(option => {
                    option.classList.remove('selected');
                    if (option.dataset.mood === diary.mood) {
                        option.classList.add('selected');
                    }
                });
                
                // 设置标签
                const tagList = document.getElementById('tag-list');
                tagList.innerHTML = '';
                if (diary.tags && diary.tags.length > 0) {
                    diary.tags.forEach(tag => {
                        const tagElement = document.createElement('span');
                        tagElement.className = 'diary-tag';
                        tagElement.innerHTML = tag + '<span class="tag-remove" onclick="removeTag(this)">×</span>';
                        tagList.appendChild(tagElement);
                    });
                }
                
                // 设置图片
                selectedImages = diary.images || [];
                const preview = document.getElementById('image-preview');
                preview.innerHTML = '';
                selectedImages.forEach(imgPath => {
                    const img = document.createElement('img');
                    img.src = imgPath.startsWith('http') ? imgPath : `${APP_CONFIG.SERVER_BASE}/${imgPath}`;
                    img.className = 'preview-image';
                    img.onclick = function() {
                        this.remove();
                        selectedImages = selectedImages.filter(img => img !== imgPath);
                        updateImagePreview();
                    };
                    preview.appendChild(img);
                });
                
                // 更新图片预览区域，添加上传占位符
                updateImagePreview();
                
                updateCharCount();
            } else {
                showModal('加载手记失败', 'alert', '错误').then(() => {
                    window.location.href = 'diary.html';
                });
            }
        })
        .catch(() => {
            showModal('网络错误，加载失败', 'alert', '错误').then(() => {
                window.location.href = 'diary.html';
            });
        });
} 