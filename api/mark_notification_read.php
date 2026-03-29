<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'db_connect.php'; // 引入数据库连接文件

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$response = ['success' => false];

if ($id === 0) {
    $response['message'] = '缺少通知ID';
    echo json_encode($response);
    exit();
}

$sql = "UPDATE notifications SET is_read = 1 WHERE id = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $id);
if ($stmt->execute()) {
    $response['success'] = true;
} else {
    $response['message'] = '更新失败';
}
echo json_encode($response);
?>