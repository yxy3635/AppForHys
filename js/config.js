// 主要的后端配置
const APP_CONFIG = {
    // 服务器基础地址
    SERVER_BASE: 'http://38.207.133.8',
    
    // API 接口地址
    API_BASE: 'http://38.207.133.8/api',
    
    // 静态资源地址
    AVATAR_BASE: 'http://38.207.133.8/',
    
    // GIF 相关地址
    GIF_BASE: 'http://38.207.133.8/gif/',
    USER_EMOJI_BASE: 'http://38.207.133.8/gif/user_uploads/',
    
    // 其他服务地址
    VERSION_CHECK_URL: 'http://38.207.133.8/appVersionCheck.php'
};

// 为了兼容现有代码，设置全局变量
window.APP_CONFIG = APP_CONFIG;
window.API_BASE_URL = APP_CONFIG.API_BASE;
window.SERVER_BASE_URL = APP_CONFIG.SERVER_BASE;
window.AVATAR_BASE_URL = APP_CONFIG.AVATAR_BASE;

// 环境切换助手函数
const ConfigHelper = {
    // 切换到开发环境
    setDevelopment: function() {
        APP_CONFIG.SERVER_BASE = 'http://localhost:8080';
        APP_CONFIG.API_BASE = 'http://localhost:8080/api';
        APP_CONFIG.AVATAR_BASE = 'http://localhost:8080/';
        APP_CONFIG.GIF_BASE = 'http://localhost:8080/gif/';
        APP_CONFIG.USER_EMOJI_BASE = 'http://localhost:8080/gif/user_uploads/';
        APP_CONFIG.VERSION_CHECK_URL = 'http://localhost:8080/appVersionCheck.php';
        this.updateGlobalVars();
    },
    
    // 切换到生产环境
    setProduction: function() {
        APP_CONFIG.SERVER_BASE = 'http://38.207.133.8';
        APP_CONFIG.API_BASE = 'http://38.207.133.8/api';
        APP_CONFIG.AVATAR_BASE = 'http://38.207.133.8/';
        APP_CONFIG.GIF_BASE = 'http://38.207.133.8/gif/';
        APP_CONFIG.USER_EMOJI_BASE = 'http://38.207.133.8/gif/user_uploads/';
        APP_CONFIG.VERSION_CHECK_URL = 'http://38.207.133.8/appVersionCheck.php';
        this.updateGlobalVars();
    },
    
    // 自定义服务器地址
    setCustomServer: function(serverUrl) {
        const baseUrl = serverUrl.replace(/\/$/, ''); // 移除末尾的斜杠
        APP_CONFIG.SERVER_BASE = baseUrl;
        APP_CONFIG.API_BASE = baseUrl + '/api';
        APP_CONFIG.AVATAR_BASE = baseUrl + '/';
        APP_CONFIG.GIF_BASE = baseUrl + '/gif/';
        APP_CONFIG.USER_EMOJI_BASE = baseUrl + '/gif/user_uploads/';
        APP_CONFIG.VERSION_CHECK_URL = baseUrl + '/appVersionCheck.php';
        this.updateGlobalVars();
    },
    
    // 更新全局变量
    updateGlobalVars: function() {
        window.APP_CONFIG = APP_CONFIG;
        window.API_BASE_URL = APP_CONFIG.API_BASE;
        window.SERVER_BASE_URL = APP_CONFIG.SERVER_BASE;
        window.AVATAR_BASE_URL = APP_CONFIG.AVATAR_BASE;
    }
};

// 导出到全局作用域
window.ConfigHelper = ConfigHelper;

// 通用网络请求函数
async function commonFetch(url, options = {}) {
  try {
    // 发送实际请求
    const response = await fetch(url, options);
    const data = await response.json();

    // 如果用户已登录，更新在线状态
    const userId = localStorage.getItem('user_id');
    const updateOnlineUrl = `${APP_CONFIG.API_BASE}/update_online_status.php`;
    
    if (userId && url !== updateOnlineUrl) {
      // 避免在更新在线状态的请求中再次更新在线状态
      fetch(updateOnlineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `user_id=${userId}`
      }).catch(error => {
        console.error('更新在线状态失败:', error);
      });
    }

    return data;
  } catch (error) {
    console.error('请求失败:', error, '请求URL:', url);
    throw error;
  }
}

console.log('YandH 配置已加载:', APP_CONFIG); 