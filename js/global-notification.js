// 全局通知管理器
    console.log('全局通知 - 初始化检查器');
    
// 位置权限相关功能
const LocationPermissionManager = {
    // 检查是否需要申请位置权限
    checkLocationPermissionOnStart: function() {
        // 如果不在5+App环境中，跳过
        if (typeof plus === 'undefined') {
      return;
    }
    
        // 检查是否已经申请过位置权限
        const hasAskedBefore = localStorage.getItem('location_permission_asked_on_start');
        if (hasAskedBefore) {
            return; // 已经申请过，不再重复申请
        }
        
        // 延迟申请，让用户先看到主页
        setTimeout(() => {
            this.requestLocationPermissionOnStart();
        }, 2000);
  },
  
    // 应用启动时申请位置权限
    requestLocationPermissionOnStart: function() {
        if (typeof plus === 'undefined' || !plus.geolocation || !plus.nativeUI) {
      return;
    }
    
        const message = '为了给您提供更好的位置共享体验，YandH 需要获取位置权限。\n\n功能用途：\n• 实时位置共享\n• 距离计算\n• 轨迹记录\n\n您的位置信息将被严格保护，仅在应用内使用。';
        
        plus.nativeUI.confirm(message, (e) => {
            if (e.index === 0) {
                // 用户同意，尝试获取位置
                this.tryGetLocationPermission();
            } else {
                // 用户拒绝，记录状态
                console.log('用户拒绝了位置权限申请');
          }
          
            // 标记已经询问过
            localStorage.setItem('location_permission_asked_on_start', 'true');
        }, '位置权限申请', ['授权', '稍后再说']);
  },
  
    // 尝试获取位置权限
    tryGetLocationPermission: function() {
        if (typeof plus === 'undefined' || !plus.geolocation) {
            return;
        }
        
        plus.geolocation.getCurrentPosition(
            (position) => {
                console.log('位置权限申请成功');
                plus.nativeUI.toast('位置权限已授权');
                
                // 可以在这里保存第一次获取的位置
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                console.log('首次位置获取:', lat, lng);
            },
            (error) => {
                console.log('位置权限申请失败:', error);
                if (error.code === 1) {
                    // 权限被拒绝
                    plus.nativeUI.confirm(
                        '位置权限被拒绝，您可以前往系统设置手动开启。\n\n路径：设置 → 应用管理 → YandH → 权限 → 位置',
                        (e) => {
                            if (e.index === 0) {
                                // 可以尝试打开设置页面
                                this.openAppSettings();
                            }
                        },
                        '权限提示',
                        ['去设置', '取消']
                    );
                }
            },
            {
                timeout: 10000,
                enableHighAccuracy: false
            }
        );
    },
    
    // 打开应用设置页面
    openAppSettings: function() {
        try {
            if (typeof plus !== 'undefined' && plus.android) {
                const packageName = plus.runtime.appid;
                
                const Intent = plus.android.importClass('android.content.Intent');
                const Settings = plus.android.importClass('android.provider.Settings');
                const Uri = plus.android.importClass('android.net.Uri');
                
                const intent = new Intent();
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse('package:' + packageName));
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                
                const activity = plus.android.runtimeMainActivity();
                activity.startActivity(intent);
      }
        } catch (e) {
            console.error('打开设置页面失败:', e);
            plus.nativeUI.toast('请手动前往设置开启位置权限');
    }
    }
};

// 应用生命周期管理
const AppLifecycleManager = {
    // 应用启动初始化
    onAppStart: function() {
        console.log('全局通知 - 应用启动');
        
        // 申请位置权限（延迟执行）
        LocationPermissionManager.checkLocationPermissionOnStart();
        
        // 初始化其他全局功能
        this.initGlobalFeatures();
  },
  
    // 应用回到前台
    onAppResume: function() {
        console.log('全局通知 - 应用回到前台');
        

    },
    
    // 应用进入后台
    onAppPause: function() {
        console.log('全局通知 - 应用进入后台');
        // 位置共享功能继续在后台运行
  },
  
    // 初始化全局功能
    initGlobalFeatures: function() {
        // 可以在这里初始化其他全局功能
        console.log('全局功能初始化完成');
    }
};

// 全局事件监听
if (typeof plus !== 'undefined') {
    document.addEventListener('plusready', function() {
        console.log('全局通知 - Plus环境就绪');
    
        // 应用启动处理
        AppLifecycleManager.onAppStart();
        
        // 监听应用生命周期
        document.addEventListener('resume', AppLifecycleManager.onAppResume);
        document.addEventListener('pause', AppLifecycleManager.onAppPause);
    });
} else {
    // Web环境
    document.addEventListener('DOMContentLoaded', function() {
        console.log('全局通知 - Web环境就绪');
        AppLifecycleManager.onAppStart();
    });
}

// 全局通知检查器（原有功能保留）
let lastNotificationCheck = 0;
const NOTIFICATION_CHECK_INTERVAL = 30000; // 30秒检查一次

function checkGlobalNotifications() {
    const now = Date.now();
    if (now - lastNotificationCheck < NOTIFICATION_CHECK_INTERVAL) {
        return;
    }
    
    lastNotificationCheck = now;
    
    const currentUserId = localStorage.getItem('user_id');
    if (!currentUserId) {
        return;
    }

    // 检查未读消息
    fetch(`${APP_CONFIG.API_BASE}/get_unread_messages.php?user_id=${currentUserId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.unread_count > 0) {
                updateChatBadge(data.unread_count);
                console.log(` 检测到 ${data.unread_count} 条未读消息`);
            } else if (data.success) {
                console.log(' 未读消息检查：无未读消息');
            }
        })
        .catch(error => {
            console.warn('检查未读消息失败:', error.message || error);
        });

    // 检查未读通知
    fetch(`${APP_CONFIG.API_BASE}/get_notifications.php?user_id=${currentUserId}&unread_only=1`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.notifications && data.notifications.length > 0) {
                const unreadCount = data.notifications.length;
                updateNotificationBadge(unreadCount);
                console.log(` 检测到 ${unreadCount} 条未读通知`);
            } else if (data.success) {
                console.log('未读通知检查：无未读通知');
            }
        })
        .catch(error => {
            console.warn('检查未读通知失败:', error.message || error);
        });
}

function updateChatBadge(count) {
    const badges = document.querySelectorAll('.chat-badge, .unread-badge');
    badges.forEach(badge => {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    });
}

function updateNotificationBadge(count) {
    const badges = document.querySelectorAll('.notification-badge');
    badges.forEach(badge => {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    });
}

// 页面加载时检查通知
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(checkGlobalNotifications, 1000);
    setInterval(checkGlobalNotifications, NOTIFICATION_CHECK_INTERVAL);
});

// 页面可见性变化时检查通知
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        setTimeout(checkGlobalNotifications, 500);
    }
});

// 导出全局管理器供其他模块使用
window.LocationPermissionManager = LocationPermissionManager;
window.AppLifecycleManager = AppLifecycleManager; 