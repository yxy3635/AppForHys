<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
    require_once __DIR__ . '/../db_connect.php';
    
    // 创建draw_rooms表
    $createRoomsTable = "
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
        game_status ENUM('waiting', 'playing', 'finished') DEFAULT 'waiting',
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

    // 创建draw_words表
    $createWordsTable = "
    CREATE TABLE IF NOT EXISTS draw_words (
        id INT AUTO_INCREMENT PRIMARY KEY,
        word VARCHAR(50) NOT NULL,
        difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";

    // 创建draw_messages表
    $createMessagesTable = "
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

    // 执行创建表的语句
    $results = [];
    
    if ($conn->query($createRoomsTable)) {
        $results['draw_rooms'] = 'OK';
    } else {
        $results['draw_rooms'] = 'ERROR: ' . $conn->error;
    }
    
    if ($conn->query($createWordsTable)) {
        $results['draw_words'] = 'OK';
    } else {
        $results['draw_words'] = 'ERROR: ' . $conn->error;
    }
    
    if ($conn->query($createMessagesTable)) {
        $results['draw_messages'] = 'OK';
    } else {
        $results['draw_messages'] = 'ERROR: ' . $conn->error;
    }
    
    // 初始化词汇数据
    $words_result = $conn->query("SELECT COUNT(*) as count FROM draw_words");
    $word_count = $words_result ? $words_result->fetch_assoc()['count'] : 0;
    
    if ($word_count == 0) {
        $words = [
            ['苹果', 'easy', '水果'], ['太阳', 'easy', '自然'], ['汽车', 'easy', '交通'],
            ['房子', 'easy', '建筑'], ['猫', 'easy', '动物'], ['狗', 'easy', '动物'],
            ['鱼', 'easy', '动物'], ['花', 'easy', '植物'], ['树', 'easy', '植物'],
            ['月亮', 'easy', '自然'], ['星星', 'easy', '自然'], ['雨', 'easy', '天气'],
            ['雪', 'easy', '天气'], ['山', 'easy', '地理'], ['海', 'easy', '地理'],
            ['蝴蝶', 'medium', '动物'], ['大象', 'medium', '动物'], ['长颈鹿', 'medium', '动物'],
            ['篮球', 'medium', '运动'], ['足球', 'medium', '运动'], ['游泳', 'medium', '运动'],
            ['钢琴', 'medium', '音乐'], ['吉他', 'medium', '音乐'], ['彩虹', 'medium', '自然'],
            ['飞机', 'medium', '交通'], ['火车', 'medium', '交通'], ['城堡', 'medium', '建筑']
        ];
        
        $stmt = $conn->prepare("INSERT INTO draw_words (word, difficulty, category) VALUES (?, ?, ?)");
        $inserted = 0;
        
        if ($stmt) {
            foreach ($words as $word) {
                $stmt->bind_param("sss", $word[0], $word[1], $word[2]);
                if ($stmt->execute()) {
                    $inserted++;
                }
            }
            $stmt->close();
        }
        
        $results['words_inserted'] = $inserted;
    } else {
        $results['words_exist'] = $word_count;
    }
    
    echo json_encode([
        'success' => true,
        'message' => '数据库表初始化完成',
        'results' => $results
    ]);
    
    $conn->close();
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
?>