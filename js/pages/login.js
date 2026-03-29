function showRegister() {
  document.getElementById('login-box').style.display = 'none';
  document.getElementById('register-box').style.display = 'block';
}
function showLogin() {
  document.getElementById('register-box').style.display = 'none';
  document.getElementById('login-box').style.display = 'block';
}

function login() {
  var username = document.getElementById('login-username').value.trim();
  var password = document.getElementById('login-password').value.trim();
  if (!username || !password) {
    showModal('请输入用户名和密码', 'alert', '登录失败');
    return;
  }
          fetch(APP_CONFIG.API_BASE + '/login.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json' // 确保这里是 'application/json'
    },
    body: JSON.stringify({ // 使用 JSON.stringify 将数据转换为 JSON 字符串
      username: username,
      password: password
    })
  })
  .then(res => res.json())
  .then(data => {
    if(data.success){
      showModal('登录成功', 'alert', '登录成功');
      localStorage.setItem('user_id', data.user.id); // 保存用户ID到本地存储
      localStorage.setItem('username', data.user.username); // 同时保存用户名
      localStorage.setItem('login_timestamp', Date.now()); // 保存当前时间戳
      
      // 检查是否为管理员，如果是则跳转到管理员页面
      if (username === 'admin') {
        window.location.href = 'admin.html';
      } else {
      window.location.href = 'home.html';
      }
    }else{
      showModal(data.message || '登录失败', 'alert', '登录失败');
    }
  })
  .catch(()=>showModal('网络错误', 'alert', '错误'));
}

function register() {
  showModal('未开放注册', 'alert', '注册失败');
  return;
  
  
  var username = document.getElementById('register-username').value.trim();
  var password = document.getElementById('register-password').value.trim();
  if (!username || !password) {
    showModal('请输入用户名和密码', 'alert', '注册失败');
    return;
  }
          fetch(APP_CONFIG.API_BASE + '/register.php', { // 使用统一配置的API地址
    method: 'POST',
    headers: {
      'Content-Type': 'application/json' // 确保 Content-Type 是 application/json
    },
    body: JSON.stringify({username: username, password: password}) // 使用 JSON.stringify
  })
  .then(res => res.json())
  .then(data => {
    if(data.success){
      showModal('注册成功，请登录', 'alert', '注册成功');
      showLogin(); // 注册成功后切换回登录界面
    }else{
      showModal(data.message || '注册失败', 'alert', '注册失败');
    }
  })
  .catch(()=>showModal('网络错误', 'alert', '错误'));
}