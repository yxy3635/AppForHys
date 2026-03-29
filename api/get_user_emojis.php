<?php
// 必须在最开始设置CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization');
header('Access-Control-Max-Age: 86400');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('HTTP/1.1 200 OK');
    exit(0);
}

// 设置内容类型
header('Content-Type: application/json; charset=utf-8');

$emojiInfoFile = dirname(__DIR__) . '/gif/user_emojis.json';
$userEmojis = [];

if (file_exists($emojiInfoFile)) {
    $content = file_get_contents($emojiInfoFile);
    $userEmojis = json_decode($content, true) ?: [];
}

http_response_code(200);
echo json_encode(['success' => true, 'emojis' => $userEmojis]);
?>