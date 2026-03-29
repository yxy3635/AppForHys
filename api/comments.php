<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'db_connect.php'; // 引入数据库连接文件

$response = ['success' => false, 'message' => ''];

// 检查连接是否成功，db_connect.php 已经处理了连接失败的情况，这里只是为了代码的完整性
if (!$conn) {
    $response['message'] = "数据库连接失败。"; // 实际错误信息已在 db_connect.php 中 die
    echo json_encode($response);
    exit();
}

// 获取 post_id 参数
$postId = isset($_GET['post_id']) ? intval($_GET['post_id']) : 0;

if ($postId === 0) {
    $response['message'] = "无效的动态ID。";
    echo json_encode($response);
    $conn->close();
    exit();
}

// 查询评论数据
$sql = "SELECT c.id, c.user_id, u.username, u.avatar_url, c.content, c.created_at
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at DESC"; // 最新评论在前

$stmt = $conn->prepare($sql);
if (!$stmt) {
    $response['message'] = "SQL 准备失败: " . $conn->error;
    echo json_encode($response);
    $conn->close();
    exit();
}

$stmt->bind_param("i", $postId);
$stmt->execute();
$result = $stmt->get_result();

$comments = [];
if ($result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $comments[] = [
            'comment_id' => $row['id'],
            'user_id' => $row['user_id'],
            'user_name' => htmlspecialchars($row['username']),
            'avatar_url' => htmlspecialchars($row['avatar_url']),
            'content' => htmlspecialchars($row['content']),
            'timestamp' => $row['created_at'] // 注意这里前端依然使用 'timestamp' 字段
        ];
    }
    $response['success'] = true;
    $response['comments'] = $comments;
} else {
    $response['success'] = true;
    $response['comments'] = [];
    $response['message'] = "没有找到评论。";
}

$stmt->close();
$conn->close();

echo json_encode($response);
?>