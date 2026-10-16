'use strict';
// Authoritative 2-8 player Tank Survival world for Party Arena.
// All movement, shell hits, enemy AI, pickups and destructible cover are computed on the Node server.
const W=4200,H=2600;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const len=(a,b)=>Math.hypot(a,b);
const spawnPoints=[
 [1920,1130],[2280,1460],[2250,1110],[1890,1480],
 [2060,1010],[2060,1620],[1780,1300],[2400,1300]
];
let serial=1;
function effect(w,x,y,type){w.fx.push({id:serial++,x:Math.round(x),y:Math.round(y),type,until:Date.now()+330});if(w.fx.length>40)w.fx.shift()}
function nearRect(x,y,r,o){return o.active&&x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h}
function collides(w,x,y,r){
 if(x<r+18||y<r+18||x>W-r-18||y>H-r-18)return true;
 return w.obstacles.some(o=>nearRect(x,y,r,o))
}
function spaceFree(w,x,y,players,r=35){
 if(collides(w,x,y,r))return false;
 return !players.some(p=>!p.respawnAt&&len(x-p.x,y-p.y)<r+48)
}
function obstaclePlace(w,players){
 for(let tries=0;tries<70;tries++){
  const x=Math.floor(rand(110,W-160)),y=Math.floor(rand(110,H-160));
  const type=Math.random()<.38?'crate':Math.random()<.57?'barrel':Math.random()<.72?'sandbag':'steel';
  const size=type==='steel'?76:type==='sandbag'?70:type==='crate'?62:50;
  const o={id:serial++,x,y,w:size,h:type==='steel'?90:size,type,
    hp:type==='steel'?999:type==='sandbag'?3:2,maxHp:type==='steel'?999:type==='sandbag'?3:2,
    active:true,respawnAt:0};
  if(w.obstacles.some(other=>other.active&&x<other.x+other.w+35&&x+o.w+35>other.x&&y<other.y+other.h+35&&y+o.h+35>other.y))continue;
  if(players.some(p=>Math.abs(p.x-x)<220&&Math.abs(p.y-y)<210))continue;
  return o;
 }
 return null;
}
function create(r){
 const w={w:W,h:H,obstacles:[],bullets:[],enemyBullets:[],mobs:[],pickups:[],fx:[],wave:1,
    spawnAt:0,addCoverAt:Date.now()+16000,extraCover:0,startedAt:0,serial:0};
 for(const p of r.players){
  const pos=spawnPoints[p.slot%8];p.x=pos[0];p.y=pos[1];
  p.hp=100;p.shield=0;p.invUntil=Date.now()+2800;p.respawnAt=0;
  p.angle=0;p.bodyAngle=0;p.fireAt=0;p.dashAt=0;p.tankDashUntil=0;p.dashHeld=false;
  p.score=0;p.kills=0;p.deaths=0;
 }
 for(let i=0;i<66;i++){const o=obstaclePlace(w,r.players);if(o)w.obstacles.push(o)}
 for(let i=0;i<17;i++){
  const pos=[rand(160,W-160),rand(160,H-160)];
  if(collides(w,pos[0],pos[1],32))continue;
  w.pickups.push({id:serial++,x:Math.round(pos[0]),y:Math.round(pos[1]),type:['heal','shield','boost'][i%3],active:true,respawnAt:0});
 }
 for(let i=0;i<5;i++)w.mobs.push(spawnEnemy(w,r.players));
 r.tank=w;
}
function spawnEnemy(w,players){
 for(let tries=0;tries<85;tries++){
  const x=rand(90,W-90),y=rand(90,H-90);
  if(!spaceFree(w,x,y,players,30)||players.some(p=>len(p.x-x,p.y-y)<420))continue;
  const roll=Math.random(),kind=w.wave>=3&&roll>.78?'heavy':roll>.45?'scout':'standard';
  const hp=kind==='scout'?1:3; // Red enemy tanks always take three direct hits.
  return {id:serial++,x,y,hp,maxHp:hp,kind,angle:rand(-3.14,3.14),
    speed:kind==='scout'?117:kind==='heavy'?47:77,fireAt:Date.now()+rand(1000,2100),ramAt:0}
 }
 return {id:serial++,x:rand(100,W-100),y:rand(100,H-100),hp:3,maxHp:3,kind:'standard',angle:0,speed:70,fireAt:Date.now()+1600,ramAt:0}
}
function spawnPlayer(w,p,t){
 const base=spawnPoints[p.slot%8];
 let x=base[0],y=base[1];
 for(let k=0;k<60;k++){
  const ang=k*2.399963229728653;
  const rad=k===0?0:30+Math.sqrt(k)*21;
  const nx=clamp(base[0]+Math.cos(ang)*rad,55,W-55);
  const ny=clamp(base[1]+Math.sin(ang)*rad,55,H-55);
  if(!collides(w,nx,ny,28)){x=nx;y=ny;break}
 }
 p.x=x;p.y=y;p.hp=100;p.shield=0;p.invUntil=t+1900;p.respawnAt=0;p.fireAt=t+350;
 p.tankDashUntil=0;p.input={dx:0,dy:0,angle:p.angle,fire:false,dash:false};
 effect(w,x,y,'respawn');
}
function moveEntity(w,e,dx,dy,radius){
 const x=clamp(e.x+dx,radius+20,W-radius-20),y=clamp(e.y+dy,radius+20,H-radius-20);
 if(!collides(w,x,e.y,radius))e.x=x;
 if(!collides(w,e.x,y,radius))e.y=y;
}
function takeDamage(w,p,damage,t,attacker){
 if(p.respawnAt||p.invUntil>t)return false;
 if(p.shield>0){p.shield--;p.invUntil=t+180;effect(w,p.x,p.y,'shield');return true}
 p.hp=Math.max(0,p.hp-damage);p.invUntil=t+180;effect(w,p.x,p.y,'hit');
 if(p.hp===0){
  p.respawnAt=t+2500;p.deaths++;p.input.fire=false;effect(w,p.x,p.y,'ko');
  if(attacker&&attacker.id!==p.id){attacker.score+=120;attacker.kills++}
 }else if(attacker&&attacker.id!==p.id)attacker.score+=10;
 return true;
}
function damageCover(w,o,b,t){
 if(o.type==='steel'){
  if(b.bounces<1){
   const prevX=b.x-b.vx*b.dt,prevY=b.y-b.vy*b.dt;
   if(prevX<=o.x||prevX>=o.x+o.w)b.vx*=-1;else b.vy*=-1;
   b.x=prevX;b.y=prevY;b.bounces++;
   effect(w,b.x,b.y,'spark');return 'bounce';
  }
  return 'end';
 }
 o.hp--;
 effect(w,b.x,b.y,o.type==='barrel'?'smoke':'spark');
 if(o.hp<=0){
  o.active=false;o.respawnAt=t+12000;
  effect(w,o.x+o.w/2,o.y+o.h/2,'blast');
  if(o.type==='barrel'){
   const x=o.x+o.w/2,y=o.y+o.h/2;
   for(const m of w.mobs)if(len(m.x-x,m.y-y)<110){m.hp-=2}
  }
 }
 return 'end';
}
function firePlayer(w,p,t){
 if(t<p.fireAt||p.respawnAt)return;
 p.fireAt=t+320;
 const a=p.angle,v=660;
 const bx=p.x+Math.cos(a)*36,by=p.y+Math.sin(a)*36;
 w.bullets.push({id:serial++,owner:p.id,x:bx,y:by,vx:Math.cos(a)*v,vy:Math.sin(a)*v,expires:t+2450,bounces:0});
 if(w.bullets.length>135)w.bullets.splice(0,w.bullets.length-135);
 effect(w,bx,by,'muzzle');
}
function advanceShells(w,players,t,dt){
 for(const b of w.bullets){
  b.dt=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.x<6||b.y<6||b.x>W-6||b.y>H-6||t>b.expires){b.dead=true;continue}
  const o=w.obstacles.find(x=>nearRect(b.x,b.y,5,x));
  if(o){
   const hit=damageCover(w,o,b,t);
   if(hit!=='bounce'){b.dead=true;continue}
  }
  const owner=players.find(p=>p.id===b.owner);
  if(!owner){b.dead=true;continue}
  for(const m of w.mobs){
   if(m.hp<=0||len(m.x-b.x,m.y-b.y)>29)continue;
   m.hp--;b.dead=true;effect(w,m.x,m.y,m.hp?'hit':'ko');
   if(m.hp===0){owner.score+=m.kind==='heavy'?125:85;owner.kills++}
   break;
  }
  if(b.dead)continue;
  for(const p of players){
   if(p.id===owner.id||p.respawnAt||len(p.x-b.x,p.y-b.y)>29)continue;
   // Even invulnerable bodies intercept a shell, preventing repeated pass-through hits.
   takeDamage(w,p,25,t,owner);b.dead=true;break;
  }
 }
 w.bullets=w.bullets.filter(b=>!b.dead);
 for(const b of w.enemyBullets){
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(t>b.expires||b.x<7||b.y<7||b.x>W-7||b.y>H-7){b.dead=true;continue}
  const o=w.obstacles.find(x=>nearRect(b.x,b.y,5,x));
  if(o){b.dead=true;continue}
  for(const p of players){
   if(p.respawnAt||len(p.x-b.x,p.y-b.y)>29)continue;
   takeDamage(w,p,20,t,null);b.dead=true;break;
  }
 }
 w.enemyBullets=w.enemyBullets.filter(b=>!b.dead);
}
function updateEnemies(w,players,t,dt){
 const wave=Math.min(5,1+Math.floor((t-w.startedAt)/30000));
 w.wave=wave;
 const active=players.filter(p=>!p.respawnAt);
 for(const m of w.mobs){
  if(m.hp<=0||!active.length)continue;
  const target=active.reduce((best,p)=>!best||len(p.x-m.x,p.y-m.y)<len(best.x-m.x,best.y-m.y)?p:best,null);
  const dx=target.x-m.x,dy=target.y-m.y,d=len(dx,dy)||1;
  m.angle=Math.atan2(dy,dx);
  if(d>200){
   const speed=m.speed*dt;
   moveEntity(w,m,dx/d*speed,dy/d*speed,24);
  }else if(d<110)moveEntity(w,m,-dx/d*m.speed*dt,-dy/d*m.speed*dt,24);
  if(t>=m.fireAt&&d<820){
   const count=m.kind==='heavy'?3:1;
   for(let i=0;i<count;i++){
    const angle=m.angle+(i-(count-1)/2)*.19+rand(-.065,.065),speed=310+wave*12;
    w.enemyBullets.push({id:serial++,x:m.x+Math.cos(angle)*32,y:m.y+Math.sin(angle)*32,
      vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,expires:t+3600});
   }
   m.fireAt=t+(m.kind==='scout'?1150:m.kind==='heavy'?2300:1700)*Math.max(.65,1-(wave-1)*.06)+rand(0,350);
   effect(w,m.x,m.y,'enemyMuzzle');
  }
  if(d<34&&t>=m.ramAt){m.ramAt=t+950;takeDamage(w,target,15,t,null)}
 }
 w.mobs=w.mobs.filter(m=>m.hp>0);
 const cap=Math.min(13,4+wave*2);
 if(w.mobs.length<cap&&t>=w.spawnAt){
  w.mobs.push(spawnEnemy(w,players));
  w.spawnAt=t+Math.max(750,2300-wave*240);
 }
 if(w.enemyBullets.length>130)w.enemyBullets.splice(0,w.enemyBullets.length-130);
}
function updateWorldObjects(w,players,t,dt){
 for(const o of w.obstacles){
  if(o.active||!o.respawnAt||t<o.respawnAt)continue;
  if(players.some(p=>!p.respawnAt&&nearRect(p.x,p.y,40,{...o,active:true})))continue;
  if(w.mobs.some(m=>nearRect(m.x,m.y,30,{...o,active:true})))continue;
  o.active=true;o.hp=o.maxHp;o.respawnAt=0;
  effect(w,o.x+o.w/2,o.y+o.h/2,'respawn');
 }
 if(t>=w.addCoverAt){
  w.addCoverAt=t+16000;
  if(w.extraCover<9){
   const o=obstaclePlace(w,players);
   if(o&&o.type!=='steel'){w.obstacles.push(o);w.extraCover++;effect(w,o.x+o.w/2,o.y+o.h/2,'respawn')}
  }
 }
 for(const pick of w.pickups){
  if(!pick.active){if(t>=pick.respawnAt)pick.active=true;continue}
  for(const p of players){
   if(p.respawnAt||len(p.x-pick.x,p.y-pick.y)>40)continue;
   if(pick.type==='heal'&&p.hp>=100)continue;
   if(pick.type==='heal')p.hp=Math.min(100,p.hp+40);
   if(pick.type==='shield')p.shield=Math.min(3,p.shield+2);
   if(pick.type==='boost')p.speedUntil=t+6500;
   pick.active=false;pick.respawnAt=t+17000;
   effect(w,pick.x,pick.y,'pickup');break;
  }
 }
 w.fx=w.fx.filter(f=>f.until>t);
}
function tick(r,t,dt){
 const w=r.tank;if(!w)return;
 if(!w.startedAt)w.startedAt=t;
 for(const p of r.players){
  if(p.respawnAt){if(t>=p.respawnAt)spawnPlayer(w,p,t);else continue}
  const stale=t-(p.lastInput||0)>650;
  const input=stale?{dx:0,dy:0,angle:p.angle,fire:false,dash:false}:p.input||{};
  let dx=clamp(Number(input.dx)||0,-1,1),dy=clamp(Number(input.dy)||0,-1,1);
  const magnitude=len(dx,dy);
  if(magnitude>1){dx/=magnitude;dy/=magnitude}
  if(Number.isFinite(input.angle))p.angle=input.angle;
  if(magnitude>.07)p.bodyAngle=Math.atan2(dy,dx);
  if(input.dash&&!p.dashHeld&&t>=p.dashAt&&magnitude>.1){
   p.dashAt=t+4600;p.tankDashUntil=t+260;p.invUntil=Math.max(p.invUntil,t+190);
   effect(w,p.x,p.y,'dash');
  }
  p.dashHeld=!!input.dash;
  let speed=p.speedUntil>t?285:205;
  if(p.tankDashUntil>t)speed*=2.6;
  moveEntity(w,p,dx*speed*dt,dy*speed*dt,26);
  if(input.fire)firePlayer(w,p,t);
 }
 advanceShells(w,r.players,t,dt);
 updateEnemies(w,r.players,t,dt);
 updateWorldObjects(w,r.players,t,dt);
}
function view(r){
 const w=r.tank;if(!w)return null;
 return {w:W,h:H,wave:w.wave,
   obstacles:w.obstacles.filter(o=>o.active).map(o=>({id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,type:o.type,hp:o.hp,maxHp:o.maxHp})),
   bullets:w.bullets.map(b=>({x:Math.round(b.x),y:Math.round(b.y),vx:Math.round(b.vx),vy:Math.round(b.vy),owner:b.owner})),
   enemyBullets:w.enemyBullets.map(b=>({x:Math.round(b.x),y:Math.round(b.y),vx:Math.round(b.vx),vy:Math.round(b.vy)})),
   mobs:w.mobs.map(m=>({id:m.id,x:Math.round(m.x),y:Math.round(m.y),a:m.angle,hp:m.hp,maxHp:m.maxHp,kind:m.kind})),
   pickups:w.pickups.filter(p=>p.active).map(p=>({x:p.x,y:p.y,type:p.type})),
   fx:w.fx.map(f=>({id:f.id,x:f.x,y:f.y,type:f.type}))
 };
}
module.exports={create,tick,view,W,H};
