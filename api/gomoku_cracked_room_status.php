<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db_connect.php';

$room_code = trim($_GET['room_code'] ?? '');

if (!$room_code) {
    echo json_encode(['success' => false, 'message' => '房间代码不能为空']);
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
    
    echo json_encode([
        'success' => true,
        'room' => [
            'id' => intval($room['id']),
            'room_code' => $room['room_code'],
            'room_name' => $room['room_name'],
            'player1_id' => $room['player1_id'] ? intval($room['player1_id']) : null,
            'player1_name' => $room['player1_name'],
            'player2_id' => $room['player2_id'] ? intval($room['player2_id']) : null,
            'player2_name' => $room['player2_name'],
            'board_state' => $room['board_state'],
            'current_turn' => intval($room['current_turn']),
            'game_status' => $room['game_status'],
            'updated_at' => $room['updated_at']
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '获取房间状态失败: ' . $e->getMessage()
    ]);
}
?>