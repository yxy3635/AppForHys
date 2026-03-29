<?php
// 强化CORS头设置
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: false');
header('Access-Control-Max-Age: 86400');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

require_once __DIR__ . '/../db_connect.php';

try {
    
    // 自动创建表（分别执行每个CREATE TABLE语句）
    $createTable1 = "
    CREATE TABLE IF NOT EXISTS draw_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_code VARCHAR(10) UNIQUE NOT NULL,
        room_name VARCHAR(100) NOT NULL,
        player1_id INT,
        player1_name VARCHAR(50),
        player1_score INT DEFAULT 0,
        player2_id INT,
        player2_name VARCHAR(50),
        player2_score INT DEFAULT 0,
        game_status ENUM('waiting', 'waiting_word', 'playing', 'finished') DEFAULT 'waiting',
        current_round INT DEFAULT 1,
        max_rounds INT DEFAULT 5,
        current_drawer INT,
        current_word VARCHAR(50),
        guess_attempts INT DEFAULT 5,
        round_start_time TIMESTAMP NULL,
        canvas_data LONGTEXT,
        canvas_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )";
    
    $createTable2 = "
    CREATE TABLE IF NOT EXISTS draw_words (
        id INT AUTO_INCREMENT PRIMARY KEY,
        word VARCHAR(50) NOT NULL,
        difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    
    $createTable3 = "
    CREATE TABLE IF NOT EXISTS draw_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_code VARCHAR(10) NOT NULL,
        user_id INT NOT NULL,
        nickname VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_correct TINYINT(1) DEFAULT 0,
        is_system TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_room_code (room_code),
        INDEX idx_created_at (created_at)
    )";
    
    // 分别执行每个CREATE TABLE语句
    $conn->query($createTable1);
    $conn->query($createTable2);
    $conn->query($createTable3);
    
    // 初始化词汇数据（如果表为空）
    $result = $conn->query("SELECT COUNT(*) FROM draw_words");
    $checkWords = $result->fetch_row()[0];
    if ($checkWords == 0) {
        $words = [
            // 简单词汇
            ['苹果', 'easy', '水果'],
            ['太阳', 'easy', '自然'],
            ['汽车', 'easy', '交通'],
            ['房子', 'easy', '建筑'],
            ['猫', 'easy', '动物'],
            ['狗', 'easy', '动物'],
            ['鱼', 'easy', '动物'],
            ['花', 'easy', '植物'],
            ['树', 'easy', '植物'],
            ['月亮', 'easy', '自然'],
            ['星星', 'easy', '自然'],
            ['雨', 'easy', '天气'],
            ['雪', 'easy', '天气'],
            ['山', 'easy', '地理'],
            ['海', 'easy', '地理'],
            
            // 中等词汇
            ['蝴蝶', 'medium', '动物'],
            ['大象', 'medium', '动物'],
            ['长颈鹿', 'medium', '动物'],
            ['企鹅', 'medium', '动物'],
            ['篮球', 'medium', '运动'],
            ['足球', 'medium', '运动'],
            ['游泳', 'medium', '运动'],
            ['钢琴', 'medium', '音乐'],
            ['吉他', 'medium', '音乐'],
            ['彩虹', 'medium', '自然'],
            ['闪电', 'medium', '天气'],
            ['飞机', 'medium', '交通'],
            ['火车', 'medium', '交通'],
            ['城堡', 'medium', '建筑'],
            ['桥梁', 'medium', '建筑'],
            
            // 困难词汇
            ['显微镜', 'hard', '科学'],
            ['望远镜', 'hard', '科学'],
            ['降落伞', 'hard', '物品'],
            ['风车', 'hard', '建筑'],
            ['灯塔', 'hard', '建筑'],
            ['热气球', 'hard', '交通'],
            ['潜水艇', 'hard', '交通'],
            ['龙卷风', 'hard', '天气'],
            ['火山', 'hard', '地理'],
            ['瀑布', 'hard', '地理'],
            ['骆驼', 'hard', '动物'],
            ['熊猫', 'hard', '动物'],
            ['孔雀', 'hard', '动物'],
            ['章鱼', 'hard', '动物'],
            ['仙人掌', 'hard', '植物']
        ];
        
        $stmt = $conn->prepare("INSERT INTO draw_words (word, difficulty, category) VALUES (?, ?, ?)");
        foreach ($words as $word) {
            $stmt->bind_param("sss", $word[0], $word[1], $word[2]);
            $stmt->execute();
        }
        $stmt->close();
    }
    
    // 清理超过24小时的旧房间
    $conn->query("DELETE FROM draw_rooms WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)");
    $conn->query("DELETE FROM draw_messages WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)");
    
    // 获取房间列表
    $stmt = $conn->prepare("
        SELECT 
            room_code,
            room_name,
            player1_name,
            player2_name,
            game_status,
            current_round,
            max_rounds,
            CASE 
                WHEN player1_id IS NOT NULL AND player2_id IS NOT NULL THEN 2
                WHEN player1_id IS NOT NULL OR player2_id IS NOT NULL THEN 1
                ELSE 0
            END as player_count,
            created_at
        FROM draw_rooms 
        ORDER BY created_at DESC
    ");
    
    $stmt->execute();
    $result = $stmt->get_result();
    $rooms = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'rooms' => $rooms
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '获取房间列表失败: ' . $e->getMessage()
    ]);
}

$conn->close();
?>