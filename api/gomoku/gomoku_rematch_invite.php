<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../db_connect.php';

$input = json_decode(file_get_contents('php://input'), true);
$from_user_id = intval($input['from_user_id'] ?? 0);
$to_user_id = intval($input['to_user_id'] ?? 0);
$old_room_code = $input['old_room_code'] ?? '';
$from_username = $input['from_username'] ?? '';

if (!$from_user_id || !$to_user_id || !$old_room_code || !$from_username) {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
    exit();
}

// 创建新房间
$room_code = substr(md5(uniqid(mt_rand(), true)), 0, 8);
$empty_board = array_fill(0, 15, array_fill(0, 15, 0));
$board_state = json_encode($empty_board);

$stmt = $conn->prepare("INSERT INTO gomoku_rooms (room_code, player1_id, board_state, current_turn) VALUES (?, ?, ?, 1)");
$stmt->bind_param("sis", $room_code, $from_user_id, $board_state);
if (!$stmt->execute()) {
    echo json_encode(['success' => false, 'message' => '新房间创建失败']);
    exit();
}
$stmt->close();

// 插入邀请记录
$stmt2 = $conn->prepare("INSERT INTO gomoku_rematch_invite (from_user_id, to_user_id, old_room_code, new_room_code, status) VALUES (?, ?, ?, ?, 'pending')");
$stmt2->bind_param("iiss", $from_user_id, $to_user_id, $old_room_code, $room_code);
if ($stmt2->execute()) {
    echo json_encode(['success' => true, 'new_room_code' => $room_code]);
} else {
    echo json_encode(['success' => false, 'message' => '邀请记录失败']);
}
$stmt2->close();
$conn->close();
?>