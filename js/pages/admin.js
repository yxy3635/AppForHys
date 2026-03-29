// 管理员页面JavaScript逻辑

// 页面加载时检查管理员权限
document.addEventListener('DOMContentLoaded', function() {
    checkAdminPermission();
    loadAdminData();
});

// 检查管理员权限
function checkAdminPermission() {
    const username = localStorage.getItem('username');
    const userId = localStorage.getItem('user_id');
    
    if (!username || !userId) {
        showModal('请先登录', 'alert', '权限不足');
        window.location.href = 'index.html';
        return;
    }
    
    // 检查是否为admin用户
    if (username !== 'admin') {
        showModal('只有管理员可以访问此页面', 'alert', '权限不足');
        window.location.href = 'home.html';
        return;
    }
    
    // 显示管理员用户名
    document.getElementById('admin-username').textContent = `管理员: ${username}`;
}

// 加载管理员数据
function loadAdminData() {
    loadSystemStats();
    loadUsersList();
    loadSystemLogs();
}

// 加载系统统计
async function loadSystemStats() {
    try {
        const response = await fetch(`${APP_CONFIG.API_BASE}/admin/stats.php`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('user_id')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                updateStatsDisplay(data.stats);
            } else {
                console.error('获取统计数据失败:', data.message);
                showDefaultStats();
            }
        } else {
            console.error('获取统计数据失败:', response.status);
            showDefaultStats();
        }
    } catch (error) {
        console.error('获取统计数据出错:', error);
        showDefaultStats();
    }
}

// 更新统计显示
function updateStatsDisplay(stats) {
    document.getElementById('total-users').textContent = stats.totalUsers || 0;
    document.getElementById('online-users').textContent = stats.onlineUsers || 0;
    document.getElementById('total-posts').textContent = stats.totalPosts || 0;
    document.getElementById('today-posts').textContent = stats.todayPosts || 0;
}

// 显示默认统计
function showDefaultStats() {
    document.getElementById('total-users').textContent = '0';
    document.getElementById('online-users').textContent = '0';
    document.getElementById('total-posts').textContent = '0';
    document.getElementById('today-posts').textContent = '0';
}

// 加载用户列表
async function loadUsersList() {
    try {
        const response = await fetch(`${APP_CONFIG.API_BASE}/admin/users.php`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('user_id')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                displayUsersList(data.users);
            } else {
                console.error('获取用户列表失败:', data.message);
                showModal('获取用户列表失败', 'alert', '错误');
            }
        } else {
            console.error('获取用户列表失败:', response.status);
            showModal('获取用户列表失败', 'alert', '错误');
        }
    } catch (error) {
        console.error('获取用户列表出错:', error);
        showModal('获取用户列表失败', 'alert', '错误');
    }
}

// 显示用户列表
function displayUsersList(users) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">暂无用户数据</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td><span class="password-field" onclick="showPasswordInfo(${user.id}, '${user.username}')" title="点击查看密码信息">${'*'.repeat(20)}</span></td>
            <td>${formatDate(user.created_at)}</td>
            <td>${formatDate(user.last_login)}</td>
            <td><span class="user-status ${user.is_online ? 'status-online' : 'status-offline'}">${user.is_online ? '在线' : '离线'}</span></td>
            <td class="user-actions">
                <button class="action-btn view-btn" onclick="viewUserDetail(${user.id})">查看</button>
                <button class="action-btn edit-btn" onclick="editUser(${user.id})">编辑</button>
                <button class="action-btn delete-btn" onclick="deleteUser(${user.id}, '${user.username}')">删除</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 搜索用户
function searchUsers() {
    const searchTerm = document.getElementById('user-search').value.trim();
    if (!searchTerm) {
        loadUsersList();
        return;
    }
    
    // 这里可以实现搜索逻辑，或者重新加载用户列表并过滤
    loadUsersList();
}

// 查看用户详情
async function viewUserDetail(userId) {
    try {
        const response = await fetch(`${APP_CONFIG.API_BASE}/admin/user_detail.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('user_id')}`
            },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showUserDetailModal(data.user);
            } else {
                showModal('获取用户详情失败', 'alert', '错误');
            }
        } else {
            showModal('获取用户详情失败', 'alert', '错误');
        }
    } catch (error) {
        console.error('获取用户详情出错:', error);
        showModal('获取用户详情失败', 'alert', '错误');
    }
}



// 关闭用户详情模态框
function closeUserModal() {
    document.getElementById('user-detail-modal').style.display = 'none';
}

// 当前查看的用户ID
let currentViewingUserId = null;

