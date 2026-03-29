<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db_connect.php';

$data = json_decode(file_get_contents('php://input'), true);

$user_id = intval($data['user_id'] ?? 0); // 当前登录用户
$peer_id = intval($data['peer_id'] ?? 0); // 对方用户

if ($user_id && $peer_id) {
    $sql = "UPDATE messages SET is_read = 1 
            WHERE to_user_id = $user_id AND from_user_id = $peer_id AND is_read = 0";
    $conn->query($sql);
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
}
$conn->close();
?>