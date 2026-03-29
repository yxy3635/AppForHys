<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 兼容 application/json 的 POST
if (empty($_POST)) {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if ($data && isset($data['user_id'])) {
        $_POST['user_id'] = $data['user_id'];
    }
}

require_once __DIR__ . '/db_connect.php';

$response = ['success' => false, 'message' => ''];

// 从POST数据或会话中获取用户ID
$userId = $_POST['user_id'] ?? null;
if (!$userId) {
    session_start();
    $userId = $_SESSION['user_id'] ?? null;
}

if (!$userId) {
    $response['message'] = '用户未登录';
    echo json_encode($response);
    exit();
}

// 更新用户的最后在线时间
$stmt = $conn->prepare("UPDATE users SET last_online = CURRENT_TIMESTAMP WHERE id = ?");
if ($stmt === false) {
    $response['message'] = '数据库预处理失败: ' . $conn->error;
    echo json_encode($response);
    $conn->close();
    exit();
}

$stmt->bind_param("i", $userId);

if ($stmt->execute()) {
    // 同时更新user_activity表
    try {
        $activity_stmt = $conn->prepare("INSERT INTO user_activity (user_id, last_activity) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE last_activity = NOW()");
        if ($activity_stmt) {
            $activity_stmt->bind_param("i", $userId);
            $activity_stmt->execute();
            $activity_stmt->close();
        }
    } catch (Exception $e) {
        // 如果user_activity表不存在，忽略错误
    }
    
    $response['success'] = true;
    $response['message'] = '在线状态更新成功';
} else {
    $response['message'] = '更新失败: ' . $stmt->error;
}

$stmt->close();
$conn->close();

echo json_encode($response);
?>