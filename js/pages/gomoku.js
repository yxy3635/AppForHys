// 使用统一配置中的API地址
const API_BASE_URL = APP_CONFIG.API_BASE;

// 五子棋页面主逻辑

document.addEventListener('DOMContentLoaded', function() {
    // 检查用户登录
    const userId = localStorage.getItem('user_id');
    if (!userId) {
        alert('请先登录！');
        window.location.href = 'index.html';
        return;
    }
    const roomListContainer = document.getElementById('roomListContainer');
    const createRoomBtn = document.getElementById('createRoomBtn');
    const gomokuModal = document.getElementById('gomokuModal');
    const gomokuGameArea = document.getElementById('gomokuGameArea');
    const gomokuRoomList = document.getElementById('gomokuRoomList');
    const gomokuBackBtn = document.getElementById('gomokuBackBtn');

    // 返回按钮
    gomokuBackBtn.onclick = function() {
        window.history.back();
    };

    // 加载房间列表
    function loadRoomList() {
        roomListContainer.innerHTML = '<div class="loading">加载中...</div>';
        fetch(`${API_BASE_URL}/gomoku/gomoku_list_rooms.php`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.rooms && data.rooms.length > 0) {
                    roomListContainer.innerHTML = '';
                    // 先批量拉取所有 player1_id 的用户名
                    const userIdNameMap = {};
                    const fetchNames = data.rooms.map(room => {
                        return fetch(`${API_BASE_URL}/profile.php?user_id=${room.player1_id}`)
                            .then(res => res.json())
                            .then(d => { userIdNameMap[room.player1_id] = d.user?.username || '房主'; });
                    });
                    Promise.all(fetchNames).then(() => {
                        data.rooms.forEach(room => {
                            const div = document.createElement('div');
                            div.className = 'gomoku-room-item';
                            const isPlayer1 = String(room.player1_id) === String(userId);
                            const isPlayer2 = String(room.player2_id) === String(userId);
                            const isFull = room.player1_id && room.player2_id && !isPlayer1 && !isPlayer2;
                            let btnText = '加入';
                            let btnDisabled = false;
                            if (isPlayer1 || isPlayer2) {
                                btnText = '进入';
                                btnDisabled = false;
                            } else if (isFull) {
                                btnText = '已满';
                                btnDisabled = true;
                            }
                            const roomOwnerName = userIdNameMap[room.player1_id] || '房主';
                            div.innerHTML = `<span class="gomoku-room-name">${roomOwnerName}的房间</span>
                                <button class="gomoku-join-btn" data-roomid="${room.id}" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>`;
                            roomListContainer.appendChild(div);
                            div.roomData = room;
                        });
                    });
                    window._lastRoomListData = data.rooms;
                } else {
                    roomListContainer.innerHTML = '<div class="loading">暂无房间，快来创建吧！</div>';
                }
            })
            .catch(() => {
                roomListContainer.innerHTML = '<div class="loading">加载失败，请稍后重试</div>';
            });
    }

    loadRoomList();

    // 创建房间弹窗
    createRoomBtn.onclick = function() {
        const myUsername = localStorage.getItem('username') || '';
        showModal('创建房间', `确定要创建房间吗？`, (ok) => {
            if (!ok) return;
            const safeUserId = String(userId || '').trim();
            const roomName = `${myUsername}的房间`;
            fetch(`${API_BASE_URL}/gomoku/gomoku_create_room.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: myUsername, user_id: safeUserId, room_name: roomName })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    enterRoom(data.room_code, myUsername);
                } else {
                    alert(data.message || '创建失败');
                }
            });
        }, null, false);
    };

    // 加入/进入房间
    roomListContainer.onclick = function(e) {
        if (e.target.classList.contains('gomoku-join-btn')) {
            const roomId = e.target.getAttribute('data-roomid');
            // 找到当前房间对象
            const room = Array.from(roomListContainer.children).map(div => div.roomData).find(r => r && String(r.id) === String(roomId));
            let foundRoom = room;
            if (!foundRoom && window._lastRoomListData) {
                foundRoom = window._lastRoomListData.find(r => String(r.id) === String(roomId));
            }
            const r = foundRoom || {};
            const isPlayer1 = String(r.player1_id) === String(userId);
            const isPlayer2 = String(r.player2_id) === String(userId);
            const myUsername = localStorage.getItem('username') || '';
            if (isPlayer1 || isPlayer2) {
                // 你已经在房间，直接进入
                enterRoom(r.room_code, myUsername);
            } else {
                // 不是玩家，弹窗确认加入
                showModal('加入房间', '确定要加入该房间吗？', (ok) => {
                    if (!ok) return;
                    const safeUserId = String(userId || '').trim();
                    fetch(`${API_BASE_URL}/gomoku/gomoku_join_room.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ room_code: r.room_code, nickname: myUsername, user_id: safeUserId })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            enterRoom(r.room_code, myUsername);
                        } else {
                            alert(data.message || '加入失败');
                        }
                    });
                }, null, false);
            }
        }
    };

    // 全局弹窗方法，支持标题、正文、按钮、输入框，动画与主App一致
    function showModal(title, message, onConfirm, defaultValue = '', confirmOnly = false) {
        // 移除旧弹窗
        let old = document.getElementById('customModalOverlay');
        if (old) old.remove();
        // 构建弹窗
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.id = 'customModalOverlay';
        const content = document.createElement('div');
        content.className = 'custom-modal-content';
        if (title) content.innerHTML += `<h3>${title}</h3>`;
        if (message) content.innerHTML += `<p>${message}</p>`;
        const actions = document.createElement('div');
        actions.className = 'custom-modal-actions';
        const okBtn = document.createElement('button');
        okBtn.id = 'custom-modal-confirm-btn';
        okBtn.textContent = '确定';
        actions.appendChild(okBtn);
        if (!confirmOnly) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'custom-modal-cancel-btn';
            cancelBtn.textContent = '取消';
            actions.appendChild(cancelBtn);
            cancelBtn.onclick = function() {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
                onConfirm(false);
            };
        }
        okBtn.onclick = function() {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
            onConfirm(confirmOnly ? true : (defaultValue || true));
        };
        content.appendChild(actions);
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);
    }

    // 进入房间（拉取房间状态，实时同步昵称和棋盘）
    let roomStatusTimer = null;
    let previewX = null, previewY = null; // 棋子虚影位置
    let gameOverShown = false; // 是否已弹出胜负提示
    let rematchPollingTimer = null; // 轮询再来一局邀请
    let rematchInviteId = null; // 当前邀请ID
    let rematchWaiting = false; // 是否正在等待对方同意
    let lastBoardState = null; // 保存上一次的棋盘状态
    let boardInitialized = false; // 标记棋盘是否已初始化
    let currentRoomCode = null; // 当前房间号
    async function enterRoom(roomCode, myNickname) {
        currentRoomCode = roomCode;
        gameOverShown = false; // 进入新房间时重置，确保胜负弹窗正常
        gomokuRoomList.style.display = 'none';
        gomokuGameArea.style.display = 'block';
        document.getElementById('gomokuGameMsg').textContent = '';
        // 清理旧定时器
        if (roomStatusTimer) clearInterval(roomStatusTimer);
        // 自动join逻辑
        async function ensureJoin(room) {
            const myUserId = userId;
            const joinRoomCode = room.room_code || room.code || currentRoomCode || '';
            if (String(room.player1_id) !== String(myUserId) && (!room.player2_id || String(room.player2_id) !== String(myUserId))) {
                console.log('自动join参数', {joinRoomCode, myUserId});
                if (!joinRoomCode || !myUserId) {
                    document.getElementById('gomokuGameMsg').textContent = '房间号或用户ID缺失，无法加入房间';
                    return;
                }
                const res = await fetch(`${API_BASE_URL}/gomoku/gomoku_join_room.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room_code: joinRoomCode, nickname: localStorage.getItem('username') || '', user_id: myUserId })
                });
                const data = await res.json();
                if (!data.success) {
                    document.getElementById('gomokuGameMsg').textContent = data.message || '加入房间失败';
                }
            }
        }
        // 拉取并渲染房间状态
        async function fetchAndRenderRoom() {
            const res = await fetch(`${API_BASE_URL}/gomoku/gomoku_room_status.php?room_code=${roomCode}`);
            const data = await res.json();
            if (!data.success) {
                document.getElementById('gomokuGameMsg').textContent = data.message || '房间信息获取失败';
                return;
            }
            const room = data.room;
            // 新房间自动join
            await ensureJoin(room);
            // 获取双方昵称
            let player1Name = '';
            let player2Name = '';
            if (String(room.player1_id) === String(userId)) {
                player1Name = myNickname;
            } else if (room.player1_id) {
                player1Name = await fetchNickname(room.player1_id);
            }
            if (String(room.player2_id) === String(userId)) {
                player2Name = myNickname;
            } else if (room.player2_id) {
                player2Name = await fetchNickname(room.player2_id);
            }
            // 渲染对局信息
            renderGameInfo(player1Name, player2Name, room.current_turn);
            // 检查是否需要清除虚影
            let myColor = null;
            if (String(room.player1_id) === String(userId)) myColor = 1;
            if (String(room.player2_id) === String(userId)) myColor = 2;
            if (room.current_turn !== myColor) {
                previewX = previewY = null;
            }
            // 检查胜负
            if (!gameOverShown && room.winner !== null && room.winner !== undefined && room.winner !== 0) {
                // 调试输出
                console.log('胜负判定调试', {
                    user_id: userId,
                    player1_id: room.player1_id,
                    player2_id: room.player2_id,
                    winner: room.winner
                });
                let msg = '';
                if (room.winner == -1) {
                    msg = '平局！';
                } else if (String(room.winner) === String(userId)) {
                    msg = '你赢了！🎉';
                } else {
                    msg = '你输了！';
                }
                gameOverShown = true;
                showRematchModal(msg, room, myColor);
            }
            renderBoard(room);
        }
        // 拉取昵称
        async function fetchNickname(uid) {
            const res = await fetch(`${API_BASE_URL}/profile.php?user_id=${uid}`);
            const data = await res.json();
            return data.user?.username || '对手';
        }
        // 渲染对局信息
        function renderGameInfo(player1, player2, currentTurn) {
            document.getElementById('playerBlack').textContent = `● ${player1 || '等待对手'}`;
            document.getElementById('playerWhite').textContent = `○ ${player2 || '等待对手'}`;
            document.getElementById('playerBlack').classList.toggle('active', currentTurn == 1);
            document.getElementById('playerWhite').classList.toggle('active', currentTurn == 2);
            document.getElementById('gomokuTurnInfo').textContent = `当前回合：${currentTurn == 1 ? (player1 || '等待对手') : (player2 || '等待对手')}`;
        }
        // 初始化棋盘网格（只在第一次调用）
        function initializeBoard() {
            const boardDiv = document.getElementById('gomokuBoard');
            boardDiv.innerHTML = '';
            
            for (let i = 0; i < 15; i++) {
                for (let j = 0; j < 15; j++) {
                    const cell = document.createElement('div');
                    cell.className = 'gomoku-cell';
                    cell.dataset.x = i;
                    cell.dataset.y = j;
                    cell.id = `cell-${i}-${j}`;
                    boardDiv.appendChild(cell);
                }
            }
            boardInitialized = true;
        }
        
        // 全局变量保存当前房间状态
        let currentRoom = null;
        
        // 更新单个格子的内容
        function updateCell(i, j, stoneType, isClickable = false, isPreview = false, myPlayerColor = null) {
            const cell = document.getElementById(`cell-${i}-${j}`);
            if (!cell) return;
            
            // 清空格子内容
            cell.innerHTML = '';
            cell.onclick = null;
            
            if (stoneType !== 0) {
                // 添加棋子
                const stone = document.createElement('div');
                stone.className = 'gomoku-stone ' + (stoneType === 1 ? 'black' : 'white');
                cell.appendChild(stone);
            } else if (isPreview) {
                // 添加虚影棋子
                const shadow = document.createElement('div');
                shadow.className = 'gomoku-stone shadow ' + (myPlayerColor === 1 ? 'black' : 'white');
                cell.appendChild(shadow);
            }
            
            // 设置点击事件
            if (isClickable) {
                cell.onclick = function() {
                    if (previewX === i && previewY === j) {
                        // 再次点击，发起落子
                        cell.clicked = true;
                        fetch(`${API_BASE_URL}/gomoku/gomoku_move.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ room_code: roomCode, user_id: userId, x: i, y: j })
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (!data.success) {
                                document.getElementById('gomokuGameMsg').textContent = data.message || '落子失败';
                            } else {
                                document.getElementById('gomokuGameMsg').textContent = '';
                                previewX = previewY = null;
                                fetchAndRenderRoom();
                            }
                        });
                    } else {
                        // 第一次点击，显示虚影
                        previewX = i;
                        previewY = j;
                        // 重新渲染当前房间状态以显示虚影
                        if (currentRoom) {
                            renderBoard(currentRoom);
                        }
                    }
                };
            }
        }
        
        // 智能渲染棋盘（只更新变化的部分）
        function renderBoard(room) {
            // 保存当前房间状态
            currentRoom = room;
            
            // 解析棋盘状态
            let board = [];
            try {
                board = JSON.parse(room.board_state);
            } catch (e) {
                board = Array.from({length: 15}, () => Array(15).fill(0));
            }
            
            // 如果棋盘未初始化，先初始化
            if (!boardInitialized) {
                initializeBoard();
            }
            
            // 计算自己执子颜色
            let myColor = null;
            if (String(room.player1_id) === String(userId)) myColor = 1;
            if (String(room.player2_id) === String(userId)) myColor = 2;
            
            // 检查回合是否变化
            const currentTurn = room.current_turn;
            const lastTurn = lastBoardState ? lastBoardState.currentTurn : null;
            const turnChanged = currentTurn !== lastTurn;
            
            // 比较当前棋盘状态与上一次状态，只更新有变化的格子
            for (let i = 0; i < 15; i++) {
                for (let j = 0; j < 15; j++) {
                    const currentStone = board[i][j];
                    const lastStone = lastBoardState ? lastBoardState[i][j] : -1;
                    const isPreviewPosition = (previewX === i && previewY === j);
                    const isClickable = (myColor && room.current_turn == myColor && currentStone === 0);
                    
                    // 获取上一次的可点击状态
                    const lastClickable = lastBoardState && lastBoardState.clickableStates ? 
                        lastBoardState.clickableStates[i][j] : false;
                    
                    // 检查是否需要更新这个格子
                    const needUpdate = 
                        currentStone !== lastStone || // 棋子状态变化
                        isPreviewPosition || // 当前是预览位置
                        (lastBoardState && lastBoardState.previewX === i && lastBoardState.previewY === j && !isPreviewPosition) || // 之前是预览位置现在不是
                        isClickable !== lastClickable || // 可点击状态变化
                        turnChanged; // 回合变化时强制更新空格子
                    
                    if (needUpdate) {
                        updateCell(i, j, currentStone, isClickable, isPreviewPosition, myColor);
                    }
                }
            }
            
            // 保存当前状态以供下次比较
            lastBoardState = board.map(row => [...row]); // 深拷贝
            lastBoardState.previewX = previewX;
            lastBoardState.previewY = previewY;
            lastBoardState.currentTurn = currentTurn;
            
            // 保存可点击状态
            lastBoardState.clickableStates = [];
            for (let i = 0; i < 15; i++) {
                lastBoardState.clickableStates[i] = [];
                for (let j = 0; j < 15; j++) {
                    const isClickable = (myColor && room.current_turn == myColor && board[i][j] === 0);
                    lastBoardState.clickableStates[i][j] = isClickable;
                }
            }
        }
        // 首次渲染
        fetchAndRenderRoom();
        // 定时轮询
        roomStatusTimer = setInterval(fetchAndRenderRoom, 1500);
        // 再来一局弹窗
        function showRematchModal(msg, room, myColor) {
            // 移除旧弹窗
            let old = document.getElementById('customModalOverlay');
            if (old) old.remove();
            const overlay = document.createElement('div');
            overlay.className = 'custom-modal-overlay';
            overlay.id = 'customModalOverlay';
            const content = document.createElement('div');
            content.className = 'custom-modal-content';
            content.innerHTML = `<h3>对局结束</h3><p>${msg}</p>`;
            const actions = document.createElement('div');
            actions.className = 'custom-modal-actions';
            const rematchBtn = document.createElement('button');
            rematchBtn.id = 'custom-modal-confirm-btn';
            rematchBtn.textContent = '再来一局';
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'custom-modal-cancel-btn';
            cancelBtn.textContent = '返回房间列表';
            actions.appendChild(rematchBtn);
            actions.appendChild(cancelBtn);
            content.appendChild(actions);
            overlay.appendChild(content);
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('show'), 10);
            rematchBtn.onclick = async function() {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
                // 发起再来一局邀请（原逻辑）
                const from_user_id = userId;
                const from_username = localStorage.getItem('username') || '';
                const old_room_code = currentRoomCode || room.room_code || room.roomCode || room.code || '';
                let to_user_id = null;
                if (myColor === 1) {
                    to_user_id = room.player2_id;
                } else if (myColor === 2) {
                    to_user_id = room.player1_id;
                }
                console.log('rematch params', {from_user_id, to_user_id, old_room_code, from_username});
                if (!from_user_id || !to_user_id || !old_room_code || !from_username) {
                    alert('参数缺失，无法发起再来一局');
                    return;
                }
                rematchWaiting = true;
                // 发起邀请
                const res = await fetch(`${API_BASE_URL}/gomoku/gomoku_rematch_invite.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ from_user_id, to_user_id, old_room_code, from_username })
                });
                const data = await res.json();
                if (!data.success) {
                    alert(data.message || '邀请失败');
                    rematchWaiting = false;
                    return;
                }
                const newRoomCode = data.new_room_code;
                // 发起方直接进入新房间，等待对方加入
                showModal('再来一局', '已创建新房间，等待对方加入...', () => {
                    enterRoom(newRoomCode, localStorage.getItem('username') || '');
                }, '', true);
                setTimeout(() => enterRoom(newRoomCode, localStorage.getItem('username') || ''), 1200);
            };
            cancelBtn.onclick = function() {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
                document.getElementById('gomokuExitBtn').click();
            };
        }
        // 轮询是否收到再来一局邀请
        async function pollRematchInvite() {
            if (rematchPollingTimer) clearInterval(rematchPollingTimer);
            rematchPollingTimer = setInterval(async () => {
                if (rematchWaiting) return; // 自己已发起邀请时不轮询
                const res = await fetch(`${API_BASE_URL}/gomoku/gomoku_check_rematch.php?user_id=${userId}`);
                const data = await res.json();
                if (data.invite && data.invite.status === 'pending') {
                    // 弹窗提示
                    rematchInviteId = data.invite.id;
                    const newRoomCode = data.invite.new_room_code;
                    showModal('再来一局', '对方邀请你再来一局，是否同意？', (ok) => {
                        if (ok) {
                            // 同意
                            fetch(`${API_BASE_URL}/gomoku/gomoku_respond_rematch.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ invite_id: rematchInviteId, action: 'accept' })
                            }).then(() => {
                                clearInterval(rematchPollingTimer);
                                enterRoom(newRoomCode, localStorage.getItem('username') || '');
                            });
                        } else {
                            // 拒绝
                            fetch(`${API_BASE_URL}/gomoku/gomoku_respond_rematch.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ invite_id: rematchInviteId, action: 'reject' })
                            }).then(() => {
                                clearInterval(rematchPollingTimer);
                                showModal('再来一局', '你已拒绝邀请', () => {}, '', true);
                            });
                        }
                    }, '', false);
                }
            }, 1500);
        }
        pollRematchInvite();
        // 返回房间列表
        document.getElementById('gomokuExitBtn').onclick = function() {
            gomokuGameArea.style.display = 'none';
            gomokuRoomList.style.display = 'block';
            if (roomStatusTimer) clearInterval(roomStatusTimer);
            if (rematchPollingTimer) clearInterval(rematchPollingTimer);
            
            // 重置游戏状态
            gameOverShown = false;
            rematchWaiting = false;
            boardInitialized = false;
            lastBoardState = null;
            previewX = previewY = null;
            currentRoom = null;
            
            loadRoomList();
        };
    }

});

document.addEventListener('plusready', function(){
  plus.key.addEventListener('backbutton', function(){
    history.back();
  }, false);
}); 