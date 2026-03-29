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
    
    // 清空棋盘，重置为空的15x15数组
    $empty_board = array_fill(0, 15, array_fill(0, 15, 0));
    $board_json = json_encode($empty_board);
    
    $stmt = $conn->prepare("
        UPDATE gomoku_cracked_rooms 
        SET board_state = ?, current_turn = 1, updated_at = CURRENT_TIMESTAMP
        WHERE room_code = ?
    ");
    $stmt->bind_param("ss", $board_json, $room_code);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => '棋盘已清空，重新开始'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '清空棋盘失败: ' . $e->getMessage()
    ]);
}
?>