<?php
// 简单的PHP测试文件
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$response = [
    'success' => true,
    'message' => 'PHP is working!',
    'server_info' => [
        'php_version' => PHP_VERSION,
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'request_method' => $_SERVER['REQUEST_METHOD'],
        'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? 'Unknown',
        'server_time' => date('Y-m-d H:i:s'),
        'timezone' => date_default_timezone_get()
    ],
    'test_data' => [
        'timestamp' => time(),
        'random_number' => rand(1, 1000),
        'memory_usage' => function_exists('memory_get_usage') ? formatBytes(memory_get_usage(true)) : 'N/A'
    ]
];

echo json_encode($response, JSON_UNESCAPED_UNICODE);

function formatBytes($bytes, $precision = 2) {
    $units = array('B', 'KB', 'MB', 'GB', 'TB');
    
    for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
        $bytes /= 1024;
    }
    
    return round($bytes, $precision) . ' ' . $units[$i];
}
?> 