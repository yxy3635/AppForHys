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

if (!$room_code || !$user_id) {
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
    
    // 检查是否是房间内的玩家
    if ($room['player1_id'] != $user_id && $room['player2_id'] != $user_id) {
        echo json_encode(['success' => false, 'message' => '你不在此房间中']);
        exit;
    }
    
    // 结束游戏
    $stmt = $conn->prepare("
        UPDATE gomoku_cracked_rooms 
        SET game_status = 'ended', updated_at = CURRENT_TIMESTAMP
        WHERE room_code = ?
    ");
    $stmt->bind_param("s", $room_code);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => '游戏已主动结束'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '结束游戏失败: ' . $e->getMessage()
    ]);
}
?>