// 手记功能主逻辑
let allDiaries = [];
let filteredDiaries = [];
let currentUserId = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    currentUserId = localStorage.getItem('user_id');
    if (!currentUserId) {
        window.location.href = 'index.html';
        return;
    }
    
    loadDiaries();
    updateStats();
});

// 加载手记数据
function loadDiaries() {
    const diaryList = document.getElementById('diary-list');
    const emptyState = document.getElementById('diary-empty');
    
    // 显示加载状态
    diaryList.innerHTML = '<div class="diary-loading">加载中...</div>';
    
    // 调用真实API
    fetch(APP_CONFIG.API_BASE + '/diaries.php?user_id=' + currentUserId)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            if (data.success) {
                allDiaries = data.diaries || [];
                try {
                    renderDiaries();
                    updateStats();
                } catch(renderError) {
                    console.error('渲染手记失败:', renderError);
                    diaryList.innerHTML = '<div class="diary-loading">渲染失败，请刷新重试</div>';
                }
            } else {
                diaryList.innerHTML = '<div class="diary-loading">加载失败: ' + (data.message || '未知错误') + '</div>';
            }
        })
        .catch(error => {
            console.error('加载手记失败:', error);
            diaryList.innerHTML = '<div class="diary-loading">网络错误，请检查网络连接</div>';
        });
}

