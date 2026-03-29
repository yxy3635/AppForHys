<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../db_connect.php';

$input=json_decode(file_get_contents('php://input'),true);
if(!$input||!isset($input['user_id'],$input['room_code'])){ echo json_encode(['success'=>false,'message'=>'缺少参数']); exit; }
$code=trim($input['room_code']);
try{ $u=$conn->prepare("UPDATE shoot_rooms SET game_status='finished' WHERE room_code=?"); $u->bind_param("s",$code); $u->execute(); $u->close(); echo json_encode(['success'=>true]); }catch(Exception $e){ echo json_encode(['success'=>false,'message'=>'结束失败: '.$e->getMessage()]); }
?>


