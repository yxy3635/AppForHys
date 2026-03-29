<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'db_connect.php'; // 引入数据库连接文件

$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;
$response = ['success' => false, 'notifications' => []];

if ($userId === 0) {
    $response['message'] = '缺少用户ID';
    echo json_encode($response);
    exit();
}

$sql = "SELECT id, type, post_id, comment_id, content, is_read, created_at FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
while ($row = $result->fetch_assoc()) {
    $response['notifications'][] = $row;
}
$response['success'] = true;
echo json_encode($response);
?>