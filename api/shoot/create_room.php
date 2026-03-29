<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../db_connect.php';

$input=json_decode(file_get_contents('php://input'),true);
if(!$input||!isset($input['user_id'],$input['room_name'],$input['nickname'])){ echo json_encode(['success'=>false,'message'=>'缺少参数']); exit; }
$uid=(int)$input['user_id']; $name=trim($input['room_name']); $nick=trim($input['nickname']);

function code(){ $c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $s=''; for($i=0;$i<5;$i++) $s.=$c[random_int(0,strlen($c)-1)]; return $s; }
$roomCode=code();

try{
  $stmt=$conn->prepare("INSERT INTO shoot_rooms (room_code,room_name,player1_id,player1_name,shooter_id,game_status) VALUES (?,?,?,?,?, 'waiting')");
  $stmt->bind_param("ssisi", $roomCode,$name,$uid,$nick,$uid);
  $stmt->execute(); $stmt->close();
  echo json_encode(['success'=>true,'room_code'=>$roomCode]);
}catch(Exception $e){ echo json_encode(['success'=>false,'message'=>'创建失败: '.$e->getMessage()]); }
?>


