<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 处理 OPTIONS 预检请求
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db_connect.php'; // 引入数据库连接文件

$response = ['success' => false, 'message' => ''];

if (!$conn) {
    $response['message'] = "数据库连接失败。";
    echo json_encode($response);
    exit();
}

// 获取 POST 请求的 JSON 数据
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$commentId = isset($data['comment_id']) ? intval($data['comment_id']) : 0;
$userId = isset($data['user_id']) ? intval($data['user_id']) : 0;

if ($commentId === 0 || $userId === 0) {
    $response['message'] = "缺少必要的评论信息（评论ID或用户ID）。";
    echo json_encode($response);
    $conn->close();
    exit();
}

// 验证用户是否有权限删除此评论
$sqlCheckOwner = "SELECT user_id FROM comments WHERE id = ?";
$stmtCheckOwner = $conn->prepare($sqlCheckOwner);
if (!$stmtCheckOwner) {
    $response['message'] = "SQL 准备失败 (检查评论所有者): " . $conn->error;
    echo json_encode($response);
    $conn->close();
    exit();
}
$stmtCheckOwner->bind_param("i", $commentId);
$stmtCheckOwner->execute();
$resultCheckOwner = $stmtCheckOwner->get_result();

if ($resultCheckOwner->num_rows === 0) {
    $response['message'] = "评论不存在。";
    echo json_encode($response);
    $stmtCheckOwner->close();
    $conn->close();
    exit();
}

$comment = $resultCheckOwner->fetch_assoc();
if ($comment['user_id'] !== $userId) {
    $response['message'] = "您没有权限删除这条评论。";
    echo json_encode($response);
    $stmtCheckOwner->close();
    $conn->close();
    exit();
}
$stmtCheckOwner->close();

// 删除评论
$sqlDelete = "DELETE FROM comments WHERE id = ?";
$stmtDelete = $conn->prepare($sqlDelete);

if (!$stmtDelete) {
    $response['message'] = "SQL 准备失败 (删除评论): " . $conn->error;
    echo json_encode($response);
    $conn->close();
    exit();
}

$stmtDelete->bind_param("i", $commentId);

if ($stmtDelete->execute()) {
    if ($stmtDelete->affected_rows > 0) {
        $response['success'] = true;
        $response['message'] = "评论删除成功！";
    } else {
        $response['message'] = "评论删除失败，评论可能已被删除。";
    }
} else {
    $response['message'] = "评论删除失败: " . $stmtDelete->error;
}

$stmtDelete->close();
$conn->close();

echo json_encode($response);
?>