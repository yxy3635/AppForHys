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

if (!$input || !isset($input['user_id'], $input['room_name'], $input['nickname'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少必要参数'
    ]);
    exit;
}

$userId = (int)$input['user_id'];
$roomName = trim($input['room_name']);
$nickname = trim($input['nickname']);

if (empty($roomName) || empty($nickname)) {
    echo json_encode([
        'success' => false,
        'message' => '房间名称和昵称不能为空'
    ]);
    exit;
}

try {
    
    // 检查用户是否已经在其他房间中
    $checkStmt = $conn->prepare("
        SELECT room_code FROM draw_rooms 
        WHERE (player1_id = ? OR player2_id = ?) AND game_status != 'finished'
    ");
    $checkStmt->bind_param("ii", $userId, $userId);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $existingRoom = $result->fetch_assoc();
    $checkStmt->close();
    
    if ($existingRoom) {
        echo json_encode([
            'success' => false,
            'message' => '您已经在房间中，请先退出当前房间'
        ]);
        exit;
    }
    
    // 生成房间代码
    do {
        $roomCode = strtoupper(substr(str_shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 6));
        $stmt = $conn->prepare("SELECT COUNT(*) FROM draw_rooms WHERE room_code = ?");
        $stmt->bind_param("s", $roomCode);
        $stmt->execute();
        $result = $stmt->get_result();
        $exists = $result->fetch_row()[0];
        $stmt->close();
    } while ($exists > 0);
    
    // 创建房间
    $stmt = $conn->prepare("
        INSERT INTO draw_rooms (
            room_code, room_name, player1_id, player1_name, 
            game_status, created_at
        ) VALUES (?, ?, ?, ?, 'waiting', NOW())
    ");
    
    $stmt->bind_param("ssis", $roomCode, $roomName, $userId, $nickname);
    $stmt->execute();
    $stmt->close();
    
    // 添加系统消息
    $message = "房间创建成功！等待其他玩家加入...";
    $msgStmt = $conn->prepare("
        INSERT INTO draw_messages (room_code, user_id, nickname, message, is_system) 
        VALUES (?, 0, 'System', ?, 1)
    ");
    $msgStmt->bind_param("ss", $roomCode, $message);
    $msgStmt->execute();
    $msgStmt->close();
    
    echo json_encode([
        'success' => true,
        'room_code' => $roomCode,
        'message' => '房间创建成功'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '创建房间失败: ' . $e->getMessage()
    ]);
}

$conn->close();
?>