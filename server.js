'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=Number(process.env.PORT)||3000;
const rooms=new Map(),sessions=new Map();
const now=()=>Date.now(),id=()=>crypto.randomBytes(18).toString('hex');
const code=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
const questions={
 trivia:[['Which planet is called the Red Planet?',['Venus','Mars','Jupiter','Mercury'],1],['How many sides does a hexagon have?',['5','6','7','8'],1],['What gas do plants absorb?',['Oxygen','Helium','Carbon dioxide','Hydrogen'],2],['Which ocean is the largest?',['Indian','Atlantic','Pacific','Arctic'],2]],
 guess:[['How many minutes are in 3 hours?',180,100],['How many keys are on a standard piano?',88,70],['How many degrees are in a triangle?',180,100],['How many days are in a leap year?',366,180]],
 pattern:[['What comes next? 2, 4, 8, 16, ?', ['24','32','30','36'],1],['What comes next? A, C, F, J, ?', ['M','N','O','P'],2],['What comes next? 1, 1, 2, 3, 5, ?', ['7','8','9','10'],1],['Which shape has no corners?',['Triangle','Square','Circle','Pentagon'],2],['What comes next? 3, 6, 9, 12, ?', ['13','14','15','18'],2],['What comes next? 1, 4, 9, 16, ?', ['20','25','24','36'],1]],
};
function getRoom(code){const r=rooms.get(String(code||'').toUpperCase());if(!r)throw Error('Room not found');return r}
function user(r,token){const p=r.players.find(x=>x.token===token);if(!p)throw Error('Invalid player session');return p}
function publicState(r,token){const p=[...r.players,...r.spectators].find(x=>x.token===token),isSpectator=!r.players.some(x=>x.token===token),round=r.round;
 return {code:r.code,host:r.host,me:p?.id,isHost:p?.id===r.host,isSpectator,phase:r.phase,roundIndex:r.roundIndex,players:r.players.map(x=>({id:x.id,name:x.name,score:x.score,online:x.online,answered:!!x.answered})),spectators:r.spectators.map(x=>({id:x.id,name:x.name})),endAt:r.endAt,round:round?{type:round.type,title:round.title,question:round.type==='pattern'?round.questions[Math.min(4,p?.partial?.length||0)][0]:round.question,options:round.type==='pattern'?round.questions[Math.min(4,p?.partial?.length||0)][1]:round.options,sequence:round.type==='memory'&&r.phase==='play'&&now()<round.revealUntil?round.sequence:null,step:round.step,stepCount:round.stepCount,submitted:!!p?.answered,answer:p?.answered?null:undefined}:null,results:r.results,champion:r.champion};}
function push(r){for(const [token,res] of r.clients){try{res.write('data: '+JSON.stringify(publicState(r,token))+'\n\n')}catch{r.clients.delete(token)}}}
function response(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(data))}
function roundSpec(index){const types=['trivia','memory','guess','pattern',...(['trivia','memory','guess','pattern'].sort(()=>Math.random()-.5)).slice(0,2)];const type=types[index];let q,sequence=null,step=0,stepCount=1;
 if(type==='trivia'){q=questions.trivia[index%questions.trivia.length];return {type,title:'Trivia Blitz',question:q[0],options:q[1],correct:q[2],step,stepCount}}
 if(type==='guess'){q=questions.guess[index%questions.guess.length];return {type,title:'Quick Guess',question:q[0],options:null,correct:q[1],tolerance:q[2],step,stepCount}}
 if(type==='memory'){sequence=Array.from({length:4},()=>Math.floor(Math.random()*4));return {type,title:'Memory Flash',question:'Memorize the sequence, then tap the tiles in order.',options:['◆','●','▲','■'],sequence,correct:sequence.join(','),revealUntil:now()+5000,step,stepCount}}
 q=Array.from({length:5},(_,j)=>questions.pattern[(index+j)%questions.pattern.length]);return {type,title:'Pattern Dash',question:q[0][0],options:q[0][1],correct:q.map(x=>x[2]),questions:q,step,stepCount:5}}
