<?php
// 必须在最开始就设置CORS头
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization');
header('Access-Control-Max-Age: 86400');

// 处理OPTIONS预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('HTTP/1.1 200 OK');
    exit(0);
}

// 设置内容类型
header('Content-Type: application/json; charset=utf-8');

// 如果是GET请求，返回测试消息
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(['success' => true, 'message' => 'upload_emoji_simple.php 文件正常']);
    exit;
}

// 获取POST原始数据
$rawData = file_get_contents('php://input');
parse_str($rawData, $postData);

$emojiName = trim($postData['name'] ?? '');
$emojiData = $postData['data'] ?? '';

if (empty($emojiName) || empty($emojiData)) {
    echo json_encode(['success' => false, 'message' => '表情名称和文件不能为空']);
    exit;
}

// 验证base64数据
if (!preg_match('/^data:image\/(gif|png|jpeg|jpg|webp);base64,/', $emojiData)) {
    echo json_encode(['success' => false, 'message' => '只支持 GIF、PNG、JPG、WEBP 格式的图片']);
    exit;
}

// 解析base64数据
list($header, $data) = explode(',', $emojiData, 2);
$data = base64_decode($data);

if ($data === false) {
    echo json_encode(['success' => false, 'message' => '文件数据无效']);
    exit;
}

// 检查文件大小 (5MB)
$maxSize = 5 * 1024 * 1024;
if (strlen($data) > $maxSize) {
    echo json_encode(['success' => false, 'message' => '文件大小不能超过5MB']);
    exit;
}

// 获取文件扩展名
preg_match('/^data:image\/([a-zA-Z]+);base64,/', $emojiData, $matches);
$extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];

// 设置目录
$uploadDir = dirname(__DIR__) . '/gif/user_uploads/';
if (!file_exists($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        echo json_encode(['success' => false, 'message' => '无法创建上传目录']);
        exit;
    }
}

// 生成文件名
$fileName = uniqid('user_', true) . '.' . $extension;
$filePath = $uploadDir . $fileName;

// 保存文件
if (file_put_contents($filePath, $data) === false) {
    echo json_encode(['success' => false, 'message' => '文件保存失败']);
    exit;
}

// 更新用户表情信息文件
$emojiInfoFile = dirname(__DIR__) . '/gif/user_emojis.json';
$userEmojis = [];

if (file_exists($emojiInfoFile)) {
    $content = file_get_contents($emojiInfoFile);
    $userEmojis = json_decode($content, true) ?: [];
}

// 添加新表情信息
$userEmojis[] = [
    'file' => $fileName,
    'label' => $emojiName,
    'created_at' => date('Y-m-d H:i:s')
];

// 保存表情信息
if (file_put_contents($emojiInfoFile, json_encode($userEmojis, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) === false) {
    echo json_encode(['success' => false, 'message' => '表情信息保存失败']);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => '上传成功',
    'file' => $fileName,
    'label' => $emojiName
]);
?>