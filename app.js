const $ = id => document.getElementById(id);
let currentGame = "";

const SYSTEM = `You create safe, simple educational browser games for Year 4 children (age about 8-10).
Return ONLY one complete self-contained HTML document. No markdown fences, no explanations.
Use only inline HTML, CSS and JavaScript. Do not load external scripts, images, fonts, APIs or websites.
Do not use localStorage, sessionStorage, IndexedDB, cookies, fetch, XMLHttpRequest, WebSocket, window.top, window.parent, window.open, or page navigation.
Do not use inline event handlers such as onclick if avoidable; attach event listeners after DOMContentLoaded.
Make every interactive control work without any external resource or browser storage.
The game must be playable with mouse and touch on a tablet, with large buttons and readable text.
Use the student's plan faithfully. Include a clear start/restart control, score, win/finish state and simple feedback.
The START GAME button MUST have a working event listener that is attached after the DOM is ready. When START GAME is clicked, hide the setup screen and immediately begin the game. Test the button logic in your generated code before returning it.
Keep mechanics simple enough for Year 4. Never include ads, purchases, chat, external links, personal-data collection, login forms, violence, scary content, gambling or inappropriate material.
The game should teach/practise the stated learning objective, not merely display information.
Do not ask for or display a child's name, email, photo, school login or other personal information.
For an improvement request, keep the same educational objective and improve the supplied game when possible.`;

function plan(){
  return {
    name: $("name").value.trim(),
    objective: $("objective").value.trim(),
    characters: $("characters").value.trim(),
    players: $("players").value,
    scoring: $("scoring").value.trim(),
    description: $("description").value.trim()
  };
}

function valid(p){
  return p.name && p.objective && p.characters && p.scoring && p.description;
}

function clean(s, n=1800){
  return String(s || "").slice(0, n);
}

function makePrompt(p, extra="", oldGame=""){
  return `${SYSTEM}

Create the game from this approved Year 4 plan:

Game name: ${clean(p.name)}
Learning objective: ${clean(p.objective)}
Characters: ${clean(p.characters)}
Players: ${clean(p.players)}
Scoring: ${clean(p.scoring)}
How it works: ${clean(p.description)}

Improvement request: ${clean(extra, 500)}

If an existing game is supplied below, improve it rather than changing the learning objective:
${clean(oldGame, 9000)}
`;
}

async function generate(extra=""){
  const p = plan();
  const prompt = makePrompt(p, extra, extra ? currentGame : "");
  const response = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      model: "openai",
      messages: [
        {role:"system", content:SYSTEM},
        {role:"user", content: prompt}
      ],
      private: true
    })
  });

  const raw = await response.text();
  if(!response.ok) throw new Error("The free AI service is busy right now. Please wait a little and try again.");

  let game = raw;
  try{
    const data = JSON.parse(raw);
    game = data?.choices?.[0]?.message?.content || data?.content || raw;
  }catch(_){}

  game = String(game)
    .replace(/^\s*```html/i,"")
    .replace(/^\s*```/i,"")
    .replace(/```\s*$/,"")
    .trim();

  if(!game.toLowerCase().includes("<html") && !game.toLowerCase().includes("<!doctype")){
    throw new Error("The AI did not return a complete game. Please try again.");
  }

  // Keep generated games self-contained and compatible with the sandbox.
  // If the model accidentally adds storage/network code, neutralize it before running.
  game = game.replace(/\b(localStorage|sessionStorage)\b/g, "__blockedStorage");
  game = game.replace(/<script[^>]+src=[\"'][^\"']+[\"'][^>]*><\/script>/gi, "");

  return game;
}

$("create").onclick = async () => {
  const p = plan();
  if(!valid(p)){
    $("status").textContent = "Please complete all the boxes before creating your game.";
    return;
  }

  $("create").disabled = true;
  $("status").textContent = "🤖 Creating your game... This may take a little while.";

  try{
    currentGame = await generate();
    $("game").srcdoc = currentGame;
    $("planner").classList.add("hidden");
    $("gameSection").classList.remove("hidden");
    $("status").textContent = "";
  }catch(e){
    $("status").textContent = "⚠️ " + e.message;
  }finally{
    $("create").disabled = false;
  }
};

$("improve").onclick = async () => {
  const c = $("change").value.trim();
  if(!c) return;

  $("improve").disabled = true;
  $("improveStatus").textContent = "🛠️ Improving your game...";

  try{
    currentGame = await generate(c);
    $("game").srcdoc = currentGame;
    $("change").value = "";
    $("improveStatus").textContent = "✅ Updated! Play it again and test your changes.";
  }catch(e){
    $("improveStatus").textContent = "⚠️ " + e.message;
  }finally{
    $("improve").disabled = false;
  }
};

$("back").onclick = () => {
  $("gameSection").classList.add("hidden");
  $("planner").classList.remove("hidden");
};