function beginRound(r){r.roundNonce=(r.roundNonce||0)+1;const nonce=r.roundNonce;r.phase='countdown';r.results=null;r.round=roundSpec(r.roundIndex);r.players.forEach(p=>{p.answered=false;p.partial=[];p.submittedAt=0});r.endAt=now()+3000;push(r);setTimeout(()=>{if(r.roundNonce!==nonce||r.phase!=='countdown')return;r.phase='play';r.endAt=now()+30000;if(r.round.type==='memory'){r.round.revealUntil=now()+5000;setTimeout(()=>{if(r.roundNonce===nonce&&r.phase==='play')push(r)},5000)}push(r);setTimeout(()=>{if(r.roundNonce===nonce)finishRound(r)},30000)},3000)}
function score(r,p){const rd=r.round,remaining=Math.max(0,Math.min(1,(r.endAt-p.submittedAt)/30000)),speed=Math.round(50*remaining);
 if(!p.submittedAt)return 0;
 if(rd.type==='trivia')return p.partial[0]===rd.correct?100+speed:0;
 if(rd.type==='guess'){const v=Number(p.partial[0]);return Number.isFinite(v)?Math.max(0,Math.round(150*(1-Math.abs(v-rd.correct)/rd.tolerance))):0}
 if(rd.type==='memory'){const hits=rd.sequence.reduce((n,x,i)=>n+(x===p.partial[i]?1:0),0);return hits*25+(hits===4?speed:0)}
 const hits=rd.correct.reduce((n,x,i)=>n+(x===p.partial[i]?1:0),0);return hits*20+(hits===5?speed:0)
}
function finishRound(r){if(r.phase!=='play')return;const nonce=r.roundNonce;r.phase='results';r.results=r.players.map(p=>{const points=score(r,p);p.score+=points;return {id:p.id,name:p.name,points,total:p.score}}).sort((a,b)=>b.total-a.total);r.endAt=now()+8000;push(r);setTimeout(()=>{if(r.roundNonce!==nonce||r.phase!=='results')return;if(r.roundIndex===5){endMatch(r)}else{r.roundIndex++;beginRound(r)}},8000)}
function beginTiebreak(r,playerIds){
 r.roundNonce=(r.roundNonce||0)+1;
 const nonce=r.roundNonce;
 const candidates=[
 ['How many seconds are in one hour?',3600,3600],
 ['How many minutes are in a week?',10080,10080],
 ['How many days are in five weeks?',35,35],
 ['How many hours are in eight days?',192,192],
 ['How many minutes are in a day?',1440,1440],
 ['How many centimeters are in twelve meters?',1200,1200]
 ];
 const q=candidates[(r.tieNumber||0)%candidates.length];r.tieNumber=(r.tieNumber||0)+1;
 r.phase='tie';r.champion=null;r.tieIds=playerIds;
 r.round={type:'guess',title:'Sudden Death',question:q[0],correct:q[1],tolerance:q[2],options:null,step:0,stepCount:1};
 for(const p of r.players){p.answered=!playerIds.includes(p.id);p.partial=[];p.submittedAt=0}
 r.endAt=now()+20000;push(r);
 setTimeout(()=>{
  if(r.roundNonce!==nonce||r.phase!=='tie')return;
  const ranked=r.players.filter(p=>r.tieIds.includes(p.id)).map(p=>({p,error:p.submittedAt?Math.abs(p.partial[0]-q[1]):Infinity})).sort((a,b)=>a.error-b.error);
  if(!ranked.length){r.phase='done';r.champion='No winner';push(r);return}
  const best=ranked.filter(x=>x.error===ranked[0].error);
  if(best.length>1){beginTiebreak(r,best.map(x=>x.p.id));return}
  r.phase='done';r.champion=best[0].p.name;push(r);
 },20000);
}
function endMatch(r){
 const ranked=[...r.players].sort((a,b)=>b.score-a.score);
 if(ranked.length>1&&ranked[0].score===ranked[1].score){
  r.tieNumber=0;beginTiebreak(r,ranked.filter(p=>p.score===ranked[0].score).map(p=>p.id));return;
 }
 r.phase='done';r.champion=ranked[0]?.name||'No winner';push(r);
}
function resetLobby(r){
 r.roundNonce=(r.roundNonce||0)+1;
 r.phase='lobby';r.round=null;r.results=null;r.champion=null;r.roundIndex=0;r.endAt=0;r.tieIds=[];
 const all=[...r.players,...r.spectators];
 r.players=all.slice(0,8);r.spectators=all.slice(8);
 for(const p of all){p.score=0;p.answered=false;p.partial=[];p.submittedAt=0}
 if(!r.players.some(x=>x.id===r.host)){const next=r.players.find(x=>x.online)||r.players[0];if(next)r.host=next.id}
 push(r);
}
function api(req,res,body){try{const b=JSON.parse(body||'{}'),route=req.url.split('?')[0];if(route==='/api/create'){let c;do{c=code()}while(rooms.has(c));const token=id(),p={id:id(),token,name:String(b.name||'Host').trim().slice(0,20),score:0,online:true};const r={code:c,host:p.id,players:[p],spectators:[],clients:new Map(),phase:'lobby',round:null,roundIndex:0,results:null,champion:null};rooms.set(c,r);sessions.set(token,c);return response(res,200,{code:c,token})}
 if(route==='/api/join'){const r=getRoom(b.code);if(r.players.length>=8&&r.phase==='lobby')throw Error('Room full');const name=String(b.name||'Player').trim().slice(0,20);if(!name)throw Error('Enter a nickname');const token=id(),p={id:id(),token,name,score:0,online:true};if(r.phase==='lobby'&&r.players.length<8)r.players.push(p);else r.spectators.push(p);sessions.set(token,r.code);push(r);return response(res,200,{code:r.code,token})}
 const r=getRoom(sessions.get(b.token)),p=user(r,b.token);
 if(route==='/api/start'){if(r.host!==p.id)throw Error('Only the host can start');if(r.phase!=='lobby'&&r.phase!=='done')throw Error('Game already running');if(r.players.length<2)throw Error('Need at least 2 players');if(r.phase==='done'){const slots=8-r.players.length;r.players.push(...r.spectators.splice(0,slots))}r.players.forEach(x=>x.score=0);r.roundIndex=0;r.champion=null;beginRound(r);return response(res,200,{ok:true})}
 if(route==='/api/lobby'){if(r.host!==p.id)throw Error('Only the host can return everyone to the lobby');resetLobby(r);return response(res,200,{ok:true})}
 if(route==='/api/answer'){if(r.phase!=='play'&&r.phase!=='tie')throw Error('No active round');if(p.answered)throw Error('Already submitted');if(r.phase==='tie'&&!r.tieIds.includes(p.id))throw Error('Only tied players may answer');const rd=r.round;
 if(rd.type==='pattern'){const value=Number(b.answer);if(!Number.isInteger(value)||value<0||value>3)throw Error('Invalid choice');p.partial.push(value);if(p.partial.length>=5){p.answered=true;p.submittedAt=now()}}
 else if(rd.type==='memory'){if(now()<rd.revealUntil)throw Error('Wait until sequence disappears');const arr=b.answer;if(!Array.isArray(arr)||arr.length!==4||arr.some(v=>!Number.isInteger(v)||v<0||v>3))throw Error('Enter 4 tiles');p.partial=arr;p.answered=true;p.submittedAt=now()}
 else{if(b.answer===null||b.answer===undefined||typeof b.answer==='boolean'||!Number.isFinite(Number(b.answer)))throw Error('Invalid answer');if(rd.type!=='guess'&&(!Number.isInteger(Number(b.answer))||Number(b.answer)<0||Number(b.answer)>3))throw Error('Invalid choice');p.partial=[Number(b.answer)];p.answered=true;p.submittedAt=now()}
 push(r);if(r.phase==='play'&&r.players.every(x=>x.answered))finishRound(r);return response(res,200,{ok:true})}
 throw Error('Unknown endpoint')
 }catch(e){return response(res,400,{error:e.message})}}
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;
 if(req.method==='GET'&&pathname==='/events'){const token=new URL(req.url,'http://localhost').searchParams.get('token'),c=sessions.get(token);if(!c||!rooms.has(c))return response(res,401,{error:'Invalid session'});const r=rooms.get(c);res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive'});r.clients.set(token,res);const p=r.players.concat(r.spectators).find(x=>x.token===token);if(p)p.online=true;res.write('data: '+JSON.stringify(publicState(r,token))+'\n\n');push(r);const heartbeat=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},15000);res.on('close',()=>{clearInterval(heartbeat);if(r.clients.get(token)!==res)return;r.clients.delete(token);if(p){p.online=false;push(r);if(r.host===p.id){setTimeout(()=>{if(!p.online&&r.host===p.id){const other=r.players.find(x=>x.online);if(other){r.host=other.id;push(r)}}},30000)}}});return}
 if(req.method==='POST'&&pathname.startsWith('/api/')){let body='';req.on('data',chunk=>{body+=chunk;if(body.length>10000)req.destroy()});req.on('end',()=>api(req,res,body));return}
 if(req.method==='GET'){
  // The game works with index.html in either /public or the repository root.
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  const normalized=path.normalize(relative);
  if(path.isAbsolute(normalized)||normalized==='..'||normalized.startsWith('..'+path.sep))return response(res,403,{error:'Forbidden'});
  const candidates=[path.join(__dirname,'public',normalized)];
  if(normalized==='index.html')candidates.push(path.join(__dirname,'index.html'));
  const serve=(n)=>{
   if(n>=candidates.length)return response(res,404,{error:'Not found'});
   const file=candidates[n];
   fs.readFile(file,(err,data)=>{
    if(err)return serve(n+1);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':normalized==='index.html'?'no-cache':'public, max-age=60'});
    res.end(data);
   });
  };
  serve(0);return;
 }response(res,405,{error:'Method not allowed'})});
server.listen(PORT,'0.0.0.0',()=>console.log(`Party Arena running at http://localhost:${PORT}`));
