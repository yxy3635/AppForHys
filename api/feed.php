<?php
// 设置响应头，允许跨域请求
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// 包含数据库配置
include_once 'config.php'; // config.php在同一个目录

// 创建数据库连接
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// 检查连接
if ($conn->connect_error) {
    echo json_encode(['success' => false, 'message' => '数据库连接失败', 'feeds' => []]);
    exit();
}

$feed_data = array();

// 检查是否有post_id参数，如果有，则只获取该动态
if (isset($_GET['post_id']) && !empty($_GET['post_id'])) {
    $postId = intval($_GET['post_id']);
    $stmt = $conn->prepare("SELECT id, user_id, username, content, media_type, media_url, created_at FROM posts WHERE id = ?");
    $stmt->bind_param("i", $postId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $mediaUrls = json_decode($row['media_url'], true); // 解析JSON字符串
        $processedMediaUrls = [];
        if (is_array($mediaUrls)) {
            foreach ($mediaUrls as $mediaItem) {
                if (isset($mediaItem['url'])) {
                    $processedMediaUrls[] = ['url' => 'http://38.207.133.8/' . $mediaItem['url'], 'type' => $mediaItem['type'] ?? ''];
                }
            }
        }

        $feed_data = array( // 返回单个动态作为对象
            "id" => $row['id'],
            "user_id" => $row['user_id'],
            "user" => $row['username'],
            "avatar" => "img/default-avatar.png", // 暂时使用默认头像
            "content" => $row['content'], // 始终返回原始文本内容
            "media_urls" => $processedMediaUrls, // 修改：返回处理后的媒体URL数组
            "type" => $row['media_type'], // 仍然保留media_type，但前端应优先使用media_urls
            "time" => $row['created_at']
        );
    }
    $stmt->close();
    
    // 返回单个动态数据（兼容原有格式）
    echo json_encode($feed_data);
} else {
    // 获取分页参数
    $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 5;
    
    // 确保分页参数有效
    if ($page < 1) $page = 1;
    if ($limit < 1) $limit = 5;
    if ($limit > 50) $limit = 50; // 限制最大每页数量，防止过载
    
    // 计算偏移量
    $offset = ($page - 1) * $limit;
    
    // 首先获取总数
    $countSql = "SELECT COUNT(*) as total FROM posts";
    $countResult = $conn->query($countSql);
    $totalCount = 0;
    if ($countResult->num_rows > 0) {
        $countRow = $countResult->fetch_assoc();
        $totalCount = intval($countRow['total']);
    }
    
    // 计算总页数
    $totalPages = ceil($totalCount / $limit);
    
    // 查询分页数据，按时间降序排列
    $sql = "SELECT id, user_id, username, content, media_type, media_url, created_at 
            FROM posts 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $limit, $offset);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $mediaUrls = json_decode($row['media_url'], true); // 解析JSON字符串
            $processedMediaUrls = [];
            if (is_array($mediaUrls)) {
                foreach ($mediaUrls as $mediaItem) {
                    if (isset($mediaItem['url'])) {
                        $processedMediaUrls[] = ['url' => 'http://38.207.133.8/' . $mediaItem['url'], 'type' => $mediaItem['type'] ?? ''];
                    }
                }
            }

            $feed_data[] = array(
                "id" => $row['id'],
                "user_id" => $row['user_id'],
                "user" => $row['username'],
                "avatar" => "img/default-avatar.png", // 暂时使用默认头像
                "content" => $row['content'], // 始终返回原始文本内容
                "media_urls" => $processedMediaUrls, // 修改：返回处理后的媒体URL数组
                "type" => $row['media_type'], // 仍然保留media_type，但前端应优先使用media_urls
                "time" => $row['created_at']
            );
        }
    }
    $stmt->close();
    
    // 返回分页格式的数据
    $response = array(
        'success' => true,
        'feeds' => $feed_data,
        'pagination' => array(
            'page' => $page,
            'limit' => $limit,
            'total' => $totalCount,
            'pages' => $totalPages,
            'has_next' => $page < $totalPages,
            'has_prev' => $page > 1
        )
    );
    
    echo json_encode($response);
}

$conn->close();
?>