<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db_connect.php';

try {
    // 创建破解版五子棋房间表（如果不存在）
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
    
    $stmt = $conn->prepare("
        SELECT id, room_code, room_name, player1_id, player1_name, player2_id, player2_name, 
               game_status, created_at 
        FROM gomoku_cracked_rooms 
        WHERE game_status IN ('waiting', 'playing')
        ORDER BY created_at DESC
    ");
    $stmt->execute();
    $result = $stmt->get_result();
    
    $rooms = [];
    while ($row = $result->fetch_assoc()) {
        $rooms[] = [
            'id' => intval($row['id']),
            'room_code' => $row['room_code'],
            'room_name' => $row['room_name'],
            'player1_id' => $row['player1_id'] ? intval($row['player1_id']) : null,
            'player1_name' => $row['player1_name'],
            'player2_id' => $row['player2_id'] ? intval($row['player2_id']) : null,
            'player2_name' => $row['player2_name'],
            'game_status' => $row['game_status'],
            'created_at' => $row['created_at']
        ];
    }
    
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
?>