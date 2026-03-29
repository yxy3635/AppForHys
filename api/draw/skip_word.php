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

// 获取POST数据
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['user_id'], $input['room_code'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少必要参数'
    ]);
    exit;
}

$userId = (int)$input['user_id'];
$roomCode = trim($input['room_code']);

try {
    
    // 获取房间信息
    $stmt = $conn->prepare("SELECT * FROM draw_rooms WHERE room_code = ?");
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
    
    // 检查是否是当前画家
    if ($room['current_drawer'] != $userId) {
        echo json_encode([
            'success' => false,
            'message' => '只有当前画家可以跳过词汇'
        ]);
        exit;
    }
    
    // 检查游戏状态
    if ($room['game_status'] !== 'playing') {
        echo json_encode([
            'success' => false,
            'message' => '游戏未在进行中'
        ]);
        exit;
    }
    
    // 检查是否还有下一轮
    if ($room['current_round'] >= $room['max_rounds']) {
        // 添加系统消息
        $player1Score = $room['player1_score'];
        $player2Score = $room['player2_score'];
        $winner = '';
        
        if ($player1Score > $player2Score) {
            $winner = $room['player1_name'] . ' 获胜！';
        } else if ($player2Score > $player1Score) {
            $winner = $room['player2_name'] . ' 获胜！';
        } else {
            $winner = '平局！';
        }
        
        $msgStmt = $conn->prepare("
            INSERT INTO draw_messages (room_code, user_id, nickname, message, is_system) 
            VALUES (?, 0, 'System', ?, 1)
        ");
        $message = "游戏结束！最终比分 {$player1Score}:{$player2Score}，$winner";
        $msgStmt->bind_param("ss", $roomCode, $message);
        $msgStmt->execute();
        $msgStmt->close();
        
        // 删除房间和消息
        $deleteRoomStmt = $conn->prepare("DELETE FROM draw_rooms WHERE room_code = ?");
        $deleteRoomStmt->bind_param("s", $roomCode);
        $deleteRoomStmt->execute();
        $deleteRoomStmt->close();
        
        $deleteMessagesStmt = $conn->prepare("DELETE FROM draw_messages WHERE room_code = ?");
        $deleteMessagesStmt->bind_param("s", $roomCode);
        $deleteMessagesStmt->execute();
        $deleteMessagesStmt->close();
        
    } else {
        // 进入下一轮
        $nextRound = $room['current_round'] + 1;
        $nextDrawer = ($room['current_drawer'] == $room['player1_id']) ? $room['player2_id'] : $room['player1_id'];
        
        // 临时方案：使用waiting状态，前端通过其他条件判断是否需要选择词汇
        $updateStmt = $conn->prepare("
            UPDATE draw_rooms 
            SET current_round = ?, current_drawer = ?, current_word = 'WAITING_FOR_WORD',
                game_status = 'waiting',
                guess_attempts = 5, round_start_time = NOW(), canvas_data = NULL 
            WHERE room_code = ?
        ");
        $updateStmt->bind_param("iis", $nextRound, $nextDrawer, $roomCode);
        $updateStmt->execute();
        $updateStmt->close();
        
        // 添加系统消息
        $drawerName = ($nextDrawer == $room['player1_id']) ? $room['player1_name'] : $room['player2_name'];
        $msgStmt = $conn->prepare("
            INSERT INTO draw_messages (room_code, user_id, nickname, message, is_system) 
            VALUES (?, 0, 'System', ?, 1)
        ");
        $message = "跳过了上一题！第{$nextRound}轮准备中，等待 $drawerName 选择词汇...";
        $msgStmt->bind_param("ss", $roomCode, $message);
        $msgStmt->execute();
        $msgStmt->close();
    }
    
    echo json_encode([
        'success' => true,
        'message' => '跳过成功'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '跳过失败: ' . $e->getMessage()
    ]);
}

$conn->close();
?>