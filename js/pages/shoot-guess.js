// 射履 - 猜词对战（五轮，每轮15次机会，单次最多60秒）
(function(){
  const API = APP_CONFIG.API_BASE + '/shoot';
  const $ = (id)=>document.getElementById(id);

  // refs
  const lobby=$('shootLobby'), game=$('shootGame');
  const roomsList=$('shootRoomsList');
  const createBtn=$('shootCreateBtn'), refreshBtn=$('shootRefreshBtn'), backBtn=$('shootBackBtn');
  const roomTitle=$('shootRoomTitle'), statusEl=$('shootStatus');
  const p1El=$('shootP1'), p2El=$('shootP2');
  const roundEl=$('shootRound'), categoryEl=$('shootCategory'), chancesEl=$('shootChances'), timerEl=$('shootTimer');
  const messagesEl=$('shootMessages');
  const askArea=$('askArea'), inputQ=$('shootQuestionInput'), sendQ=$('shootSendQuestionBtn');
  const setterArea=$('setterArea'), wordInput=$('shootWordInput'), catInput=$('shootCategoryInput'), startRoundBtn=$('shootStartRoundBtn');
  const judgeArea=$('judgeArea'), endBtn=$('shootEndBtn');

  // state
  let userId = localStorage.getItem('user_id');
  let username = localStorage.getItem('username') || '玩家';
  let currentRoom=null, pollTimer=null, countdownTimer=null;
  let isShooter=false; // 是否射者

  function init(){
    ensureModal();
    if(!userId){ alert('请先登录'); window.location.href='index.html'; return; }
    bindUI();
    // 若带 room 参数则直接进入对战页
    const params = new URLSearchParams(location.search);
    const code = params.get('room');
    if (code) {
      currentRoom = code;
      if (lobby) lobby.style.display='none';
      if (game) game.style.display='block';
      startPolling();
    } else {
      loadRooms();
    }
  }

  // 若全局未注入 showModal，这里提供轻量版本
  function ensureModal(){
    if (typeof window.showModal === 'function') return;
    window.showModal = function(title, message, onConfirm, defaultValue = '', confirmOnly = true){
      const overlay = document.createElement('div');
      overlay.className = 'custom-modal-overlay';
      const content = document.createElement('div');
      content.className = 'custom-modal-content';
      if (title) { const h = document.createElement('h3'); h.textContent = title; content.appendChild(h); }
      if (message){ const p = document.createElement('p'); p.innerHTML = message; content.appendChild(p); }
      const actions = document.createElement('div'); actions.className = 'custom-modal-actions';
      const ok = document.createElement('button'); ok.id='custom-modal-confirm-btn'; ok.textContent='确定';
      ok.onclick = ()=>{ overlay.classList.remove('show'); setTimeout(()=>overlay.remove(),300); if (onConfirm) onConfirm(true); };
      actions.appendChild(ok);
      if (!confirmOnly){
        const cancel = document.createElement('button'); cancel.id='custom-modal-cancel-btn'; cancel.textContent='取消';
        cancel.onclick = ()=>{ overlay.classList.remove('show'); setTimeout(()=>overlay.remove(),300); if (onConfirm) onConfirm(false); };
        actions.appendChild(cancel);
      }
      content.appendChild(actions); overlay.appendChild(content); document.body.appendChild(overlay);
      setTimeout(()=>overlay.classList.add('show'), 10);
    };
  }

  function bindUI(){
    if (backBtn) backBtn.onclick=()=>window.location.href='interaction.html';
    if (createBtn) createBtn.onclick=createRoom;
    if (refreshBtn) refreshBtn.onclick=loadRooms;
    if (sendQ) sendQ.onclick=sendQuestion;
    if (startRoundBtn) startRoundBtn.onclick=startRound;
    if (endBtn) endBtn.onclick=endGame;
    if (judgeArea) judgeArea.querySelectorAll('button[data-judge]').forEach(btn=>{
      btn.onclick=()=> sendJudge(btn.getAttribute('data-judge'));
    });
  }

  async function loadRooms(){
    roomsList.innerHTML='<div class="loading">加载中...</div>';
    const res = await fetch(`${API}/list_rooms.php`).then(r=>r.json());
    if(!res.success){ roomsList.innerHTML='<div class="loading">加载失败，请稍后重试</div>'; return; }
    if(!res.rooms||res.rooms.length===0){ roomsList.innerHTML='<div class="gomoku-empty">暂无房间，快来创建吧！</div>'; return; }
    roomsList.innerHTML = res.rooms.map(r=>{
      const btnText = (r.player1_id&&r.player2_id)?'进入':'加入';
      return `
        <div class="gomoku-room-item">
          <span class="gomoku-room-name">${r.room_name}</span>
          <button class="gomoku-join-btn" data-room="${r.room_code}">${btnText}</button>
        </div>`;
    }).join('');
    roomsList.querySelectorAll('button[data-room]').forEach(b=>b.onclick=()=>joinRoom(b.dataset.room));
  }

  async function createRoom(){
    const name = `${username}的射履房`;
    const res = await fetch(`${API}/create_room.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,room_name:name,nickname:username})}).then(r=>r.json());
    if(!res.success){ alert(res.message||'创建失败'); return; }
    window.location.href = `shoot-guess-game.html?room=${res.room_code}`;
  }

  async function joinRoom(code){
    const res = await fetch(`${API}/join_room.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,room_code:code,nickname:username})}).then(r=>r.json());
    if(!res.success){ alert(res.message||'加入失败'); return; }
    window.location.href = `shoot-guess-game.html?room=${code}`;
  }

  function enterGame(){
    // 改为进入独立对战区域（当前页面内切换仍保留，但结构可单独页面化）
    lobby.style.display='none';
    game.style.display='block';
    if (roomTitle) roomTitle.textContent=`房间: ${currentRoom}`;
    startPolling();
  }
  function startPolling(){ stopPolling(); poll(); pollTimer=setInterval(poll,1000); }
  function stopPolling(){ if(pollTimer){clearInterval(pollTimer);pollTimer=null;} }

  async function poll(){
    if(!currentRoom) return;
    const res = await fetch(`${API}/room_status.php?room_code=${currentRoom}&user_id=${userId}`).then(r=>r.json());
    if(!res.success){ return; }
    const room=res.room; isShooter=(room.shooter_id==userId);
    // 基本信息
    if (statusEl) statusEl.textContent = room.game_status;
    p1El.querySelector('.name').textContent=room.player1_name||'P1';
    p2El.querySelector('.name').textContent=room.player2_name||'P2';
    p1El.querySelector('.score').textContent=room.player1_score||0;
    p2El.querySelector('.score').textContent=room.player2_score||0;
    roundEl.textContent=room.current_round||1;
    categoryEl.textContent=room.category||'—';
    chancesEl.textContent=room.chances_left||15;
    // 实时倒计时：若 time_left 返回数字则开始本地倒计时
    if (typeof room.time_left === 'number') {
      startLocalCountdown(room.time_left);
    } else {
      stopLocalCountdown();
      timerEl.textContent = 60;
    }
    // 可见性
    const awaitingJudge = (room.game_status==='asking' && !room.turn_deadline);
    setterArea && (setterArea.style.display = (room.game_status==='waiting_set' && isShooter)?'block':'none');
    judgeArea && (judgeArea.style.display = (room.game_status==='asking' && isShooter && awaitingJudge)?'block':'none');
    askArea && (askArea.style.display = (room.game_status==='asking' && !isShooter)?'flex':'none');
    // 输入权限与占位提示
    if (askArea) {
      const disableAsk = isShooter || awaitingJudge || room.game_status!=='asking';
      if (inputQ) inputQ.disabled = disableAsk;
      if (sendQ) sendQ.disabled = disableAsk;
      if (inputQ) {
        if (isShooter) inputQ.placeholder = '射者回答阶段，此处不可用';
        else if (awaitingJudge) inputQ.placeholder = '等待射者回答，请稍候...';
        else if (room.game_status!=='asking') inputQ.placeholder = '当前不可提问';
        else inputQ.placeholder = '履者提问或直接输入答案进行猜测...';
      }
    }
    endBtn.style.display = (room.game_status!=='finished')?'inline-block':'none';
    // 消息
    renderMessages(room.messages||[]);

    if(room.game_status==='finished'){
      showModal('比赛结束', `${room.player1_name||'P1'}：${room.player1_score||0} 分<br>${room.player2_name||'P2'}：${room.player2_score||0} 分`, async ()=>{
        try{ await fetch(`${API}/cleanup_room.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room_code:currentRoom})}); }catch(e){}
        window.location.href='interaction.html';
      }, '', true);
      stopPolling();
    }
  }

  function startLocalCountdown(seconds){
    stopLocalCountdown();
    let left = Math.max(0, parseInt(seconds,10)||0);
    timerEl.textContent = left;
    updateProgress(left);
    countdownTimer = setInterval(()=>{
      left = Math.max(0, left-1);
      timerEl.textContent = left;
      updateProgress(left);
      if(left<=0){ stopLocalCountdown(); }
    },1000);
  }
  function stopLocalCountdown(){ if(countdownTimer){ clearInterval(countdownTimer); countdownTimer=null; } }
  function updateProgress(left){
    const el = document.getElementById('shootProgress');
    if(!el) return;
    const w = Math.max(0, Math.min(100, (left/60)*100));
    el.style.width = w + '%';
  }

  function renderMessages(list){
    messagesEl.innerHTML = list.map(m=>{
      if(m.type==='system') return `<div class="shoot-message system">${m.text}</div>`;
      if(m.role==='asker') return `<div class="shoot-message"><b>履：</b>${m.text}</div>`;
      if(m.role==='shooter') return `<div class="shoot-message"><b>射：</b>${m.text}</div>`;
      return `<div class="shoot-message">${m.text}</div>`;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function startRound(){
    const word=wordInput.value.trim(); const cat=catInput.value.trim();
    if(!word){ alert('请填写谜底'); return; }
    if(!cat){ alert('请填写类别'); return; }
    const res = await fetch(`${API}/start_round.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,room_code:currentRoom,word,category:cat})}).then(r=>r.json());
    if(!res.success){ alert(res.message||'开始失败'); }
  }

  async function sendQuestion(){
    const text=inputQ.value.trim(); if(!text) return;
    const res = await fetch(`${API}/send_question.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,room_code:currentRoom,text})}).then(r=>r.json());
    if(res.success){ inputQ.value=''; }
  }

  async function sendJudge(judge){
    const res = await fetch(`${API}/send_judge.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,room_code:currentRoom,judge})}).then(r=>r.json());
    if(!res.success){ alert(res.message||'判定失败'); }
  }

  async function endGame(){
    showModal('主动结束比赛', '确定要结束当前比赛吗？', async (ok)=>{
      if(!ok) return;
      await fetch(`${API}/end_game.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,room_code:currentRoom})});
    }, '', false);
  }

  document.addEventListener('DOMContentLoaded', init);
})();


