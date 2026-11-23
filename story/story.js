/* ---------- story mode: Bot Escape (Python) and Case Files (SQL) ---------- */
// MISSIONS, CASES and CITY_SQL are written in by build.js from the story/ folder.
// The games are the screen: the story is told as dialogue lines, teaching sits behind "How it works".
SQL_SEEDS.city = CITY_SQL;
const STEPS = CASES.flatMap(c => c.steps.map((s, k) => ({...s, id: `${c.id}/${k + 1}`, caseId: c.id, k})));
const ACCUSE = CASES.map(c => ({id: c.id + "/accuse", xp: c.xp_accuse || 40}));
RANKED = [...MISSIONS, ...STEPS, ...ACCUSE];
prog.stars = prog.stars || {};
prog.cleared = prog.cleared || {};
const saveProg = () => store.set("pq-progress", prog);
const lessonTitle = id => (LESSONS.find(l => l.id === id) || {}).title || id;
const codexLinks = ids => `<div class="helpers">${ids.map(id => `<button class="btn mini" data-codex="${id}">Full lesson: ${esc(lessonTitle(id))}</button>`).join("")}</div>`;
document.addEventListener("click", e => {
  const b = e.target.closest("[data-codex]");
  if (b) { closeModal(); show("learn"); openLesson(b.dataset.codex); window.scrollTo({top:0}); }
});
// a mission or step opens once the one before it in the same list is done
const unlocked = (list, item) => { const i = list.indexOf(item); return i <= 0 || !!prog.done[list[i - 1].id]; };
const codeLines = code => code.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).length;
const stars = (n, of = 3) => Array.from({length: of}, (_, i) => `<i class="star ${i < n ? "on" : ""}"></i>`).join("");
// story text becomes short dialogue lines: sentences, merged while they stay short
function lines(html){
  const parts = html.replace(/\n+/g, " ").split(/(?<=[.!?:]["']?)\s+(?=[A-Z"<])/);
  const out = [];
  for (const p of parts) { if (out.length && (out[out.length - 1] + " " + p).length < 150) out[out.length - 1] += " " + p; else out.push(p); }
  return out.filter(Boolean);
}
const firstSentence = md => { const t = (md.split("\n").find(l => l.trim() && !/^(###|~~~|- )/.test(l.trim())) || "").replace(/<[^>]+>/g, ""); const m = t.match(/^.*?[.!?](\s|$)/); return m ? m[0] : t; };

/* ---- modal ---- */
function openModal(title, html){ $("#smTitle").textContent = title; $("#smBody").innerHTML = html; $("#smodal").hidden = false; runAllExamples(); $("#smClose").focus(); }
function closeModal(){ $("#smodal").hidden = true; }
$("#smClose").onclick = closeModal;
$("#smodal").addEventListener("click", e => { if (e.target.id === "smodal") closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#smodal").hidden && !ST) closeModal(); });

/* ---- dialogue box: one line at a time, click to continue ---- */
const NAMES = {bit: "Bit", warden: "WARDEN", radio: "Mission log", goal: "Objective", chief: "Captain Okoye"};
function talk(el, script, onDone){
  let i = 0;
  const draw = () => {
    if (i >= script.length) {
      const last = script[script.length - 1];
      el.className = "dialog mini";
      el.innerHTML = `<span class="face ${last.face}"></span><p class="line" style="font-size:.85rem">${last.html}</p><button class="next" data-replay>Replay</button>`;
      el.querySelector("[data-replay]").onclick = ev => { ev.stopPropagation(); talk(el, script, onDone); };
      el.onclick = null;
      if (onDone) onDone();
      return;
    }
    const s = script[i];
    el.className = "dialog";
    el.innerHTML = `<span class="face ${s.face}"></span><div><div class="who">${esc(s.who || NAMES[s.face])}</div><p class="line">${s.html}</p>${script.length > 1 ? `<div class="pips">${i + 1} / ${script.length}</div>` : ""}</div><button class="next">${i < script.length - 1 ? "Next" : "Got it"}</button>`;
  };
  el.onclick = () => { i++; draw(); };
  draw();
}
const say1 = (el, face, html) => talk(el, [{face, html}]);

/* ===================== BOT ESCAPE ===================== */
const botEd = CodeMirror($("#botEditor"), {...cmBase, mode:"python"});
botEd.setOption("extraKeys", {...cmBase.extraKeys, "Ctrl-Enter": () => botRun(), "Cmd-Enter": () => botRun()});
let mission = null, mapIdx = 0, anim = null;
const TAUNTS = ["WARDEN logged that. Try again.", "Predictable. WARDEN expected that move.", "Another crash for my records.", "Your robot belongs to me now. Or not, if you fix that code."];
const CHEERS = ["That works on this map!", "Path clear. Nice code.", "Bit is happy. Beep."];

function levelsHtml(){
  let h = `<div class="world">`, ch = null;
  MISSIONS.forEach((m, i) => {
    if (m.chapter !== ch) { if (ch) h += `</div></div>`; ch = m.chapter; h += `<div class="chap"><h3>${esc(ch)}</h3><div class="nodes">`; }
    const open = unlocked(MISSIONS, m), done = prog.done[m.id], now = open && !done;
    h += `<button class="node ${done ? "done" : ""} ${now ? "now" : ""} ${open ? "" : "locked"}" data-m="${m.id}" title="${esc(m.title)}"><span class="n">${i + 1}</span><span class="ss">${done ? stars(prog.stars[m.id] || 1) : ""}</span><small>${esc(m.title)}</small></button>`;
  });
  return h + `</div></div></div>`;
}
$("#botLevelsBtn").onclick = () => openModal("Bot Escape: levels", levelsHtml());
$("#smBody").addEventListener("click", e => {
  const n = e.target.closest(".node"); if (!n) return;
  if (n.classList.contains("locked")) return toast("Locked", "Finish the mission before it first.");
  closeModal(); openMission(n.dataset.m); $("#view-bot").scrollIntoView({behavior:"smooth"});
});

function openMission(id){
  const m = MISSIONS.find(x => x.id === id) || MISSIONS[0];
  mission = m; mapIdx = 0; prog.lastBot = m.id; saveProg();
  $("#botChapter").textContent = `${m.chapter} / Mission ${MISSIONS.indexOf(m) + 1} of ${MISSIONS.length}`;
  $("#botTitle").textContent = m.title;
  $("#botStars").innerHTML = prog.done[m.id] ? stars(prog.stars[m.id] || 1) : "";
  $("#botPower").innerHTML = `<span class="pc-tag">New power</span><span class="pc-name">${esc(m.covers.map(lessonTitle).join(" + "))}</span><span class="sp"></span>
    <button class="btn mini primary" id="botHow">How it works</button><p class="pc-txt">${esc(firstSentence(m.power))}</p>`;
  $("#botHow").onclick = () => openModal("New power: " + m.covers.map(lessonTitle).join(" + "), `<div class="prose">${md(m.power)}</div>${codexLinks(m.covers)}`);
  botEd.setValue(store.get("pq-draft-" + m.id, null) ?? m.starter);
  botEd.clearHistory();
  $("#botOut").innerHTML = `<p class="hint">Press Run to watch Bit follow your code. Test all maps finishes the mission.</p>`;
  $("#botBanner").hidden = true;
  renderMaps(); drawWorld(m.worlds[0]);
  const script = [...lines(m.story).map(html => ({face: "radio", html})), {face: "goal", html: m.goal}];
  if (prog.done[m.id]) talk($("#botDialog"), [script[script.length - 1]]); else talk($("#botDialog"), script);
  onEngines();
  setTimeout(() => botEd.refresh(), 0);
}
let botDraft;
botEd.on("change", () => { clearTimeout(botDraft); botDraft = setTimeout(() => mission && store.set("pq-draft-" + mission.id, botEd.getValue()), 400); });
$("#botHint").onclick = () => openModal("Hint", `<p>${esc(mission.hint)}</p>`);
$("#botSol").onclick = () => {
  prog.peeked = Object.assign(prog.peeked || {}, {[mission.id]: true}); saveProg();
  openModal("Solution", `<p class="rows">Peeking costs the third star on this mission.</p><pre class="st-out">${esc(mission.solution)}</pre><div class="helpers"><button class="btn" id="botUseSol">Copy into editor</button></div>`);
  $("#botUseSol").onclick = () => { botEd.setValue(mission.solution); closeModal(); };
};
$("#botApi").onclick = () => openModal("Robot controls", `<div class="prose">${md(ROBOT_HELP)}</div>`);
$("#botReset").onclick = () => { botEd.setValue(mission.starter); store.del("pq-draft-" + mission.id); };

function renderMaps(marks){
  const ws = mission.worlds;
  $("#botMaps").innerHTML = ws.length < 2 ? "" : ws.map((w, i) => `<button role="tab" data-i="${i}" aria-selected="${i === mapIdx}" class="${marks && marks[i] ? marks[i] : ""}">Map ${i + 1}</button>`).join("");
  const w = ws[mapIdx];
  $("#botStdin").hidden = !w.stdin;
  if (w.stdin) $("#botStdin").innerHTML = `On this map, <code>input()</code> receives: ${w.stdin.split("\n").map(s => `<code>${esc(s)}</code>`).join(" then ")}`;
}
$("#botMaps").addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (!b) return; mapIdx = +b.dataset.i; renderMaps(); drawWorld(mission.worlds[mapIdx]); $("#botBanner").hidden = true; });

const TILE = {"#":"wall", x:"hole", E:"exit", k:"key", $:"coin"};
function tileSize(cols){ const avail = Math.min($("#view-bot .stage").clientWidth || 640, 820) - 30; return Math.max(20, Math.min(58, Math.floor(avail / cols) - 3)); }
function drawWorld(w){
  stopAnim();
  const rows = w.map, cols = Math.max(...rows.map(r => r.length)), t = tileSize(cols);
  const g = $("#botGrid");
  g.style.setProperty("--t", t + "px");
  g.style.gridTemplateColumns = `repeat(${cols}, ${t}px)`;
  let h = "", bot = null;
  rows.forEach((row, y) => { for (let x = 0; x < cols; x++) {
    const c = row[x] || "#";
    if ("^>v<".includes(c)) bot = {x, y, d: {"^":"N", ">":"E", v:"S", "<":"W"}[c]};
    const cls = TILE[c] || ("ABCD".includes(c) ? "door" : "123456789".includes(c) ? "term" : "");
    h += `<div class="tile ${cls}" data-xy="${x},${y}">${"ABCD123456789".includes(c) ? c : c === "E" ? (t > 34 ? "EXIT" : "E") : ""}</div>`;
  } });
  g.innerHTML = h + `<div class="bot" id="bot"><i></i></div>`;
  g.dataset.t = t;
  if (bot) placeBot(bot);
  hud({frames: [], bag: {key: 0, coin: 0}}, w, 0);
}
function placeBot(f){
  const t = +$("#botGrid").dataset.t, el = $("#bot");
  el.style.transform = `translate(${f.x * (t + 3)}px, ${f.y * (t + 3)}px)`;
  el.firstElementChild.style.transform = `rotate(${{N:0, E:90, S:180, W:270}[f.d]}deg)`;
}
function bubble(f, text){
  const t = +$("#botGrid").dataset.t; let b = $("#botGrid .say-bubble");
  if (!b) { b = document.createElement("div"); b.className = "say-bubble"; $("#botGrid").appendChild(b); }
  b.textContent = text; b.style.left = (f.x * (t + 3) + t / 2) + "px"; b.style.top = (f.y * (t + 3) - 4) + "px";
}
// battery and bag shown in the HUD as the robot plays out its frames
function hud(s, w, upto){
  const total = w.battery || 400, used = s.frames.slice(0, upto).filter(f => f.act !== "crash").length;
  const left = Math.max(0, 1 - used / total), fill = $("#batFill");
  fill.style.width = (left * 100).toFixed(1) + "%"; fill.classList.toggle("low", left < .2);
  const bag = {key: 0, coin: 0};
  for (const f of s.frames.slice(0, upto)) { if (f.act === "pick") bag[f.item]++; if (f.act === "open") bag.key = Math.max(0, bag.key - (w.codes && w.codes[f.door] ? 0 : 1)); }
  $("#bagKey").textContent = bag.key; $("#bagCoin").textContent = bag.coin;
}
function stopAnim(){ if (anim) { clearInterval(anim); anim = null; } }
function animate(s, w, done){
  stopAnim();
  const frames = s.frames; let i = 0;
  const tick = () => {
    if (i >= frames.length) { stopAnim(); if (done) done(); return; }
    const f = frames[i++], tile = xy => $(`#botGrid [data-xy="${xy[0]},${xy[1]}"]`);
    placeBot(f); hud(s, w, i);
    if (f.act === "pick") { const el = tile([f.x, f.y]); if (el) el.classList.add("gone"); }
    if (f.act === "open") { const el = tile(f.at); if (el) { el.className = "tile"; el.textContent = ""; } }
    if (f.act === "say") bubble(f, f.text);
    if (f.act === "crash") { $("#bot").classList.add("crash"); bubble(f, "Crash!"); }
  };
  if (!frames.length) { if (done) done(); return; }
  anim = setInterval(tick, 520 - 48 * +$("#botSpeed").value); tick();
}
// one run of the learner's code on one map: the world, its files and databases are fresh every time
function runWorld(m, w, code, echo, test){
  window.pqBotLoad(JSON.stringify(w));
  namedDbs = {};
  for (const [name, sql] of Object.entries(w.dbs || {})) { const db = new SQLLIB.Database(); db.exec(sql); namedDbs[name] = db; }
  const fs = clone(w.fs || {});
  const r = py(code, w.stdin || "", fs, test || "", echo, "story");
  const s = JSON.parse(window.pqBotState());
  return {r, s, fs};
}
function judge(m, w, r, s){
  if (s.crash) return s.crash;
  if (r.err) return r.err;
  const c = m.check || {};
  if (c.items && s.items_left) return `Bit left ${s.items_left} item(s) on the floor. Pick up every key and coin.`;
  if (c.doors && s.doors_left) return `${s.doors_left} door(s) are still locked.`;
  if (c.exit && !s.at_exit) return `The program ended but Bit is not on the exit (it stopped at ${s.x}, ${s.y}).`;
  if (w.output != null && normOut(r.out) !== normOut(w.output)) return `The output is not what was expected.\n\nExpected:\n${w.output}\n\nYour output:\n${r.out || "(nothing)"}`;
  if (r.test && r.test !== "pass") return r.test;
  return "";
}
const missionReady = () => pyReady && (!mission || !mission.worlds.some(w => w.dbs) || SQLLIB);
function failBanner(why){
  const short = why.split("\n")[0].slice(0, 160);
  $("#botBanner").className = "banner bad"; $("#botBanner").textContent = short; $("#botBanner").hidden = false;
  talk($("#botDialog"), [{face: "warden", html: esc(TAUNTS[Math.floor(Math.random() * TAUNTS.length)])}]);
}
function botRun(){
  if (!mission || !missionReady()) return;
  const w = mission.worlds[mapIdx];
  drawWorld(w); $("#botBanner").hidden = true;
  const {r, s} = runWorld(mission, w, botEd.getValue(), true);
  // a crash is explained in plain words instead of a traceback through the robot's code
  $("#botOut").innerHTML = s.crash ? (r.out ? `<pre>${esc(r.out)}</pre>` : "") + `<pre class="err">${esc(s.crash)}</pre>` : pyOutput(r, w.fs || {});
  animate(s, w, () => {
    const why = judge(mission, w, r, s);
    if (why) failBanner(why);
    else { $("#bot").classList.add("win"); talk($("#botDialog"), [{face: "bit", html: esc(CHEERS[Math.floor(Math.random() * CHEERS.length)]) + (mission.worlds.length > 1 ? " Now press <b>Test all maps</b>." : " Press <b>Test all maps</b> to finish.")}]); }
  });
}
function botCheck(){
  if (!mission || !missionReady()) return;
  const m = mission, code = botEd.getValue(), marks = [];
  let fail = null;
  m.worlds.forEach((w, i) => {
    if (fail) return;
    const {r, s} = runWorld(m, w, code, false, m.test);
    const why = judge(m, w, r, s);
    marks[i] = why ? "fail" : "pass";
    if (why) fail = {i, why, s, r};
  });
  if (fail) {
    mapIdx = fail.i; renderMaps(marks); const w = m.worlds[fail.i]; drawWorld(w);
    $("#botOut").innerHTML = `<pre class="err">${m.worlds.length > 1 ? `Map ${fail.i + 1}: ` : ""}${esc(fail.why)}</pre>`;
    animate(fail.s, w, () => failBanner((m.worlds.length > 1 ? `Map ${fail.i + 1}: ` : "") + fail.why));
    return;
  }
  renderMaps(marks);
  const lines = codeLines(code), before = rankOf(xpNow()), first = !prog.done[m.id];
  const got = 1 + (lines <= m.par ? 1 : 0) + (lines <= m.par && !(prog.peeked || {})[m.id] ? 1 : 0);
  prog.done[m.id] = true; prog.stars[m.id] = Math.max(prog.stars[m.id] || 0, got); saveProg();
  renderRank();
  const after = rankOf(xpNow());
  const next = MISSIONS[MISSIONS.indexOf(m) + 1];
  const w = m.worlds[mapIdx]; drawWorld(w);
  animate(runWorld(m, w, code, false).s, w, () => {
    $("#bot").classList.add("win");
    $("#botStars").innerHTML = stars(prog.stars[m.id]);
    openModal("Mission complete", `<div class="win"><h2>${next && next.chapter !== m.chapter ? "Chapter cleared" : "Escaped"}</h2>
      <div class="big-stars">${stars(got)}</div>
      <p>${first ? `<b>+${m.xp} XP</b>. ` : ""}${lines} line(s) of code, par ${m.par}.${got < 3 ? (lines > m.par ? " Shorter code earns more stars." : " Solve it without the solution for the third star.") : ""}</p>
      ${before !== after ? `<p><b>Rank up: ${esc(after)}</b></p>` : ""}
      <div class="row">${next ? `<button class="btn go" id="winNext">Next: ${esc(next.title)}</button>` : `<p>Bit is free. You finished Bot Escape.</p>`}<button class="btn" id="winStay">Stay here</button></div></div>`);
    $("#winStay").onclick = closeModal;
    if (next) $("#winNext").onclick = () => { closeModal(); openMission(next.id); };
  });
}
$("#botRun").onclick = botRun;
$("#botCheck").onclick = () => { $("#botCheck").disabled = true; setTimeout(() => { try { botCheck(); } finally { $("#botCheck").disabled = !missionReady(); } }, 20); };
$("#botStep").onclick = () => {
  if (!mission || !missionReady()) return;
  const w = mission.worlds[mapIdx];
  window.pqBotLoad(JSON.stringify(w)); namedDbs = {};
  for (const [name, sql] of Object.entries(w.dbs || {})) { const db = new SQLLIB.Database(); db.exec(sql); namedDbs[name] = db; }
  openStepper(botEd.getValue(), w.stdin || "", clone(w.fs || {}), "story");
};
const ROBOT_HELP = `Start a program with <code>from robot import *</code> to get these.
- <code>move()</code> one square forward. <code>turn_left()</code> and <code>turn_right()</code> turn on the spot.
- <code>pick()</code> picks up the key or coin under Bit. <code>bag()</code> tells what it carries, like <code>{'key': 1, 'coin': 2}</code>.
- <code>unlock(code)</code> opens the door in front. Doors with a code need the right code; plain doors use up one key.
- <code>scan()</code> reads the terminal (numbered square) under Bit and returns its data.
- <code>say(text)</code> prints the text and shows it in a speech bubble.
- Sensors: <code>front_is_clear()</code>, <code>front()</code> (what is ahead: wall, floor, door, hole, exit, key, coin, terminal), <code>here()</code> (what is under Bit), <code>at_exit()</code>, <code>position()</code> as <code>(x, y)</code>, <code>facing()</code> as N, E, S or W.
- Walls, locked doors and holes stop Bit. Each action uses battery; an endless loop empties it.`;

/* ===================== CASE FILES ===================== */
const caseEd = CodeMirror($("#caseEditor"), {...cmBase, mode:"text/x-sqlite"});
caseEd.setOption("extraKeys", {...cmBase.extraKeys, "Ctrl-Enter": () => caseRun(), "Cmd-Enter": () => caseRun()});
let step = null, kase = null;
const caseOpen = c => { const i = CASES.indexOf(c); return i <= 0 || !!prog.done[CASES[i - 1].id + "/accuse"]; };
const stepsOf = c => STEPS.filter(s => s.caseId === c.id);
const AV = ["var(--sql)", "var(--auto)", "var(--py)", "var(--k)", "var(--d)", "var(--ok)"];
const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join("");

$("#caseListBtn").onclick = () => openModal("Case files", `<div class="cases">${CASES.map((c, i) => {
  const open = caseOpen(c), solved = prog.done[c.id + "/accuse"], ss = stepsOf(c);
  return `<button class="folder ${open ? "" : "locked"}" data-case="${c.id}"><span class="stamp ${solved ? "solved" : open ? "open" : ""}">${solved ? "SOLVED" : open ? "OPEN" : "LOCKED"}</span><small>CASE ${i + 1}</small><b>${esc(c.title)}</b><small>${ss.filter(s => prog.done[s.id]).length} of ${ss.length} leads</small></button>`;
}).join("")}</div>`);
$("#smBody").addEventListener("click", e => {
  const f = e.target.closest(".folder"); if (!f) return;
  if (f.classList.contains("locked")) return toast("Locked", "Close the case before it first.");
  const c = CASES.find(x => x.id === f.dataset.case), ss = stepsOf(c);
  closeModal(); openStep((ss.find(s => !prog.done[s.id]) || ss[ss.length - 1]).id, true);
});

function renderBoard(){
  const c = kase, ss = stepsOf(c), ready = ss.every(s => prog.done[s.id]), solved = prog.done[c.id + "/accuse"];
  const cleared = prog.cleared[c.id] || [];
  $("#caseLeads").textContent = `${ss.filter(s => prog.done[s.id]).length}/${ss.length}`;
  $("#suspects").innerHTML = c.suspects.map((p, i) => `<div class="card ${cleared.includes(p.name) ? "cleared" : ""}">
      <span class="avatar" style="--av:${AV[i % AV.length]}">${esc(initials(p.name))}</span><b>${esc(p.name)}</b><small>${esc(p.note)}</small>
      <div class="acts"><button class="btn mini ghost" data-clear="${esc(p.name)}">${cleared.includes(p.name) ? "Suspect again" : "Clear"}</button>${ready && !solved ? `<button class="btn mini go" data-accuse="${esc(p.name)}">Accuse</button>` : ""}${solved && p.name === c.culprit ? `<span class="chip" style="--tsoft:var(--bad-soft);--tc:var(--bad)">Arrested</span>` : ""}</div></div>`).join("");
  $("#notes").innerHTML = ss.map((s, k) => {
    const open = unlocked(ss, s), cur = step && step.id === s.id;
    return prog.done[s.id]
      ? `<button class="note ${cur ? "cur" : ""}" data-s="${s.id}" style="--r:${k % 2 ? 1.5 : -1.5}deg"><b>Clue ${k + 1}</b>${esc(s.clue)}</button>`
      : `<button class="note todo ${cur ? "cur" : ""} ${open ? "" : "locked"}" data-s="${s.id}" style="--r:${k % 2 ? 1 : -1}deg"><b>Lead ${k + 1}</b>${open ? esc(s.title) : "Not found yet"}</button>`;
  }).join("");
}
$("#notes").addEventListener("click", e => { const n = e.target.closest(".note"); if (!n) return; if (n.classList.contains("locked")) return toast("Locked", "Solve the lead before it first."); openStep(n.dataset.s); });
$("#suspects").addEventListener("click", e => {
  const cl = e.target.closest("[data-clear]"), ac = e.target.closest("[data-accuse]");
  if (cl) { const list = prog.cleared[kase.id] = prog.cleared[kase.id] || [], n = cl.dataset.clear; const i = list.indexOf(n); if (i >= 0) list.splice(i, 1); else list.push(n); saveProg(); renderBoard(); }
  if (ac) accuse(ac.dataset.accuse);
});
function accuse(who){
  const c = kase, id = c.id + "/accuse";
  if (who !== c.culprit) { talk($("#caseDialog"), [{face: "chief", html: `${esc(who)} has an answer for every clue. The evidence does not hold. Read the clue notes again.`}]); return; }
  const before = rankOf(xpNow()), first = !prog.done[id];
  prog.done[id] = true; saveProg(); renderRank(); renderBoard();
  const after = rankOf(xpNow()), next = CASES[CASES.indexOf(c) + 1];
  talk($("#caseDialog"), lines(c.closing).map(html => ({face: "chief", html})));
  openModal("Case closed", `<div class="win"><h2>Case closed</h2><p><b>${esc(c.culprit)}</b> is under arrest.${first ? ` <b>+${c.xp_accuse || 40} XP</b>.` : ""}</p>
    ${before !== after ? `<p><b>Rank up: ${esc(after)}</b></p>` : ""}<div class="prose" style="text-align:left;max-width:60ch;margin:auto">${md(c.closing)}</div>
    <div class="row">${next ? `<button class="btn go" id="winNextCase">Next case: ${esc(next.title)}</button>` : `<p>You closed every case in Harbor City.</p>`}<button class="btn" id="winStay">Stay here</button></div></div>`);
  $("#winStay").onclick = closeModal;
  if (next) $("#winNextCase").onclick = () => { closeModal(); openStep(next.id + "/1", true); };
}

function openStep(id, intro){
  if (id.endsWith("/accuse")) id = id.replace("/accuse", "/1");
  const s = STEPS.find(x => x.id === id) || STEPS[0], c = CASES.find(x => x.id === s.caseId);
  const newCase = kase !== c;
  step = s; kase = c; prog.lastCase = s.id; saveProg();
  const ss = stepsOf(c);
  $("#caseNo").textContent = `Case ${CASES.indexOf(c) + 1} of ${CASES.length}`;
  $("#caseTitle").textContent = c.title;
  $("#lead").innerHTML = `<div class="eyebrow">Lead ${s.k + 1} of ${ss.length}</div><h3>${esc(s.title)}</h3><div class="prose">${md(s.ask)}</div>`;
  $("#casePower").innerHTML = `<span class="pc-tag">New skill</span><span class="pc-name">${esc(s.covers.map(lessonTitle).join(" + "))}</span><span class="sp"></span>
    <button class="btn mini primary" id="caseHow">How it works</button><p class="pc-txt">${esc(firstSentence(s.brief))}</p>`;
  $("#caseHow").onclick = () => openModal("New skill: " + s.covers.map(lessonTitle).join(" + "), `<div class="prose">${md(s.brief, "city")}</div>${codexLinks(s.covers)}`);
  caseEd.setValue(store.get("pq-draft-" + s.id, null) ?? (s.starter || "SELECT *\nFROM \nLIMIT 20;"));
  caseEd.clearHistory();
  $("#caseVerdict").hidden = true;
  $("#caseOut").innerHTML = `<p class="hint">Run shows what your query finds in the city records. Submit it as evidence when it answers the lead.</p>`;
  renderBoard();
  const brief = lines(c.story).map(html => ({face: "chief", html}));
  const ask = {face: "chief", html: `Lead ${s.k + 1}: ${esc(s.title)}`};
  if ((newCase || intro) && !prog.done[s.id] && s.k === 0) talk($("#caseDialog"), [...brief, ask]);
  else talk($("#caseDialog"), [ask]);
  onEngines();
  setTimeout(() => caseEd.refresh(), 0);
}
let caseDraft;
caseEd.on("change", () => { clearTimeout(caseDraft); caseDraft = setTimeout(() => step && store.set("pq-draft-" + step.id, caseEd.getValue()), 400); });
$("#caseHint").onclick = () => openModal("Hint", `<p>${esc(step.hint)}</p>`);
$("#caseSol").onclick = () => {
  openModal("Solution", `<pre class="st-out">${esc(step.solution)}</pre><div class="helpers"><button class="btn" id="caseUseSol">Copy into editor</button></div>`);
  $("#caseUseSol").onclick = () => { caseEd.setValue(step.solution); closeModal(); };
};
$("#caseReset").onclick = () => { caseEd.setValue(step.starter || ""); store.del("pq-draft-" + step.id); };
function caseRun(){
  if (!step || !SQLLIB) return;
  try { $("#caseOut").innerHTML = withDb(db => { if (step.setup) db.exec(step.setup); return resultTables(db.exec(caseEd.getValue())); }, "city"); }
  catch(e){ $("#caseOut").innerHTML = `<pre class="err">${esc(e.message)}</pre>`; }
}
function checkStep(s, code){
  const a = freshDb("city"), b = freshDb("city");
  try {
    if (s.setup) { a.exec(s.setup); b.exec(s.setup); }
    return compareSql(s, code, a, b);
  } finally { a.close(); b.close(); }
}
function caseCheck(){
  const s = step; if (!s || !SQLLIB) return;
  const res = checkStep(s, caseEd.getValue()), v = $("#caseVerdict");
  if (!res.ok) {
    // describe the shape of the evidence, never the rows: showing them would give the clue away
    const e = res.expected;
    v.hidden = false; v.className = "verdict bad";
    v.innerHTML = `<b>Not evidence yet</b><pre>${esc(res.msg)}${e ? `\n\nThe evidence has ${e.columns.length} column(s) (${e.columns.join(", ")}) and ${e.values.length} row(s).` : ""}</pre>`;
    talk($("#caseDialog"), [{face: "chief", html: "That does not prove anything yet. Look at what the lead asks for."}]);
    return;
  }
  v.hidden = true;
  const before = rankOf(xpNow()), first = !prog.done[s.id];
  prog.done[s.id] = true; saveProg(); renderRank();
  const after = rankOf(xpNow());
  caseRun(); renderBoard();
  const note = $(`#notes [data-s="${s.id}"]`); if (note) note.classList.add("fresh");
  const ss = stepsOf(kase), next = ss[s.k + 1];
  talk($("#caseDialog"), [
    {face: "chief", html: `${first ? `Good work. <b>+${s.xp} XP</b>. ` : ""}${esc(s.clue)}`},
    ...(before !== after ? [{face: "chief", html: `Promotion: you are now <b>${esc(after)}</b>.`}] : []),
    {face: "chief", html: next ? `Next lead: ${esc(next.title)}.` : "That is every lead. Clear the suspects the clues rule out, then press <b>Accuse</b> on the one who did it."}
  ], next ? () => openStep(next.id) : null);
}
$("#caseRun").onclick = caseRun;
$("#caseCheck").onclick = caseCheck;
function renderCaseSchema(){
  if (!SQLLIB) return;
  withDb(db => {
    const t = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0];
    $("#caseSchema").innerHTML = (t ? t.values : []).map(([n]) => {
      const cols = db.exec(`SELECT name, type FROM pragma_table_info('${n}')`)[0];
      return `<div class="schema-t"><button data-ct="${esc(n)}">${esc(n)}</button><ul>${cols.values.map(([c, ty]) => `<li>${esc(c)} <span>${esc(ty)}</span></li>`).join("")}</ul></div>`;
    }).join("");
  }, "city");
}
$("#caseSchema").addEventListener("click", e => { const b = e.target.closest("button[data-ct]"); if (b) { caseEd.setValue(`SELECT *\nFROM ${b.dataset.ct}\nLIMIT 20;`); caseRun(); } });

/* ---- shared hooks ---- */
const baseOnEngines = onEngines;
onEngines = function(){
  baseOnEngines();
  for (const id of ["botRun","botCheck","botStep"]) $("#" + id).disabled = !missionReady();
  for (const id of ["caseRun","caseCheck"]) $("#" + id).disabled = !SQLLIB;
  if (SQLLIB && !$("#caseSchema").innerHTML) renderCaseSchema();
};
function storyReload(){
  prog.stars = prog.stars || {}; prog.cleared = prog.cleared || {};
  openMission(prog.lastBot || MISSIONS[0].id);
  if (STEPS.length) openStep(prog.lastCase || STEPS[0].id);
}
const baseShow = show;
show = function(v){ baseShow(v); setTimeout(() => { botEd.refresh(); caseEd.refresh(); if (v === "bot" && mission) drawWorld(mission.worlds[mapIdx]); }, 0); };
document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => show(b.dataset.view));

/* ---- self test: every mission and case step works with its own solution, and every lesson is covered ---- */
window.__selfTestStory = () => {
  const problems = [];
  const covered = new Set([...MISSIONS.flatMap(m => m.covers), ...STEPS.flatMap(s => s.covers)]);
  for (const l of LESSONS) if (!covered.has(l.id)) problems.push(["coverage", l.id, "no mission or case covers this lesson"]);
  for (const m of MISSIONS) {
    m.worlds.forEach((w, i) => {
      const {r, s} = runWorld(m, w, m.solution, false, m.test);
      const why = judge(m, w, r, s);
      if (why) problems.push([m.id, i + 1, "solution: " + why.slice(0, 300)]);
    });
    const starterPasses = m.worlds.every(w => { const {r, s} = runWorld(m, w, m.starter, false, m.test); return !judge(m, w, r, s); });
    if (starterPasses) problems.push([m.id, 0, "the starter code already passes"]);
    if (codeLines(m.solution) > m.par) problems.push([m.id, 0, `solution has ${codeLines(m.solution)} lines, par is ${m.par}`]);
  }
  for (const s of STEPS) {
    const res = checkStep(s, s.solution);
    if (!res.ok) problems.push([s.id, 0, res.msg]);
    try { const out = withDb(db => { if (s.setup) db.exec(s.setup); return db.exec(s.solution); }, "city"); if (!s.verify && !out.length) problems.push([s.id, 0, "solution returns no table"]); }
    catch(e){ problems.push([s.id, 0, e.message]); }
  }
  for (const c of CASES) if (!c.suspects.some(p => p.name === c.culprit)) problems.push([c.id, 0, "culprit is not a suspect"]);
  // story examples run too
  const from = EXAMPLES.length;
  MISSIONS.forEach(m => md(m.power)); STEPS.forEach(s => md(s.brief, "city"));
  EXAMPLES.slice(from).forEach((ex, k) => {
    if (ex.lang === "sql") { try { if (!withDb(db => db.exec(ex.code), ex.db).length) problems.push(["example", k, "no result table: " + ex.code.slice(0, 60)]); } catch(e){ problems.push(["example", k, e.message + ": " + ex.code.slice(0, 60)]); } }
    else { const r = py(ex.code, ex.stdin, clone(SEED_FS), "", true); if (r.err) problems.push(["example", k, r.err.slice(-200)]); else if (!r.out.trim()) problems.push(["example", k, "printed nothing: " + ex.code.slice(0, 60)]); }
  });
  return {missions: MISSIONS.length, steps: STEPS.length, problems};
};

storyReload();
