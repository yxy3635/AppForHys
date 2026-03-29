<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db_connect.php';

$input = file_get_contents('php://input');
$data = json_decode($input, true);

$user_id = intval($data['user_id'] ?? 0);
$nickname = trim($data['nickname'] ?? '');
$room_name = trim($data['room_name'] ?? '');

if (!$user_id || !$nickname) {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
    exit;
}

try {
    // 确保表存在
    $createTableSQL = "
        CREATE TABLE IF NOT EXISTS gomoku_cracked_rooms (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_code VARCHAR(20) UNIQUE NOT NULL,
            room_name VARCHAR(100) DEFAULT '',
            player1_id INT DEFAULT NULL,
            player1_name VARCHAR(50) DEFAULT '',
            player2_id INT DEFAULT NULL,
            player2_name VARCHAR(50) DEFAULT '',
            board_state TEXT DEFAULT NULL,
            current_turn INT DEFAULT 1,
            game_status ENUM('waiting', 'playing', 'ended') DEFAULT 'waiting',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ";
    $conn->query($createTableSQL);
    
    // 生成房间代码
    $room_code = 'CR' . strtoupper(substr(md5(time() . $user_id . rand()), 0, 8));
    
    $stmt = $conn->prepare("
        INSERT INTO gomoku_cracked_rooms 
        (room_code, room_name, player1_id, player1_name, current_turn, game_status) 
        VALUES (?, ?, ?, ?, 1, 'waiting')
    ");
    $stmt->bind_param("ssis", $room_code, $room_name, $user_id, $nickname);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'room_code' => $room_code,
        'message' => '破解版房间创建成功'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '创建房间失败: ' . $e->getMessage()
    ]);
}
?>