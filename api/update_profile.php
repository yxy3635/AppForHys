<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/db_connect.php'; // 引入数据库连接文件

$response = ['success' => false, 'message' => ''];

$userId = isset($_POST['user_id']) ? intval($_POST['user_id']) : 0;
$username = isset($_POST['username']) ? trim($_POST['username']) : '';
$signature = isset($_POST['signature']) ? trim($_POST['signature']) : '';

if (!$userId || empty($username)) {
    $response['message'] = '用户ID或用户名缺失。';
    echo json_encode($response);
    $conn->close();
    exit();
}

// 使用预处理语句更新用户资料
$stmt = $conn->prepare("UPDATE users SET username = ?, signature = ? WHERE id = ?");
if ($stmt === false) {
    $response['message'] = '数据库预处理失败: ' . $conn->error;
    echo json_encode($response);
    $conn->close();
    exit();
}

$stmt->bind_param("ssi", $username, $signature, $userId); // "ssi" 表示字符串、字符串、整数
$stmt->execute();

if ($stmt->affected_rows > 0) {
    $response['success'] = true;
    $response['message'] = '个人资料更新成功。';
} else if ($stmt->affected_rows === 0) {
    $response['success'] = true; // 即使没有行被修改，也认为是成功（数据未变）
    $response['message'] = '个人资料没有变化。';
}
else {
    $response['message'] = '个人资料更新失败: ' . $stmt->error;
}

$stmt->close();
$conn->close();

echo json_encode($response);
?>