<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../db_connect.php';

if(!isset($_GET['room_code'])){ echo json_encode(['success'=>false,'message'=>'缺少参数']); exit; }
$code=trim($_GET['room_code']);

try{
  $stmt=$conn->prepare("SELECT * FROM shoot_rooms WHERE room_code=?");
  $stmt->bind_param("s",$code); $stmt->execute(); $room=$stmt->get_result()->fetch_assoc(); $stmt->close();
  if(!$room){ echo json_encode(['success'=>false,'message'=>'房间不存在']); exit; }

  // 超时推进：asking 状态下，若超过 60s 自动进入下一次机会
  if($room['game_status']==='asking' && $room['turn_deadline']){
    if(time() > strtotime($room['turn_deadline'])){
      // 减少机会
      $ch = max(0, ((int)$room['chances_left']) - 1);
      // 机会耗尽：计分并进入下一轮或结束
      if($ch<=0){
        // 射者 +1 分
        $p1=$room['player1_score']; $p2=$room['player2_score'];
        if($room['shooter_id']==$room['player1_id']) $p1++; else $p2++;
        $nextRound = ((int)$room['current_round'])+1;
        if($nextRound>5){
          $u=$conn->prepare("UPDATE shoot_rooms SET player1_score=?, player2_score=?, game_status='finished' WHERE room_code=?");
          $u->bind_param("iis",$p1,$p2,$code); $u->execute(); $u->close();
        }else{
          $u=$conn->prepare("UPDATE shoot_rooms SET player1_score=?, player2_score=?, current_round=?, game_status='waiting_set', category=NULL, secret_word=NULL, chances_left=15, turn_deadline=NULL WHERE room_code=?");
          $u->bind_param("iiis",$p1,$p2,$nextRound,$code); $u->execute(); $u->close();
        }
      }else{
        $deadline = date('Y-m-d H:i:s', time()+60);
        $u=$conn->prepare("UPDATE shoot_rooms SET chances_left=?, turn_deadline=? WHERE room_code=?");
        $u->bind_param("iss",$ch,$deadline,$code); $u->execute(); $u->close();
      }
      // 附带系统提示
      $msg=$conn->prepare("INSERT INTO shoot_messages (room_code,role,type,text) VALUES (?, 'system','text',?)");
      $txt='上一问超时，自动进入下一次';
      $msg->bind_param("ss",$code,$txt); $msg->execute(); $msg->close();

      // 重新读取
      $stmt=$conn->prepare("SELECT * FROM shoot_rooms WHERE room_code=?");
      $stmt->bind_param("s",$code); $stmt->execute(); $room=$stmt->get_result()->fetch_assoc(); $stmt->close();
    }
  }
  // 计算前端倒计时
  if($room['game_status']==='asking' && $room['turn_deadline']){
    $room['time_left'] = max(0, strtotime($room['turn_deadline']) - time());
  } else {
    $room['time_left'] = null;
  }

  // 附带消息
  $m=$conn->prepare("SELECT role,type,text,created_at FROM shoot_messages WHERE room_code=? ORDER BY id ASC");
  $m->bind_param("s",$code); $m->execute(); $msgs=$m->get_result()->fetch_all(MYSQLI_ASSOC); $m->close();
  $room['messages']=$msgs;

  echo json_encode(['success'=>true,'room'=>$room]);
}catch(Exception $e){ echo json_encode(['success'=>false,'message'=>'获取失败: '.$e->getMessage()]); }
?>


