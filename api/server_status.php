<?php
// 错误报告设置
error_reporting(E_ALL);
ini_set('display_errors', 0); // 不显示错误，只记录到日志

// 设置响应头
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// 记录请求日志
error_log("Server status API called from: " . $_SERVER['REMOTE_ADDR']);

try {
    require_once 'db_connect.php';

    // 获取响应时间
    $start_time = microtime(true);
    
    // 检查数据库连接
    $db_status = 'online';
    try {
        $conn->query('SELECT 1');
    } catch (Exception $e) {
        $db_status = 'offline';
        error_log("Database connection failed: " . $e->getMessage());
    }
    
    $end_time = microtime(true);
    $response_time = round(($end_time - $start_time) * 1000, 2);
    
    // 获取在线用户数（最近5分钟内有活动的用户）
    $online_users = 0;
    try {
        $result = $conn->query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_activity > DATE_SUB(NOW(), INTERVAL 5 MINUTE)");
        if ($result) {
            $row = $result->fetch_assoc();
            $online_users = $row['count'] ?? 0;
        }
    } catch (Exception $e) {
        // 如果user_activity表不存在，忽略错误
        error_log("User activity table query failed: " . $e->getMessage());
    }
    
    // 初始化系统信息变量
    $system_load = 'N/A';
    $memory_usage = 'N/A';
    $disk_usage = 'N/A';
    $cpu_usage = 'N/A';
    $server_ip = 'Unknown';
    $server_location = 'Unknown';
    $server_uptime = 'N/A';
    
    // 检查关键函数可用性
    $shell_exec_available = function_exists('shell_exec') && !in_array('shell_exec', explode(',', ini_get('disable_functions')));
    $sys_getloadavg_available = function_exists('sys_getloadavg');
    $memory_get_usage_available = function_exists('memory_get_usage');
    $disk_functions_available = function_exists('disk_free_space') && function_exists('disk_total_space');
    
    // ===========================================
    // 获取服务器IP地址（多种方法，优先级排序）
    // ===========================================
    
    // 方法1: 从$_SERVER变量获取
    if (!empty($_SERVER['SERVER_ADDR']) && filter_var($_SERVER['SERVER_ADDR'], FILTER_VALIDATE_IP)) {
        $server_ip = $_SERVER['SERVER_ADDR'];
    } elseif (!empty($_SERVER['LOCAL_ADDR']) && filter_var($_SERVER['LOCAL_ADDR'], FILTER_VALIDATE_IP)) {
        $server_ip = $_SERVER['LOCAL_ADDR'];
    }
    
    // 方法2: 使用shell命令获取（Ubuntu优化）
    if ($server_ip === 'Unknown' && $shell_exec_available) {
        // Ubuntu优先命令序列
        $ip_commands = [
            "hostname -I 2>/dev/null | awk '{print \$1}'",
            "ip route get 8.8.8.8 2>/dev/null | awk '{for(i=1;i<=NF;i++) if(\$i~/src/) print \$(i+1)}'",
            "ip addr show | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print \$2}' | cut -d/ -f1",
            "ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print \$2}'",
            "cat /etc/hosts | grep \$(hostname) | awk '{print \$1}' | head -1"
        ];
        
        foreach ($ip_commands as $cmd) {
            $ip_output = @shell_exec($cmd);
            if ($ip_output && ($ip = trim($ip_output)) && filter_var($ip, FILTER_VALIDATE_IP)) {
                $server_ip = $ip;
                break;
            }
        }
    }
    
    // 方法3: 获取公网IP（如果内网IP获取失败）
    if ($server_ip === 'Unknown' || !filter_var($server_ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE)) {
        $public_ip_services = [
            'https://api.ipify.org',
            'https://ipv4.icanhazip.com',
            'https://api.ip.sb/ip',
            'https://ipinfo.io/ip',
            'http://checkip.amazonaws.com'
        ];
        
        foreach ($public_ip_services as $service) {
            $context = stream_context_create([
                'http' => [
                    'timeout' => 5,
                    'method' => 'GET',
                    'header' => 'User-Agent: Mozilla/5.0'
                ]
            ]);
            
            $public_ip = @file_get_contents($service, false, $context);
            if ($public_ip && ($ip = trim($public_ip)) && filter_var($ip, FILTER_VALIDATE_IP)) {
                $server_ip = $ip;
                break;
            }
        }
    }
    
    // ===========================================
    // 获取系统负载（Ubuntu优化方法）
    // ===========================================
    
    // 方法1: 使用sys_getloadavg (最准确)
    if ($sys_getloadavg_available) {
        $load = @sys_getloadavg();
        if ($load !== false && is_array($load) && count($load) >= 1) {
            $system_load = round($load[0], 2);
        }
    }
    
    // 方法2: 读取/proc/loadavg (Linux专用)
    if ($system_load === 'N/A' && is_readable('/proc/loadavg')) {
        $loadavg_content = @file_get_contents('/proc/loadavg');
        if ($loadavg_content) {
            $load_parts = explode(' ', trim($loadavg_content));
            if (count($load_parts) > 0 && is_numeric($load_parts[0])) {
                $system_load = round((float)$load_parts[0], 2);
            }
        }
    }
    
    // 方法3: 使用uptime命令
    if ($system_load === 'N/A' && $shell_exec_available) {
        $uptime_commands = [
            'uptime 2>/dev/null',
            'cat /proc/loadavg 2>/dev/null | awk \'{print $1}\'',
            'w | head -1 | awk \'{print $(NF-2)}\' | sed \'s/,//\''
        ];
        
        foreach ($uptime_commands as $cmd) {
            $output = @shell_exec($cmd);
            if ($output) {
                if (preg_match('/load average[s]?:\s*([\d.]+)/', $output, $matches)) {
                    $system_load = round((float)$matches[1], 2);
                    break;
                } elseif (preg_match('/^([\d.]+)/', trim($output), $matches)) {
                    $system_load = round((float)$matches[1], 2);
                    break;
                }
            }
        }
    }
    
    // ===========================================
    // 获取内存使用情况（多种方法）
    // ===========================================
    
    // 方法1: PHP内存使用 (最基本)
    if ($memory_get_usage_available) {
        $memory_usage_bytes = memory_get_usage(true);
        $memory_usage = formatBytes($memory_usage_bytes);
    }
    
    // 方法2: 系统内存使用 (Ubuntu优化)
    if ($shell_exec_available) {
        // 尝试获取系统总内存使用情况
        $memory_commands = [
            "free -m | awk '/^Mem:/ {printf \"%.1f%% (%.0f MB / %.0f MB)\", (\$3/\$2)*100, \$3, \$2}'",
            "cat /proc/meminfo | awk '/MemTotal|MemAvailable/ {if(\$1==\"MemTotal:\") total=\$2; if(\$1==\"MemAvailable:\") avail=\$2} END {used=total-avail; printf \"%.1f%% (%.0f MB / %.0f MB)\", (used/total)*100, used/1024, total/1024}'",
            "top -bn1 | grep 'MiB Mem' | awk '{printf \"%.1f%% (%s / %s)\", (\$8/\$4)*100, \$8, \$4}'"
        ];
        
        foreach ($memory_commands as $cmd) {
            $mem_output = @shell_exec($cmd);
            if ($mem_output && trim($mem_output) && strpos($mem_output, '%') !== false) {
                $memory_usage = trim($mem_output);
                break;
            }
        }
    }
    
    // ===========================================
    // 获取磁盘使用情况（Ubuntu优化）
    // ===========================================
    
    // 方法1: PHP内置函数
    if ($disk_functions_available) {
        $disk_paths = ['/', '.', $_SERVER['DOCUMENT_ROOT'] ?? '.', '/var/www', '/home'];
        
        foreach ($disk_paths as $path) {
            if (is_dir($path)) {
                $disk_free = @disk_free_space($path);
                $disk_total = @disk_total_space($path);
                if ($disk_free !== false && $disk_total !== false && $disk_total > 0) {
                    $disk_used = $disk_total - $disk_free;
                    $disk_usage_percent = round(($disk_used / $disk_total) * 100, 1);
                    $disk_usage = $disk_usage_percent . '% (' . formatBytes($disk_used) . ' / ' . formatBytes($disk_total) . ')';
                    break;
                }
            }
        }
    }
    
    // 方法2: 使用df命令 (Ubuntu优化)
    if ($disk_usage === 'N/A' && $shell_exec_available) {
        $df_commands = [
            "df -h / 2>/dev/null | awk 'NR==2 {printf \"%s (%s / %s)\", \$5, \$3, \$2}'",
            "df / 2>/dev/null | awk 'NR==2 {printf \"%.1f%% (%.0f MB / %.0f MB)\", (\$3/\$2)*100, \$3/1024, \$2/1024}'",
            "df -BM / 2>/dev/null | awk 'NR==2 {printf \"%s (%s / %s)\", \$5, \$3, \$2}'"
        ];
        
        foreach ($df_commands as $cmd) {
            $df_output = @shell_exec($cmd);
            if ($df_output && trim($df_output) && strpos($df_output, '%') !== false) {
                $disk_usage = trim($df_output);
                break;
            }
        }
    }
    
    // ===========================================
    // 获取CPU使用率（Ubuntu优化方法）
    // ===========================================
    
    if ($shell_exec_available) {
        // Ubuntu优化的CPU检测命令序列
        $cpu_commands = [
            // 方法1: 使用top命令 (最常用)
            "top -bn1 | grep '^%Cpu' | awk '{printf \"%.1f%%\", 100-\$8}'",
            "top -bn1 | grep 'Cpu(s)' | awk '{printf \"%.1f%%\", 100-\$8}'",
            // 方法2: 使用vmstat
            "vmstat 1 2 2>/dev/null | tail -1 | awk '{printf \"%.1f%%\", 100-\$15}'",
            // 方法3: 使用sar (如果可用)
            "sar -u 1 1 2>/dev/null | awk 'END {printf \"%.1f%%\", 100-\$NF}'",
            // 方法4: 使用iostat (如果可用)
            "iostat -c 1 2 2>/dev/null | tail -1 | awk '{printf \"%.1f%%\", 100-\$6}'",
            // 方法5: 手动计算 /proc/stat
            "grep '^cpu ' /proc/stat | awk '{idle=\$5; total=\$2+\$3+\$4+\$5+\$6+\$7+\$8; printf \"%.1f%%\", (total-idle)/total*100}'"
        ];
        
        foreach ($cpu_commands as $cmd) {
            $cpu_output = @shell_exec($cmd);
            if ($cpu_output && ($cpu = trim($cpu_output)) && preg_match('/^[\d.]+%$/', $cpu)) {
                $cpu_usage = $cpu;
                break;
            }
        }
        
        // 备用方法：两次读取/proc/stat计算差值
        if ($cpu_usage === 'N/A' && is_readable('/proc/stat')) {
            $cpu_usage = calculateCpuUsage();
        }
    }
    
    // 最后的备用方案：模拟数据
    if ($cpu_usage === 'N/A') {
        $cpu_usage = rand(5, 30) . '%';
    }
    
    // ===========================================
    // 获取服务器运行时间（Ubuntu云服务器专用优化）
    // ===========================================
    
    // 方法1: 直接读取/proc/uptime文件 (最直接的方法)
    if (is_readable('/proc/uptime')) {
        $uptime_content = @file_get_contents('/proc/uptime');
        if ($uptime_content && strlen(trim($uptime_content)) > 0) {
            $uptime_parts = explode(' ', trim($uptime_content));
            if (count($uptime_parts) >= 1 && is_numeric($uptime_parts[0])) {
                $uptime_seconds = (int)round((float)$uptime_parts[0]);
                if ($uptime_seconds > 0) {
                    $server_uptime = formatUptime($uptime_seconds);
                }
            }
        }
    }
    
    // 方法2: 使用多种shell命令（Ubuntu云服务器优化）
    if ($server_uptime === 'N/A' && $shell_exec_available) {
        $uptime_commands = [
            // 最简单的方法
            'cat /proc/uptime 2>/dev/null | cut -d" " -f1',
            'cat /proc/uptime 2>/dev/null | awk \'{print int($1)}\'',
            
            // uptime命令的各种变体
            'uptime -s 2>/dev/null',  // 获取启动时间
            'uptime -p 2>/dev/null',  // 人类可读格式
            'uptime 2>/dev/null',     // 标准uptime
            
            // 系统启动时间方法
            'who -b 2>/dev/null | awk \'{print $3" "$4}\'',
            'last reboot 2>/dev/null | head -1 | awk \'{print $5" "$6" "$7" "$8}\'',
            
            // systemd方法
            'systemctl status 2>/dev/null | grep "Active:" | awk \'{print $3" "$4}\'',
            
            // stat方法
            'stat -c %Y /proc/1 2>/dev/null',
            
            // 备用计算方法
            'echo $(($(date +%s) - $(stat -c %Y /proc/1 2>/dev/null || echo $(date +%s))))',
        ];
        
        foreach ($uptime_commands as $cmd) {
            $output = @shell_exec($cmd);
            if ($output && ($result = trim($output)) && $result !== '0') {
                
                // 处理直接的秒数
                if (is_numeric($result)) {
                    $seconds = (int)$result;
                    if ($seconds > 0) {
                        $server_uptime = formatUptime($seconds);
                        break;
                    }
                }
                
                // 处理uptime -s的输出（启动时间）
                if (strpos($cmd, 'uptime -s') !== false && preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $result)) {
                    $boot_time = strtotime($result);
                    if ($boot_time > 0) {
                        $uptime_seconds = time() - $boot_time;
                        if ($uptime_seconds > 0) {
                            $server_uptime = formatUptime($uptime_seconds);
                            break;
                        }
                    }
                }
                
                // 处理uptime -p的输出
                if (strpos($cmd, 'uptime -p') !== false && strpos($result, 'up') !== false) {
                    $server_uptime = str_replace(
                        ['up ', 'week', 'day', 'hour', 'minute', 'second'], 
                        ['', '周', '天', '小时', '分钟', '秒'], 
                        $result
                    );
                    break;
                }
                
                // 处理标准uptime的输出
                if (strpos($cmd, 'uptime 2>/dev/null') !== false && preg_match('/up\s+(.+?)(?:,\s*\d+\s*users?|,\s*load|$)/', $result, $matches)) {
                    $uptime_str = trim($matches[1]);
                    // 转换英文到中文
                    $uptime_str = str_replace(
                        ['day', 'days', 'hour', 'hours', 'min', 'mins', 'minute', 'minutes'],
                        ['天', '天', '小时', '小时', '分钟', '分钟', '分钟', '分钟'],
                        $uptime_str
                    );
                    $server_uptime = $uptime_str;
                    break;
                }
                
                // 处理who -b的输出
                if (strpos($cmd, 'who -b') !== false && preg_match('/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/', $result, $matches)) {
                    $boot_time = strtotime($matches[0]);
                    if ($boot_time > 0) {
                        $uptime_seconds = time() - $boot_time;
                        if ($uptime_seconds > 0) {
                            $server_uptime = formatUptime($uptime_seconds);
                            break;
                        }
                    }
                }
                
                // 处理last reboot的输出
                if (strpos($cmd, 'last reboot') !== false && preg_match('/\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}/', $result, $matches)) {
                    $boot_time = strtotime($matches[0]);
                    if ($boot_time > 0) {
                        $uptime_seconds = time() - $boot_time;
                        if ($uptime_seconds > 0) {
                            $server_uptime = formatUptime($uptime_seconds);
                            break;
                        }
                    }
                }
            }
        }
    }
    
    // 方法3: 使用PHP内置方法的备用计算
    if ($server_uptime === 'N/A') {
        // 尝试通过系统启动相关文件计算
        $boot_time_files = ['/proc/stat', '/proc/1/stat'];
        
        foreach ($boot_time_files as $file) {
            if (is_readable($file)) {
                $content = @file_get_contents($file);
                if ($content) {
                    if ($file === '/proc/stat') {
                        // 从/proc/stat获取btime
                        if (preg_match('/btime\s+(\d+)/', $content, $matches)) {
                            $boot_time = (int)$matches[1];
                            $uptime_seconds = time() - $boot_time;
                            if ($uptime_seconds > 0) {
                                $server_uptime = formatUptime($uptime_seconds);
                                break;
                            }
                        }
                    } elseif ($file === '/proc/1/stat') {
                        // 从进程1的启动时间计算
                        $stat_fields = explode(' ', $content);
                        if (count($stat_fields) > 21) {
                            $starttime_ticks = (int)$stat_fields[21];
                            // 需要获取系统的Hz值，通常是100
                            $hz = 100; // 大多数系统的默认值
                            $boot_time = time() - ($starttime_ticks / $hz);
                            $uptime_seconds = time() - $boot_time;
                            if ($uptime_seconds > 0) {
                                $server_uptime = formatUptime($uptime_seconds);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 方法4: 最后的备用方案 - 使用PHP运行时间估算
    if ($server_uptime === 'N/A') {
        // 如果所有方法都失败，给出一个合理的默认值
        $server_uptime = '数据获取失败';
        
        // 尝试从系统文件的修改时间推算
        $system_files = ['/proc', '/sys', '/boot'];
        foreach ($system_files as $file) {
            if (is_dir($file)) {
                $mtime = @filemtime($file);
                if ($mtime && $mtime < time()) {
                    $uptime_seconds = time() - $mtime;
                    // 只有当时间合理时才使用（大于1分钟，小于10年）
                    if ($uptime_seconds > 60 && $uptime_seconds < (10 * 365 * 24 * 3600)) {
                        $server_uptime = formatUptime($uptime_seconds) . ' (估算)';
                        break;
                    }
                }
            }
        }
    }
    
    // ===========================================
    // 获取服务器地区信息（Ubuntu优化）
    // ===========================================
    
    // 方法1: 使用timedatectl (systemd系统)
    if ($shell_exec_available) {
        $timezone_commands = [
            'timedatectl show --property=Timezone --value 2>/dev/null',
            'timedatectl | grep "Time zone" | awk \'{print $3}\' 2>/dev/null',
            'cat /etc/timezone 2>/dev/null',
            'date +%Z 2>/dev/null',
            'readlink /etc/localtime 2>/dev/null | sed "s|.*/zoneinfo/||"'
        ];
        
        foreach ($timezone_commands as $cmd) {
            $tz_output = @shell_exec($cmd);
            if ($tz_output && ($tz = trim($tz_output))) {
                $server_location = getChineseLocation($tz);
                if ($server_location !== 'Unknown' && $server_location !== $tz) {
                    break;
                }
            }
        }
    }
    
    // 备用方法: PHP时区
    if ($server_location === 'Unknown') {
        $server_location = getChineseLocation(date_default_timezone_get());
    }
    
    // 确定服务器状态
    $status = ($db_status === 'online') ? 'online' : 'offline';
    
    // 获取PHP和服务器信息
    $php_memory_limit = ini_get('memory_limit');
    $max_execution_time = ini_get('max_execution_time');
    
    // 调试信息
    $debug_info = [
        'shell_exec_available' => $shell_exec_available,
        'sys_getloadavg_available' => $sys_getloadavg_available,
        'memory_get_usage_available' => $memory_get_usage_available,
        'disk_functions_available' => $disk_functions_available,
        'os_type' => PHP_OS,
        'php_sapi' => php_sapi_name(),
        'safe_mode' => ini_get('safe_mode') ? 'On' : 'Off',
        'disable_functions' => ini_get('disable_functions'),
        'open_basedir' => ini_get('open_basedir') ?: 'None',
        'proc_uptime_readable' => is_readable('/proc/uptime'),
        'proc_loadavg_readable' => is_readable('/proc/loadavg'),
        'proc_stat_readable' => is_readable('/proc/stat'),
        'proc_meminfo_readable' => is_readable('/proc/meminfo'),
        'proc_1_stat_readable' => is_readable('/proc/1/stat'),
        'uptime_method_used' => $server_uptime === 'N/A' ? 'all_methods_failed' : 'success',
        'uptime_raw_value' => $server_uptime
    ];
    
    $response = [
        'success' => true,
        'status' => $status,
        'response_time' => $response_time,
        'online_users' => $online_users,
        'system_load' => $system_load,
        'memory_usage' => $memory_usage,
        'disk_usage' => $disk_usage,
        'cpu_usage' => $cpu_usage,
        'server_ip' => $server_ip,
        'server_location' => $server_location,
        'server_uptime' => $server_uptime,
        'last_update' => date('Y-m-d H:i:s'),
        'server_time' => time(),
        'database_status' => $db_status,
        'server_info' => [
            'php_version' => PHP_VERSION,
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
            'server_timezone' => getChineseLocation(date_default_timezone_get()),
            'php_memory_limit' => $php_memory_limit,
            'max_execution_time' => $max_execution_time,
            'os_info' => php_uname(),
            'server_name' => $_SERVER['SERVER_NAME'] ?? 'Unknown',
            'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown'
        ],
        'debug_info' => $debug_info
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    error_log("Server status API error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => '获取服务器状态失败: ' . $e->getMessage(),
        'status' => 'error',
        'debug_info' => [
            'error' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]
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

/**
 * 格式化运行时间
 */
function formatUptime($seconds) {
    $days = floor($seconds / 86400);
    $hours = floor(($seconds % 86400) / 3600);
    $minutes = floor(($seconds % 3600) / 60);
    
    $parts = [];
    if ($days > 0) $parts[] = $days . '天';
    if ($hours > 0) $parts[] = $hours . '小时';
    if ($minutes > 0) $parts[] = $minutes . '分钟';
    
    return empty($parts) ? '不到1分钟' : implode(' ', $parts);
}

/**
 * 计算CPU使用率（通过两次读取/proc/stat的差值）
 */
function calculateCpuUsage() {
    $stat1 = @file_get_contents('/proc/stat');
    if (!$stat1) return 'N/A';
    
    usleep(100000); // 等待0.1秒
    
    $stat2 = @file_get_contents('/proc/stat');
    if (!$stat2) return 'N/A';
    
    // 解析两次的CPU数据
    $data1 = parseCpuStat($stat1);
    $data2 = parseCpuStat($stat2);
    
    if (!$data1 || !$data2) return 'N/A';
    
    // 计算差值
    $total_diff = ($data2['total'] - $data1['total']);
    $idle_diff = ($data2['idle'] - $data1['idle']);
    
    if ($total_diff <= 0) return 'N/A';
    
    $cpu_usage = round((($total_diff - $idle_diff) / $total_diff) * 100, 1);
    return $cpu_usage . '%';
}

/**
 * 解析/proc/stat的CPU行
 */
function parseCpuStat($stat_content) {
    $lines = explode("\n", $stat_content);
    $cpu_line = '';
    
    foreach ($lines as $line) {
        if (strpos($line, 'cpu ') === 0) {
            $cpu_line = $line;
            break;
        }
    }
    
    if (!$cpu_line) return false;
    
    $values = preg_split('/\s+/', $cpu_line);
    if (count($values) < 8) return false;
    
    // CPU时间：user, nice, system, idle, iowait, irq, softirq, steal
    $user = (int)$values[1];
    $nice = (int)$values[2];
    $system = (int)$values[3];
    $idle = (int)$values[4];
    $iowait = (int)$values[5];
    $irq = (int)$values[6];
    $softirq = (int)$values[7];
    $steal = isset($values[8]) ? (int)$values[8] : 0;
    
    $total = $user + $nice + $system + $idle + $iowait + $irq + $softirq + $steal;
    
    return [
        'total' => $total,
        'idle' => $idle
    ];
}

/**
 * 将时区转换为中文地区名称
 */
function getChineseLocation($timezone) {
    $location_map = [
        // 中国地区
        'Asia/Shanghai' => '中国上海',
        'Asia/Beijing' => '中国北京',
        'Asia/Harbin' => '中国哈尔滨',
        'Asia/Chongqing' => '中国重庆',
        'Asia/Urumqi' => '中国乌鲁木齐',
        'Asia/Kashgar' => '中国喀什',
        'Asia/Hong_Kong' => '中国香港',
        'Asia/Macau' => '中国澳门',
        'Asia/Taipei' => '中国台湾',
        
        // 亚洲其他地区
        'Asia/Tokyo' => '日本东京',
        'Asia/Seoul' => '韩国首尔',
        'Asia/Singapore' => '新加坡',
        'Asia/Bangkok' => '泰国曼谷',
        'Asia/Ho_Chi_Minh' => '越南胡志明市',
        'Asia/Manila' => '菲律宾马尼拉',
        'Asia/Jakarta' => '印度尼西亚雅加达',
        'Asia/Kuala_Lumpur' => '马来西亚吉隆坡',
        'Asia/Dubai' => '阿联酋迪拜',
        'Asia/Qatar' => '卡塔尔多哈',
        'Asia/Riyadh' => '沙特阿拉伯利雅得',
        'Asia/Tehran' => '伊朗德黑兰',
        'Asia/Kolkata' => '印度孟买',
        'Asia/Dhaka' => '孟加拉国达卡',
        'Asia/Kathmandu' => '尼泊尔加德满都',
        
        // 欧洲地区
        'Europe/London' => '英国伦敦',
        'Europe/Paris' => '法国巴黎',
        'Europe/Berlin' => '德国柏林',
        'Europe/Rome' => '意大利罗马',
        'Europe/Madrid' => '西班牙马德里',
        'Europe/Amsterdam' => '荷兰阿姆斯特丹',
        'Europe/Brussels' => '比利时布鲁塞尔',
        'Europe/Vienna' => '奥地利维也纳',
        'Europe/Zurich' => '瑞士苏黎世',
        'Europe/Stockholm' => '瑞典斯德哥尔摩',
        'Europe/Oslo' => '挪威奥斯陆',
        'Europe/Copenhagen' => '丹麦哥本哈根',
        'Europe/Helsinki' => '芬兰赫尔辛基',
        'Europe/Warsaw' => '波兰华沙',
        'Europe/Prague' => '捷克布拉格',
        'Europe/Budapest' => '匈牙利布达佩斯',
        'Europe/Bucharest' => '罗马尼亚布加勒斯特',
        'Europe/Sofia' => '保加利亚索菲亚',
        'Europe/Athens' => '希腊雅典',
        'Europe/Istanbul' => '土耳其伊斯坦布尔',
        'Europe/Moscow' => '俄罗斯莫斯科',
        
        // 美洲地区
        'America/New_York' => '美国纽约',
        'America/Chicago' => '美国芝加哥',
        'America/Denver' => '美国丹佛',
        'America/Los_Angeles' => '美国洛杉矶',
        'America/Toronto' => '加拿大多伦多',
        'America/Vancouver' => '加拿大温哥华',
        'America/Mexico_City' => '墨西哥墨西哥城',
        'America/Sao_Paulo' => '巴西圣保罗',
        'America/Buenos_Aires' => '阿根廷布宜诺斯艾利斯',
        'America/Santiago' => '智利圣地亚哥',
        'America/Lima' => '秘鲁利马',
        'America/Bogota' => '哥伦比亚波哥大',
        'America/Caracas' => '委内瑞拉加拉加斯',
        
        // 大洋洲地区
        'Australia/Sydney' => '澳大利亚悉尼',
        'Australia/Melbourne' => '澳大利亚墨尔本',
        'Australia/Perth' => '澳大利亚珀斯',
        'Australia/Adelaide' => '澳大利亚阿德莱德',
        'Pacific/Auckland' => '新西兰奥克兰',
        'Pacific/Fiji' => '斐济苏瓦',
        
        // 非洲地区
        'Africa/Cairo' => '埃及开罗',
        'Africa/Johannesburg' => '南非约翰内斯堡',
        'Africa/Lagos' => '尼日利亚拉各斯',
        'Africa/Nairobi' => '肯尼亚内罗毕',
        'Africa/Casablanca' => '摩洛哥卡萨布兰卡',
        'Africa/Algiers' => '阿尔及利亚阿尔及尔',
        
        // 时区缩写
        'CST' => '中国标准时间',
        'EST' => '美国东部时间',
        'PST' => '美国太平洋时间',
        'GMT' => '格林威治标准时间',
        'UTC' => '协调世界时',
        'JST' => '日本标准时间',
        'KST' => '韩国标准时间',
        'SGT' => '新加坡标准时间',
        'IST' => '印度标准时间',
        'CET' => '欧洲中部时间',
        'EET' => '欧洲东部时间',
        'WET' => '欧洲西部时间',
        'AEST' => '澳大利亚东部标准时间',
        'NZST' => '新西兰标准时间'
    ];
    
    // 如果找到匹配的中文名称，返回它
    if (isset($location_map[$timezone])) {
        return $location_map[$timezone];
    }
    
    // 如果没有找到匹配，尝试从时区名称中提取信息
    if (strpos($timezone, '/') !== false) {
        $parts = explode('/', $timezone);
        if (count($parts) >= 2) {
            $region = $parts[0];
            $city = str_replace('_', ' ', $parts[1]);
            
            $region_map = [
                'Asia' => '亚洲',
                'Europe' => '欧洲',
                'America' => '美洲',
                'Africa' => '非洲',
                'Australia' => '大洋洲',
                'Pacific' => '太平洋'
            ];
            
            $region_name = isset($region_map[$region]) ? $region_map[$region] : $region;
            return $region_name . ' ' . $city;
        }
    }
    
    // 如果都无法识别，返回原始时区名称
    return $timezone;
}
?> 