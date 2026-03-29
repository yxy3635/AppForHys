<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../db_connect.php';

$input = json_decode(file_get_contents('php://input'), true);
$invite_id = intval($input['invite_id'] ?? 0);
$action = $input['action'] ?? ''; // 'accept' or 'reject'

if (!$invite_id || !in_array($action, ['accept', 'reject'])) {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
    exit();
}

$status = $action === 'accept' ? 'accepted' : 'rejected';

$stmt = $conn->prepare("UPDATE gomoku_rematch_invite SET status = ? WHERE id = ?");
$stmt->bind_param("si", $status, $invite_id);
if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => '操作失败']);
}
$stmt->close();
$conn->close();
?>