// 渲染手记列表
function renderDiaries(diaries = allDiaries) {
    const diaryList = document.getElementById('diary-list');
    const emptyState = document.getElementById('diary-empty');
    
    if (diaries.length === 0) {
        diaryList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    diaryList.style.display = 'block';
    emptyState.style.display = 'none';
    
    // 按时间倒序排列
    const sortedDiaries = diaries.sort((a, b) => b.timestamp - a.timestamp);

    // 按年-月分组
    const groupMap = {};
    sortedDiaries.forEach(diary => {
        const date = new Date(diary.created_at);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const groupKey = `${year}年${month}月`;
        if (!groupMap[groupKey]) groupMap[groupKey] = [];
        groupMap[groupKey].push(diary);
    });
    const groupKeys = Object.keys(groupMap).sort((a, b) => b.localeCompare(a));

    // 渲染分组，支持折叠展开
    const now = new Date();
    const currentGroupKey = `${now.getFullYear()}年${(now.getMonth() + 1).toString().padStart(2, '0')}月`;
    diaryList.innerHTML = groupKeys.map((groupKey, gidx) => `
        <div class="diary-group" data-group="${groupKey}">
            <div class="diary-group-title diary-group-toggle" style="font-size:16px;font-weight:bold;margin:18px 0 8px 0;color:#ff6b9d;cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px;" onclick="toggleDiaryGroup('${groupKey}')">
                <span class="diary-group-arrow" id="arrow-${groupKey}">${groupKey === currentGroupKey ? '▼' : '▶'}</span> ${groupKey}
            </div>
            <div class="diary-group-content" id="group-content-${groupKey}" style="display:${groupKey === currentGroupKey ? '' : 'none'};">
            ${groupMap[groupKey].map((diary, index) => `
                <div class="diary-item" onclick="viewDiary(${diary.id})" style="animation-delay: ${index * 0.1}s">
                    <div class="diary-header-row">
                        <span class="diary-date">${formatDate(diary.created_at)}</span>
                        <span class="diary-mood">${diary.mood}</span>
                    </div>
                    <div class="diary-title">${diary.title}</div>
                    <div class="diary-content">${diary.content.length > 20 ? diary.content.slice(0, 20) + '…' : diary.content}</div>
                    ${diary.images && diary.images.length > 0 ? `
                        <div class="diary-images">
                            ${diary.images.slice(0, 3).map(img => {
                                try {
                                    const imgPath = img.startsWith('http') ? img : `${APP_CONFIG.SERVER_BASE}/${img.replace(/^\//, '')}`;
                                    return `<img src="${imgPath}" class="diary-image" alt="手记图片" onerror="this.onerror=null;this.style.display='none';" loading="lazy">`;
                                } catch(e) {
                                    console.error('图片路径构建失败:', e, img);
                                    return '';
                                }
                            }).filter(html => html).join('')}
                            ${diary.images.length > 3 ? `<div class="diary-image-more">+${diary.images.length - 3}</div>` : ''}
                        </div>
                    ` : ''}
                    <div class="diary-footer">
                        <div class="diary-author">
                            <img src="${diary.author_avatar ? APP_CONFIG.AVATAR_BASE + diary.author_avatar : 'img/default-avatar.png'}" class="diary-author-avatar" alt="头像">
                            <span>${diary.author_name}</span>
                        </div>
                        ${diary.tags && diary.tags.length > 0 ? `
                            <div class="diary-tags">
                                ${diary.tags.slice(0, 3).map(tag => `
                                    <span class="diary-tag">${tag}</span>
                                `).join('')}
                                ${diary.tags.length > 3 ? `<span class="diary-tag">+${diary.tags.length - 3}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
            </div>
        </div>
    `).join('');
}

// 折叠/展开分组函数
window.toggleDiaryGroup = function(groupKey) {
    const content = document.getElementById('group-content-' + groupKey);
    const arrow = document.getElementById('arrow-' + groupKey);
    if (content.style.display === 'none') {
        content.style.display = '';
        if (arrow) arrow.textContent = '▼';
    } else {
        content.style.display = 'none';
        if (arrow) arrow.textContent = '▶';
    }
}

// 搜索手记
window.searchDiaries = function(searchTerm) {
    if (!searchTerm) {
        filteredDiaries = allDiaries;
        renderDiaries(filteredDiaries);
        updateStats(filteredDiaries);
    } else {
        // 使用后端搜索API
        fetch(`${APP_CONFIG.API_BASE}/diaries.php?user_id=${currentUserId}&search=${encodeURIComponent(searchTerm)}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    filteredDiaries = data.diaries;
                    renderDiaries(filteredDiaries);
                    updateStats(filteredDiaries);
                } else {
                    console.error('搜索失败:', data.message);
                    // 降级到前端搜索
                    filteredDiaries = allDiaries.filter(diary => 
                        diary.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        diary.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        diary.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
                    );
                    renderDiaries(filteredDiaries);
                    updateStats(filteredDiaries);
                }
            })
            .catch(error => {
                console.error('搜索请求失败:', error);
                // 降级到前端搜索
                filteredDiaries = allDiaries.filter(diary => 
                    diary.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    diary.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    diary.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
                );
                renderDiaries(filteredDiaries);
                updateStats(filteredDiaries);
            });
    }
};

// 更新统计信息
function updateStats(diaries = allDiaries) {
    // 使用前端计算（兼容性更好）
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 计算本周开始时间（周一 00:00:00）
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 如果是周日，距离周一是6天
    const thisWeekStart = new Date(today.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
    
    const totalCount = diaries.length;
    const monthCount = diaries.filter(d => new Date(d.created_at) >= thisMonth).length;
    const weekCount = diaries.filter(d => new Date(d.created_at) >= thisWeekStart).length;
    
    document.getElementById('total-diaries').textContent = totalCount;
    document.getElementById('this-month').textContent = monthCount;
    document.getElementById('this-week').textContent = weekCount;
    
    // 也可以调用后端统计API获取更详细的统计
    // fetch('http://38.207.133.8/api/diary_stats.php?user_id=' + currentUserId)
    //     .then(res => res.json())
    //     .then(data => {
    //         if (data.success) {
    //             document.getElementById('total-diaries').textContent = data.stats.total;
    //             document.getElementById('this-month').textContent = data.stats.this_month;
    //             document.getElementById('this-week').textContent = data.stats.this_week;
    //         }
    //     })
    //     .catch(error => {
    //         console.error('获取统计信息失败:', error);
    //     });
}

// 查看手记详情
function viewDiary(diaryId) {
    window.location.href = `diary-detail.html?id=${diaryId}`;
}

// 格式化日期
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    // 获取年月日
    const dateY = date.getFullYear(), dateM = date.getMonth(), dateD = date.getDate();
    const nowY = now.getFullYear(), nowM = now.getMonth(), nowD = now.getDate();

    // 今天
    if (dateY === nowY && dateM === nowM && dateD === nowD) {
        return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    // 昨天
    const yesterday = new Date(nowY, nowM, nowD - 1);
    if (dateY === yesterday.getFullYear() && dateM === yesterday.getMonth() && dateD === yesterday.getDate()) {
        return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    // 其他
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }) +
        ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 模拟数据（临时使用）
function getMockDiaries() {
    return [
        {
            id: 1,
            title: "今天的约会真开心",
            content: "今天和宝宝一起去看了电影，然后吃了火锅，感觉特别幸福。电影很好看，火锅也很美味，最重要的是有你在身边。",
            mood: "🥰",
            authorName: "小明",
            authorAvatar: "img/default-avatar.png",
            timestamp: Date.now() - 2 * 60 * 60 * 1000,
            tags: ["约会", "电影", "美食"],
            images: []
        },
        {
            id: 2,
            title: "收到你的礼物",
            content: "今天收到了宝宝送的礼物，是一个很可爱的小熊玩偶。虽然不是什么贵重的东西，但是看到你用心挑选的样子，我就觉得特别感动。",
            mood: "😢",
            authorName: "小红",
            authorAvatar: "img/default-avatar.png",
            timestamp: Date.now() - 24 * 60 * 60 * 1000,
            tags: ["礼物", "感动"],
            images: []
        },
        {
            id: 3,
            title: "一起做饭的时光",
            content: "今天我们一起做了晚饭，虽然不是很成功，但是过程很有趣。你切菜的样子很认真，我炒菜的时候你一直在旁边指导，感觉特别温馨。",
            mood: "😊",
            authorName: "小明",
            authorAvatar: "img/default-avatar.png",
            timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
            tags: ["做饭", "温馨"],
            images: []
        },
        {
            id: 4,
            title: "周末旅行计划",
            content: "我们计划下周末去附近的城市旅行，已经订好了酒店和车票。虽然只是短途旅行，但是很期待和你一起探索新的地方。",
            mood: "🤔",
            authorName: "小红",
            authorAvatar: "img/default-avatar.png",
            timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
            tags: ["旅行", "计划"],
            images: []
        },
        {
            id: 5,
            title: "庆祝我们的纪念日",
            content: "今天是我们的恋爱纪念日，虽然已经在一起很久了，但是每次想到这个特殊的日子，还是会觉得很激动。感谢你一直陪在我身边。",
            mood: "🎉",
            authorName: "小明",
            authorAvatar: "img/default-avatar.png",
            timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
            tags: ["纪念日", "庆祝"],
            images: []
        }
    ];
}

// 保存手记数据（供新建页面调用）
window.saveDiaryData = function(diaryData) {
    // 调用真实API保存数据
            fetch(APP_CONFIG.API_BASE + '/diaries.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user_id: currentUserId,
            ...diaryData
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            plus.nativeUI.toast('保存成功！');
            // 清除草稿
            if (window.clearDraft) {
                window.clearDraft();
            }
            setTimeout(() => {
                window.location.href = 'diary.html';
            }, 1000);
        } else {
            plus.nativeUI.toast('保存失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('保存失败:', error);
        plus.nativeUI.toast('网络错误，请检查网络连接');
    });
}; 