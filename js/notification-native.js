/**
 * 基于Native.js的通知管理器
 * 绕过plus.notification API，直接使用Android原生通知
 */

const NativeNotificationManager = {
  isReady: false,
  hasError: false,
  notificationId: 1000, // 通知ID起始值
  
  // 初始化
  init: function() {
    if (typeof window.plus === 'undefined') {
      this.hasError = true;
      return;
    }
    
    if (!plus.android) {
      this.hasError = true;
      return;
    }
    
    try {
      this.setupNativeNotification();
      this.isReady = true;
    } catch (e) {
      console.error('NativeNotificationManager 初始化失败:', e);
      this.hasError = true;
    }
  },
  
  // 设置原生通知
  setupNativeNotification: function() {
    // 导入必要的Android类
    this.Context = plus.android.importClass("android.content.Context");
    this.NotificationManager = plus.android.importClass("android.app.NotificationManager");
    this.NotificationCompat = plus.android.importClass("androidx.core.app.NotificationCompat");
    this.PendingIntent = plus.android.importClass("android.app.PendingIntent");
    this.Intent = plus.android.importClass("android.content.Intent");
    this.NotificationChannel = plus.android.importClass("android.app.NotificationChannel");
    this.Build = plus.android.importClass("android.os.Build");
    
    // 获取主Activity和NotificationManager
    this.mainActivity = plus.android.runtimeMainActivity();
    this.notificationManager = this.mainActivity.getSystemService(this.Context.NOTIFICATION_SERVICE);
    
    // 创建通知渠道（Android 8.0+需要）
    this.createNotificationChannel();
  },
  
  // 创建通知渠道
  createNotificationChannel: function() {
    try {
      // Android 8.0 (API 26) 及以上需要通知渠道
      if (this.Build.VERSION.SDK_INT >= 26) {
        const channelId = "YandH_default_channel";
        const channelName = "YandH 默认通知";
        const importance = 3; // NotificationManager.IMPORTANCE_DEFAULT
        
        const channel = new this.NotificationChannel(channelId, channelName, importance);
        channel.setDescription("YandH应用的默认通知渠道");
        channel.enableVibration(false); // 禁用震动
        channel.enableLights(true);
        channel.setLightColor(-16711936); // Color.GREEN
        
        this.notificationManager.createNotificationChannel(channel);
        this.channelId = channelId;
      } else {
        this.channelId = null;
      }
    } catch (e) {
      console.error('创建通知渠道失败:', e);
      // 不抛出错误，继续使用默认设置
      this.channelId = null;
    }
  },
  
  // 发送原生通知
  sendNativeNotification: function(options = {}) {
    if (!this.isReady) {
      return false;
    }
    
    try {
      const title = options.title || "YandH";
      const content = options.content || "您有新的消息";
      const notificationId = this.notificationId++;
      
      // 创建Intent（点击通知时的行为）
      const intent = new this.Intent();
      intent.setClass(this.mainActivity, this.mainActivity.getClass());
      intent.setFlags(0x10200000); // FLAG_ACTIVITY_CLEAR_TOP | FLAG_ACTIVITY_SINGLE_TOP
      
      // 创建PendingIntent
      const pendingIntent = this.PendingIntent.getActivity(
        this.mainActivity, 
        notificationId, 
        intent, 
        0x08000000 // PendingIntent.FLAG_UPDATE_CURRENT
      );
      
      // 构建通知
      let builder;
      
      if (this.channelId) {
        // Android 8.0+ 使用通知渠道
        builder = new this.NotificationCompat.Builder(this.mainActivity, this.channelId);
      } else {
        // Android 7.1及以下
        builder = new this.NotificationCompat.Builder(this.mainActivity);
        // 设置优先级（旧版本Android）
        builder.setPriority(1); // NotificationCompat.PRIORITY_DEFAULT
      }
      
      builder.setContentTitle(title);
      builder.setContentText(content);
      builder.setContentIntent(pendingIntent);
      builder.setAutoCancel(true); // 点击后自动清除
      
      // 设置图标
      try {
        const appInfo = this.mainActivity.getApplicationInfo();
        builder.setSmallIcon(appInfo.icon);
      } catch (e) {
        // 使用Android默认图标
        builder.setSmallIcon(17301651); // android.R.drawable.ic_dialog_info
      }
      
      // 禁用震动（已移除震动功能）
      builder.setVibrate(null); // 明确禁用震动
      
      // 设置声音（仅声音，不包含震动）
      if (options.sound !== false) {
        // 仅使用默认通知声音，不包含震动
        const RingtoneManager = plus.android.importClass("android.media.RingtoneManager");
        const defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        builder.setSound(defaultSoundUri);
      }
      
      // 设置长文本（如果内容过长）
      if (content.length > 50) {
        const bigTextStyle = new (plus.android.importClass("androidx.core.app.NotificationCompat$BigTextStyle"))();
        bigTextStyle.bigText(content);
        builder.setStyle(bigTextStyle);
      }
      
      // 构建并发送通知
      const notification = builder.build();
      this.notificationManager.notify(notificationId, notification);
      
      return true;
      
    } catch (e) {
      console.error('发送原生通知失败:', e);
      return false;
    }
  },
  
  // 清除所有通知
  clearAllNotifications: function() {
    try {
      if (this.isReady && this.notificationManager) {
        this.notificationManager.cancelAll();
      }
    } catch (e) {
      console.error('清除通知失败:', e);
    }
  },
  
  // 检查通知权限
  checkNotificationPermission: function() {
    try {
      if (this.isReady && this.notificationManager) {
        const hasPermission = this.notificationManager.areNotificationsEnabled();
        console.log('权限检查 - areNotificationsEnabled()结果:', hasPermission);
        return hasPermission;
      }
      console.log('权限检查 - 管理器未准备就绪');
      return false;
    } catch (e) {
      console.log('权限检查 - 检查权限时出错:', e);
      return false;
    }
  },

  // 弹窗请求通知权限
  requestNotificationPermissionWithDialog: function() {
    const hasPermission = this.checkNotificationPermission();
    
    if (hasPermission) {
      // 已有权限，显示成功提示
      if (typeof plus !== 'undefined' && plus.nativeUI) {
        plus.nativeUI.alert('通知权限已开启！', null, '权限状态');
      } else {
        alert('通知权限已开启！');
      }
      return true;
    }
    
    // 没有权限，显示请求弹窗
    const message = '为了及时接收消息通知，请允许YandH发送通知。\n\n点击"去设置"可以手动开启通知权限。';
    
    if (typeof plus !== 'undefined' && plus.nativeUI) {
      plus.nativeUI.confirm(message, (e) => {
        if (e.index === 0) {
          // 用户点击"去设置"
          this.openNotificationSettings();
        }
        // 用户点击"取消"则什么都不做
      }, '开启通知权限', ['去设置', '取消']);
    } else {
      // 浏览器环境降级处理
      const confirmed = confirm(message + '\n\n点击"确定"了解如何开启权限。');
      if (confirmed) {
        alert('请在手机设置中找到YandH应用，开启通知权限。\n\n路径：设置 → 应用管理 → YandH → 通知');
      }
    }
    
    return false;
  },

  // 打开通知设置页面
  openNotificationSettings: function() {
    try {
      if (typeof plus !== 'undefined' && plus.android) {
        // 获取当前应用包名
        const packageName = plus.runtime.appid;
        
        // 创建Intent跳转到应用详情页
        const Intent = plus.android.importClass('android.content.Intent');
        const Settings = plus.android.importClass('android.provider.Settings');
        const Uri = plus.android.importClass('android.net.Uri');
        
        const intent = new Intent();
        intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse('package:' + packageName));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        
        const activity = plus.android.runtimeMainActivity();
        activity.startActivity(intent);
      } else {
        // 降级处理
        if (typeof plus !== 'undefined' && plus.nativeUI) {
          plus.nativeUI.alert('请在手机设置中手动开启通知权限', null, '设置提示');
        } else {
          alert('请在手机设置中手动开启通知权限');
        }
      }
    } catch (e) {
      console.error('打开设置页面失败:', e);
      if (typeof plus !== 'undefined' && plus.nativeUI) {
        plus.nativeUI.alert('请手动前往设置开启通知权限\n\n路径：设置 → 应用管理 → YandH → 通知', null, '设置提示');
      } else {
        alert('请手动前往设置开启通知权限\n\n路径：设置 → 应用管理 → YandH → 通知');
      }
    }
  },
  
  // 智能发送通知（自动检查权限）
  sendNotificationWithPermissionCheck: function(options) {
    console.log('智能通知 - 检查权限中...');
    
    // 检查是否有权限
    const hasPermission = this.checkNotificationPermission();
    console.log('智能通知 - 权限状态:', hasPermission);
    
    if (!hasPermission) {
      // 没有权限时，静默失败（不打扰用户）
      console.log('智能通知 - 权限不足，静默失败');
      return false;
    }
    
    // 有权限时正常发送
    console.log('智能通知 - 权限充足，开始发送');
    const result = this.sendNativeNotification(options);
    console.log('智能通知 - 发送结果:', result);
    return result;
  },

  // 新消息通知
  notifyNewMessage: function(messageInfo) {
    const senderName = messageInfo.senderName || '用户';
    let content = '';
    
    if (messageInfo.type === 'image') {
      content = '[图片]';
    } else if (messageInfo.content && messageInfo.content.includes('<img')) {
      content = '[表情]';
    } else {
      content = messageInfo.content || '发来了一条消息';
      if (content.length > 100) {
        content = content.substring(0, 100) + '...';
      }
    }

    return this.sendNotificationWithPermissionCheck({
      title: `来自${senderName}的新消息`,
      content: content,
      type: 'message',
      data: messageInfo
    });
  },
  
  // 新动态通知
  notifyNewPost: function(postInfo) {
    const username = postInfo.username || '用户';
    const preview = postInfo.content ? 
      (postInfo.content.length > 50 ? postInfo.content.substring(0, 50) + '...' : postInfo.content) : 
      '发布了新动态';

    return this.sendNotificationWithPermissionCheck({
      title: '新动态发布',
      content: `${username}: ${preview}`,
      type: 'post',
      data: postInfo
    });
  },
  
  // 测试通知
  testNotification: function() {
    return this.sendNativeNotification({
      title: '测试通知',
      content: '这是一条原生测试通知，如果你看到了这个通知，说明原生通知功能正常工作！',
      type: 'test'
    });
  }
};

// 等待plus准备就绪后初始化
if (typeof window.plus !== 'undefined') {
  NativeNotificationManager.init();
} else {
  document.addEventListener('plusready', function() {
    setTimeout(() => {
      NativeNotificationManager.init();
    }, 100);
  });
}

// 导出到全局
window.NativeNotificationManager = NativeNotificationManager; 