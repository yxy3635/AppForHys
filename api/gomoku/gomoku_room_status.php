<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../db_connect.php';

$room_code = $_GET['room_code'] ?? '';

if (!$room_code) {
    echo json_encode(['success' => false, 'message' => '缺少房间号']);
    exit();
}

$stmt = $conn->prepare("SELECT id, player1_id, player2_id, board_state, current_turn, winner FROM gomoku_rooms WHERE room_code = ?");
$stmt->bind_param("s", $room_code);
$stmt->execute();
$result = $stmt->get_result();
$room = $result->fetch_assoc();
$stmt->close();

if (!$room) {
    echo json_encode(['success' => false, 'message' => '房间不存在']);
    exit();
}

echo json_encode([
    'success' => true,
    'room' => $room
]);
$conn->close();
?>