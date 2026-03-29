<?php
// 强化CORS头设置
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: false');
header('Access-Control-Max-Age: 86400');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

require_once __DIR__ . '/../db_connect.php';

if (!isset($_GET['room_code'], $_GET['user_id'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少必要参数'
    ]);
    exit;
}

$roomCode = trim($_GET['room_code']);
$userId = (int)$_GET['user_id'];

try {
    
    // 获取房间信息
    $stmt = $conn->prepare("
        SELECT *,
            CASE 
                WHEN player1_id IS NOT NULL AND player2_id IS NOT NULL THEN 2
                WHEN player1_id IS NOT NULL OR player2_id IS NOT NULL THEN 1
                ELSE 0
            END as player_count
        FROM draw_rooms 
        WHERE room_code = ?
    ");
    $stmt->bind_param("s", $roomCode);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    $stmt->close();
    
    if (!$room) {
        echo json_encode([
            'success' => false,
            'message' => '房间不存在'
        ]);
        exit;
    }
    
    // 检查游戏是否被主动结束
    $gameEndedBy = null;
    if ($room['game_status'] === 'finished' && strpos($room['current_word'], 'ENDED_BY:') === 0) {
        $gameEndedBy = substr($room['current_word'], 9); // 去掉 'ENDED_BY:' 前缀
    }
    
    // 计算剩余时间
    if ($room['game_status'] === 'playing' && $room['round_start_time']) {
        $roundDuration = 120; // 每轮120秒
        $timeElapsed = time() - strtotime($room['round_start_time']);
        $timeLeft = max(0, $roundDuration - $timeElapsed);
        $room['time_left'] = $timeLeft;
    }
    
    // 检查画板是否有更新
    $lastUpdate = isset($_GET['last_canvas_update']) ? $_GET['last_canvas_update'] : '1970-01-01 00:00:00';
    $canvasChanged = $room['canvas_updated_at'] > $lastUpdate;
    
    echo json_encode([
        'success' => true,
        'room' => $room,
        'canvas_changed' => $canvasChanged,
        'game_ended_by' => $gameEndedBy
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '获取房间状态失败: ' . $e->getMessage()
    ]);
}

$conn->close();
?>