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

if (!$input || !isset($input['user_id'], $input['room_code'], $input['nickname'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少必要参数'
    ]);
    exit;
}

$userId = (int)$input['user_id'];
$roomCode = trim($input['room_code']);
$nickname = trim($input['nickname']);

if (empty($roomCode) || empty($nickname)) {
    echo json_encode([
        'success' => false,
        'message' => '房间代码和昵称不能为空'
    ]);
    exit;
}

try {
    
    // 获取房间信息
    $stmt = $conn->prepare("
        SELECT * FROM draw_rooms WHERE room_code = ?
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
    
    // 检查用户是否已经在其他房间中
    $checkStmt = $conn->prepare("
        SELECT room_code FROM draw_rooms 
        WHERE (player1_id = ? OR player2_id = ?) AND room_code != ? AND game_status != 'finished'
    ");
    $checkStmt->bind_param("iis", $userId, $userId, $roomCode);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $existingRoom = $result->fetch_assoc();
    $checkStmt->close();
    
    if ($existingRoom) {
        echo json_encode([
            'success' => false,
            'message' => '您已经在其他房间中，请先退出当前房间'
        ]);
        exit;
    }
    
    // 检查用户是否已经在当前房间中
    if ($room['player1_id'] == $userId || $room['player2_id'] == $userId) {
        echo json_encode([
            'success' => true,
            'message' => '已在房间中',
            'position' => $room['player1_id'] == $userId ? 1 : 2
        ]);
        exit;
    }
    
    // 检查房间是否已满
    if ($room['player1_id'] && $room['player2_id']) {
        echo json_encode([
            'success' => false,
            'message' => '房间已满，无法加入'
        ]);
        exit;
    }
    
    // 加入房间
    if (!$room['player1_id']) {
        // 成为玩家1
        $updateStmt = $conn->prepare("
            UPDATE draw_rooms 
            SET player1_id = ?, player1_name = ? 
            WHERE room_code = ?
        ");
        $updateStmt->bind_param("iss", $userId, $nickname, $roomCode);
        $updateStmt->execute();
        $updateStmt->close();
        $position = 1;
    } else {
        // 成为玩家2
        $updateStmt = $conn->prepare("
            UPDATE draw_rooms 
            SET player2_id = ?, player2_name = ? 
            WHERE room_code = ?
        ");
        $updateStmt->bind_param("iss", $userId, $nickname, $roomCode);
        $updateStmt->execute();
        $updateStmt->close();
        $position = 2;
    }
    
    // 添加系统消息
    $msgStmt = $conn->prepare("
        INSERT INTO draw_messages (room_code, user_id, nickname, message, is_system) 
        VALUES (?, 0, 'System', ?, 1)
    ");
    $message = "$nickname 加入了房间！";
    $msgStmt->bind_param("ss", $roomCode, $message);
    $msgStmt->execute();
    $msgStmt->close();
    
    echo json_encode([
        'success' => true,
        'message' => '加入房间成功',
        'position' => $position
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '加入房间失败: ' . $e->getMessage()
    ]);
}

$conn->close();
?>