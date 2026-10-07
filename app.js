const $ = id => document.getElementById(id);
let currentGame = null;
let currentPlan = null;
let currentSavedId = null;
const STORAGE_KEY = "year4-ai-game-maker-saved-v2";

function getSavedGames(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");}catch(_){return [];}
}
function setSavedGames(list){localStorage.setItem(STORAGE_KEY,JSON.stringify(list.slice(0,50)));}
function saveCurrentGame(){
  if(!currentGame || !currentPlan) return;
  const list=getSavedGames();
  const item={
    id: currentSavedId || ("g_"+Date.now()+"_"+Math.random().toString(36).slice(2,8)),
    name: currentPlan.name || currentGame.title || "My Game",
    plan: currentPlan,
    game: currentGame,
    updatedAt:new Date().toISOString()
  };
  currentSavedId=item.id;
  const idx=list.findIndex(x=>x.id===item.id);
  if(idx>=0) list[idx]=item; else list.unshift(item);
  setSavedGames(list);
  renderSavedGames();
}
function deleteSavedGame(id){
  setSavedGames(getSavedGames().filter(x=>x.id!==id));
  if(currentSavedId===id) currentSavedId=null;
  renderSavedGames();
}
function openSavedGame(id){
  const item=getSavedGames().find(x=>x.id===id); if(!item)return;
  currentSavedId=item.id; currentPlan=item.plan; currentGame=item.game;
  $("game").srcdoc=buildGameHTML(item.game,item.plan.players);
  $("planner").classList.add("hidden"); $("gameSection").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}
