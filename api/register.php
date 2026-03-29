<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

// 允许跨域请求 (仅在开发阶段有用，生产环境请根据需要严格控制)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 如果是 OPTIONS 请求，直接返回，用于 CORS 预检
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 确保请求方法是 POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

// 获取前端发送的 JSON 数据
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$username = $data['username'] ?? '';
$password = $data['password'] ?? '';

// 验证输入
if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Username and password are required.']);
    exit();
}

// 密码哈希
$hashed_password = password_hash($password, PASSWORD_DEFAULT);

// 数据库连接和插入
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 检查用户名是否已存在
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = :username");
    $stmt->execute(['username' => $username]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Username already exists.']);
        exit();
    }

    // 插入新用户
    $stmt = $pdo->prepare("INSERT INTO users (username, password) VALUES (:username, :password)");
    $stmt->execute([
        'username' => $username,
        'password' => $hashed_password
    ]);

    echo json_encode(['success' => true, 'message' => 'Registration successful.']);

} catch (PDOException $e) {
    // 数据库错误
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    // 其他错误
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}
?>