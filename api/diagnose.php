<?php
// 服务器诊断脚本
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$diagnosis = [
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'server_info' => [],
    'file_info' => [],
    'database_info' => [],
    'recommendations' => []
];

// 1. 基本服务器信息
$diagnosis['server_info'] = [
    'php_version' => PHP_VERSION,
    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    'server_name' => $_SERVER['SERVER_NAME'] ?? 'Unknown',
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
    'script_filename' => $_SERVER['SCRIPT_FILENAME'] ?? 'Unknown',
    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'Unknown',
    'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? 'Unknown',
    'timezone' => date_default_timezone_get(),
    'memory_limit' => ini_get('memory_limit'),
    'max_execution_time' => ini_get('max_execution_time'),
    'display_errors' => ini_get('display_errors'),
    'error_reporting' => ini_get('error_reporting')
];

// 2. 文件系统检查
$current_dir = __DIR__;
$diagnosis['file_info'] = [
    'current_directory' => $current_dir,
    'current_file' => __FILE__,
    'file_exists' => file_exists(__FILE__),
    'is_readable' => is_readable(__FILE__),
    'directory_writable' => is_writable($current_dir),
    'parent_directory' => dirname($current_dir),
    'parent_writable' => is_writable(dirname($current_dir))
];

// 3. 检查关键文件
$key_files = [
    'db_connect.php',
    'config.php',
    'server_status.php',
    'test_php.php'
];

$diagnosis['file_info']['key_files'] = [];
foreach ($key_files as $file) {
    $file_path = $current_dir . '/' . $file;
    $diagnosis['file_info']['key_files'][$file] = [
        'exists' => file_exists($file_path),
        'readable' => is_readable($file_path),
        'size' => file_exists($file_path) ? filesize($file_path) : 0,
        'path' => $file_path
    ];
}

// 4. 数据库连接测试
try {
    if (file_exists($current_dir . '/db_connect.php')) {
        require_once 'db_connect.php';
        
        if (isset($conn) && $conn instanceof mysqli) {
            $diagnosis['database_info'] = [
                'connection_status' => 'connected',
                'server_info' => $conn->server_info,
                'host_info' => $conn->host_info,
                'stat' => $conn->stat
            ];
            
            // 测试查询
            $result = $conn->query('SELECT 1 as test');
            if ($result) {
                $diagnosis['database_info']['test_query'] = 'success';
            } else {
                $diagnosis['database_info']['test_query'] = 'failed';
            }
        } else {
            $diagnosis['database_info'] = [
                'connection_status' => 'failed',
                'error' => 'Database connection not established'
            ];
        }
    } else {
        $diagnosis['database_info'] = [
            'connection_status' => 'skipped',
            'reason' => 'db_connect.php not found'
        ];
    }
} catch (Exception $e) {
    $diagnosis['database_info'] = [
        'connection_status' => 'error',
        'error' => $e->getMessage()
    ];
}

// 5. 系统功能检查
$diagnosis['system_functions'] = [
    'memory_get_usage' => function_exists('memory_get_usage'),
    'sys_getloadavg' => function_exists('sys_getloadavg'),
    'disk_free_space' => function_exists('disk_free_space'),
    'disk_total_space' => function_exists('disk_total_space'),
    'microtime' => function_exists('microtime')
];

// 6. 提供建议
$recommendations = [];

if (!$diagnosis['file_info']['key_files']['db_connect.php']['exists']) {
    $recommendations[] = '缺少数据库连接文件 db_connect.php';
}

if (!$diagnosis['file_info']['key_files']['config.php']['exists']) {
    $recommendations[] = '缺少配置文件 config.php';
}

if ($diagnosis['database_info']['connection_status'] === 'failed') {
    $recommendations[] = '数据库连接失败，请检查数据库配置';
}

if (!$diagnosis['system_functions']['memory_get_usage']) {
    $recommendations[] = 'PHP内存函数不可用，可能影响服务器状态监控';
}

if (empty($recommendations)) {
    $recommendations[] = '所有检查通过，服务器配置正常';
}

$diagnosis['recommendations'] = $recommendations;

echo json_encode($diagnosis, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?> 