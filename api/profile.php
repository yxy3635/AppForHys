<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/db_connect.php';

$response = ['success' => false, 'message' => ''];

if (!isset($_GET['user_id'])) {
    $response['message'] = '用户ID缺失。';
    echo json_encode($response);
    $conn->close();
    exit();
}

$userId = intval($_GET['user_id']);

// 使用预处理语句查询用户资料
$stmt = $conn->prepare("SELECT id, username, signature, avatar_url, last_online, created_at FROM users WHERE id = ?");
if ($stmt === false) {
    $response['message'] = '数据库预处理失败: ' . $conn->error;
    echo json_encode($response);
    $conn->close();
    exit();
}

$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $foundUser = $result->fetch_assoc();
    // 提供默认值
    $foundUser['signature'] = $foundUser['signature'] ?? '欢迎来到我的个人主页！';
    
    // 构建完整的头像 URL
    $base_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://" . $_SERVER['HTTP_HOST'] . "/";
    $foundUser['avatar_url'] = $foundUser['avatar_url'] ? $base_url . $foundUser['avatar_url'] : $base_url . 'img/default-avatar.png';

    $response['success'] = true;
    $response['message'] = '个人资料获取成功。';
    $response['user'] = $foundUser;
} else {
    $response['message'] = '未找到该用户。';
}

$stmt->close();
$conn->close();

echo json_encode($response);
?>