'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=Number(process.env.PORT)||3000;
const tankWorld=require('./tank-world');
const W=1800,H=1080,ROUND_MS=150000;
const GAMES={
 tank:{id:'tank',name:'Tank Survival',duration:150000,objective:'Original Explore & Earn Tank Survival HTML arena and local upgrades.'},
 fishing:{id:'fishing',name:'Fishing 3D',duration:120000,objective:'Catch fish from a boat in first person, using the original 3D lake.'},
 jumping:{id:'jumping',name:'Skybound Trials',duration:120000,objective:'Original Explore & Earn platform challenges, checkpoints and moving platforms.'},
 space:{id:'space',name:'Nebula Endless',duration:150000,objective:'Original Explore & Earn space exploration, regional bosses and endless progression.'}
};
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
].map((o,i)=>({...o,type:['crate','steel','barrel','sandbag','crate','steel','sandbag','barrel','crate','sandbag','steel'][i],hp:[3,999,2,999,3,999,999,2,3,999,999][i]}));
const PICKSPOTS=[[900,310],[900,760],[430,550],[1370,550],[600,270],[1200,800],[1220,260],[570,820]];
const SPAWNS=[[140,150],[1650,920],[1630,150],[150,920],[900,100],[900,990],[115,540],[1690,540]];
const COLORS=['#63f3e0','#ffb55b','#ae8bff','#ff6b9a','#78adff','#b3f278','#ffd677','#ff86ed'];
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
function fault(msg,status=400){const e=new Error(msg);e.status=status;throw e}
function getRoom(code){const r=rooms.get(String(code||'').trim().toUpperCase());if(!r)fault('Room not found. Check the code.');return r}
function getAuth(token){const c=sessions.get(String(token||''));if(!c)fault('Session expired. Please create or join a room.',401);const r=getRoom(c),p=[...r.players,...r.spectators].find(p=>p.token===token);if(!p)fault('Player no longer in this room.',401);return {r,p}}
function cleanName(n){return String(n||'').trim().replace(/[<>]/g,'').slice(0,18)}
function makePlayer(name,slot){return {id:uuid(),token:uuid(),name,slot,score:0,kills:0,deaths:0,x:SPAWNS[slot][0],y:SPAWNS[slot][1],angle:0,bodyAngle:0,hp:100,shield:0,speedUntil:0,invUntil:0,respawnAt:0,online:false,fireAt:0,dashAt:0,dashHeld:false,input:{dx:0,dy:0,angle:0,fire:false,dash:false},lastInput:0}}
function resetPlayer(p){const xy=SPAWNS[p.slot%SPAWNS.length];p.vy=0;p.grounded=false;p.jumpHeld=false;p.lapCooldown=0;p.lastCatch=0;p.fishClaims=0;p.lastClassicReport=0;p.x=xy[0];p.y=xy[1];p.angle=0;p.bodyAngle=0;p.hp=100;p.shield=0;p.speedUntil=0;p.invUntil=now()+2000;p.respawnAt=0;p.fireAt=0;p.dashAt=0;p.dashHeld=false;p.score=0;p.kills=0;p.deaths=0;p.input={dx:0,dy:0,angle:0,fire:false,dash:false};p.lastInput=now()}
function playerView(p){return {id:p.id,name:p.name,slot:p.slot,x:Math.round(p.x),y:Math.round(p.y),a:p.angle,bodyA:p.bodyAngle,hp:p.hp,shield:p.shield,score:p.score,kills:p.kills,deaths:p.deaths,online:p.online,respawnAt:p.respawnAt,invUntil:p.invUntil,speedUntil:p.speedUntil,dashAt:p.dashAt,vy:p.vy,grounded:p.grounded,fishClaims:p.fishClaims}}
function stateFor(r,token){
 const p=[...r.players,...r.spectators].find(x=>x.token===token);
 return {code:r.code,phase:r.phase,me:p?.id,host:r.host,isHost:p?.id===r.host,isSpectator:!!p&&!r.players.includes(p),
 serverNow:now(),endsAt:r.endsAt,round:r.round,gameId:r.gameId,practice:r.practice,games:Object.values(GAMES),players:r.players.map(playerView),spectators:r.spectators.map(x=>({id:x.id,name:x.name})),
 bullets:r.phase==='playing'?r.bullets.map(b=>({x:Math.round(b.x),y:Math.round(b.y),vx:b.vx,vy:b.vy,owner:b.owner})):[],
 enemyBullets:r.gameId==='tank'&&r.phase==='playing'?r.enemyBullets.map(b=>({x:Math.round(b.x),y:Math.round(b.y),vx:b.vx,vy:b.vy})):[],
 wave:r.gameId==='tank'?r.wave:0,
 pickups:r.phase==='playing'?r.pickups.filter(x=>x.active).map(x=>({x:x.x,y:x.y,type:x.type})):[],
 stars:r.gameId==='jumping'&&r.phase==='playing'?r.gems.filter(g=>g.active).map(g=>({x:Math.round(g.x),y:Math.round(g.y)})):[],
 platforms:r.gameId==='jumping'?PLATFORMS:[],
 asteroids:r.gameId==='space'&&r.phase==='playing'?r.meteors.map(m=>({x:Math.round(m.x),y:Math.round(m.y),r:m.r,hp:m.hp})):[],mobs:r.gameId==='tank'&&r.phase==='playing'?r.mobs.map(m=>({x:Math.round(m.x),y:Math.round(m.y),hp:m.hp,maxHp:m.maxHp,kind:m.kind,a:m.a})):[],
 fx:r.phase==='playing'?r.fx.map(f=>({x:f.x,y:f.y,type:f.type,id:f.id})):[],
 champion:r.champion,tank:r.gameId==='tank'&&r.phase!=='lobby'?tankWorld.view(r):null,arena:{w:W,h:H,obstacles:r.gameId==='tank'?r.obstacles:[]}
 };
}
function push(r){
 for(const [token,res] of r.clients){
  try{res.write('data: '+JSON.stringify(stateFor(r,token))+'\n\n')}
  catch{r.clients.delete(token)}
 }
}
function createRoom(name){let code;do{code=newCode()}while(rooms.has(code));const p=makePlayer(name,0),r={code,players:[p],spectators:[],host:p.id,clients:new Map(),phase:'lobby',round:0,gameId:'tank',practice:false,endsAt:0,bullets:[],enemyBullets:[],obstacles:[],wave:1,mobSpawnAt:0,startedAt:0,tank:null,pickups:[],gems:[],zones:[],meteors:[],mobs:[],meteorTimer:0,scoreTimer:0,fx:[],champion:'',lastTick:now(),lastPush:0,activeAt:now()};rooms.set(code,r);sessions.set(p.token,code);return {r,p}}
function nextSlot(r){const slots=new Set([...r.players,...r.spectators].map(p=>p.slot));for(let i=0;i<8;i++)if(!slots.has(i))return i;return 0}
function toLobby(r){r.tank=null;r.phase='lobby';r.practice=false;r.round=0;r.endsAt=0;r.champion='';r.bullets=[];r.enemyBullets=[];r.obstacles=[];r.wave=1;r.mobSpawnAt=0;r.pickups=[];r.gems=[];r.zones=[];r.meteors=[];r.mobs=[];r.meteorTimer=0;r.scoreTimer=0;r.fx=[];r.players.push(...r.spectators.splice(0,8-r.players.length));for(const p of r.players)resetPlayer(p);push(r)}
const PLATFORMS=[
 {x:0,y:945,w:255,h:135},{x:340,y:860,w:185,h:25},{x:615,y:780,w:195,h:25},
 {x:892,y:875,w:180,h:25},{x:1165,y:795,w:180,h:25},{x:1430,y:865,w:180,h:25},
 {x:1650,y:920,w:150,h:30}
];
function spawnDrone(r,i){
 let x=900,y=500;
 for(let n=0;n<80;n++){
  x=rand(95,W-95);y=rand(95,H-95);
  if(canMove(x,y,36,r.obstacles)&&r.players.every(p=>Math.hypot(p.x-x,p.y-y)>290))break
 }
 const roll=Math.random(),kind=r.wave>=3&&roll>.78?'heavy':roll>.47?'scout':'standard';
 const hp=kind==='heavy'?5:kind==='scout'?1:r.wave>=3?3:2;
 return {x,y,hp,maxHp:hp,kind,a:0,vx:0,vy:0,speed:kind==='scout'?105:kind==='heavy'?43:66,
  fireAt:now()+rand(550,1800),hitAt:now()+1800}
}
function spawnAsteroid(){
 return {x:rand(100,W-100),y:rand(100,H-100),vx:rand(-95,95),vy:rand(-90,90),r:rand(21,40),hp:2,hitAt:0}
}
function start(r,practice=false){
 if(r.players.length<2&&!practice)fault('At least 2 players required. Use TEST SOLO to practice.');
 if(r.phase!=='lobby'&&r.phase!=='done')fault('Match already running.');
 r.players.push(...r.spectators.splice(0,8-r.players.length));
 for(const p of r.players)resetPlayer(p);
 r.practice=!!practice&&r.players.length===1;r.round++;r.phase='countdown';r.endsAt=now()+4000;
 r.bullets=[];r.enemyBullets=[];r.fx=[];r.champion='';r.gems=[];r.zones=[];r.meteors=[];r.mobs=[];
 r.obstacles=[];r.wave=1;r.mobSpawnAt=0;r.startedAt=0;
 r.pickups=(r.gameId==='tank'||r.gameId==='space')?PICKSPOTS.map((a,i)=>({x:a[0],y:a[1],type:['heal','shield','speed'][i%3],active:true,respawn:0})):[];
 if(r.gameId==='jumping'){
  for(const p of r.players){p.x=75+p.slot*17;p.y=922;p.vy=0;p.grounded=true}
  r.gems=PLATFORMS.slice(1).map((pl,i)=>({x:pl.x+pl.w/2,y:pl.y-52,active:true,respawn:0}))
 }
 if(r.gameId==='space')for(let i=0;i<18;i++)r.meteors.push(spawnAsteroid());
 if(r.gameId==='tank')tankWorld.create(r);
 push(r)
}
function newGem(i){
 let x,y;for(let n=0;n<50;n++){x=rand(65,W-65);y=rand(65,H-65);if(canMove(x,y,24))break}
 if(!canMove(x,y,24)){x=SPAWNS[i%8][0];y=SPAWNS[i%8][1]}
 return {x,y,rare:i%7===0,active:true,respawn:0}
}
function obstacleAt(x,y,r,obstacles){return obstacles.find(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h)}
function canMove(x,y,r=22,obstacles=OBS){return x>=r&&x<=W-r&&y>=r&&y<=H-r&&!obstacleAt(x,y,r,obstacles)}
function move(p,dx,dy,obstacles=OBS){let nx=clamp(p.x+dx,23,W-23),ny=clamp(p.y+dy,23,H-23);if(canMove(nx,p.y,24,obstacles))p.x=nx;if(canMove(p.x,ny,24,obstacles))p.y=ny}
function fire(r,p,t){
 if(t<p.fireAt||p.respawnAt||r.gameId==='fishing'||r.gameId==='jumping')return;
 p.fireAt=t+(r.gameId==='tank'?315:240);
 const a=p.angle,speed=r.gameId==='tank'?680:710;const x=p.x+Math.cos(a)*31,y=p.y+Math.sin(a)*31;
 r.bullets.push({x,y,prevX:x,prevY:y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,owner:p.id,expires:t+(r.gameId==='tank'?2350:1150),bounces:0});
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
function endGame(r){r.phase='done';r.endsAt=0;r.enemyBullets=[];const sorted=[...r.players].sort((a,b)=>b.score-a.score||a.deaths-b.deaths);const highest=sorted[0]?.score??0;r.champion=sorted.filter(p=>p.score===highest).map(p=>p.name).join(' & ');r.bullets=[];push(r)}
function tickJumping(r,t,dt){
 for(const p of r.players){
  const i=t-p.lastInput<950?p.input:{dx:0,jump:false,dash:false};
  const jump=!!(i.jump||i.dash);
  if(jump&&!p.jumpHeld&&p.grounded){p.vy=-700;p.grounded=false;effect(r,p.x,p.y,'dash')}
  p.jumpHeld=jump;
  p.x=clamp(p.x+clamp(i.dx,-1,1)*295*dt,23,W-23);
  const oldY=p.y;p.vy=Math.min(960,p.vy+1520*dt);p.y+=p.vy*dt;p.grounded=false;
  for(const pl of PLATFORMS){
   if(p.vy>=0&&p.x+20>pl.x&&p.x-20<pl.x+pl.w&&oldY+23<=pl.y+14&&p.y+23>=pl.y){
    p.y=pl.y-23;p.vy=0;p.grounded=true;break
   }
  }
  if(p.y>H+45){p.x=76+p.slot*17;p.y=922;p.vy=0;p.deaths++;effect(r,p.x,p.y,'hit')}
  if(p.x>1710&&p.y<970&&t>p.lapCooldown){p.score+=170;p.kills++;p.lapCooldown=t+2700;p.x=77;p.y=922;p.vy=0;effect(r,1720,870,'pickup')}
 }
 for(const star of r.gems){
  if(!star.active){if(t>=star.respawn)star.active=true;continue}
  for(const p of r.players)if(Math.hypot(p.x-star.x,p.y-star.y)<45){
   star.active=false;star.respawn=t+9000;p.score+=40;effect(r,star.x,star.y,'pickup');break
  }
 }
 r.fx=r.fx.filter(f=>f.until>t);
}
function damageByEnemy(r,p,t,x,y){
 if(p.respawnAt||t<p.invUntil)return;
 if(p.shield>0){p.shield--;effect(r,p.x,p.y,'shield')}
 else {p.hp=Math.max(0,p.hp-20);effect(r,p.x,p.y,'hit')}
 p.invUntil=t+850;
 if(p.hp<=0){
  p.deaths++;p.respawnAt=t+2600;p.input.fire=false;effect(r,p.x,p.y,'ko');
 }
}
function tickDrones(r,t,dt){
 r.wave=Math.min(5,1+Math.floor(Math.max(0,t-r.startedAt)/30000));
 const alive=r.players.filter(p=>!p.respawnAt);
 for(const m of r.mobs){
  if(m.hp<=0||!alive.length)continue;
  const target=alive.reduce((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)<Math.hypot(b.x-m.x,b.y-m.y)?a:b);
  const dx=target.x-m.x,dy=target.y-m.y,d=Math.hypot(dx,dy)||1;
  m.a=Math.atan2(dy,dx);
  const intent=d>205?1:d<125?-1:0;
  const step=m.speed*dt*intent;
  if(intent){
   const nextX=clamp(m.x+dx/d*step,30,W-30),nextY=clamp(m.y+dy/d*step,30,H-30);
   if(canMove(nextX,m.y,28,r.obstacles))m.x=nextX;
   if(canMove(m.x,nextY,28,r.obstacles))m.y=nextY;
  }
  if(t>=m.fireAt&&d<710){
   const burst=m.kind==='heavy'?3:1;
   for(let k=0;k<burst;k++){
    const dir=m.a+(k-(burst-1)/2)*.22+rand(-.04,.04),speed=r.wave>=4?345:290;
    r.enemyBullets.push({x:m.x+Math.cos(dir)*36,y:m.y+Math.sin(dir)*36,vx:Math.cos(dir)*speed,vy:Math.sin(dir)*speed,
      expires:t+2800,bounces:0});
   }
   if(r.enemyBullets.length>120)r.enemyBullets.splice(0,r.enemyBullets.length-120);
   m.fireAt=t+(m.kind==='scout'?1100:m.kind==='heavy'?2450:1800)*Math.max(.67,1-(r.wave-1)*.06)+rand(0,320);
   effect(r,m.x,m.y,'muzzle');
  }
  if(d<40&&t>m.hitAt){m.hitAt=t+1100;damageByEnemy(r,target,t,m.x,m.y)}
 }
 r.mobs=r.mobs.filter(m=>m.hp>0);
 const cap=Math.min(12,3+r.wave*2);
 if(r.mobs.length<cap&&t>r.mobSpawnAt){
  r.mobs.push(spawnDrone(r,r.mobs.length));r.mobSpawnAt=t+Math.max(750,2300-r.wave*220);
 }
 for(const b of r.enemyBullets){
  const px=b.x,py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.x<7||b.x>W-7||b.y<7||b.y>H-7||t>b.expires){b.dead=true;continue}
  const ob=obstacleAt(b.x,b.y,6,r.obstacles);
  if(ob){
   if(ob.type==='steel'&&b.bounces<1){
    if(px<ob.x-5||px>ob.x+ob.w+5)b.vx*=-1;else b.vy*=-1;
    b.x=px;b.y=py;b.bounces++;
   }else b.dead=true;
   if(b.dead)continue;
  }
  for(const p of r.players)if(!b.dead&&!p.respawnAt&&Math.hypot(p.x-b.x,p.y-b.y)<26){
   b.dead=true;damageByEnemy(r,p,t,b.x,b.y);
  }
 }
 r.enemyBullets=r.enemyBullets.filter(b=>!b.dead);
}
function tickAsteroids(r,t,dt){
 for(const m of r.meteors){
  m.x+=m.vx*dt;m.y+=m.vy*dt;
  if(m.x<m.r||m.x>W-m.r){m.x=clamp(m.x,m.r,W-m.r);m.vx*=-1}
  if(m.y<m.r||m.y>H-m.r){m.y=clamp(m.y,m.r,H-m.r);m.vy*=-1}
  for(const p of r.players){
   if(p.respawnAt||t<p.invUntil||t<m.hitAt||Math.hypot(m.x-p.x,m.y-p.y)>m.r+19)continue;
   m.hitAt=t+1100;p.invUntil=t+500;
   if(p.shield)p.shield--;else p.hp=Math.max(0,p.hp-28);
   effect(r,p.x,p.y,'hit');
   if(!p.hp){p.deaths++;p.respawnAt=t+2400;effect(r,p.x,p.y,'ko')}
  }
 }
 for(let i=0;i<r.meteors.length;i++)if(r.meteors[i].hp<=0)r.meteors[i]=spawnAsteroid();
}
function updateRoom(r,t,dt){
 if(r.phase==='countdown'){if(t>=r.endsAt){r.phase='playing';r.startedAt=t;r.endsAt=t+(GAMES[r.gameId]?.duration||ROUND_MS);push(r)}return}
 if(r.phase!=='playing')return;
 if(t>=r.endsAt){endGame(r);return}
 // Source-faithful HTML engines run inside each player's browser.
 // The server controls the common match clock and leaderboard.
 if(r.gameId==='tank'){tankWorld.tick(r,t,dt);return}
 if(['fishing','jumping','space'].includes(r.gameId))return;
 if(r.gameId==='jumping'){tickJumping(r,t,dt);return}
 for(const p of r.players){
  if(p.respawnAt){if(t>=p.respawnAt)respawn(p,t);else continue}
  const input=t-p.lastInput<1000?p.input:{dx:0,dy:0,angle:p.angle,fire:false,dash:false};
  if(Number.isFinite(input.angle))p.angle=input.angle;
  let dx=clamp(input.dx,-1,1),dy=clamp(input.dy,-1,1),mag=Math.hypot(dx,dy);
  if(mag>1){dx/=mag;dy/=mag}
  let speed=p.speedUntil>t?330:240;
  if(input.dash&&!p.dashHeld&&p.dashAt<t&&mag>.2){p.dashAt=t+4200;speed*=4.4;p.invUntil=Math.max(p.invUntil,t+250);effect(r,p.x,p.y,'dash')}
  p.dashHeld=!!input.dash;
  if(r.gameId==='space'){p.x=clamp(p.x+dx*speed*dt,24,W-24);p.y=clamp(p.y+dy*speed*dt,24,H-24)}
  else move(p,dx*speed*dt,dy*speed*dt,r.obstacles);
  if(mag>.1&&r.gameId==='tank')p.bodyAngle=Math.atan2(dy,dx);
  if(input.fire)fire(r,p,t);
 }
 for(const b of r.bullets){
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(t>b.expires||b.x<5||b.x>W-5||b.y<5||b.y>H-5){b.dead=true;continue}
  if(r.gameId==='tank'){
   const obstacle=obstacleAt(b.x,b.y,5,r.obstacles);
   if(obstacle){
    const oldX=b.x-b.vx*dt,oldY=b.y-b.vy*dt;
    if(obstacle.type==='steel'&&b.bounces<2){
     if(oldX<=obstacle.x-5||oldX>=obstacle.x+obstacle.w+5)b.vx*=-1;else b.vy*=-1;
     b.x=oldX;b.y=oldY;b.bounces++;effect(r,b.x,b.y,'spark');
    }else{
     b.dead=true;
     if(obstacle.hp<900){obstacle.hp-=1;effect(r,b.x,b.y,'hit');if(obstacle.hp<=0){
      r.obstacles=r.obstacles.filter(o=>o!==obstacle);
      if(obstacle.type==='barrel'){for(const mob of r.mobs)if(Math.hypot(mob.x-b.x,mob.y-b.y)<105)mob.hp-=2}
     }}
    }
    if(b.dead)continue;
   }
  }
  const shooter=r.players.find(p=>p.id===b.owner);if(!shooter){b.dead=true;continue}
  const targets=r.gameId==='space'?r.meteors:r.mobs;
  for(const obj of targets){
   const radius=r.gameId==='space'?obj.r+7:32;
   if(obj.hp>0&&Math.hypot(obj.x-b.x,obj.y-b.y)<radius){
    obj.hp--;b.dead=true;effect(r,obj.x,obj.y,'hit');
    if(obj.hp===0){shooter.score+=r.gameId==='space'?45:75;shooter.kills++;effect(r,obj.x,obj.y,'ko')}
    break
   }
  }
  if(b.dead)continue;
  for(const p of r.players){
   if(p.id===shooter.id||p.respawnAt)continue;
   if(Math.hypot(p.x-b.x,p.y-b.y)<26){b.dead=true;hit(r,p,shooter,t);break}
  }
 }
 r.bullets=r.bullets.filter(b=>!b.dead);
 if(r.gameId==='space')tickAsteroids(r,t,dt);else tickDrones(r,t,dt);
 for(const pick of r.pickups){
  if(!pick.active){if(t>=pick.respawn)pick.active=true;continue}
  for(const p of r.players){
   if(p.respawnAt||Math.hypot(p.x-pick.x,p.y-pick.y)>38)continue;
   if(pick.type==='heal'&&p.hp===100)continue;
   if(pick.type==='heal')p.hp=Math.min(100,p.hp+45);
   if(pick.type==='shield')p.shield=Math.min(3,p.shield+2);
   if(pick.type==='speed')p.speedUntil=t+7500;
   pick.active=false;pick.respawn=t+12000;effect(r,pick.x,pick.y,'pickup');break
  }
 }
 r.fx=r.fx.filter(f=>f.until>t);
}
let last=now();
setInterval(()=>{
 const t=now(),dt=Math.min(0.075,Math.max(0,(t-last)/1000));last=t;
 for(const r of rooms.values()){
  updateRoom(r,t,dt);
  if(r.phase==='playing'&&r.clients.size&&t-r.lastPush>=(r.gameId==='tank'?100:400)){push(r);r.lastPush=t}
  if(!r.clients.size&&t-r.activeAt>3600000){for(const p of [...r.players,...r.spectators])sessions.delete(p.token);rooms.delete(r.code)}
 }
},50);
function api(req,res,body){
 try{
  let b=JSON.parse(body||'{}');if(!b||typeof b!=='object')fault('Invalid request');
  const route=new URL(req.url,'http://localhost').pathname;
  if(route==='/api/create'){const name=cleanName(b.name);if(!name)fault('Enter your nickname first');const {r,p}=createRoom(name);return json(res,200,{token:p.token,code:r.code})}
  if(route==='/api/join'){const r=getRoom(b.code),name=cleanName(b.name);if(!name)fault('Enter your nickname first');if(r.players.length+r.spectators.length>=8)fault('Room full (8 players maximum)');const p=makePlayer(name,nextSlot(r));if(r.phase==='lobby')r.players.push(p);else if(r.gameId==='tank'&&r.tank&&(r.phase==='countdown'||r.phase==='playing')&&r.players.length<8){r.players.push(p);tankWorld.join(r,p)}else r.spectators.push(p);sessions.set(p.token,r.code);r.activeAt=now();push(r);return json(res,200,{token:p.token,code:r.code})}
  const {r,p}=getAuth(b.token);r.activeAt=now();
  if(route==='/api/resume')return json(res,200,{ok:true});
  if(route==='/api/classic-score'){
   if(r.phase!=='playing'||r.gameId==='fishing'||!['jumping','space'].includes(r.gameId)||!r.players.includes(p))
    fault('No classic HTML score submission available.');
   const value=Number(b.points);
   if(!Number.isFinite(value)||value<0)fault('Invalid score');
   const t=now();
   if(t-(p.lastClassicReport||0)<650)return json(res,200,{ok:true,score:p.score});
   p.lastClassicReport=t;
   // Cap client-reported local scores to prevent unlimited points from a
   // malformed browser. The original games remain client-simulated.
   const maxScore=Math.min(16000,Math.floor((t-(r.startedAt||t))/1000)*160+160);
   const safePoints=clamp(Math.floor(value),0,maxScore);
   if(safePoints>p.score){p.score=safePoints;push(r)}
   return json(res,200,{ok:true,score:p.score});
  }
  if(route==='/api/fish'){
   if(r.phase!=='playing'||r.gameId!=='fishing'||!r.players.includes(p))fault('Fishing round not active.');
   const t=now();if(t-p.lastCatch<6000)fault('Wait before catching another fish.');
   p.lastCatch=t;p.fishClaims++;const points=50+Math.floor(rand(0,60));
   p.score+=points;push(r);return json(res,200,{ok:true,points,total:p.score});
  }
  if(route==='/api/select'){
   if(r.host!==p.id)fault('Only the host can select a game');
   if(r.phase!=='lobby'&&r.phase!=='done')fault('Finish the match or return to lobby first');
   if(!Object.prototype.hasOwnProperty.call(GAMES,b.gameId))fault('Unknown game mode');
   r.gameId=b.gameId;push(r);return json(res,200,{ok:true,gameId:r.gameId});
  }
  if(route==='/api/start'){if(r.host!==p.id)fault('Only the host can start the match');start(r,b.practice===true);return json(res,200,{ok:true})}
  if(route==='/api/lobby'){if(r.host!==p.id)fault('Only the host can return to lobby');toLobby(r);return json(res,200,{ok:true})}
  if(route==='/api/input'){
   if(r.phase!=='playing'||!r.players.includes(p))return json(res,200,{ok:true});
   const v=b.input||{};
   p.input={dx:clamp(Number(v.dx)||0,-1,1),dy:clamp(Number(v.dy)||0,-1,1),angle:Number.isFinite(Number(v.angle))?Number(v.angle):p.angle,fire:v.fire===true,dash:v.dash===true,jump:v.jump===true};
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
 if(req.method==='GET'&&(route==='/'||route==='/index.html'||route==='/fishing.html'||route==='/classic.html'||route==='/tank-shared.html')){
  const file=path.join(__dirname,route==='/fishing.html'?'fishing.html':route==='/classic.html'?'classic.html':route==='/tank-shared.html'?'tank-shared.html':'index.html');
  fs.readFile(file,(err,data)=>{
   if(err)return json(res,404,{error:'Game client missing'});
   res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});res.end(data);
  });return;
 }
 json(res,404,{error:'Not found'});
});
server.listen(PORT,'0.0.0.0',()=>console.log('Party Arena PRO 2D running on port '+PORT));