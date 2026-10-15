'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=Number(process.env.PORT)||3000;
const W=1800,H=1080,ROUND_MS=150000;
const rooms=new Map(),sessions=new Map();
const now=()=>Date.now(),rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const uuid=()=>crypto.randomBytes(16).toString('hex');
const newCode=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
const OBS=[
 {x:250,y:205,w:195,h:90},{x:780,y:130,w:240,h:85},{x:1350,y:205,w:195,h:90},
 {x:250,y:785,w:195,h:90},{x:780,y:865,w:240,h:85},{x:1350,y:785,w:195,h:90},
 {x:565,y:385,w:145,h:110},{x:1090,y:585,w:145,h:110},
 {x:1080,y:385,w:145,h:110},{x:575,y:585,w:145,h:110},
 {x:858,y:477,w:85,h:125}
];
const PICKSPOTS=[[900,310],[900,760],[430,550],[1370,550],[600,270],[1200,800],[1220,260],[570,820]];
const SPAWNS=[[140,150],[1650,920],[1630,150],[150,920],[900,100],[900,990],[115,540],[1690,540]];
const COLORS=['#63f3e0','#ffb55b','#ae8bff','#ff6b9a','#78adff','#b3f278','#ffd677','#ff86ed'];
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
function fault(msg,status=400){const e=new Error(msg);e.status=status;throw e}
function getRoom(code){const r=rooms.get(String(code||'').trim().toUpperCase());if(!r)fault('Room not found. Check the code.');return r}
function getAuth(token){const c=sessions.get(String(token||''));if(!c)fault('Session expired. Please create or join a room.',401);const r=getRoom(c),p=[...r.players,...r.spectators].find(p=>p.token===token);if(!p)fault('Player no longer in this room.',401);return {r,p}}
function cleanName(n){return String(n||'').trim().replace(/[<>]/g,'').slice(0,18)}
function makePlayer(name,slot){return {id:uuid(),token:uuid(),name,slot,score:0,kills:0,deaths:0,x:SPAWNS[slot][0],y:SPAWNS[slot][1],angle:0,hp:100,shield:0,speedUntil:0,invUntil:0,respawnAt:0,online:false,fireAt:0,dashAt:0,dashHeld:false,input:{dx:0,dy:0,angle:0,fire:false,dash:false},lastInput:0}}
function resetPlayer(p){const xy=SPAWNS[p.slot%SPAWNS.length];p.x=xy[0];p.y=xy[1];p.hp=100;p.shield=0;p.speedUntil=0;p.invUntil=now()+2000;p.respawnAt=0;p.fireAt=0;p.dashAt=0;p.dashHeld=false;p.score=0;p.kills=0;p.deaths=0;p.input={dx:0,dy:0,angle:0,fire:false,dash:false};p.lastInput=now()}
function playerView(p){return {id:p.id,name:p.name,slot:p.slot,x:Math.round(p.x),y:Math.round(p.y),a:p.angle,hp:p.hp,shield:p.shield,score:p.score,kills:p.kills,deaths:p.deaths,online:p.online,respawnAt:p.respawnAt,invUntil:p.invUntil,speedUntil:p.speedUntil,dashAt:p.dashAt}}
function stateFor(r,token){
 const p=[...r.players,...r.spectators].find(x=>x.token===token);
 return {code:r.code,phase:r.phase,me:p?.id,host:r.host,isHost:p?.id===r.host,isSpectator:!!p&&!r.players.includes(p),
 serverNow:now(),endsAt:r.endsAt,round:r.round,players:r.players.map(playerView),spectators:r.spectators.map(x=>({id:x.id,name:x.name})),
 bullets:r.phase==='playing'?r.bullets.map(b=>({x:Math.round(b.x),y:Math.round(b.y),vx:b.vx,vy:b.vy,owner:b.owner})):[],
 pickups:r.phase==='playing'?r.pickups.filter(x=>x.active).map(x=>({x:x.x,y:x.y,type:x.type})):[],
 fx:r.phase==='playing'?r.fx.map(f=>({x:f.x,y:f.y,type:f.type,id:f.id})):[],
 champion:r.champion,arena:{w:W,h:H,obstacles:OBS}
 };
}
function push(r){
 for(const [token,res] of r.clients){
  try{res.write('data: '+JSON.stringify(stateFor(r,token))+'\n\n')}
  catch{r.clients.delete(token)}
 }
}
function createRoom(name){let code;do{code=newCode()}while(rooms.has(code));const p=makePlayer(name,0),r={code,players:[p],spectators:[],host:p.id,clients:new Map(),phase:'lobby',round:0,endsAt:0,bullets:[],pickups:[],fx:[],champion:'',lastTick:now(),lastPush:0,activeAt:now()};rooms.set(code,r);sessions.set(p.token,code);return {r,p}}
function nextSlot(r){const slots=new Set([...r.players,...r.spectators].map(p=>p.slot));for(let i=0;i<8;i++)if(!slots.has(i))return i;return 0}
function toLobby(r){r.phase='lobby';r.round=0;r.endsAt=0;r.champion='';r.bullets=[];r.pickups=[];r.fx=[];r.players.push(...r.spectators.splice(0,8-r.players.length));for(const p of r.players)resetPlayer(p);push(r)}
function start(r){if(r.players.length<2)fault('At least 2 players are required to start.');
 if(r.phase!=='lobby'&&r.phase!=='done')fault('The match is already running.');
 r.players.push(...r.spectators.splice(0,8-r.players.length));
 for(const p of r.players)resetPlayer(p);
 r.round++;r.phase='countdown';r.endsAt=now()+4000;r.bullets=[];r.fx=[];r.champion='';
 r.pickups=PICKSPOTS.map((a,i)=>({x:a[0],y:a[1],type:['heal','shield','speed'][i%3],active:true,respawn:0}));
 push(r);
}
function canMove(x,y,r=22){return x>=r&&x<=W-r&&y>=r&&y<=H-r&&!OBS.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h)}
function move(p,dx,dy){let nx=clamp(p.x+dx,23,W-23),ny=clamp(p.y+dy,23,H-23);if(canMove(nx,p.y))p.x=nx;if(canMove(p.x,ny))p.y=ny}
function fire(r,p,t){
 if(t<p.fireAt||p.respawnAt)return;
 p.fireAt=t+240;
 const a=p.angle,speed=710;const x=p.x+Math.cos(a)*31,y=p.y+Math.sin(a)*31;
 r.bullets.push({x,y,prevX:x,prevY:y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,owner:p.id,expires:t+1150});
 if(r.bullets.length>140)r.bullets.splice(0,r.bullets.length-140);
}
function effect(r,x,y,type){r.fx.push({x:Math.round(x),y:Math.round(y),type,id:uuid().slice(0,8),until:now()+340});if(r.fx.length>24)r.fx.splice(0,r.fx.length-24)}
function respawn(p,t){p.x=SPAWNS[p.slot][0];p.y=SPAWNS[p.slot][1];p.hp=100;p.shield=0;p.respawnAt=0;p.invUntil=t+1600;p.fireAt=t+450}
function hit(r,p,shooter,t){
 if(p.respawnAt||p.invUntil>t)return;
 if(p.shield>0){p.shield--;effect(r,p.x,p.y,'shield');return}
 p.hp=Math.max(0,p.hp-25);effect(r,p.x,p.y,'hit');
 if(p.hp===0){p.deaths++;p.respawnAt=t+2600;p.input.fire=false;shooter.score+=100;shooter.kills++;effect(r,p.x,p.y,'ko')}
 else shooter.score+=10;
}
function endGame(r){r.phase='done';r.endsAt=0;const sorted=[...r.players].sort((a,b)=>b.score-a.score||a.deaths-b.deaths);const highest=sorted[0]?.score??0;r.champion=sorted.filter(p=>p.score===highest).map(p=>p.name).join(' & ');r.bullets=[];push(r)}
function updateRoom(r,t,dt){
 if(r.phase==='countdown'){if(t>=r.endsAt){r.phase='playing';r.endsAt=t+ROUND_MS;push(r)}return}
 if(r.phase!=='playing')return;
 if(t>=r.endsAt){endGame(r);return}
 for(const p of r.players){
  if(p.respawnAt){if(t>=p.respawnAt)respawn(p,t);else continue}
  const input=t-p.lastInput>1000?{dx:0,dy:0,angle:p.angle,fire:false,dash:false}:p.input;
  p.angle=input.angle;
  let dx=clamp(input.dx,-1,1),dy=clamp(input.dy,-1,1),mag=Math.hypot(dx,dy);
  if(mag>1){dx/=mag;dy/=mag}
  let speed=p.speedUntil>t?330:235;
  if(input.dash&&!p.dashHeld&&p.dashAt<t&&mag>0.2){p.dashAt=t+4500;speed*=4.5;p.invUntil=Math.max(p.invUntil,t+260);effect(r,p.x,p.y,'dash')}
  p.dashHeld=input.dash;
  move(p,dx*speed*dt,dy*speed*dt);
  if(input.fire)fire(r,p,t);
 }
 for(const b of r.bullets){
  b.prevX=b.x;b.prevY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(t>b.expires||!canMove(b.x,b.y,5)){b.dead=true;continue}
  const owner=r.players.find(p=>p.id===b.owner);if(!owner){b.dead=true;continue}
  for(const p of r.players){
   if(p.id===b.owner||p.respawnAt)continue;
   if(Math.hypot(p.x-b.x,p.y-b.y)<26){b.dead=true;hit(r,p,owner,t);break}
  }
 }
 r.bullets=r.bullets.filter(b=>!b.dead);
 for(const pick of r.pickups){
  if(!pick.active){if(t>=pick.respawn)pick.active=true;continue}
  for(const p of r.players){
   if(p.respawnAt||Math.hypot(p.x-pick.x,p.y-pick.y)>38)continue;
   if(pick.type==='heal'){if(p.hp===100)continue;p.hp=Math.min(100,p.hp+45)}
   if(pick.type==='shield')p.shield=Math.min(3,p.shield+2);
   if(pick.type==='speed')p.speedUntil=t+7500;
   pick.active=false;pick.respawn=t+12000;effect(r,pick.x,pick.y,'pickup');break;
  }
 }
 r.fx=r.fx.filter(f=>f.until>t);
}
let last=now();
setInterval(()=>{
 const t=now(),dt=Math.min(0.075,Math.max(0,(t-last)/1000));last=t;
 for(const r of rooms.values()){
  updateRoom(r,t,dt);
  if(r.clients.size&&t-r.lastPush>=100){push(r);r.lastPush=t}
  if(!r.clients.size&&t-r.activeAt>3600000){for(const p of [...r.players,...r.spectators])sessions.delete(p.token);rooms.delete(r.code)}
 }
},50);
function api(req,res,body){
 try{
  let b=JSON.parse(body||'{}');if(!b||typeof b!=='object')fault('Invalid request');
  const route=new URL(req.url,'http://localhost').pathname;
  if(route==='/api/create'){const name=cleanName(b.name);if(!name)fault('Enter your nickname first');const {r,p}=createRoom(name);return json(res,200,{token:p.token,code:r.code})}
  if(route==='/api/join'){const r=getRoom(b.code),name=cleanName(b.name);if(!name)fault('Enter your nickname first');if(r.players.length+r.spectators.length>=8)fault('Room full (8 players maximum)');const p=makePlayer(name,nextSlot(r));if(r.phase==='lobby')r.players.push(p);else r.spectators.push(p);sessions.set(p.token,r.code);r.activeAt=now();push(r);return json(res,200,{token:p.token,code:r.code})}
  const {r,p}=getAuth(b.token);r.activeAt=now();
  if(route==='/api/resume')return json(res,200,{ok:true});
  if(route==='/api/start'){if(r.host!==p.id)fault('Only the host can start the match');start(r);return json(res,200,{ok:true})}
  if(route==='/api/lobby'){if(r.host!==p.id)fault('Only the host can return to lobby');toLobby(r);return json(res,200,{ok:true})}
  if(route==='/api/input'){
   if(r.phase!=='playing'||!r.players.includes(p))return json(res,200,{ok:true});
   const v=b.input||{};
   p.input={dx:clamp(Number(v.dx)||0,-1,1),dy:clamp(Number(v.dy)||0,-1,1),angle:Number.isFinite(Number(v.angle))?Number(v.angle):p.angle,fire:v.fire===true,dash:v.dash===true};
   p.lastInput=now();return json(res,200,{ok:true});
  }
  if(route==='/api/leave'){
   const old=r.clients.get(p.token);if(old){r.clients.delete(p.token);try{old.end()}catch{}}
   r.players=r.players.filter(x=>x.id!==p.id);r.spectators=r.spectators.filter(x=>x.id!==p.id);
   sessions.delete(p.token);
   if(r.host===p.id){const next=r.players.find(x=>x.online)||r.players[0]||r.spectators[0];if(next)r.host=next.id}
   if(!r.players.length&&r.spectators.length){r.players.push(r.spectators.shift());r.host=r.players[0].id}
   if(!r.players.length)rooms.delete(r.code);else push(r);
   return json(res,200,{ok:true});
  }
  fault('Unknown API endpoint',404);
 }catch(e){json(res,e.status||400,{error:e.message})}
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),route=url.pathname;
 if(req.method==='GET'&&route==='/events'){
  try{
   const {r,p}=getAuth(url.searchParams.get('token'));
   const old=r.clients.get(p.token);if(old&&old!==res){r.clients.delete(p.token);try{old.end()}catch{}}
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
   r.clients.set(p.token,res);p.online=true;r.activeAt=now();push(r);
   const heartbeat=setInterval(()=>{try{res.write(': keepalive\n\n')}catch{}},15000);
   res.on('close',()=>{
    clearInterval(heartbeat);if(r.clients.get(p.token)!==res)return;
    r.clients.delete(p.token);p.online=false;push(r);
    if(r.host===p.id){setTimeout(()=>{if(!p.online&&r.host===p.id){const next=r.players.find(q=>q.online);if(next){r.host=next.id;push(r)}}},30000)}
   });
  }catch(e){json(res,401,{error:e.message})}return;
 }
 if(req.method==='POST'&&route.startsWith('/api/')){
  let body='';req.on('data',chunk=>{body+=chunk;if(body.length>5000)req.destroy()});
  req.on('end',()=>api(req,res,body));return;
 }
 if(req.method==='GET'&&(route==='/'||route==='/index.html')){
  const file=path.join(__dirname,'index.html');
  fs.readFile(file,(err,data)=>{
   if(err)return json(res,404,{error:'Game client missing'});
   res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});res.end(data);
  });return;
 }
 json(res,404,{error:'Not found'});
});
server.listen(PORT,'0.0.0.0',()=>console.log('Party Arena PRO 2D running on port '+PORT));