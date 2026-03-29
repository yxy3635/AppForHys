<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

//允许跨域请求 (仅在开发阶段有用，生产环境请根据需要严格控制)
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

// --- 模拟数据库验证 ---
// 在实际应用中，你会连接到数据库并查询用户表
// 例如：使用 PDO 或 MySQLi

// 示例：硬编码的用户名和密码 (请替换为真实的数据库查询)
// if ($username === 'testuser' && $password === 'testpass') {
//     // 登录成功
//     echo json_encode(['success' => true, 'message' => 'Login successful.', 'user' => ['username' => $username]]);
// } else {
//     // 登录失败
//     echo json_encode(['success' => false, 'message' => 'Invalid username or password.']);
// }

// --- 真实的数据库连接示例 (你需要根据你的数据库类型和配置来完成) ---

try {
    // === 调试信息开始 ===
    // error_log("LOGIN_DEBUG: Attempting login for username: " . $username);
    // error_log("LOGIN_DEBUG: Received password (length): " . strlen($password));
    // === 调试信息结束 ===

    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = :username");
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        // === 调试信息开始 ===
        // error_log("LOGIN_DEBUG: User found in DB. Stored hashed password (first 10 chars): " . substr($user['password'], 0, 10) . "...");
        // error_log("LOGIN_DEBUG: Result of password_verify: " . (password_verify($password, $user['password']) ? 'TRUE' : 'FALSE'));
        // === 调试信息结束 ===

        if (password_verify($password, $user['password'])) {
            // 登录成功 - 确保这里返回了 user['id']
            echo json_encode(['success' => true, 'message' => 'Login successful.', 'user' => ['username' => $user['username'], 'id' => $user['id']]]);
        } else {
            // error_log("LOGIN_DEBUG: password_verify returned FALSE. Invalid password.");
            echo json_encode(['success' => false, 'message' => 'Invalid username or password.']);
        }
    } else {
        // error_log("LOGIN_DEBUG: User not found in DB.");
        echo json_encode(['success' => false, 'message' => 'Invalid username or password.']);
    }
} catch (PDOException $e) {
    // error_log("LOGIN_DEBUG: Database error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}

?>