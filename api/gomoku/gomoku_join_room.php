<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../db_connect.php';

$input = json_decode(file_get_contents('php://input'), true);
$user_id = intval($input['user_id'] ?? 0);
$room_code = $input['room_code'] ?? '';

if (!$user_id || !$room_code) {
    echo json_encode(['success' => false, 'message' => '缺少参数']);
    exit();
}

// 检查房间是否存在且未满
$stmt = $conn->prepare("SELECT id, player1_id, player2_id FROM gomoku_rooms WHERE room_code = ?");
$stmt->bind_param("s", $room_code);
$stmt->execute();
$result = $stmt->get_result();
$room = $result->fetch_assoc();
$stmt->close();

if (!$room) {
    echo json_encode(['success' => false, 'message' => '房间不存在']);
    exit();
}
if ($room['player2_id']) {
    echo json_encode(['success' => false, 'message' => '房间已满']);
    exit();
}
if ($room['player1_id'] == $user_id) {
    echo json_encode(['success' => false, 'message' => '不能加入自己的房间']);
    exit();
}

// 加入房间
$stmt = $conn->prepare("UPDATE gomoku_rooms SET player2_id = ? WHERE id = ?");
$stmt->bind_param("ii", $user_id, $room['id']);
if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => '加入房间成功']);
} else {
    echo json_encode(['success' => false, 'message' => '加入房间失败']);
}
$stmt->close();
$conn->close();
?>