// 显示用户详情模态框
function showUserDetailModal(user) {
    currentViewingUserId = user.id;
    const modal = document.getElementById('user-detail-modal');
    const content = document.getElementById('user-detail-content');
    const resetBtn = document.getElementById('reset-password-btn');
    
    // 如果不是管理员账户，显示重置密码按钮
    if (user.username !== 'admin') {
        resetBtn.style.display = 'inline-block';
    } else {
        resetBtn.style.display = 'none';
    }
    
    let recentPostsHtml = '';
    if (user.recent_posts && user.recent_posts.length > 0) {
        recentPostsHtml = '<div class="detail-item"><label>最近动态:</label><div class="recent-posts">';
        user.recent_posts.forEach(post => {
            recentPostsHtml += `<div class="post-item">${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}</div>`;
        });
        recentPostsHtml += '</div></div>';
    }
    
    content.innerHTML = `
        <div class="user-detail">
            <div class="detail-item">
                <label>用户ID:</label>
                <span>${user.id}</span>
            </div>
            <div class="detail-item">
                <label>用户名:</label>
                <span>${user.username}</span>
            </div>
            <div class="detail-item">
                <label>密码:</label>
                <span class="password-field" onclick="showPasswordInfo(${user.id}, '${user.username}')" title="点击查看密码信息">${'*'.repeat(20)}</span>
            </div>
            <div class="detail-item">
                <label>个性签名:</label>
                <span>${user.signature || '无'}</span>
            </div>
            <div class="detail-item">
                <label>注册时间:</label>
                <span>${formatDate(user.created_at)}</span>
            </div>
            <div class="detail-item">
                <label>最后登录:</label>
                <span>${formatDate(user.last_login)}</span>
            </div>
            <div class="detail-item">
                <label>在线状态:</label>
                <span class="user-status ${user.is_online ? 'status-online' : 'status-offline'}">${user.is_online ? '在线' : '离线'}</span>
            </div>
            <div class="detail-item">
                <label>发布动态数:</label>
                <span>${user.posts_count || 0}</span>
            </div>
            <div class="detail-item">
                <label>评论数:</label>
                <span>${user.comments_count || 0}</span>
            </div>
            <div class="detail-item">
                <label>日记数:</label>
                <span>${user.diaries_count || 0}</span>
            </div>
            <div class="detail-item">
                <label>用户角色:</label>
                <span>${user.role || '普通用户'}</span>
            </div>
            ${recentPostsHtml}
        </div>
    `;
    
    modal.style.display = 'block';
}

// 编辑用户
function editUser(userId) {
    showModal('编辑用户功能开发中...', 'alert', '提示');
    // 这里可以实现编辑用户的逻辑
}

// 重置用户密码
function resetUserPassword() {
    if (!currentViewingUserId) {
        showModal('请先选择用户', 'alert', '错误');
        return;
    }
    
    // 显示重置密码模态框
    document.getElementById('reset-password-modal').style.display = 'block';
    document.getElementById('new-password').value = '';
}

// 生成随机密码
function generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('new-password').value = password;
}

// 确认重置密码
async function confirmResetPassword() {
    const newPassword = document.getElementById('new-password').value.trim();
    
    if (!newPassword) {
        showModal('请输入新密码', 'alert', '错误');
        return;
    }
    
    try {
        const response = await fetch(`${APP_CONFIG.API_BASE}/admin/reset_password.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('user_id')}`
            },
            body: JSON.stringify({
                user_id: currentViewingUserId,
                new_password: newPassword
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showModal(`密码重置成功！新密码: ${data.new_password}`, 'alert', '成功');
            closeResetPasswordModal();
            // 重新加载用户详情
            viewUserDetail(currentViewingUserId);
        } else {
            showModal(data.message || '密码重置失败', 'alert', '错误');
        }
    } catch (error) {
        console.error('重置密码出错:', error);
        showModal('重置密码失败', 'alert', '错误');
    }
}

// 关闭重置密码模态框
function closeResetPasswordModal() {
    document.getElementById('reset-password-modal').style.display = 'none';
}

// 删除用户
function deleteUser(userId, username) {
    if (username === 'admin') {
        showModal('不能删除管理员账户', 'alert', '错误');
        return;
    }
    
    plus.nativeUI.confirm(`确定要删除用户 "${username}" 吗？此操作不可恢复。`, function(e) {
        if (e.index === 0) { // 确认删除
            performDeleteUser(userId);
        }
    }, '确认删除', ['确定', '取消']);
}

// 执行删除用户
async function performDeleteUser(userId) {
    try {
        const response = await fetch(`${APP_CONFIG.API_BASE}/admin/delete_user.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('user_id')}`
            },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showModal('用户删除成功', 'alert', '成功');
                loadUsersList(); // 重新加载用户列表
            } else {
                showModal(data.message || '删除用户失败', 'alert', '错误');
            }
        } else {
            showModal('删除用户失败', 'alert', '错误');
        }
    } catch (error) {
        console.error('删除用户出错:', error);
        showModal('删除用户失败', 'alert', '错误');
    }
}

