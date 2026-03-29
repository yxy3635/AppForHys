<?php
// 获取词库中的词语
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

try {
    require_once __DIR__ . '/../db_connect.php';
    
    // 从每个难度等级随机选择3个词语
    $words = [];
    $difficulties = ['easy', 'medium', 'hard'];
    
    foreach ($difficulties as $difficulty) {
        $stmt = $conn->prepare("SELECT word FROM draw_words WHERE difficulty = ? ORDER BY RAND() LIMIT 3");
        if ($stmt) {
            $stmt->bind_param("s", $difficulty);
            $stmt->execute();
            $result = $stmt->get_result();
            
            while ($row = $result->fetch_assoc()) {
                $words[] = [
                    'word' => $row['word'],
                    'difficulty' => $difficulty
                ];
            }
            $stmt->close();
        }
    }
    
    // 如果词库为空，提供默认词语
    if (empty($words)) {
        $defaultWords = [
            ['word' => '苹果', 'difficulty' => 'easy'],
            ['word' => '太阳', 'difficulty' => 'easy'],
            ['word' => '汽车', 'difficulty' => 'easy'],
            ['word' => '篮球', 'difficulty' => 'medium'],
            ['word' => '彩虹', 'difficulty' => 'medium'],
            ['word' => '飞机', 'difficulty' => 'medium'],
            ['word' => '城堡', 'difficulty' => 'hard'],
            ['word' => '风车', 'difficulty' => 'hard'],
            ['word' => '瀑布', 'difficulty' => 'hard']
        ];
        $words = $defaultWords;
    }
    
    echo json_encode([
        'success' => true,
        'words' => $words
    ]);
    
    $conn->close();
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '获取词语失败: ' . $e->getMessage()
    ]);
}
?>