<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db_connect.php';

$input = file_get_contents('php://input');
$data = json_decode($input, true);

$room_code = trim($data['room_code'] ?? '');
$user_id = intval($data['user_id'] ?? 0);
$nickname = trim($data['nickname'] ?? '');

if (!$room_code || !$user_id || !$nickname) {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT * FROM gomoku_cracked_rooms WHERE room_code = ?");
    $stmt->bind_param("s", $room_code);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        echo json_encode(['success' => false, 'message' => '房间不存在']);
        exit;
    }
    
    // 检查是否已经在房间中
    if ($room['player1_id'] == $user_id) {
        echo json_encode(['success' => true, 'message' => '已在房间中', 'position' => 1]);
        exit;
    }
    if ($room['player2_id'] == $user_id) {
        echo json_encode(['success' => true, 'message' => '已在房间中', 'position' => 2]);
        exit;
    }
    
    // 如果player2为空，则加入为player2
    if (!$room['player2_id']) {
        $stmt = $conn->prepare("
            UPDATE gomoku_cracked_rooms 
            SET player2_id = ?, player2_name = ?, game_status = 'playing' 
            WHERE room_code = ?
        ");
        $stmt->bind_param("iss", $user_id, $nickname, $room_code);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => '加入破解版房间成功', 'position' => 2]);
    } else {
        echo json_encode(['success' => false, 'message' => '房间已满']);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '加入房间失败: ' . $e->getMessage()
    ]);
}
?>