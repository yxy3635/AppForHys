<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $diagnostic = [];
    
    // 基础PHP信息
    $diagnostic['php_info'] = [
        'version' => PHP_VERSION,
        'os' => PHP_OS,
        'sapi' => php_sapi_name(),
        'memory_limit' => ini_get('memory_limit'),
        'max_execution_time' => ini_get('max_execution_time'),
        'safe_mode' => ini_get('safe_mode') ? 'On' : 'Off',
        'disable_functions' => ini_get('disable_functions'),
        'open_basedir' => ini_get('open_basedir') ?: 'None'
    ];
    
    // 函数可用性检查
    $functions_to_check = [
        'shell_exec', 'exec', 'system', 'passthru',
        'sys_getloadavg', 'memory_get_usage', 'disk_free_space',
        'php_uname', 'file_get_contents', 'curl_init'
    ];
    
    $diagnostic['functions'] = [];
    foreach ($functions_to_check as $func) {
        $diagnostic['functions'][$func] = function_exists($func);
    }
    
    // 系统信息测试
    $diagnostic['system_tests'] = [];
    
    // 测试shell_exec
    if (function_exists('shell_exec')) {
        $diagnostic['system_tests']['shell_exec'] = [
            'available' => true,
            'test_commands' => []
        ];
        
        // 测试各种命令
        $commands = [
            'uptime' => 'uptime 2>/dev/null',
            'who' => 'who -b 2>/dev/null',
            'hostname' => 'hostname 2>/dev/null',
            'date' => 'date 2>/dev/null',
            'cat_proc_uptime' => 'cat /proc/uptime 2>/dev/null',
            'cat_proc_loadavg' => 'cat /proc/loadavg 2>/dev/null',
            'cat_proc_stat' => 'cat /proc/stat | head -1 2>/dev/null'
        ];
        
        foreach ($commands as $name => $command) {
            $output = shell_exec($command);
            $diagnostic['system_tests']['shell_exec']['test_commands'][$name] = [
                'command' => $command,
                'output' => $output ? trim($output) : null,
                'success' => !empty($output)
            ];
        }
    } else {
        $diagnostic['system_tests']['shell_exec'] = ['available' => false];
    }
    
    // 测试sys_getloadavg
    if (function_exists('sys_getloadavg')) {
        $load = sys_getloadavg();
        $diagnostic['system_tests']['sys_getloadavg'] = [
            'available' => true,
            'result' => $load !== false ? $load : null,
            'success' => $load !== false
        ];
    } else {
        $diagnostic['system_tests']['sys_getloadavg'] = ['available' => false];
    }
    
    // 测试内存使用
    if (function_exists('memory_get_usage')) {
        $memory = memory_get_usage(true);
        $diagnostic['system_tests']['memory_get_usage'] = [
            'available' => true,
            'result' => $memory,
            'formatted' => formatBytes($memory)
        ];
    } else {
        $diagnostic['system_tests']['memory_get_usage'] = ['available' => false];
    }
    
    // 测试磁盘空间
    $disk_paths = ['/', '.', $_SERVER['DOCUMENT_ROOT'] ?? '.'];
    $diagnostic['system_tests']['disk_space'] = [];
    
    foreach ($disk_paths as $path) {
        $free = disk_free_space($path);
        $total = disk_total_space($path);
        $diagnostic['system_tests']['disk_space'][$path] = [
            'free' => $free,
            'total' => $total,
            'used' => $total ? $total - $free : null,
            'percentage' => $total ? round((($total - $free) / $total) * 100, 1) : null,
            'formatted' => $total ? formatBytes($total - $free) . ' / ' . formatBytes($total) : null
        ];
    }
    
    // 测试网络连接
    $diagnostic['network_tests'] = [];
    
    // 测试公网IP获取
    $public_ip = @file_get_contents('https://api.ipify.org');
    $diagnostic['network_tests']['public_ip'] = [
        'result' => $public_ip ? trim($public_ip) : null,
        'success' => !empty($public_ip) && filter_var($public_ip, FILTER_VALIDATE_IP)
    ];
    
    // 服务器变量
    $diagnostic['server_vars'] = [
        'SERVER_ADDR' => $_SERVER['SERVER_ADDR'] ?? 'Not set',
        'LOCAL_ADDR' => $_SERVER['LOCAL_ADDR'] ?? 'Not set',
        'HTTP_HOST' => $_SERVER['HTTP_HOST'] ?? 'Not set',
        'SERVER_NAME' => $_SERVER['SERVER_NAME'] ?? 'Not set',
        'SERVER_SOFTWARE' => $_SERVER['SERVER_SOFTWARE'] ?? 'Not set',
        'DOCUMENT_ROOT' => $_SERVER['DOCUMENT_ROOT'] ?? 'Not set'
    ];
    
    // 时区信息
    $diagnostic['timezone'] = [
        'default_timezone' => date_default_timezone_get(),
        'current_time' => date('Y-m-d H:i:s'),
        'timezone_offset' => date('P')
    ];
    
    // 数据库连接测试
    $diagnostic['database'] = [];
    
    // 尝试连接数据库
    $db_config = [
        'host' => 'localhost',
        'username' => 'root',
        'password' => '',
        'database' => 'yandh'
    ];
    
    try {
        $conn = new mysqli($db_config['host'], $db_config['username'], $db_config['password'], $db_config['database']);
        if ($conn->connect_error) {
            $diagnostic['database']['connection'] = [
                'success' => false,
                'error' => $conn->connect_error
            ];
        } else {
            $diagnostic['database']['connection'] = [
                'success' => true,
                'server_info' => $conn->server_info,
                'host_info' => $conn->host_info
            ];
            
            // 测试user_activity表
            $result = $conn->query("SHOW TABLES LIKE 'user_activity'");
            $diagnostic['database']['user_activity_table'] = [
                'exists' => $result && $result->num_rows > 0
            ];
            
            $conn->close();
        }
    } catch (Exception $e) {
        $diagnostic['database']['connection'] = [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
    
    echo json_encode([
        'success' => true,
        'diagnostic' => $diagnostic,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * 格式化字节数
 */
function formatBytes($bytes, $precision = 2) {
    $units = array('B', 'KB', 'MB', 'GB', 'TB');
    
    for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
        $bytes /= 1024;
    }
    
    return round($bytes, $precision) . ' ' . $units[$i];
}
?> 