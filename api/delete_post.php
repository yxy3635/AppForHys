<?php
// 设置响应头，允许跨域请求
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// 处理 OPTIONS 请求（CORS 预检）
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 包含数据库配置
include_once 'config.php'; // config.php在同一个目录

// 创建数据库连接
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// 检查连接
if ($conn->connect_error) {
    echo json_encode(["success" => false, "message" => "数据库连接失败: " . $conn->connect_error]);
    exit();
}

// 获取POST数据
$input = json_decode(file_get_contents("php://input"), true);
$postId = $input['post_id'] ?? null;
$userId = $input['user_id'] ?? null;

if (empty($postId) || !is_numeric($postId)) {
    echo json_encode(["success" => false, "message" => "无效的动态ID。"]);
    exit();
}

if (empty($userId) || !is_numeric($userId)) {
    echo json_encode(["success" => false, "message" => "用户ID无效，无法删除动态。"]);
    exit();
}

// 查询动态，并验证用户权限
$stmt = $conn->prepare("SELECT user_id, media_url FROM posts WHERE id = ?");
$stmt->bind_param("i", $postId);
$stmt->execute();
$result = $stmt->get_result();
$post = $result->fetch_assoc();
$stmt->close();

if (!$post) {
    echo json_encode(["success" => false, "message" => "动态不存在。"]);
    exit();
}

if (intval($post['user_id']) !== intval($userId)) {
    echo json_encode(["success" => false, "message" => "无权删除此动态。"]);
    exit();
}

// 如果有媒体文件，解析JSON并删除它们
if (!empty($post['media_url'])) {
    $mediaUrls = json_decode($post['media_url'], true); // 解析JSON字符串
    if (is_array($mediaUrls)) {
        foreach ($mediaUrls as $mediaItem) {
            if (isset($mediaItem['url']) && !empty($mediaItem['url'])) {
                // 确保路径是相对于服务器根目录的正确路径
                $filePath = '../' . $mediaItem['url']; // 假设 uploads 目录在 api 目录的上一级
                if (file_exists($filePath)) {
                    unlink($filePath); // 删除文件
                }
            }
        }
    }
}

// 删除数据库中的动态记录
$stmt = $conn->prepare("DELETE FROM posts WHERE id = ? AND user_id = ?");
$stmt->bind_param("ii", $postId, $userId);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "动态删除成功！"]);
} else {
    echo json_encode(["success" => false, "message" => "动态删除失败: " . $stmt->error]);
}

$stmt->close();
$conn->close();
?>