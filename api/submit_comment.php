<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'db_connect.php'; // 引入数据库连接文件

$response = ['success' => false, 'message' => ''];

// 检查连接是否成功
if (!$conn) {
    $response['message'] = "数据库连接失败。";
    echo json_encode($response);
    exit();
}

// 获取 POST 请求的 JSON 数据
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// 调试用：记录收到的原始数据（可选，调试后可删除）
// file_put_contents('/tmp/comment_debug.log', var_export($data, true), FILE_APPEND);

$postId = isset($data['post_id']) ? intval($data['post_id']) : 0;
$userId = isset($data['user_id']) ? intval($data['user_id']) : 0;
$currentUsername = isset($data['user_name']) ? trim($data['user_name']) : '';
$parentCommentId = isset($data['parent_comment_id']) ? intval($data['parent_comment_id']) : 0;
// content类型防御：如果是数组则拼接为字符串
$content = '';
if (isset($data['content'])) {
    if (is_array($data['content'])) {
        $content = trim(implode('', $data['content']));
    } else {
        $content = trim($data['content']);
    }
}

// 调试：把收到的原始数据和content内容返回给前端
$response['debug'] = [
    'data' => $data,
    'content' => $content
]; 

// 插入评论数据
$sql = "INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())"; // 使用 created_at
$stmt = $conn->prepare($sql);

if (!$stmt) {
    $response['message'] = "SQL 准备失败: " . $conn->error;
    echo json_encode($response);
    $conn->close();
    exit();
}

$stmt->bind_param("iis", $postId, $userId, $content);

if ($stmt->execute()) {
    $response['success'] = true;
    $response['message'] = "评论发表成功！";
    $response['comment_id'] = $conn->insert_id;

    // 新增：如果是回复别人的评论，生成通知
    if (!empty($parentCommentId)) {
        // 查询被回复的评论所属用户
        $sql2 = "SELECT user_id FROM comments WHERE id = ?";
        $stmt2 = $conn->prepare($sql2);
        $stmt2->bind_param("i", $parentCommentId);
        $stmt2->execute();
        $stmt2->bind_result($targetUserId);
        if ($stmt2->fetch() && $targetUserId != $userId) { // 不提醒自己
            $stmt2->close();
            // 插入通知
            $notifySql = "INSERT INTO notifications (user_id, type, post_id, comment_id, content) VALUES (?, 'reply', ?, ?, ?)";
            $notifyStmt = $conn->prepare($notifySql);
            $notifyContent = $currentUsername . " 回复了你：" . $content;
            $notifyStmt->bind_param("iiis", $targetUserId, $postId, $parentCommentId, $notifyContent);
            $notifyStmt->execute();
            $notifyStmt->close();
        } else {
            $stmt2->close();
        }
    } else {
        // 主评论，通知动态作者
        $sql3 = "SELECT user_id FROM posts WHERE id = ?";
        $stmt3 = $conn->prepare($sql3);
        $stmt3->bind_param("i", $postId);
        $stmt3->execute();
        $stmt3->bind_result($postOwnerId);
        if ($stmt3->fetch() && $postOwnerId != $userId) { // 不提醒自己
            $stmt3->close();
            $notifySql = "INSERT INTO notifications (user_id, type, post_id, comment_id, content) VALUES (?, 'comment', ?, NULL, ?)";
            $notifyStmt = $conn->prepare($notifySql);
            $notifyContent = $currentUsername . " 评论了你的动态：" . $content;
            $notifyStmt->bind_param("iis", $postOwnerId, $postId, $notifyContent);
            $notifyStmt->execute();
            $notifyStmt->close();
        } else {
            $stmt3->close();
        }
    }
} else {
    $response['message'] = "评论发表失败: " . $stmt->error;
}

$stmt->close();
$conn->close();

echo json_encode($response);
?>