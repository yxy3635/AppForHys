<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../db_connect.php';

$user_id = intval($_GET['user_id'] ?? 0);

if (!$user_id) {
    echo json_encode(['success' => false, 'message' => '缺少用户ID']);
    exit();
}

// 查询未处理的邀请
$sql = "SELECT * FROM gomoku_rematch_invite WHERE to_user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();
$invite = $result->fetch_assoc();
$stmt->close();

if ($invite) {
    echo json_encode(['success' => true, 'invite' => $invite]);
} else {
    echo json_encode(['success' => true, 'invite' => null]);
}
$conn->close();
?>