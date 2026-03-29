// 你画我猜游戏逻辑
document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = APP_CONFIG.API_BASE;
    
    // 获取DOM元素
    const drawRoomList = document.getElementById('drawRoomList');
    const drawGameArea = document.getElementById('drawGameArea');
    const drawRoomsList = document.getElementById('drawRoomsList');
    
    // 按钮元素
    const drawBackBtn = document.getElementById('drawBackBtn');
    const createDrawRoomBtn = document.getElementById('createDrawRoomBtn');
    const refreshDrawRoomsBtn = document.getElementById('refreshDrawRoomsBtn');
    const drawExitBtn = document.getElementById('drawExitBtn');
    const drawStartBtn = document.getElementById('drawStartBtn');
    const drawSkipBtn = document.getElementById('drawSkipBtn');
    const drawEndBtn = document.getElementById('drawEndBtn');
    
    // 游戏元素
    const drawRoomTitle = document.getElementById('drawRoomTitle');
    const drawGameStatus = document.getElementById('drawGameStatus');
    const drawPlayer1 = document.getElementById('drawPlayer1');
    const drawPlayer2 = document.getElementById('drawPlayer2');
    const drawGuessAttempts = document.getElementById('drawGuessAttempts');
    const drawWordHint = document.getElementById('drawWordHint');
    
    // 画板元素
    const drawCanvas = document.getElementById('drawCanvas');
    const drawCanvasDisabled = document.getElementById('drawCanvasDisabled');
    const drawTools = document.querySelectorAll('.draw-tool');
    const drawColorPicker = document.getElementById('drawColorPicker');
    const drawBrushSize = document.getElementById('drawBrushSize');
    const drawClearBtn = document.getElementById('drawClearBtn');
    const drawHelpBtn = document.getElementById('drawHelpBtn');
    
    // 聊天元素
    const drawChatMessages = document.getElementById('drawChatMessages');
    const drawChatInput = document.getElementById('drawChatInput');
    const drawSendBtn = document.getElementById('drawSendBtn');
    
    // 游戏状态变量
    let currentRoom = null;
    let currentUser = localStorage.getItem('user_id');
    let currentNickname = localStorage.getItem('username');
    let gameTimer = null;
    let roomStatusTimer = null;
    let canvasContext = null;
    // 离屏画布和视图变换状态（用于缩放/平移）
    let offscreenCanvas = null;
    let offscreenContext = null;
    let viewScale = 1;
    let viewTranslateX = 0;
    let viewTranslateY = 0;
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 4;
    const BASE_CANVAS_WIDTH = 800;
    const BASE_CANVAS_HEIGHT = 600;
    let isPinching = false;
    let pinchStartScale = 1;
    let pinchStartDistance = 0;
    let pinchFocalWorld = { x: 0, y: 0 };
    let isDrawing = false;
    let lastPoint = null; // 上次绘制的世界坐标，用于插值
    let currentTool = 'pen';
    let lastCanvasData = '';
    let lastGameStatus = null; // 跟踪游戏状态变化
    let lastRoomSnapshot = null; // 最近一次房间快照，用于后备结算
    let hasShownFinal = false;   // 防止重复弹结算
    // 视图平移状态
    let isPanning = false;
    let panStartScreen = { x: 0, y: 0 };
    let panStartTranslate = { x: 0, y: 0 };
    // 是否允许绘制（只有当前画家并在游戏中时为 true）
    let canDraw = false;
    
    // 画板设置
    if (drawCanvas) {
        initCanvasSize();
        canvasContext = drawCanvas.getContext('2d');
        canvasContext.lineCap = 'round';
        canvasContext.lineJoin = 'round';
        // 初始化离屏画布
        setupOffscreenCanvas();
        
        // 窗口大小改变时重新调整画布
        window.addEventListener('resize', initCanvasSize);
    }
    
    function initCanvasSize() {
        if (!drawCanvas) return;
        
        // 统一内部分辨率，跨设备保持一致
        const targetWidth = BASE_CANVAS_WIDTH;
        const targetHeight = BASE_CANVAS_HEIGHT;
        
        // 如果尺寸未变化则不触发重置，避免清空画布
        const currentWidth = drawCanvas.width;
        const currentHeight = drawCanvas.height;
        if (currentWidth === targetWidth && currentHeight === targetHeight) {
            return;
        }
        
        // 优先从离屏画布保存内容（避免因可视变换造成采样误差）
        let dataURL = null;
        try {
            if (offscreenCanvas) {
                dataURL = offscreenCanvas.toDataURL();
            } else if (drawCanvas) {
                dataURL = drawCanvas.toDataURL();
            }
        } catch (e) {
            dataURL = null;
        }
        
        // 设置新尺寸（这一步会清空画布与重置上下文状态）
        drawCanvas.width = targetWidth;
        drawCanvas.height = targetHeight;
        
        // 重建上下文状态
        canvasContext = drawCanvas.getContext('2d');
        if (canvasContext) {
            canvasContext.lineCap = 'round';
            canvasContext.lineJoin = 'round';
        }
        
        // 同步调整离屏画布尺寸并恢复内容
        const ensureOffscreen = () => {
            if (!offscreenCanvas) {
                offscreenCanvas = document.createElement('canvas');
                offscreenContext = offscreenCanvas.getContext('2d');
                offscreenContext.lineCap = 'round';
                offscreenContext.lineJoin = 'round';
            }
            if (offscreenCanvas.width !== targetWidth || offscreenCanvas.height !== targetHeight) {
                const img = dataURL ? new Image() : null;
                if (img) {
                    img.onload = () => {
                        offscreenCanvas.width = targetWidth;
                        offscreenCanvas.height = targetHeight;
                        offscreenContext.drawImage(img, 0, 0, targetWidth, targetHeight);
                        renderCanvasFromOffscreen();
                    };
                    img.src = dataURL;
                } else {
                    offscreenCanvas.width = targetWidth;
                    offscreenCanvas.height = targetHeight;
                    renderCanvasFromOffscreen();
                }
            } else {
                // 尺寸相同仅需要重绘
                renderCanvasFromOffscreen();
            }
        };
        ensureOffscreen();
        
        // 视图缩放在重置尺寸后保持不变，仅重绘
        clampViewTransform();
    }

    function setupOffscreenCanvas() {
        if (!offscreenCanvas) {
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = drawCanvas.width;
            offscreenCanvas.height = drawCanvas.height;
            offscreenContext = offscreenCanvas.getContext('2d');
            offscreenContext.lineCap = 'round';
            offscreenContext.lineJoin = 'round';
        }
        renderCanvasFromOffscreen();
    }

    function renderCanvasFromOffscreen() {
        if (!canvasContext || !offscreenCanvas) return;
        canvasContext.save();
        // 清空可视画布
        canvasContext.setTransform(1, 0, 0, 1, 0, 0);
        canvasContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        // 先铺一层白底，避免透明像素在某些环境下显示为黑色
        canvasContext.fillStyle = '#ffffff';
        canvasContext.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
        // 应用视图变换并绘制离屏图像
        canvasContext.setTransform(viewScale, 0, 0, viewScale, viewTranslateX, viewTranslateY);
        canvasContext.drawImage(offscreenCanvas, 0, 0);
        canvasContext.restore();
    }

    function clampViewTransform() {
        if (!offscreenCanvas || !drawCanvas) return;
        const contentW = offscreenCanvas.width * viewScale;
        const contentH = offscreenCanvas.height * viewScale;
        const canvasW = drawCanvas.width;
        const canvasH = drawCanvas.height;
        // X 方向
        if (contentW <= canvasW) {
            viewTranslateX = (canvasW - contentW) / 2;
        } else {
            const minX = canvasW - contentW;
            const maxX = 0;
            if (viewTranslateX < minX) viewTranslateX = minX;
            if (viewTranslateX > maxX) viewTranslateX = maxX;
        }
        // Y 方向
        if (contentH <= canvasH) {
            viewTranslateY = (canvasH - contentH) / 2;
        } else {
            const minY = canvasH - contentH;
            const maxY = 0;
            if (viewTranslateY < minY) viewTranslateY = minY;
            if (viewTranslateY > maxY) viewTranslateY = maxY;
        }
    }

    function getCanvasPixelScale() {
        const rect = drawCanvas.getBoundingClientRect();
        return {
            scaleX: drawCanvas.width / rect.width,
            scaleY: drawCanvas.height / rect.height
        };
    }
    
    // 初始化
    init();
    
    function init() {
        if (!currentUser || !currentNickname) {
            showModal('提示', '请先登录后再玩游戏', (ok) => {
                if (ok) window.location.href = 'index.html';
            }, '', true);
            return;
        }
        
        loadRoomList();
        setupEventListeners();
    }
    
    function setupEventListeners() {
        // 返回按钮
        drawBackBtn.onclick = () => window.location.href = 'interaction.html';
        
        // 房间管理
        createDrawRoomBtn.onclick = createRoom;
        refreshDrawRoomsBtn.onclick = loadRoomList;
        drawExitBtn.onclick = exitRoom;
        
        // 游戏控制
        drawStartBtn.onclick = startGame;
        drawSkipBtn.onclick = skipWord;
        drawEndBtn.onclick = endGame;
        
        // 画板工具
        drawTools.forEach(tool => {
            tool.onclick = () => selectTool(tool.dataset.tool);
        });
        // 动态添加“手型”工具（拖拽视图）
        try {
            const toolsContainer = drawClearBtn && drawClearBtn.parentElement ? drawClearBtn.parentElement : null;
            if (toolsContainer && !toolsContainer.querySelector('[data-tool="hand"]')) {
                const handBtn = document.createElement('button');
                handBtn.className = 'draw-tool';
                handBtn.setAttribute('data-tool', 'hand');
                handBtn.title = '拖拽视图';
                handBtn.textContent = '✋';
                toolsContainer.insertBefore(handBtn, drawClearBtn);
                handBtn.onclick = () => selectTool('hand');
            }
        } catch (e) {}
        drawClearBtn.onclick = clearCanvas;
        if (drawHelpBtn) drawHelpBtn.onclick = showHelp;
        
        // 画板事件
        setupCanvasEvents();
        
        // 聊天功能
        drawSendBtn.onclick = sendMessage;
        drawChatInput.onkeypress = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
    }

    function showHelp() {
        const helpHtml = `
            <style>
                .guide { text-align: left; }
                .guide-section { margin: 10px 0 14px; }
                .guide-title { font-weight: 700; font-size: 16px; margin-bottom: 8px; color: #333; }
                .guide-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
                .guide-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #eee; border-radius: 10px; background: #fafafa; }
                .guide-emoji { width: 22px; text-align: center; font-size: 18px; }
                .guide-text { font-size: 14px; color: #444; }
                .guide-note { font-size: 12px; color: #666; margin-top: 6px; }
                body.dark-theme .guide-item { background:#2d3748; border-color:#4a5568; }
                body.dark-theme .guide-text { color:#e2e8f0; }
                body.dark-theme .guide-title { color:#f2f2fa; }
            </style>
            <div class="guide">
                <div class="guide-section">
                    <div class="guide-title">工具</div>
                    <div class="guide-grid">
                        <div class="guide-item"><span class="guide-emoji">🖊️</span><div class="guide-text">画笔：在画布上绘制</div></div>
                        <div class="guide-item"><span class="guide-emoji">🧹</span><div class="guide-text">橡皮：擦除内容</div></div>
                        <div class="guide-item"><span class="guide-emoji">🎨</span><div class="guide-text">颜色：选择画笔颜色</div></div>
                        <div class="guide-item"><span class="guide-emoji">➖</span><div class="guide-text">大小：调整线条粗细</div></div>
                        <div class="guide-item"><span class="guide-emoji">✋</span><div class="guide-text">手型：拖拽以移动视图</div></div>
                        <div class="guide-item"><span class="guide-emoji">🗑️</span><div class="guide-text">清空：清空当前画布</div></div>
                    </div>
                </div>
                <div class="guide-section">
                    <div class="guide-title">手势</div>
                    <div class="guide-item"><span class="guide-emoji">🤏</span><div class="guide-text">双指捏合：缩放画布（已设置边界）</div></div>
                    <div class="guide-item" style="margin-top:8px"><span class="guide-emoji">☝️</span><div class="guide-text">单指拖拽（手型选中）：平移视图</div></div>
                    <div class="guide-note">提示：点击“✋”切换到手型后再拖动；点击“🖊️/🧹”恢复绘制。</div>
                </div>
            </div>
        `;
        showModal('使用说明', helpHtml, () => {}, '', true);
    }
    
    function setupCanvasEvents() {
        if (!drawCanvas || !canvasContext) return;
        
        // 鼠标事件
        drawCanvas.onmousedown = (e) => {
            if (currentTool === 'hand') {
                isPanning = true;
                const { scaleX, scaleY } = getCanvasPixelScale();
                const rect = drawCanvas.getBoundingClientRect();
                panStartScreen = { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
                panStartTranslate = { x: viewTranslateX, y: viewTranslateY };
            } else {
                startDraw(e);
            }
        };
        drawCanvas.onmousemove = (e) => {
            if (currentTool === 'hand' && isPanning) {
                const { scaleX, scaleY } = getCanvasPixelScale();
                const rect = drawCanvas.getBoundingClientRect();
                const cur = { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
                const dx = cur.x - panStartScreen.x;
                const dy = cur.y - panStartScreen.y;
                viewTranslateX = panStartTranslate.x + dx;
                viewTranslateY = panStartTranslate.y + dy;
                clampViewTransform();
                renderCanvasFromOffscreen();
            } else {
                draw(e);
            }
        };
        drawCanvas.onmouseup = (e) => {
            if (currentTool === 'hand') {
                isPanning = false;
            } else {
                stopDraw();
            }
        };
        drawCanvas.onmouseout = (e) => {
            if (currentTool === 'hand') {
                isPanning = false;
            } else {
                stopDraw();
            }
        };
        
        // 触摸事件
        drawCanvas.ontouchstart = (e) => {
            if (!canvasContext) return;
            if (e.touches.length === 2) {
                // 双指缩放开始
                isPinching = true;
                pinchStartScale = viewScale;
                pinchStartDistance = distanceBetweenTouches(e.touches[0], e.touches[1]);
                const focal = getTouchesCenter(e.touches[0], e.touches[1]);
                pinchFocalWorld = screenToWorld(focal.x, focal.y);
                e.preventDefault();
                return;
            }
            if (e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                if (currentTool === 'hand') {
                    const { scaleX, scaleY } = getCanvasPixelScale();
                    const rect = drawCanvas.getBoundingClientRect();
                    panStartScreen = { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
                    panStartTranslate = { x: viewTranslateX, y: viewTranslateY };
                    isPanning = true;
                } else {
                    const mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
                    drawCanvas.dispatchEvent(mouseEvent);
                }
            }
        };
        
        drawCanvas.ontouchmove = (e) => {
            if (!canvasContext) return;
            if (e.touches.length === 2) {
                // 双指缩放或拖拽
                e.preventDefault();
                handlePinchMove(e);
                return;
            }
            if (e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                if (currentTool === 'hand' && isPanning) {
                    const { scaleX, scaleY } = getCanvasPixelScale();
                    const rect = drawCanvas.getBoundingClientRect();
                    const cur = { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
                    const dx = cur.x - panStartScreen.x;
                    const dy = cur.y - panStartScreen.y;
                    viewTranslateX = panStartTranslate.x + dx;
                    viewTranslateY = panStartTranslate.y + dy;
                    clampViewTransform();
                    renderCanvasFromOffscreen();
                } else {
                    const mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
                    drawCanvas.dispatchEvent(mouseEvent);
                }
            }
        };
        
        drawCanvas.ontouchend = (e) => {
            if (isPinching && e.touches.length < 2) {
                isPinching = false;
            }
            e.preventDefault();
            if (currentTool === 'hand') {
                isPanning = false;
            }
            const mouseEvent = new MouseEvent('mouseup', {});
            drawCanvas.dispatchEvent(mouseEvent);
        };
    }
    
    // 房间管理功能
    async function loadRoomList() {
        try {
            drawRoomsList.innerHTML = '<div class="draw-loading">正在加载房间列表...</div>';
            
            const response = await fetch(`${API_BASE_URL}/draw/list_rooms.php`);
            const data = await response.json();
            
            if (data.success) {
                displayRooms(data.rooms);
            } else {
                drawRoomsList.innerHTML = '<div class="draw-loading">加载失败，请刷新重试</div>';
            }
        } catch (error) {
            console.error('加载房间列表失败:', error);
            drawRoomsList.innerHTML = '<div class="draw-loading">加载失败，请刷新重试</div>';
        }
    }
    
    function displayRooms(rooms) {
        if (!rooms || rooms.length === 0) {
            drawRoomsList.innerHTML = '<div class="gomoku-empty">暂无房间，快来创建吧！</div>';
            return;
        }
        drawRoomsList.innerHTML = rooms.map(room => {
            const isFull = room.player_count >= 2;
            const btnText = isFull ? '进入' : '加入';
            const disabled = false;
            return `
            <div class="gomoku-room-item">
                <span class="gomoku-room-name">${room.room_name}</span>
                <button class="gomoku-join-btn" onclick="joinRoom('${room.room_code}')" ${disabled?'disabled':''}>${btnText}</button>
            </div>`;
        }).join('');
    }
    
    function getGameStatusText(status) {
        const statusMap = {
            'waiting': '等待开始',
            'playing': '游戏中',
            'finished': '已结束'
        };
        return statusMap[status] || '未知';
    }
    
    async function createRoom() {
        showModal('创建房间', `确定要创建房间吗？`, (ok) => {
            if (!ok) return;
            
            const roomName = `${currentNickname}的房间`;
            
            try {
                fetch(`${API_BASE_URL}/draw/create_room.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: currentUser,
                        room_name: roomName,
                        nickname: currentNickname
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        joinRoom(data.room_code);
                    } else {
                        showModal('创建失败', data.message || '创建房间失败', () => {}, '', true);
                    }
                })
                .catch(error => {
                    console.error('创建房间失败:', error);
                    showModal('创建失败', '创建房间失败，请重试', () => {}, '', true);
                });
            } catch (error) {
                console.error('创建房间失败:', error);
                showModal('创建失败', '创建房间失败，请重试', () => {}, '', true);
            }
        });
    }
    
    // 使房间相关函数全局可访问
    window.joinRoom = async function(roomCode) {
        try {
            const response = await fetch(`${API_BASE_URL}/draw/join_room.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser,
                    room_code: roomCode,
                    nickname: currentNickname
                })
            });
            
            const data = await response.json();
            if (data.success) {
                currentRoom = roomCode;
                enterGameArea();
                startStatusPolling();
            } else {
                alert(data.message || '加入房间失败');
            }
        } catch (error) {
            console.error('加入房间失败:', error);
            alert('加入房间失败，请重试');
        }
    };
    
    function enterGameArea() {
        drawRoomList.style.display = 'none';
        drawGameArea.style.display = 'block';
        drawRoomTitle.textContent = `序号: ${currentRoom}`;
        
        // 清空画板
        if (canvasContext) {
            canvasContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        }
        
        // 重置聊天
        drawChatMessages.innerHTML = '<div class="draw-system-message">欢迎来到你画我猜游戏！</div>';
    }
    
    function exitRoom() {
        if (roomStatusTimer) {
            clearInterval(roomStatusTimer);
            roomStatusTimer = null;
        }
        if (gameTimer) {
            clearInterval(gameTimer);
            gameTimer = null;
        }
        
        currentRoom = null;
        drawRoomList.style.display = 'block';
        drawGameArea.style.display = 'none';
        loadRoomList();
    }
    
    // 游戏状态管理
    function startStatusPolling() {
        if (roomStatusTimer) clearInterval(roomStatusTimer);
        
        fetchRoomStatus();
        roomStatusTimer = setInterval(fetchRoomStatus, 2000);
    }
    
    async function fetchRoomStatus() {
        if (!currentRoom) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/draw/room_status.php?room_code=${currentRoom}&user_id=${currentUser}`);
            const data = await response.json();
            
            if (data.success) {
                // 检查游戏是否被主动结束
                if (data.game_ended_by) {
                    // 停止状态轮询
                    if (roomStatusTimer) {
                        clearInterval(roomStatusTimer);
                        roomStatusTimer = null;
                    }
                    
                    // 显示结束通知并清理房间数据
                    showModal('游戏结束', `${data.game_ended_by} 主动结束了比赛`, async () => {
                        await cleanupRoomData();
                        exitRoom();
                    }, '', true);
                    return;
                }
                
                updateGameUI(data.room);
                // 比赛自然结束：展示结算
                if (data.room && data.room.game_status === 'finished' && !data.game_ended_by && !hasShownFinal) {
                    hasShownFinal = true;
                    showFinalResult(data.room, false);
                    return;
                }
                if (data.canvas_changed) {
                    loadCanvasData();
                }
                loadChatMessages();
            } else if (data.message && data.message.includes('房间不存在')) {
                // 后端已删除房间：尝试使用前端快照做后备结算
                if (lastRoomSnapshot && !hasShownFinal) {
                    hasShownFinal = true;
                    showFinalResult(lastRoomSnapshot, true);
                } else {
                    showModal('游戏结束', '游戏已结束，房间已关闭', () => { exitRoom(); }, '', true);
                }
            }
        } catch (error) {
            console.error('获取房间状态失败:', error);
        }
    }

    function showFinalResult(room, roomAlreadyDeleted) {
        const p1 = room.player1_name || '玩家1';
        const p2 = room.player2_name || '玩家2';
        const s1 = room.player1_score || 0;
        const s2 = room.player2_score || 0;
        let title = '比赛结束';
        let resultLine = '';
        if (s1 > s2) {
            resultLine = `${p1} 获胜！`;
        } else if (s2 > s1) {
            resultLine = `${p2} 获胜！`;
        } else {
            resultLine = '平局！';
        }
        const content = `
            <div style="text-align:center">
                <div style="font-size:20px;font-weight:700;margin-bottom:8px;">${resultLine}</div>
                <div style="display:flex;gap:12px;justify-content:center;margin:10px 0;">
                    <div style="padding:10px 12px;border:1px solid #eee;border-radius:10px;min-width:120px;">
                        <div style="font-weight:600;margin-bottom:6px;">${p1}</div>
                        <div style="font-size:18px;color:#667eea;">${s1} 分</div>
                    </div>
                    <div style="padding:10px 12px;border:1px solid #eee;border-radius:10px;min-width:120px;">
                        <div style="font-weight:600;margin-bottom:6px;">${p2}</div>
                        <div style="font-size:18px;color:#ff6b6b;">${s2} 分</div>
                    </div>
                </div>
            </div>`;
        showModal(title, content, async () => {
            if (!roomAlreadyDeleted) {
                await cleanupRoomData();
            }
            exitRoom();
        }, '', true);
    }
    
    function updateGameUI(room) {
        lastGameStatus = room.game_status;
        lastRoomSnapshot = room; // 保存快照
        
        // 更新玩家信息
        updatePlayerDisplay(drawPlayer1, room.player1_name, room.player1_score, room.current_drawer === room.player1_id);
        updatePlayerDisplay(drawPlayer2, room.player2_name, room.player2_score, room.current_drawer === room.player2_id);
        
        // 更新游戏状态
        drawGameStatus.textContent = getGameStatusText(room.game_status);
        
        // 更新词汇提示
        updateWordHint(room);
        
        // 更新控制按钮
        updateGameControls(room);
        
        // 更新画板状态
        updateCanvasState(room);
        
        // 更新猜测次数
        updateGuessAttempts(room);
    }
    
    function updatePlayerDisplay(element, name, score, isActive) {
        const nameElement = element.querySelector('.draw-player-name');
        const scoreElement = element.querySelector('.draw-player-score');
        
        nameElement.textContent = name || '等待玩家';
        scoreElement.textContent = `${score || 0}分`;
        
        if (isActive) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
    }
    
    function updateWordHint(room) {
        if (room.game_status === 'waiting' && room.current_word !== 'WAITING_FOR_WORD') {
            drawWordHint.textContent = '等待游戏开始';
        } else if (room.game_status === 'finished') {
            drawWordHint.textContent = '游戏结束';
        } else if (room.game_status === 'waiting' && room.current_word === 'WAITING_FOR_WORD') {
            // 等待画家选择词汇状态
            const drawerName = room.current_drawer === room.player1_id ? room.player1_name : room.player2_name;
            if (String(room.current_drawer) === String(currentUser)) {
                drawWordHint.textContent = `第${room.current_round}局 - 请选择词汇`;
            } else {
                drawWordHint.textContent = `第${room.current_round}局 - 等待 ${drawerName} 选择词汇...`;
            }
        } else if (room.current_drawer && String(room.current_drawer) === String(currentUser)) {
            drawWordHint.textContent = `第${room.current_round}局 - 你来画: ${room.current_word || '获取词汇中...'}`;
        } else {
            const wordHint = room.current_word ? room.current_word.replace(/./g, '_ ').trim() : '';
            drawWordHint.textContent = `第${room.current_round}局 - 请猜: ${wordHint}`;
        }
    }
    
    function updateGameControls(room) {
        const isRoomOwner = String(room.player1_id) === String(currentUser);
        const canStart = room.game_status === 'waiting' && room.player_count >= 2 && room.current_word !== 'WAITING_FOR_WORD';
        const isCurrentDrawer = String(room.current_drawer) === String(currentUser);
        const isPlaying = room.game_status === 'playing';
        const inRoom = room.player1_id == currentUser || room.player2_id == currentUser;
        const isWaitingForWord = room.game_status === 'waiting' && room.current_word === 'WAITING_FOR_WORD' && isCurrentDrawer;
        
        // 显示开始游戏按钮：房主在第一局 或 当前画家在等待选择词汇时
        drawStartBtn.style.display = ((isRoomOwner && canStart) || isWaitingForWord) ? 'block' : 'none';
        if (isWaitingForWord) {
            drawStartBtn.textContent = '选择词汇开始';
        } else {
            drawStartBtn.textContent = '开始游戏';
        }
        
        drawSkipBtn.style.display = (isCurrentDrawer && isPlaying) ? 'block' : 'none';
        drawEndBtn.style.display = (inRoom && isPlaying) ? 'block' : 'none';
    }
    
    function updateCanvasState(room) {
        const isCurrentDrawer = String(room.current_drawer) === String(currentUser);
        const isPlaying = room.game_status === 'playing';
        const isWaitingForWord = room.game_status === 'waiting' && room.current_word === 'WAITING_FOR_WORD';
        
        canDraw = isCurrentDrawer && isPlaying;
        // 猜的人也允许缩放/平移：始终开启指针事件
        drawCanvas.style.pointerEvents = 'auto';
        // 仍显示上方提示条，告知当前不可绘制
        drawCanvasDisabled.style.display = (!canDraw && (isPlaying || isWaitingForWord)) ? 'flex' : 'none';
    }
    
    function updateGuessAttempts(room) {
        if (room.game_status === 'playing' && room.current_drawer !== parseInt(currentUser) && room.current_word !== 'WAITING_FOR_WORD') {
            const attemptsLeft = room.guess_attempts || 5;
            drawGuessAttempts.textContent = `猜测机会: ${attemptsLeft}/5`;
            drawGuessAttempts.style.display = 'block';
            
            // 根据剩余次数改变颜色
            if (attemptsLeft <= 1) {
                drawGuessAttempts.style.color = '#ff3333';
                drawGuessAttempts.style.background = 'rgba(255, 51, 51, 0.1)';
            } else if (attemptsLeft <= 2) {
                drawGuessAttempts.style.color = '#ff6b6b';
                drawGuessAttempts.style.background = 'rgba(255, 107, 107, 0.1)';
            } else {
                drawGuessAttempts.style.color = '#667eea';
                drawGuessAttempts.style.background = 'rgba(102, 126, 234, 0.1)';
            }
        } else {
            drawGuessAttempts.style.display = 'none';
        }
    }
    
    // 游戏控制功能
    async function startGame() {
        try {
            // 检查当前房间状态
            const statusResponse = await fetch(`${API_BASE_URL}/draw/room_status.php?room_code=${currentRoom}&user_id=${currentUser}`);
            const statusData = await statusResponse.json();
            
            if (!statusData.success) {
                alert('获取房间状态失败');
                return;
            }
            
            const room = statusData.room;
            const isCurrentDrawer = String(room.current_drawer) === String(currentUser);
            
            // 如果是等待词汇状态且当前用户是画家，或者是第一局开始
            if ((room.game_status === 'waiting' && room.current_word === 'WAITING_FOR_WORD' && isCurrentDrawer) || 
                (room.game_status === 'waiting' && room.player_count >= 2 && room.current_word !== 'WAITING_FOR_WORD')) {
                
                // 显示词语选择
                const wordResult = await showWordSelection();
                if (wordResult === false) return; // 用户取消了选择
                
                // 开始游戏，当前用户作为画家
                await actuallyStartGame(wordResult);
            } else {
                alert('当前不能开始游戏');
            }
        } catch (error) {
            console.error('开始游戏失败:', error);
            alert('开始游戏失败，请重试');
        }
    }
    
    // 实际开始游戏的函数
    async function actuallyStartGame(wordResult) {
        try {
            const requestBody = {
                user_id: currentUser,
                room_code: currentRoom
            };
            
            // 只有在有自定义词语时才添加custom_word字段
            if (wordResult) {
                requestBody.custom_word = wordResult;
            }
            
            const response = await fetch(`${API_BASE_URL}/draw/start_game.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            if (data.success) {
                addSystemMessage('游戏开始！');
                // 清空画布
                if (canvasContext) {
                    canvasContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
                    // 保存清空后的画布状态
                    saveCanvasData();
                }
            } else {
                alert(data.message || '开始游戏失败');
            }
        } catch (error) {
            console.error('开始游戏失败:', error);
            alert('开始游戏失败，请重试');
        }
    }
    
    // 显示词语选择界面
    async function showWordSelection() {
        return new Promise(async (resolve) => {
            try {
                // 获取词库词语
                const response = await fetch(`${API_BASE_URL}/draw/get_words.php`);
                const data = await response.json();
                
                if (!data.success) {
                    alert('获取词库失败，将使用随机词语');
                    resolve(null);
                    return;
                }
                
                // 创建选择界面
                const modal = document.createElement('div');
                modal.className = 'custom-modal-overlay';
                modal.innerHTML = `
                    <div class="custom-modal-content" style="max-width: 450px;">
                        <h3>🎨 选择游戏词语</h3>
                        <div class="word-selection">
                            <div class="word-options">
                                <h4>词库词语：</h4>
                                <div class="word-list">
                                    ${data.words.map(word => 
                                        `<button class="word-option" data-word="${word.word}">
                                            ${word.word} <span class="difficulty ${word.difficulty}">[${word.difficulty}]</span>
                                        </button>`
                                    ).join('')}
                                </div>
                            </div>
                            <div class="custom-word">
                                <h4>自定义词语：</h4>
                                <input type="text" id="customWordInput" placeholder="输入自定义词语 (最多5个字)" maxlength="5">
                                <button id="useCustomWord" class="draw-btn draw-btn-secondary">确定</button>
                            </div>
                        </div>
                        <div class="modal-buttons">
                            <button id="cancelWordSelection" class="draw-btn draw-btn-secondary">取消</button>
                            <button id="randomWord" class="draw-btn draw-btn-warning">随机选择</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // 显示弹窗动画
                setTimeout(() => {
                    modal.classList.add('show');
                }, 10);
                
                // 添加样式
                const style = document.createElement('style');
                style.textContent = `
                    .word-selection { margin: 20px 0; }
                    .word-list { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
                    .word-option { 
                        padding: 8px 12px; 
                        border: 2px solid #ddd; 
                        border-radius: 20px; 
                        background: white; 
                        cursor: pointer; 
                        transition: all 0.3s;
                        color: #333;
                    }
                    .word-option:hover { border-color: #667eea; background: #f0f8ff; }
                    .word-option.selected { border-color: #667eea; background: #667eea; color: white; }
                    .difficulty { font-size: 0.8em; opacity: 0.7; }
                    .custom-word { margin-top: 20px; }
                    .custom-word input { 
                        width: 100%; 
                        padding: 8px 12px; 
                        border: 1px solid #ddd; 
                        border-radius: 5px; 
                        margin: 10px 0;
                        background: white;
                        color: #333;
                    }
                    
                    /* 暗黑主题适配 */
                    body.dark-theme .word-option {
                        background: #23242a;
                        border-color: #555;
                        color: #f2f2fa;
                    }
                    body.dark-theme .word-option:hover {
                        border-color: #667eea;
                        background: #2d3748;
                    }
                    body.dark-theme .custom-word input {
                        background: #23242a;
                        border-color: #555;
                        color: #f2f2fa;
                    }
                    body.dark-theme .custom-word input::placeholder {
                        color: #bbbbbb;
                    }
                `;
                document.head.appendChild(style);
                
                // 绑定事件
                const wordOptions = modal.querySelectorAll('.word-option');
                const customInput = modal.querySelector('#customWordInput');
                const useCustomBtn = modal.querySelector('#useCustomWord');
                const cancelBtn = modal.querySelector('#cancelWordSelection');
                const randomBtn = modal.querySelector('#randomWord');
                
                let selectedWord = null;
                
                wordOptions.forEach(option => {
                    option.onclick = () => {
                        wordOptions.forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                        selectedWord = option.dataset.word;
                    };
                });
                
                useCustomBtn.onclick = () => {
                    const custom = customInput.value.trim();
                    if (!custom) {
                        alert('请输入自定义词语');
                        return;
                    }
                    if (custom.length > 5) {
                        alert('词语不能超过5个字');
                        return;
                    }
                    modal.classList.remove('show');
                    setTimeout(() => {
                        if (modal.parentNode) {
                            document.body.removeChild(modal);
                        }
                        if (style.parentNode) {
                            document.head.removeChild(style);
                        }
                    }, 300);
                    resolve(custom);
                };
                
                cancelBtn.onclick = () => {
                    modal.classList.remove('show');
                    setTimeout(() => {
                        if (modal.parentNode) {
                            document.body.removeChild(modal);
                        }
                        if (style.parentNode) {
                            document.head.removeChild(style);
                        }
                    }, 300);
                    resolve(false); // false表示取消
                };
                
                randomBtn.onclick = () => {
                    modal.classList.remove('show');
                    setTimeout(() => {
                        if (modal.parentNode) {
                            document.body.removeChild(modal);
                        }
                        if (style.parentNode) {
                            document.head.removeChild(style);
                        }
                    }, 300);
                    resolve(null); // null表示使用随机词语
                };
                
                // 双击词语选项直接选择
                wordOptions.forEach(option => {
                    option.ondblclick = () => {
                        modal.classList.remove('show');
                        setTimeout(() => {
                            if (modal.parentNode) {
                                document.body.removeChild(modal);
                            }
                            if (style.parentNode) {
                                document.head.removeChild(style);
                            }
                        }, 300);
                        resolve(option.dataset.word);
                    };
                });
                
            } catch (error) {
                console.error('获取词语失败:', error);
                resolve(null);
            }
        });
    }
    
    async function skipWord() {
        try {
            const response = await fetch(`${API_BASE_URL}/draw/skip_word.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser,
                    room_code: currentRoom
                })
            });
            
            const data = await response.json();
            if (data.success) {
                addSystemMessage('已跳过当前题目');
                if (canvasContext) {
                    canvasContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
                }
            } else {
                alert(data.message || '跳过失败');
            }
        } catch (error) {
            console.error('跳过失败:', error);
            alert('跳过失败，请重试');
        }
    }
    
    // 结束游戏功能
    async function endGame() {
        if (!confirm('确定要结束比赛吗？')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/draw/end_game.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser,
                    room_code: currentRoom
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // 停止状态轮询
                if (roomStatusTimer) {
                    clearInterval(roomStatusTimer);
                    roomStatusTimer = null;
                }
                
                // 显示成功消息并清理数据
                showModal('游戏结束', '您已结束比赛', async () => {
                    await cleanupRoomData();
                    exitRoom();
                }, '', true);
            } else {
                alert(data.message || '结束游戏失败');
            }
        } catch (error) {
            console.error('结束游戏失败:', error);
            alert('结束游戏失败，请重试');
        }
    }
    
    // 清理房间数据
    async function cleanupRoomData() {
        try {
            await fetch(`${API_BASE_URL}/draw/cleanup_room.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room_code: currentRoom
                })
            });
        } catch (error) {
            console.error('清理房间数据失败:', error);
        }
    }
    
    // 画板功能
    function selectTool(tool) {
        currentTool = tool;
        drawTools.forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    }
    
    function startDraw(e) {
        if (!canvasContext || !canDraw) return;
        // 多指触控时不进入绘制
        if (e.touches && e.touches.length > 1) return;

        isDrawing = true;
        const coords = getCanvasCoordinates(e);
        const world = screenToWorld(coords.x, coords.y);

        offscreenContext.beginPath();
        offscreenContext.moveTo(world.x, world.y);
        lastPoint = world;
        renderCanvasFromOffscreen();
    }
    
    function draw(e) {
        if (!canvasContext) return;
        // 处理双指缩放和平移
        if (e.touches && e.touches.length === 2) {
            handlePinchMove(e);
            return;
        }
        if (!isDrawing) return;

        const coords = getCanvasCoordinates(e);
        const world = screenToWorld(coords.x, coords.y);

        if (currentTool === 'pen') {
            offscreenContext.globalCompositeOperation = 'source-over';
            offscreenContext.strokeStyle = drawColorPicker.value;
            offscreenContext.lineWidth = drawBrushSize.value / viewScale; // 缩放时线宽视觉一致
        } else if (currentTool === 'eraser') {
            offscreenContext.globalCompositeOperation = 'destination-out';
            offscreenContext.lineWidth = (drawBrushSize.value * 2) / viewScale;
        }
        // 插值：防止快速移动出现断裂
        if (lastPoint) {
            const dx = world.x - lastPoint.x;
            const dy = world.y - lastPoint.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const step = Math.max(1, (offscreenContext.lineWidth * 0.75));
            const steps = Math.ceil(dist / step);
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const ix = lastPoint.x + dx * t;
                const iy = lastPoint.y + dy * t;
                offscreenContext.lineTo(ix, iy);
            }
            offscreenContext.stroke();
        } else {
            offscreenContext.lineTo(world.x, world.y);
            offscreenContext.stroke();
        }
        lastPoint = world;
        renderCanvasFromOffscreen();
    }
    
    function stopDraw() {
        if (!isDrawing) return;
        isDrawing = false;
        renderCanvasFromOffscreen();
        lastPoint = null;
        saveCanvasData();
    }
    
    function clearCanvas() {
        if (!canvasContext || !canDraw) return;
        if (offscreenContext) {
            offscreenContext.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        }
        renderCanvasFromOffscreen();
        saveCanvasData();
    }
    
    async function saveCanvasData() {
        if (!currentRoom || !canvasContext) return;
        
        try {
            const target = offscreenCanvas || drawCanvas;
            const canvasData = target.toDataURL();
            if (canvasData === lastCanvasData) return;
            
            await fetch(`${API_BASE_URL}/draw/save_canvas.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser,
                    room_code: currentRoom,
                    canvas_data: canvasData
                })
            });
            
            lastCanvasData = canvasData;
        } catch (error) {
            console.error('保存画板数据失败:', error);
        }
    }
    
    async function loadCanvasData() {
        if (!currentRoom || !canvasContext) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/draw/get_canvas.php?room_code=${currentRoom}`);
            const data = await response.json();
            
            if (data.success && data.canvas_data && data.canvas_data !== lastCanvasData) {
                const img = new Image();
                img.onload = () => {
                    if (offscreenCanvas && offscreenContext) {
                        offscreenContext.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                        offscreenContext.drawImage(img, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
                        renderCanvasFromOffscreen();
                    } else {
                        canvasContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
                        canvasContext.drawImage(img, 0, 0);
                    }
                };
                img.src = data.canvas_data;
                lastCanvasData = data.canvas_data;
            }
        } catch (error) {
            console.error('加载画板数据失败:', error);
        }
    }
    
    // 聊天功能
    async function sendMessage() {
        const message = drawChatInput.value.trim();
        if (!message || !currentRoom) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/draw/send_message.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser,
                    room_code: currentRoom,
                    message: message,
                    nickname: currentNickname
                })
            });
            
            const data = await response.json();
            if (data.success) {
                drawChatInput.value = '';
                if (data.is_correct) {
                    addSystemMessage(`🎉 ${currentNickname} 答对了！答案是：${data.correct_word}`);
                }
            }
        } catch (error) {
            console.error('发送消息失败:', error);
        }
    }
    
    async function loadChatMessages() {
        if (!currentRoom) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/draw/get_messages.php?room_code=${currentRoom}`);
            const data = await response.json();
            
            if (data.success) {
                displayChatMessages(data.messages);
            }
        } catch (error) {
            console.error('加载聊天消息失败:', error);
        }
    }
    
    function displayChatMessages(messages) {
        const currentScrollHeight = drawChatMessages.scrollHeight;
        const currentScrollTop = drawChatMessages.scrollTop;
        const isAtBottom = currentScrollTop + drawChatMessages.clientHeight >= currentScrollHeight - 10;
        
        drawChatMessages.innerHTML = messages.map(msg => {
            if (msg.is_system) {
                return `<div class="draw-system-message">${msg.message}</div>`;
            } else if (msg.is_correct) {
                return `<div class="draw-message draw-correct-message">
                    <span class="draw-message-sender">${msg.nickname}:</span>${msg.message} ✓
                </div>`;
            } else {
                return `<div class="draw-message draw-wrong-message">
                    <span class="draw-message-sender">${msg.nickname}:</span>${msg.message}
                </div>`;
            }
        }).join('');
        
        if (isAtBottom) {
            drawChatMessages.scrollTop = drawChatMessages.scrollHeight;
        }
    }
    
    function addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'draw-system-message';
        messageDiv.textContent = message;
        drawChatMessages.appendChild(messageDiv);
        drawChatMessages.scrollTop = drawChatMessages.scrollHeight;
    }
    
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
    
    // 获取正确的画布坐标
    function getCanvasCoordinates(e) {
        const rect = drawCanvas.getBoundingClientRect();
        const scaleX = drawCanvas.width / rect.width;
        const scaleY = drawCanvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    // 坐标变换：屏幕坐标 -> 世界坐标（离屏画布坐标系）
    function screenToWorld(x, y) {
        return {
            x: (x - viewTranslateX) / viewScale,
            y: (y - viewTranslateY) / viewScale
        };
    }
    
    // 手势辅助
    function distanceBetweenTouches(t1, t2) {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    function getTouchesCenter(t1, t2) {
        return {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };
    }
    
    function handlePinchMove(e) {
        if (e.touches.length !== 2) return;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const newDistance = distanceBetweenTouches(t1, t2);
        if (pinchStartDistance === 0) return;
        let newScale = pinchStartScale * (newDistance / pinchStartDistance);
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
        
        // 以双指中心为锚点进行缩放，保持该点在世界坐标不变
        const center = getTouchesCenter(t1, t2);
        const { scaleX, scaleY } = getCanvasPixelScale();
        const before = screenToWorld(center.x * scaleX, center.y * scaleY);
        viewScale = newScale;
        
        // 更新平移使得焦点在缩放后仍指向同一世界点
        viewTranslateX = center.x * scaleX - before.x * viewScale;
        viewTranslateY = center.y * scaleY - before.y * viewScale;
        clampViewTransform();
        
        renderCanvasFromOffscreen();
    }
    
    // 工具函数
    function showInputModal(title, prompt) {
        return new Promise((resolve) => {
            const input = window.prompt(`${title}\n${prompt}`);
            resolve(input);
        });
    }
});

// 返回到主页
document.addEventListener('plusready', function(){
    plus.key.addEventListener('backbutton', function(){
        window.location.href = 'interaction.html';
    });
});