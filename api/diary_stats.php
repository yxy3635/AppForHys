<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '只支持GET请求']);
    exit();
}

try {
    $user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    
    if (!$user_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '缺少用户ID']);
        exit();
    }
    
    // 获取总手记数
    $total_sql = "SELECT COUNT(*) as total FROM diaries WHERE user_id = ?";
    $total_stmt = $conn->prepare($total_sql);
    $total_stmt->bind_param('i', $user_id);
    $total_stmt->execute();
    $total_result = $total_stmt->get_result();
    $total = $total_result->fetch_assoc()['total'];
    
    // 获取本月手记数
    $month_sql = "SELECT COUNT(*) as month_count FROM diaries WHERE user_id = ? AND YEAR(created_at) = YEAR(CURRENT_DATE()) AND MONTH(created_at) = MONTH(CURRENT_DATE())";
    $month_stmt = $conn->prepare($month_sql);
    $month_stmt->bind_param('i', $user_id);
    $month_stmt->execute();
    $month_result = $month_stmt->get_result();
    $month_count = $month_result->fetch_assoc()['month_count'];
    
    // 获取本周手记数
    $week_sql = "SELECT COUNT(*) as week_count FROM diaries WHERE user_id = ? AND YEARWEEK(created_at, 1) = YEARWEEK(CURRENT_DATE(), 1)";
    $week_stmt = $conn->prepare($week_sql);
    $week_stmt->bind_param('i', $user_id);
    $week_stmt->execute();
    $week_result = $week_stmt->get_result();
    $week_count = $week_result->fetch_assoc()['week_count'];
    
    // 获取今日手记数
    $today_sql = "SELECT COUNT(*) as today_count FROM diaries WHERE user_id = ? AND DATE(created_at) = CURRENT_DATE()";
    $today_stmt = $conn->prepare($today_sql);
    $today_stmt->bind_param('i', $user_id);
    $today_stmt->execute();
    $today_result = $today_stmt->get_result();
    $today_count = $today_result->fetch_assoc()['today_count'];
    
    // 获取心情统计
    $mood_sql = "SELECT mood, COUNT(*) as count FROM diaries WHERE user_id = ? GROUP BY mood ORDER BY count DESC";
    $mood_stmt = $conn->prepare($mood_sql);
    $mood_stmt->bind_param('i', $user_id);
    $mood_stmt->execute();
    $mood_result = $mood_stmt->get_result();
    
    $mood_stats = [];
    while ($row = $mood_result->fetch_assoc()) {
        $mood_stats[] = [
            'mood' => $row['mood'],
            'count' => (int)$row['count']
        ];
    }
    
    // 获取标签统计
    $tag_sql = "SELECT tags FROM diaries WHERE user_id = ? AND tags IS NOT NULL AND tags != ''";
    $tag_stmt = $conn->prepare($tag_sql);
    $tag_stmt->bind_param('i', $user_id);
    $tag_stmt->execute();
    $tag_result = $tag_stmt->get_result();
    
    $tag_counts = [];
    while ($row = $tag_result->fetch_assoc()) {
        $tags = json_decode($row['tags'], true);
        if (is_array($tags)) {
            foreach ($tags as $tag) {
                if (!empty($tag)) {
                    $tag_counts[$tag] = isset($tag_counts[$tag]) ? $tag_counts[$tag] + 1 : 1;
                }
            }
        }
    }
    
    // 按使用次数排序标签
    arsort($tag_counts);
    $top_tags = array_slice($tag_counts, 0, 10, true);
    
    echo json_encode([
        'success' => true,
        'stats' => [
            'total' => (int)$total,
            'this_month' => (int)$month_count,
            'this_week' => (int)$week_count,
            'today' => (int)$today_count,
            'mood_stats' => $mood_stats,
            'top_tags' => $top_tags
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()]);
}
?> 