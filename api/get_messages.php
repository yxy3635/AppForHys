<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db_connect.php';

$user_id = intval($_GET['user_id'] ?? 0); // 当前登录用户
$peer_id = intval($_GET['peer_id'] ?? 0); // 对方用户
// 新增分页参数：每次返回条数与游标（取更早的消息）
$limit = intval($_GET['limit'] ?? 50);
$before_id = isset($_GET['before_id']) ? intval($_GET['before_id']) : null;

// 限制每次最大条数，防止过载
if ($limit < 1) { $limit = 50; }
if ($limit > 200) { $limit = 200; }

if ($user_id && $peer_id) {
    // 构建基础条件：双方会话
    $baseWhere = "(from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)";

    // 如果带了 before_id，则只取该ID之前（更早）的消息，便于上拉加载更多
    if ($before_id) {
        $sql = "SELECT * FROM (
                    SELECT * FROM messages
                    WHERE ($baseWhere) AND id < ?
                    ORDER BY id DESC
                    LIMIT ?
                ) AS recent
                ORDER BY id ASC";
        $stmt = $conn->prepare($sql);
        // 参数顺序：user_id, peer_id, peer_id, user_id, before_id, limit
        $stmt->bind_param("iiiiii", $user_id, $peer_id, $peer_id, $user_id, $before_id, $limit);
    } else {
        // 首次加载：取最新的 limit 条
        $sql = "SELECT * FROM (
                    SELECT * FROM messages
                    WHERE $baseWhere
                    ORDER BY id DESC
                    LIMIT ?
                ) AS recent
                ORDER BY id ASC";
        $stmt = $conn->prepare($sql);
        // 参数顺序：user_id, peer_id, peer_id, user_id, limit
        $stmt->bind_param("iiiii", $user_id, $peer_id, $peer_id, $user_id, $limit);
    }

    if ($stmt && $stmt->execute()) {
        $result = $stmt->get_result();
        $messages = [];
        while ($row = $result->fetch_assoc()) {
            // 增加unread字段：仅对“对方发来的且未读”的消息为true
            $row['unread'] = ($row['from_user_id'] == $peer_id && $row['to_user_id'] == $user_id && intval($row['is_read']) === 0) ? true : false;
            $messages[] = $row;
        }

        // 计算是否还有更早的消息
        $has_more = false;
        if (!empty($messages)) {
            $oldest_id = $messages[0]['id'];
            $countSql = "SELECT 1 FROM messages WHERE ($baseWhere) AND id < ? LIMIT 1";
            $countStmt = $conn->prepare($countSql);
            $countStmt->bind_param("iiiii", $user_id, $peer_id, $peer_id, $user_id, $oldest_id);
            $countStmt->execute();
            $countResult = $countStmt->get_result();
            $has_more = $countResult && $countResult->num_rows > 0;
            $countStmt->close();
        }

        echo json_encode(['success' => true, 'messages' => $messages, 'has_more' => $has_more], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['success' => false, 'message' => '查询失败'], JSON_UNESCAPED_UNICODE);
    }
    if ($stmt) { $stmt->close(); }
} else {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
}
$conn->close();
?>