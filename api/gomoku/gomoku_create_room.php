<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../db_connect.php';

$input = json_decode(file_get_contents('php://input'), true);
$user_id = intval($input['user_id'] ?? 0);

if (!$user_id) {
    echo json_encode(['success' => false, 'message' => '缺少用户ID']);
    exit();
}

// 生成唯一房间号
$room_code = substr(md5(uniqid(mt_rand(), true)), 0, 8);

// 15x15空棋盘
$empty_board = array_fill(0, 15, array_fill(0, 15, 0));
$board_state = json_encode($empty_board);

$stmt = $conn->prepare("INSERT INTO gomoku_rooms (room_code, player1_id, board_state, current_turn) VALUES (?, ?, ?, 1)");
$stmt->bind_param("sis", $room_code, $user_id, $board_state);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'room_code' => $room_code
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => '房间创建失败'
    ]);
}
$stmt->close();
$conn->close();
?>