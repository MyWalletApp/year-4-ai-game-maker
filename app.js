const $ = id => document.getElementById(id);
let currentGame = "";

const SYSTEM = `You create safe, simple educational browser games for Year 4 children (age about 8-10).
Return ONLY one complete self-contained HTML document. No markdown fences, no explanations.
Use only inline HTML, CSS and JavaScript. Do not load external scripts, images, fonts, APIs or websites.
The game must be playable with mouse and touch on a tablet, with large buttons and readable text. Use normal DOM click/touch handlers; attach them after the DOM is ready. Avoid localStorage, sessionStorage, cookies, popups, external resources, APIs, navigation, parent/top window access, and other browser features that may be blocked in an embedded game. Never make the game depend on any of those features.
Use the student's plan faithfully. Include a clear Start Game button that MUST visibly begin the game when clicked, plus a Restart button, score, win/finish state and simple feedback. Test the button logic mentally before returning the HTML. Put game JavaScript at the end of the body or inside DOMContentLoaded so the controls definitely exist before listeners are attached.
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
  return game;
}


function prepareGame(html){
  // Make AI-generated games more reliable when embedded: move classic scripts
  // to the end of <body> so they run after game controls exist.
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const body = doc.body || doc.documentElement;
    if(body){
      [...doc.querySelectorAll("script")].forEach(script => {
        // Keep script contents/attributes intact; moving them prevents the
        // common "button exists later but listener was attached too early" bug.
        body.appendChild(script);
      });
    }
    return "<!doctype html>\n" + doc.documentElement.outerHTML;
  } catch(e){
    return html;
  }
}

function showGame(html){
  currentGame = prepareGame(html);
  $("game").srcdoc = currentGame;
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
    showGame(await generate());
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
    showGame(await generate(c));
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
