<?php
require_once __DIR__ . '/config.php'; // 引入数据库配置文件

// 数据库连接
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// 检查连接
if ($conn->connect_error) {
    die("数据库连接失败: " . $conn->connect_error);
}

// 设置字符集
$conn->set_charset("utf8mb4");

?>