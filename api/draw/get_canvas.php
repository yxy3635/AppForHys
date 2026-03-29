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

if (!isset($_GET['room_code'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少房间代码'
    ]);
    exit;
}

$roomCode = trim($_GET['room_code']);

try {
    
    // 获取画板数据
    $stmt = $conn->prepare("
        SELECT canvas_data, canvas_updated_at 
        FROM draw_rooms 
        WHERE room_code = ?
    ");
    $stmt->bind_param("s", $roomCode);
    $stmt->execute();
    $result = $stmt->get_result();
    $result = $result->fetch_assoc();
    $stmt->close();
    
    if (!$result) {
        echo json_encode([
            'success' => false,
            'message' => '房间不存在'
        ]);
        exit;
    }
    
    echo json_encode([
        'success' => true,
        'canvas_data' => $result['canvas_data'],
        'updated_at' => $result['canvas_updated_at']
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '获取画板数据失败: ' . $e->getMessage()
    ]);
}

$conn->close();
?>