// 使用统一配置中的API地址
const API_BASE_URL = APP_CONFIG.API_BASE;

// 破解版五子棋页面主逻辑

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
        fetch(`${API_BASE_URL}/gomoku_cracked_list_rooms.php`)
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
                            div.innerHTML = `<span class="gomoku-room-name">${roomOwnerName}的破解房间</span>
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
        showModal('创建破解房间', `确定要创建破解版五子棋房间吗？`, (ok) => {
            if (!ok) return;
            const safeUserId = String(userId || '').trim();
            const roomName = `${myUsername}的破解房间`;
            fetch(`${API_BASE_URL}/gomoku_cracked_create_room.php`, {
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
                showModal('加入破解房间', '确定要加入该破解版五子棋房间吗？', (ok) => {
                    if (!ok) return;
                    const safeUserId = String(userId || '').trim();
                    fetch(`${API_BASE_URL}/gomoku_cracked_join_room.php`, {
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
        content.innerHTML += `<p>${message}</p>`;
        // if (defaultValue !== '') {
        //     content.innerHTML += `<input type="text" id="modalInput" value="${defaultValue}" placeholder="请输入...">`;
        // }
        const actions = document.createElement('div');
        actions.className = 'custom-modal-actions';
        if (!confirmOnly) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'custom-modal-cancel-btn';
            cancelBtn.textContent = '取消';
            actions.appendChild(cancelBtn);
        }
        const confirmBtn = document.createElement('button');
        confirmBtn.id = 'custom-modal-confirm-btn';
        confirmBtn.textContent = '确定';
        actions.appendChild(confirmBtn);
        content.appendChild(actions);
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);
        // 绑定点击事件
        if (!confirmOnly) {
            document.getElementById('custom-modal-cancel-btn').onclick = function() {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
                if (onConfirm) onConfirm(false);
            };
        }
        document.getElementById('custom-modal-confirm-btn').onclick = function() {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
            const inputValue = document.getElementById('modalInput') ? document.getElementById('modalInput').value : '';
            if (onConfirm) onConfirm(true, inputValue);
        };
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
                if (onConfirm) onConfirm(false);
            }
        };
    }

    // 进入房间（游戏界面）
    let currentRoomCode = null;
    let roomStatusTimer = null;
    let gameOverShown = false;
    let previewX = null, previewY = null;
    let myColor = null;
    let lastBoardState = null; // 保存上一次的棋盘状态
    let boardInitialized = false; // 标记棋盘是否已初始化

    async function enterRoom(roomCode, myNickname) {
        currentRoomCode = roomCode;
        gomokuRoomList.style.display = 'none';
        gomokuGameArea.style.display = 'block';
        gameOverShown = false;
        previewX = previewY = null;
        
        // 加入房间（如果还没加入）
        const res = await fetch(`${API_BASE_URL}/gomoku_cracked_join_room.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_code: roomCode, nickname: myNickname, user_id: userId })
        });
        const data = await res.json();
        console.log('join room result:', data);
        
        // 获取房间状态并渲染
        async function fetchAndRenderRoom() {
            const res = await fetch(`${API_BASE_URL}/gomoku_cracked_room_status.php?room_code=${roomCode}`);
            const data = await res.json();
            if (data.success && data.room) {
                const room = data.room;
                // 确定我的颜色（1=black, 2=white）
                if (String(room.player1_id) === String(userId)) {
                    myColor = 1;
                } else if (String(room.player2_id) === String(userId)) {
                    myColor = 2;
                } else {
                    myColor = null;
                }
                
                // 渲染玩家信息
                renderGameInfo(room.player1_name, room.player2_name, room.current_turn);
                // 渲染棋盘
                renderBoard(room);
                
                // 检查游戏是否被主动结束
                if (room.game_status === 'ended' && !gameOverShown) {
                    gameOverShown = true;
                    clearInterval(roomStatusTimer);
                    showGameEndModal('游戏已结束', '有玩家主动结束了游戏');
                } else if (room.game_status === 'playing') {
                    document.getElementById('gomokuGameMsg').textContent = '现在是破解模式噢~~';
                } else if (room.game_status === 'waiting') {
                    document.getElementById('gomokuGameMsg').textContent = '等待对手加入...';
                }
            }
        }
        
        // 渲染玩家信息
        function renderGameInfo(player1, player2, currentTurn) {
            const playerBlack = document.getElementById('playerBlack');
            const playerWhite = document.getElementById('playerWhite');
            const turnInfo = document.getElementById('gomokuTurnInfo');
            
            playerBlack.textContent = `○ ${player1 || '等待玩家'}`;
            playerWhite.textContent = `● ${player2 || '等待玩家'}`;
            
            // 高亮当前回合玩家
            playerBlack.classList.toggle('active', currentTurn === 1);
            playerWhite.classList.toggle('active', currentTurn === 2);
            
            if (currentTurn === 1) {
                turnInfo.textContent = `当前回合：${player1 || '玩家1'}`;
            } else if (currentTurn === 2) {
                turnInfo.textContent = `当前回合：${player2 || '玩家2'}`;
            } else {
                turnInfo.textContent = '当前回合：-';
            }
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
                        fetch(`${API_BASE_URL}/gomoku_cracked_move.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ room_code: roomCode, user_id: userId, x: i, y: j })
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (!data.success) {
                                document.getElementById('gomokuGameMsg').textContent = data.message || '落子失败';
                            } else {
                                document.getElementById('gomokuGameMsg').textContent = '现在是破解模式噢~~';
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
            if (room.board_state) {
                try {
                    board = JSON.parse(room.board_state);
                } catch(e) {
                    console.error('Failed to parse board state:', e);
                    board = Array(15).fill().map(() => Array(15).fill(0));
                }
            } else {
                board = Array(15).fill().map(() => Array(15).fill(0));
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
        
        // 游戏结束弹窗函数
        function showGameEndModal(title, message) {
            showModal(title, message, (ok) => {
                if (ok) {
                    document.getElementById('gomokuExitBtn').click();
                }
            }, '', true);
        }
        
        // 破解版特有功能：主动结束游戏和清空棋盘
        document.getElementById('endGameBtn').onclick = function() {
            showModal('结束游戏', '确定要主动结束当前游戏吗？', (ok) => {
                if (ok) {
                    fetch(`${API_BASE_URL}/gomoku_cracked_end_game.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ room_code: roomCode, user_id: userId })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            gameOverShown = true;
                            clearInterval(roomStatusTimer);
                            showGameEndModal('游戏结束', '你主动结束了游戏！');
                        } else {
                            alert(data.message || '结束游戏失败');
                        }
                    });
                }
            }, '', false);
        };
        
        document.getElementById('clearBoardBtn').onclick = function() {
            showModal('清空棋盘', '确定要清空整个棋盘吗？此操作不可撤销。', (ok) => {
                if (ok) {
                    fetch(`${API_BASE_URL}/gomoku_cracked_clear_board.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ room_code: roomCode, user_id: userId })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            document.getElementById('gomokuGameMsg').textContent = '棋盘已清空';
                            // 重置棋盘状态以确保正确渲染
                            lastBoardState = null;
                            currentRoom = null;
                            previewX = previewY = null;
                            fetchAndRenderRoom();
                        } else {
                            alert(data.message || '清空棋盘失败');
                        }
                    });
                }
            }, '', false);
        };
        
        // 返回房间列表
        document.getElementById('gomokuExitBtn').onclick = function() {
            gomokuGameArea.style.display = 'none';
            gomokuRoomList.style.display = 'block';
            if (roomStatusTimer) clearInterval(roomStatusTimer);
            
            // 重置游戏状态
            gameOverShown = false;
            boardInitialized = false;
            lastBoardState = null;
            previewX = previewY = null;
            myColor = null;
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