function encodeShared(obj){
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function decodeShared(str){
  str=str.replace(/-/g,"+").replace(/_/g,"/");
  while(str.length%4)str+="=";
  return JSON.parse(decodeURIComponent(escape(atob(str))));
}
function shareCurrentGame(){
  if(!currentGame || !currentPlan)return;
  const payload={plan:currentPlan,game:currentGame};
  const url=location.origin+location.pathname+"#game="+encodeShared(payload);
  navigator.clipboard?.writeText(url).then(
    ()=>{$("shareStatus").textContent="✅ Share link copied! Send it to your classmates.";},
    ()=>{prompt("Copy this game link:",url);}
  );
}
function loadSharedGame(){
  const m=location.hash.match(/^#game=(.+)$/);
  if(!m)return false;
  try{
    const payload=decodeShared(m[1]);
    if(!payload?.game||!payload?.plan)return false;
    currentPlan=payload.plan; currentGame=payload.game; currentSavedId=null;
    $("game").srcdoc=buildGameHTML(payload.game,payload.plan.players);
    $("planner").classList.add("hidden"); $("gameSection").classList.remove("hidden");
    $("shareStatus").textContent="🔗 Shared game loaded. You can play it here.";
    return true;
  }catch(_){return false;}
}
function renderSavedGames(){
  const box=$("savedList"); if(!box)return;
  const list=getSavedGames();
  if(!list.length){box.innerHTML='<p class="hint">No saved games yet. Create a game and it will appear here.</p>';return;}
  box.innerHTML=list.map(item=>'<div class="savedItem"><div><strong>'+esc(item.name)+'</strong><div class="savedDate">'+new Date(item.updatedAt).toLocaleString()+'</div></div><div class="savedActions"><button class="secondary" data-play="'+item.id+'">PLAY</button><button class="danger" data-delete="'+item.id+'">DELETE</button></div></div>').join("");
  box.querySelectorAll("[data-play]").forEach(b=>b.onclick=()=>openSavedGame(b.dataset.play));
  box.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteSavedGame(b.dataset.delete));
}

const SYSTEM = `You create simple, safe educational browser games for Year 4 children (age 8-10).
You are NOT writing HTML or JavaScript. Return ONLY valid JSON matching the schema below. No markdown, no code fences, no extra text.
The game must be playable as a simple turn-based educational quiz using multiple-choice questions.
Use the student's plan faithfully. Make questions directly practise the learning objective.
Schema:
{
  "title": string,
  "instructions": string,
  "pointsPerCorrect": number,
  "questions": [
    {"question": string, "options": [string,string,string,string], "answer": number, "explanation": string}
  ]
}
Rules: exactly 6 questions; exactly 4 options per question; answer is 0,1,2,or 3; pointsPerCorrect is 5,10,15,20,or 25; no personal information; no external resources; no violence, gambling, ads, purchases, login, chat, or scary content.`;

function plan(){return {name:$("name").value.trim(),objective:$("objective").value.trim(),characters:$("characters").value.trim(),players:$("players").value,scoring:$("scoring").value.trim(),description:$("description").value.trim()};}
function valid(p){return p.name&&p.objective&&p.characters&&p.scoring&&p.description;}
function clean(s,n=2500){return String(s||"").slice(0,n);}
function promptFor(p,extra="",old=null){return `${SYSTEM}\n\nApproved plan:\nGame name: ${clean(p.name)}\nLearning objective: ${clean(p.objective)}\nCharacters: ${clean(p.characters)}\nPlayers: ${clean(p.players)}\nScoring: ${clean(p.scoring)}\nHow it works: ${clean(p.description)}\n\n${extra?`Improvement request: ${clean(extra,700)}\nExisting game JSON: ${JSON.stringify(old)}`:"Create a new game."}`;}

async function askAI(prompt){
 const response=await fetch("https://text.pollinations.ai/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"openai",messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],private:true})});
 const raw=await response.text();
 if(!response.ok) throw new Error("The free AI service is busy right now. Please try again.");
 let text=raw; try{const d=JSON.parse(raw);text=d?.choices?.[0]?.message?.content||d?.content||raw;}catch(_){ }
 text=String(text).replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/i,"").trim();
 const a=text.indexOf("{"); const b=text.lastIndexOf("}"); if(a<0||b<=a) throw new Error("The AI did not return a valid game. Please try again.");
 let game; try{game=JSON.parse(text.slice(a,b+1));}catch(e){throw new Error("The AI returned invalid game data. Please try again.");}
 if(!game.title||!Array.isArray(game.questions)||game.questions.length<4) throw new Error("The AI returned an incomplete game. Please try again.");
 game.questions=game.questions.slice(0,6).map(q=>({question:String(q.question||"Question"),options:Array.isArray(q.options)?q.options.slice(0,4).map(String):[],answer:Number(q.answer),explanation:String(q.explanation||"")})).filter(q=>q.options.length===4&&q.answer>=0&&q.answer<4);
 if(game.questions.length<4) throw new Error("The AI returned incomplete questions. Please try again.");
 game.pointsPerCorrect=[5,10,15,20,25].includes(Number(game.pointsPerCorrect))?Number(game.pointsPerCorrect):10;
 return game;
}

function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\"/g,"&quot;").replace(/'/g,"&#39;");}
function buildGameHTML(game,players){
 const rawPlayers = String(players ?? '1').trim().toLowerCase();
 const playerCount = Math.max(1, Math.min(2, /2/.test(rawPlayers) ? 2 : 1));
 const playerList = Array.isArray(game.players) && game.players.length
   ? game.players.slice(0,2).map((x,i)=>String(x||`Player ${i+1}`))
   : Array.from({length:playerCount},(_,i)=>`Player ${i+1}`);
 const payload = {
   title:String(game.title||'My Game'),
   instructions:String(game.instructions||''),
   pointsPerCorrect:Number(game.pointsPerCorrect)||10,
   questions:Array.isArray(game.questions)?game.questions:[],
   players:playerList
 };
 const safeData = JSON.stringify(payload).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font-family:Arial,sans-serif;background:#f4f7ff;color:#17223b}.wrap{max-width:760px;margin:auto;padding:22px}.screen{background:white;border-radius:18px;padding:24px;box-shadow:0 6px 25px #0001}.title{font-size:30px;font-weight:800;margin-bottom:8px}.sub{color:#667085;line-height:1.5}.score{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.pill{background:#edf1ff;border-radius:999px;padding:8px 12px;font-weight:700}.question{font-size:23px;font-weight:800;line-height:1.35;margin:18px 0}.options{display:grid;gap:10px}.opt{border:2px solid #dfe5f2;background:#fff;border-radius:12px;padding:13px;text-align:left;font-size:17px;cursor:pointer}.opt:hover{background:#f4f7ff}.msg{margin-top:14px;font-weight:700;min-height:24px}.start,.next,.restart{border:0;border-radius:12px;padding:13px 20px;background:#536dfe;color:#fff;font-weight:800;font-size:16px;cursor:pointer}.next{margin-top:14px}.hidden{display:none}.finish{text-align:center}.big{font-size:25px;font-weight:800}.small{color:#667085;margin-top:8px}</style></head><body><div class="wrap"><div id="app"></div></div><script id="game-data" type="application/json">${safeData}</script><script>
(function(){
const GAME=JSON.parse(document.getElementById('game-data').textContent||'{}');
if(!Array.isArray(GAME.players)){const n=Math.max(1,Math.min(2,Number(GAME.players)||1));GAME.players=Array.from({length:n},(_,i)=>'Player '+(i+1));}
const root=document.getElementById('app');let q=0;let scores=GAME.players.map(()=>0);let answered=false;
function renderStart(){root.innerHTML='<div class="screen"><div class="title">'+GAME.title+'</div><div class="sub">'+GAME.instructions+'</div><div class="score">'+GAME.players.map((_,i)=>'<span class="pill">Player '+(i+1)+': 0</span>').join('')+'</div><button class="start" id="startBtn">START GAME</button></div>';document.getElementById('startBtn').onclick=startGame;}
function startGame(){q=0;scores=GAME.players.map(()=>0);renderQuestion();}
function renderQuestion(){if(q>=GAME.questions.length){finish();return;}answered=false;const item=GAME.questions[q]||{};const turn=q%GAME.players.length;root.innerHTML='<div class="screen"><div class="score">'+GAME.players.map((_,i)=>'<span class="pill">Player '+(i+1)+': '+scores[i]+'</span>').join('')+'</div><div class="sub">Question '+(q+1)+' of '+GAME.questions.length+' · Player '+(turn+1)+' turn</div><div class="question">'+String(item.question||'Question')+'</div><div class="options">'+(Array.isArray(item.options)?item.options:[]).map((o,i)=>'<button class="opt" data-i="'+i+'">'+String(o)+'</button>').join('')+'</div><div class="msg" id="msg"></div><button class="next hidden" id="nextBtn">NEXT QUESTION</button></div>';document.querySelectorAll('.opt').forEach(b=>b.onclick=()=>answer(Number(b.dataset.i)));}
function answer(i){if(answered)return;answered=true;const item=GAME.questions[q]||{};const turn=q%GAME.players.length;const msg=document.getElementById('msg');if(i===Number(item.answer)){scores[turn]+=Number(GAME.pointsPerCorrect)||10;msg.textContent='Correct! +'+(Number(GAME.pointsPerCorrect)||10)+' points. '+(item.explanation||'');}else{msg.textContent='Not quite. '+(item.explanation||'');}document.querySelectorAll('.opt').forEach(b=>b.disabled=true);const n=document.getElementById('nextBtn');n.classList.remove('hidden');n.onclick=()=>{q++;renderQuestion();};}
function finish(){const best=Math.max.apply(null,scores);root.innerHTML='<div class="screen finish"><div class="big">🎉 Game finished!</div><div class="score">'+GAME.players.map((_,i)=>'<span class="pill">Player '+(i+1)+': '+scores[i]+' points</span>').join('')+'</div><div class="sub">'+(scores.filter(s=>s===best).length>1?'Great job! It is a tie!':'Player '+(scores.indexOf(best)+1)+' wins!')+'</div><br><button class="restart" id="restartBtn">PLAY AGAIN</button></div>';document.getElementById('restartBtn').onclick=renderStart;}
renderStart();
})();
</script></body></html>`;
}
async function generate(extra=""){
 const p=plan(); currentPlan=p;const game=await askAI(promptFor(p,extra,extra?currentGame:null));currentGame=game;return buildGameHTML(game,Math.max(1,Math.min(2,game.players?Number(game.players):String(p.players).startsWith("2")?2:1)));
}

$("create").onclick=async()=>{const p=plan();if(!valid(p)){$("status").textContent="Please complete all the boxes before creating your game.";return;}$("create").disabled=true;$("game").srcdoc="";$("gameSection").classList.add("hidden");history.replaceState(null,"",location.pathname+location.search);$("status").textContent="🤖 Creating your game...";try{currentSavedId=null;currentGame=null;currentPlan=p;const html=await generate();$("game").srcdoc=html;saveCurrentGame();$("planner").classList.add("hidden");$("gameSection").classList.remove("hidden");$("status").textContent="";}catch(e){$("planner").classList.remove("hidden");$("gameSection").classList.add("hidden");$("status").textContent="⚠️ "+e.message;}finally{$("create").disabled=false;}};
$("improve").onclick=async()=>{const c=$("change").value.trim();if(!c||!currentGame)return;$("improve").disabled=true;$("improveStatus").textContent="🛠️ Improving your game...";try{$("game").srcdoc="";const html=await generate(c);$("game").srcdoc=html;saveCurrentGame();$("change").value="";$("improveStatus").textContent="✅ Updated!";}catch(e){$("improveStatus").textContent="⚠️ "+e.message;}finally{$("improve").disabled=false;}};
$("back").onclick=()=>{$("game").srcdoc="";$("gameSection").classList.add("hidden");$("planner").classList.remove("hidden");$("status").textContent="";$("improveStatus").textContent="";$("shareStatus").textContent="";history.replaceState(null,"",location.pathname+location.search);};
$("share").onclick=shareCurrentGame;

renderSavedGames();
loadSharedGame();
