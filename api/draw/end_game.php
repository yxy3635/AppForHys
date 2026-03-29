<?php
// 设置错误报告
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// CORS头设置
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
    require_once __DIR__ . '/../db_connect.php';
    
    // 获取房间信息
    $stmt = $conn->prepare("SELECT * FROM draw_rooms WHERE room_code = ?");
    if (!$stmt) {
        throw new Exception("准备查询语句失败: " . $conn->error);
    }
    
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
    
    // 检查用户是否在房间中
    if ($room['player1_id'] != $userId && $room['player2_id'] != $userId) {
        echo json_encode([
            'success' => false,
            'message' => '您不在此房间中'
        ]);
        exit;
    }
    
    // 获取结束游戏的玩家姓名
    $endPlayerName = '';
    if ($room['player1_id'] == $userId) {
        $endPlayerName = $room['player1_name'];
    } else {
        $endPlayerName = $room['player2_name'];
    }
    
    // 添加结束游戏的系统消息
    $message = "$endPlayerName 主动结束了比赛";
    $msgStmt = $conn->prepare("
        INSERT INTO draw_messages (room_code, user_id, nickname, message, is_system) 
        VALUES (?, 0, 'System', ?, 1)
    ");
    
    if ($msgStmt) {
        $msgStmt->bind_param("ss", $roomCode, $message);
        $msgStmt->execute();
        $msgStmt->close();
    }
    
    // 设置房间状态为已结束，并记录是谁结束的
    $finishStmt = $conn->prepare("
        UPDATE draw_rooms 
        SET game_status = 'finished',
            current_word = CONCAT('ENDED_BY:', ?)
        WHERE room_code = ?
    ");
    
    if (!$finishStmt) {
        throw new Exception("准备更新语句失败: " . $conn->error);
    }
    
    $finishStmt->bind_param("ss", $endPlayerName, $roomCode);
    if (!$finishStmt->execute()) {
        throw new Exception("结束游戏失败: " . $finishStmt->error);
    }
    $finishStmt->close();
    
    echo json_encode([
        'success' => true,
        'message' => '游戏已结束',
        'ended_by' => $endPlayerName
    ]);
    
    $conn->close();
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '结束游戏失败: ' . $e->getMessage(),
        'debug_info' => [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]
    ]);
    
    if (isset($conn)) {
        $conn->close();
    }
}
?>