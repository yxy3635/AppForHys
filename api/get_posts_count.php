<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// 引入数据库连接
require_once __DIR__ . '/db_connect.php';

try {
    $sql = "SELECT COUNT(*) as total FROM posts";
    $result = $conn->query($sql);
    
    if ($result) {
        $row = $result->fetch_assoc();
        echo json_encode([
            "success" => true,
            "total_posts" => (int)$row['total']
        ]);
    } else {
        throw new Exception("查询失败: " . $conn->error);
    }
    
} catch(Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "查询失败: " . $e->getMessage()
    ]);
}

$conn->close();
?> 