<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../db_connect.php';

try{
  $conn->query("CREATE TABLE IF NOT EXISTS shoot_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_code VARCHAR(10) UNIQUE NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    player1_id INT, player1_name VARCHAR(50), player1_score INT DEFAULT 0,
    player2_id INT, player2_name VARCHAR(50), player2_score INT DEFAULT 0,
    game_status ENUM('waiting','waiting_set','asking','finished') DEFAULT 'waiting',
    shooter_id INT,
    category VARCHAR(20),
    secret_word VARCHAR(50),
    current_round INT DEFAULT 1,
    chances_left INT DEFAULT 15,
    turn_deadline TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  $conn->query("CREATE TABLE IF NOT EXISTS shoot_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_code VARCHAR(10) NOT NULL,
    role ENUM('asker','shooter','system') NOT NULL,
    type VARCHAR(20) DEFAULT 'text',
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(room_code), INDEX(created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  $stmt=$conn->prepare("SELECT room_code, room_name, player1_id, player1_name, player2_id, player2_name, game_status, current_round FROM shoot_rooms ORDER BY created_at DESC");
  $stmt->execute(); $rooms=$stmt->get_result()->fetch_all(MYSQLI_ASSOC); $stmt->close();
  echo json_encode(['success'=>true,'rooms'=>$rooms]);
}catch(Exception $e){ echo json_encode(['success'=>false,'message'=>'获取房间失败: '.$e->getMessage()]); }
?>