// 加载系统日志
async function loadSystemLogs() {
    try {
        const response = await fetch(`${APP_CONFIG.API_BASE}/admin/logs.php`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('user_id')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                displaySystemLogs(data.logs);
            } else {
                console.error('获取系统日志失败:', data.message);
                showDefaultLogs();
            }
        } else {
            console.error('获取系统日志失败:', response.status);
            showDefaultLogs();
        }
    } catch (error) {
        console.error('获取系统日志出错:', error);
        showDefaultLogs();
    }
}

// 显示系统日志
function displaySystemLogs(logs) {
    const container = document.getElementById('logs-container');
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="log-entry">暂无系统日志</div>';
        return;
    }
    
    container.innerHTML = '';
    logs.forEach(log => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = `
            <span class="log-time">${formatDate(log.timestamp)}</span>
            <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
            <span class="log-message">${log.message}</span>
        `;
        container.appendChild(logEntry);
    });
}

// 显示默认日志
function showDefaultLogs() {
    const container = document.getElementById('logs-container');
    container.innerHTML = '<div class="log-entry">暂无系统日志</div>';
}

// 刷新日志
function refreshLogs() {
    loadSystemLogs();
}

// 显示不同部分
function showSection(sectionName) {
    // 隐藏所有部分
    const sections = document.querySelectorAll('.stats-section, .users-section, .logs-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    // 显示选中的部分
    switch(sectionName) {
        case 'stats':
            document.querySelector('.stats-section').style.display = 'block';
            break;
        case 'users':
            document.querySelector('.users-section').style.display = 'block';
            break;
        case 'logs':
            document.querySelector('.logs-section').style.display = 'block';
            break;
    }
    
    // 更新导航按钮状态
    const navButtons = document.querySelectorAll('.admin-nav button');
    navButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

// 返回主页
function goHome() {
    window.location.href = 'home.html';
}

// 退出登录
function logout() {
    plus.nativeUI.confirm('确定要退出登录吗？', function(e) {
        if (e.index === 0) {
            localStorage.removeItem('user_id');
            localStorage.removeItem('username');
            localStorage.removeItem('login_timestamp');
            window.location.href = 'index.html';
        }
    }, '确认退出', ['确定', '取消']);
}

// 格式化日期
function formatDate(dateString) {
    if (!dateString) return '未知';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '未知';
    
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 显示密码信息
async function showPasswordInfo(userId, username) {
    try {
        const response = await fetch(`${APP_CONFIG.API_BASE}/admin/decrypt_password.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('user_id')}`
            },
            body: JSON.stringify({ user_id: userId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const passwordInfo = data.password_info;
            const modal = document.getElementById('password-info-modal');
            const content = document.getElementById('password-info-content');
            
            const securityStatus = passwordInfo.is_secure ? 
                '<span style="color: #28a745; font-weight: bold;">✓ 安全</span>' : 
                '<span style="color: #dc3545; font-weight: bold;">⚠ 不安全</span>';
            
            content.innerHTML = `
                <div class="password-info">
                    <div class="info-item">
                        <label>用户名:</label>
                        <span>${passwordInfo.username}</span>
                    </div>
                    <div class="info-item">
                        <label>加密类型:</label>
                        <span>${passwordInfo.hash_type}</span>
                    </div>
                    <div class="info-item">
                        <label>加密成本:</label>
                        <span>${passwordInfo.hash_cost || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <label>安全状态:</label>
                        <span>${securityStatus}</span>
                    </div>
                    <div class="info-item">
                        <label>加密后的密码:</label>
                        <div class="hashed-password">${passwordInfo.hashed_password}</div>
                    </div>
                    <div class="info-note">
                        <p><strong>注意:</strong> 密码已经过bcrypt加密，无法直接查看明文密码。这是出于安全考虑。</p>
                        <p>如需重置密码，请使用"重置密码"功能。</p>
                    </div>
                </div>
            `;
            
            modal.style.display = 'block';
        } else {
            showModal(data.message || '获取密码信息失败', 'alert', '错误');
        }
    } catch (error) {
        console.error('获取密码信息出错:', error);
        showModal('获取密码信息失败', 'alert', '错误');
    }
}

// 关闭密码信息模态框
function closePasswordInfoModal() {
    document.getElementById('password-info-modal').style.display = 'none';
}

// 点击模态框外部关闭
window.onclick = function(event) {
    const modal = document.getElementById('user-detail-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
} 