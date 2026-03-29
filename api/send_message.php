<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db_connect.php';

$data = json_decode(file_get_contents('php://input'), true);

$from_user_id = intval($data['from_user_id'] ?? 0);
$to_user_id = intval($data['to_user_id'] ?? 0);
$content = trim($data['content'] ?? '');

if ($from_user_id && $to_user_id && $content !== '') {
    $stmt = $conn->prepare("INSERT INTO messages (from_user_id, to_user_id, content, created_at) VALUES (?, ?, ?, NOW())");
    $stmt->bind_param("iis", $from_user_id, $to_user_id, $content);
    $success = $stmt->execute();
    $stmt->close();
    echo json_encode(['success' => $success]);
} else {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
}
$conn->close();
?>