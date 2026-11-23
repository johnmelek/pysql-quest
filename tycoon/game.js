/* ---------- Script City: every script you write becomes a machine that earns while you are away ---------- */
// CONTRACTS and COMPANY_SQL are written in by build.js from the tycoon/ folder. Contracts come in two lines
// that run side by side: code (Python, then automation) and data (SQL). Each line is played in order.
SQL_SEEDS.company = COMPANY_SQL;
const C = CONTRACTS.map(c => ({type: "order", xp: c.type && c.type !== "order" ? 15 : 20, ...c}));
const byId = id => C.find(c => c.id === id);
const LINES = {code: C.filter(c => c.district !== "sql"), data: C.filter(c => c.district === "sql")};
const lineOf = c => c.district === "sql" ? "data" : "code";
const idxOf = c => LINES[lineOf(c)].indexOf(c);
const DISTRICTS = [{id: "py", name: "Python Workshop"}, {id: "auto", name: "Automation Dock"}, {id: "sql", name: "SQL Tower"}];
RANKED = C;
// a license costs about 2 minutes of what the floor earns by then: long enough to want upgrades, short enough to wait for
const LIC_EVERY = 8;
const OFFLINE_RATE = 0.5, OFFLINE_CAP = 8 * 3600;
const freshTy = () => ({coins: 0, levels: {}, seen: Date.now(), licenses: {}, records: {}, streak: {n: 0, last: ""}, drill: {day: "", done: false}, muted: false});
let ty = Object.assign(freshTy(), store.get("pq-ty", {}));
const saveTy = () => { ty.seen = Date.now(); store.set("pq-ty", ty); };
const fmt = n => { n = Math.floor(n); if (n < 1000) return String(n); const u = ["K", "M", "B", "T"]; let i = -1; while (n >= 1000 && i < 3) { n /= 1000; i++; } return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + u[i]; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const initials = n => n.split(",")[0].trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("");
const AV = ["var(--sql)", "var(--auto)", "var(--py)", "var(--k)", "var(--d)", "var(--ok)"];
const avOf = s => AV[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length];
const codeLines = code => code.split("\n").filter(l => l.trim() && !l.trim().startsWith("#") && !l.trim().startsWith("--")).length;
const lessonTitle = id => (LESSONS.find(l => l.id === id) || {}).title || id;

/* ---- the economy ---- */
const done = c => !!prog.done[c.id];
const reached = c => { const i = idxOf(c); return i === 0 || done(LINES[lineOf(c)][i - 1]); };
const licKey = c => { const i = idxOf(c); return i > 0 && i % LIC_EVERY === 0 ? `${lineOf(c)}-${i}` : null; };
const licCost = c => Math.round(Math.max(baseIncome(c) * 400, rate() * 120) / 100) * 100;
const available = c => !done(c) && reached(c) && (!licKey(c) || ty.licenses[licKey(c)]);
const baseIncome = c => Math.max(1, Math.round(2 * Math.pow(1.3, idxOf(c))));
const level = id => ty.levels[id] || 0;
// a machine stops when its client sent an update or a bug report that is now waiting at the head of the line
const jammedBy = m => C.find(x => x.of === m.id && x.type !== "order" && !done(x) && reached(x));
const machines = () => C.filter(c => c.type === "order" && done(c));
const income = m => jammedBy(m) ? 0 : baseIncome(m) * (1 + level(m.id));
const rate = () => machines().reduce((s, m) => s + income(m), 0);
const upCost = m => Math.round(baseIncome(m) * 25 * Math.pow(1.75, level(m.id)));

/* ---- sound: tiny synth, no files ---- */
let actx = null;
function sfx(kind){
  if (ty.muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = {coin: [[880, .05], [1320, .08]], ship: [[523, .09], [659, .09], [784, .09], [1047, .25]], err: [[180, .18], [140, .25]], up: [[440, .06], [660, .06], [990, .12]], buy: [[392, .08], [523, .08], [784, .2]], jam: [[300, .1], [200, .2]]}[kind] || [];
    let t = actx.currentTime;
    for (const [f, d] of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === "err" || kind === "jam" ? "sawtooth" : "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + .02); t += d * .8;
    }
  } catch(e){}
}
$("#tyMute").onclick = () => { ty.muted = !ty.muted; saveTy(); muteLabel(); };
const muteLabel = () => { $("#tyMute").textContent = ty.muted ? "Sound off" : "Sound on"; $("#tyMute").setAttribute("aria-pressed", ty.muted); };

/* ---- modal ---- */
function openModal(title, html, wide){ $("#smTitle").textContent = title; $("#smBody").innerHTML = html; $(".sm-card").style.width = wide ? "min(860px,100%)" : ""; $("#smodal").hidden = false; runAllExamples(); }
function closeModal(){ $("#smodal").hidden = true; }
$("#smClose").onclick = closeModal;
$("#smodal").addEventListener("click", e => { if (e.target.id === "smodal") closeModal(); });
document.addEventListener("keydown", e => { if (e.key !== "Escape" || ST) return; if (!$("#smodal").hidden) closeModal(); else if (!$("#work").hidden) closeWork(); });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-codex]");
  if (b) { closeModal(); closeWork(); show("learn"); openLesson(b.dataset.codex); window.scrollTo({top: 0}); }
});

/* ---- HUD and orders ---- */
let shownCoins = ty.coins;
function hud(){
  shownCoins += (ty.coins - shownCoins) * .2;
  if (Math.abs(ty.coins - shownCoins) < 1) shownCoins = ty.coins;
  $("#tyCoins").textContent = fmt(shownCoins);
  $("#tyRate").textContent = `+${fmt(rate())} / s`;
  $("#tyMachines").textContent = machines().length;
  $("#tyStreak").textContent = ty.streak.n;
}
function drillPick(){
  const pool = machines(); if (!pool.length) return null;
  const d = today(); let h = 0; for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}
const drillReward = () => Math.round(rate() * 180 + 60 * (ty.streak.n + 1));
function renderOrders(){
  let h = "";
  const dm = drillPick();
  if (dm) {
    const fin = ty.drill.day === today() && ty.drill.done;
    h += `<div class="order daily"><div class="o-meta"><span class="tag gold">Daily drill</span><span class="tag">Streak ${ty.streak.n}</span></div>
      <b>${fin ? "Drill done. Come back tomorrow." : `Rebuild "${esc(dm.machine.name)}" from memory`}</b>
      <p>${fin ? "Your streak is safe." : `Write it again from a blank starter. Reward: ${fmt(drillReward())} coins.`}</p>${fin ? "" : `<button class="btn mini go" data-drill="${dm.id}">Start drill</button>`}</div>`;
  }
  for (const [line, list] of Object.entries(LINES)) {
    const head = list.find(c => !done(c));
    if (!head) { h += `<div class="order"><b>${line === "code" ? "Every code order shipped" : "Every data order shipped"}</b><p>Upgrade your machines and keep your streak.</p></div>`; continue; }
    const key = licKey(head);
    if (key && !ty.licenses[key]) {
      const cost = licCost(head), can = ty.coins >= cost;
      h += `<div class="order lic"><div class="o-meta"><span class="tag ${head.district}">${DISTRICTS.find(d => d.id === head.district).name}</span><span class="tag">License</span></div>
        <b>Bigger clients need a business license</b><p>${fmt(cost)} coins. Your machines are earning it right now${can ? "" : ` (${fmt(Math.max(0, cost - ty.coins))} to go)`}.</p>
        <button class="btn mini ${can ? "go" : ""}" data-lic="${head.id}" ${can ? "" : "disabled"}>Buy license</button></div>`;
      continue;
    }
    const hot = head.type !== "order", of = head.of && byId(head.of);
    h += `<div class="order ${hot ? "hot" : ""}"><div class="o-top"><span class="o-av" style="--av:${avOf(head.client)}">${esc(initials(head.client))}</span><span class="o-who">${esc(head.client)}</span></div>
      <b>${esc(head.title)}</b>
      <div class="o-meta"><span class="tag ${head.district}">${head.district === "py" ? "Python" : head.district === "auto" ? "Automation" : "SQL"}</span>${
        head.type === "update" ? `<span class="tag bad">${esc(of.machine.name)} jammed</span>` : head.type === "bug" ? `<span class="tag bad">Bug in ${esc(of.machine.name)}</span>` : `<span class="tag gold">+${fmt(baseIncome(head))} / s machine</span>`}</div>
      <button class="btn mini ${hot ? "danger" : "primary"}" data-take="${head.id}">${hot ? "Fix it" : "Take order"}</button></div>`;
  }
  $("#tyOrders").innerHTML = h;
}
$("#tyOrders").addEventListener("click", e => {
  const t = e.target.closest("[data-take]"), l = e.target.closest("[data-lic]"), d = e.target.closest("[data-drill]");
  if (t) openWork(byId(t.dataset.take), "order");
  if (d) openWork(byId(d.dataset.drill), "drill");
  if (l) {
    const c = byId(l.dataset.lic), cost = licCost(c);
    if (ty.coins < cost) return;
    ty.coins -= cost; ty.licenses[licKey(c)] = true; saveTy(); sfx("buy");
    toast("License bought", "New clients are calling.");
    renderOrders();
  }
});

/* ---- work bench ---- */
const wEd = CodeMirror($("#wEditor"), {...cmBase, mode: "python"});
wEd.setOption("extraKeys", {...cmBase.extraKeys, "Ctrl-Enter": () => wRun(), "Cmd-Enter": () => wRun()});
let work = null, timer = null;
const isSql = c => c.district === "sql";
const draftKey = () => "pq-draft-ty-" + work.c.id + (work.mode === "drill" ? "-drill" : "");
function starterFor(c, mode){
  if (mode === "drill") return c.starter;
  if (c.type === "update") return store.get("pq-ty-code-" + c.of, null) ?? byId(c.of).solution;
  return c.starter;
}
function openWork(c, mode){
  work = {c, mode, t0: Date.now()};
  const of = c.of && byId(c.of), sk = c.skill;
  $(".w-card").className = "w-card d-" + c.district;
  $("#wAv").style.setProperty("--av", avOf(c.client)); $("#wAv").textContent = initials(c.client);
  $("#wClient").textContent = c.client + (mode === "drill" ? " (daily drill)" : "");
  $("#wTitle").textContent = mode === "drill" ? `Drill: ${c.machine.name}` : c.title;
  const msgs = c.brief.split(/(?<=[.!?])\s+(?=[A-Z"])/).reduce((a, s) => { if (a.length && (a[a.length - 1] + s).length < 120) a[a.length - 1] += " " + s; else a.push(s); return a; }, []);
  $("#wChat").innerHTML = (mode === "drill" ? [`Daily drill: rebuild this machine from a blank starter, without looking at your old code. Remembering is what makes it stick.`] : msgs).map(m => `<div class="bubble-in">${m}</div>`).join("");
  const db = isSql(c) ? "company" : undefined;
  $("#wSkill").innerHTML = sk ? `<div class="s-head"><span class="tagline">New skill</span><b>${esc(sk.title)}</b><span class="sp"></span>${(c.covers || []).map(id => `<button class="btn mini" data-codex="${id}" title="Open the full lesson">Lesson: ${esc(lessonTitle(id))}</button>`).join("")}</div>
      <div class="prose">${md(sk.card + (sk.example ? `\n\n~~~${isSql(c) ? "sql" : "python"}\n${sk.example}\n~~~` : ""), db)}</div>`
    : of ? `<div class="s-head"><span class="tagline">Your machine</span><b>${esc(of.machine.name)}</b></div><div class="prose"><p>${c.type === "update" ? "The editor holds the code you shipped for this machine. Change it to handle the update." : "Someone else's change broke this machine. Find the bug and fix it."}</p></div>` : "";
  $("#wSkill").hidden = !$("#wSkill").innerHTML;
  $("#wTask").innerHTML = md(c.task, db);
  $("#wReveal").innerHTML = "";
  const tests = c.tests || [];
  $("#wCase").innerHTML = tests.map((t, i) => `<option value="${i}">${esc(t.name || `Sample ${i + 1}`)}</option>`).join("");
  $("#wCase").hidden = isSql(c) || tests.length < 2;
  $("#wStep").hidden = isSql(c);
  wEd.setOption("mode", isSql(c) ? "text/x-sqlite" : "python");
  wEd.setValue(store.get(draftKey(), null) ?? starterFor(c, mode));
  wEd.clearHistory();
  $("#wOut").innerHTML = `<p class="hint">Run tries your code on sample data. Ship it runs every check; when it passes, ${c.type === "order" && mode === "order" && !done(c) ? "a new machine goes on the floor." : "the machine is fixed."}</p>`;
  $("#wVerdict").hidden = true;
  caseInfo();
  $("#work").hidden = false; document.body.style.overflow = "hidden";
  clearInterval(timer); timer = setInterval(() => { const s = Math.floor((Date.now() - work.t0) / 1000); $("#wTimer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }, 1000);
  $("#wTimer").textContent = "0:00";
  onEngines();
  setTimeout(() => { wEd.refresh(); wEd.focus(); }, 0);
}
function closeWork(){ $("#work").hidden = true; document.body.style.overflow = ""; clearInterval(timer); work = null; }
$("#wClose").onclick = closeWork;
let wDraft;
wEd.on("change", () => { clearTimeout(wDraft); wDraft = setTimeout(() => work && store.set(draftKey(), wEd.getValue()), 400); });
$("#wHint").onclick = () => { $("#wReveal").innerHTML = `<p><b>Hint:</b> ${esc(work.c.hint)}</p>`; };
$("#wSol").onclick = () => {
  $("#wReveal").innerHTML = `<pre>${esc(work.c.solution)}</pre><div class="helpers"><button class="btn mini" id="wUseSol">Copy into editor</button></div>`;
  work.peeked = true;
  $("#wUseSol").onclick = () => wEd.setValue(work.c.solution);
};
$("#wReset").onclick = () => { wEd.setValue(starterFor(work.c, work.mode)); store.del(draftKey()); };
$("#wCase").onchange = caseInfo;
function caseInfo(){
  const t = (work.c.tests || [])[+$("#wCase").value || 0] || {};
  $("#wStdin").hidden = !t.stdin;
  if (t.stdin) $("#wStdin").innerHTML = `Lines typed into <code>input()</code> in this sample: ${t.stdin.split("\n").map(s => `<code>${esc(s)}</code>`).join(" then ")}`;
}
// one run of a Python order on one sample: its files and databases are fresh every time
function runCase(c, t, code, echo, test){
  namedDbs = {};
  for (const [name, sql] of Object.entries(t.dbs || {})) { const db = new SQLLIB.Database(); if (sql) db.exec(sql); namedDbs[name] = db; }
  return py(code, t.stdin || "", clone(t.fs || {}), test || "", echo, "story");
}
function judgeCase(t, r){
  if (r.err) return r.err;
  if (t.output != null && normOut(r.out) !== normOut(t.output)) return `The output is not what the client expects.\n\nExpected:\n${t.output}\n\nYour output:\n${r.out || "(nothing)"}`;
  if (r.test && r.test !== "pass") return r.test;
  return "";
}
function checkSqlC(c, code){
  const a = freshDb("company"), b = freshDb("company");
  try { if (c.setup) { a.exec(c.setup); b.exec(c.setup); } return compareSql(c, code, a, b); }
  finally { a.close(); b.close(); }
}
// every check of an order: {ok, msg, expected}
function checkC(c, code){
  if (isSql(c)) return checkSqlC(c, code);
  for (const [i, t] of (c.tests || []).entries()) {
    const why = judgeCase(t, runCase(c, t, code, false, c.test));
    if (why) return {ok: false, msg: (c.tests.length > 1 ? `Sample ${i + 1} (${t.name || "data set " + (i + 1)}): ` : "") + why};
  }
  return {ok: true};
}
const engineReady = () => pyReady && !!SQLLIB;
function wRun(){
  if (!work || !engineReady()) return;
  const c = work.c, code = wEd.getValue();
  if (isSql(c)) {
    try { $("#wOut").innerHTML = withDb(db => { if (c.setup) db.exec(c.setup); return resultTables(db.exec(code)); }, "company"); }
    catch(e){ $("#wOut").innerHTML = `<pre class="err">${esc(e.message)}</pre>`; }
    return;
  }
  const t = c.tests[+$("#wCase").value || 0];
  $("#wOut").innerHTML = pyOutput(runCase(c, t, code, true), t.fs || {});
}
$("#wRun").onclick = wRun;
$("#wStep").onclick = () => {
  if (!work || !engineReady() || isSql(work.c)) return;
  const t = work.c.tests[+$("#wCase").value || 0];
  namedDbs = {}; for (const [name, sql] of Object.entries(t.dbs || {})) { const db = new SQLLIB.Database(); if (sql) db.exec(sql); namedDbs[name] = db; }
  openStepper(wEd.getValue(), t.stdin || "", clone(t.fs || {}), "story");
};
$("#wSubmit").onclick = () => { $("#wSubmit").disabled = true; $("#wSubmit").textContent = "Testing..."; setTimeout(() => { try { ship(); } finally { $("#wSubmit").disabled = !engineReady(); $("#wSubmit").textContent = "Ship it"; } }, 20); };
function ship(){
  const c = work.c, code = wEd.getValue(), res = checkC(c, code), v = $("#wVerdict");
  if (!res.ok) {
    sfx("err"); v.hidden = false; v.className = "verdict bad";
    v.innerHTML = `<b>The client sent it back</b><pre>${esc(res.msg)}</pre>${res.expected ? `<div style="width:100%"><p class="rows">What the client expects:</p>${resultTables([res.expected])}</div>` : ""}`;
    return;
  }
  const secs = Math.round((Date.now() - work.t0) / 1000), lines = codeLines(code), mode = work.mode;
  const before = rankOf(xpNow()), first = !done(c) && mode === "order";
  const rec = ty.records[c.id] || {}, newBest = [];
  if (!rec.secs || secs < rec.secs) { rec.secs = secs; if (ty.records[c.id]) newBest.push("fastest time"); }
  if (!rec.lines || lines < rec.lines) { rec.lines = lines; if (ty.records[c.id]) newBest.push("shortest code"); }
  ty.records[c.id] = rec;
  let coins = 0, title = "Shipped", note = "";
  if (mode === "drill") {
    if (!(ty.drill.day === today() && ty.drill.done)) {
      const y = new Date(Date.now() - 864e5), yd = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
      ty.streak.n = ty.streak.last === yd ? ty.streak.n + 1 : 1; ty.streak.last = today();
      coins = drillReward(); ty.drill = {day: today(), done: true};
      title = "Drill complete"; note = `Streak: ${ty.streak.n} day${ty.streak.n > 1 ? "s" : ""}.`;
    } else title = "Drill done again";
  } else {
    store.set("pq-ty-code-" + (c.type === "update" ? c.of : c.id), code);
    if (first) {
      prog.done[c.id] = true; store.set("pq-progress", prog);
      if (c.type === "order") { coins = baseIncome(c) * 20; spawn[c.id] = performance.now(); title = "New machine"; note = `<b>${esc(c.machine.name)}</b> is on the floor, earning ${fmt(baseIncome(c))} coins a second.`; }
      else { const of = byId(c.of); ty.levels[of.id] = level(of.id) + 1; coins = baseIncome(of) * 15; spawn[of.id] = performance.now(); title = "Machine fixed"; note = `<b>${esc(of.machine.name)}</b> runs again, one level higher.`; }
    } else title = "Still works";
  }
  ty.coins += coins; saveTy(); store.del(draftKey());
  sfx("ship"); renderRank(); renderOrders();
  const after = rankOf(xpNow());
  closeWork();
  openModal(title, `<div class="ship"><div class="big gold">${coins ? "+" + fmt(coins) : "OK"}</div>
    <p class="center">${note}${newBest.length ? ` New record: ${newBest.join(" and ")}.` : ""}</p>
    <div class="statgrid"><div><small>Time</small><b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}</b></div><div><small>Lines of code</small><b>${lines}${c.par ? ` / par ${c.par}` : ""}</b></div>${first ? `<div><small>XP</small><b>+${c.xp}</b></div>` : ""}<div><small>Income now</small><b>${fmt(rate())} / s</b></div></div>
    ${before !== after ? `<p class="center"><b>Rank up: ${esc(after)}</b></p>` : ""}
    <div class="row"><button class="btn go" id="shipOk">Back to the floor</button></div></div>`);
  $("#shipOk").onclick = closeModal;
  if (before !== after) sfx("up");
}

/* ---- machine panel ---- */
function machinePanel(m){
  const jam = jammedBy(m), cost = upCost(m), can = ty.coins >= cost, rec = ty.records[m.id] || {};
  openModal(m.machine.name, `<p class="rows">Built for ${esc(m.client)}: ${esc(m.title)}</p>
    <div class="statgrid"><div><small>Level</small><b>${level(m.id)}</b></div><div><small>Income</small><b>${jam ? "Jammed" : fmt(income(m)) + " / s"}</b></div><div><small>Best time</small><b>${rec.secs ? `${Math.floor(rec.secs / 60)}:${String(rec.secs % 60).padStart(2, "0")}` : "-"}</b></div><div><small>Shortest</small><b>${rec.lines ? rec.lines + " lines" : "-"}</b></div></div>
    ${jam ? `<p><b>Jammed:</b> ${esc(jam.title)}. Fix it from the Orders list.</p>` : ""}
    <div class="row"><button class="btn go" id="mUp" ${can && !jam ? "" : "disabled"}>Upgrade for ${fmt(cost)} (+${fmt(baseIncome(m))} / s)</button><button class="btn" id="mCode">Open its code</button></div>`);
  $("#mUp").onclick = () => { if (ty.coins < cost) return; ty.coins -= cost; ty.levels[m.id] = level(m.id) + 1; spawn[m.id] = performance.now(); saveTy(); sfx("up"); machinePanel(m); };
  $("#mCode").onclick = () => { closeModal(); openWork(m, "order"); wEd.setValue(store.get("pq-ty-code-" + m.id, null) ?? m.solution); };
}

/* ---- the factory floor (canvas) ---- */
const cv = $("#floor"), cx = cv.getContext("2d");
let W = 0, H = 0, layout = [], hover = null, floaters = [], parts = [];
const spawn = {}, lastPay = {};
let COL = {};
function readColors(){
  const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim() || "#888";
  COL = {head: `700 13px ${g("--display")}`, py: g("--py"), auto: g("--auto"), sql: g("--sql"), gold: "#F2C14E", ok: "#5BC37D", bad: "#F07264", ink: "#E4E9F2", mute: "#7C879D", belt: "#2A3248", belt2: "#3A4562", body: "#1E2638"};
}
readColors();
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors); } catch(e){}
function rr(x, y, w, h, r){ cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, h, r) : cx.rect(x, y, w, h); }
function icon(kind, x, y, s, col){
  cx.save(); cx.translate(x, y); cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = Math.max(1.5, s * .08); cx.lineCap = "round";
  const k = s / 2;
  switch (kind) {
    case "chart": for (let i = 0; i < 3; i++) cx.fillRect(-k + i * k * .7, k - (i + 1) * k * .55, k * .45, (i + 1) * k * .55); break;
    case "filter": cx.beginPath(); cx.moveTo(-k, -k * .7); cx.lineTo(k, -k * .7); cx.lineTo(k * .2, k * .1); cx.lineTo(k * .2, k * .8); cx.lineTo(-k * .2, k * .6); cx.lineTo(-k * .2, k * .1); cx.closePath(); cx.stroke(); break;
    case "mail": cx.strokeRect(-k, -k * .6, 2 * k, k * 1.3); cx.beginPath(); cx.moveTo(-k, -k * .6); cx.lineTo(0, k * .1); cx.lineTo(k, -k * .6); cx.stroke(); break;
    case "db": for (let i = 0; i < 3; i++) { cx.beginPath(); cx.ellipse(0, -k * .6 + i * k * .6, k * .8, k * .25, 0, 0, Math.PI * 2); cx.stroke(); } break;
    case "clock": cx.beginPath(); cx.arc(0, 0, k * .85, 0, Math.PI * 2); cx.moveTo(0, 0); cx.lineTo(0, -k * .55); cx.moveTo(0, 0); cx.lineTo(k * .4, k * .2); cx.stroke(); break;
    case "folder": cx.beginPath(); cx.moveTo(-k, -k * .5); cx.lineTo(-k * .3, -k * .5); cx.lineTo(-k * .1, -k * .25); cx.lineTo(k, -k * .25); cx.lineTo(k, k * .7); cx.lineTo(-k, k * .7); cx.closePath(); cx.stroke(); break;
    case "search": cx.beginPath(); cx.arc(-k * .15, -k * .15, k * .55, 0, Math.PI * 2); cx.moveTo(k * .25, k * .25); cx.lineTo(k * .85, k * .85); cx.stroke(); break;
    case "text": for (let i = 0; i < 4; i++) cx.fillRect(-k, -k * .7 + i * k * .45, (i % 2 ? 1.3 : 2) * k, k * .18); break;
    case "shield": cx.beginPath(); cx.moveTo(0, -k); cx.lineTo(k * .8, -k * .6); cx.lineTo(k * .6, k * .4); cx.lineTo(0, k); cx.lineTo(-k * .6, k * .4); cx.lineTo(-k * .8, -k * .6); cx.closePath(); cx.stroke(); break;
    case "list": for (let i = 0; i < 3; i++) { cx.fillRect(-k, -k * .6 + i * k * .6, k * .25, k * .25); cx.fillRect(-k * .55, -k * .6 + i * k * .6, k * 1.5, k * .25); } break;
    case "calc": cx.strokeRect(-k * .75, -k, k * 1.5, 2 * k); cx.fillRect(-k * .5, -k * .75, k, k * .45); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) cx.fillRect(-k * .45 + j * k * .55, k * .0 + i * k * .45, k * .3, k * .25); break;
    default: { cx.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? k * .6 : k * .85; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } cx.closePath(); cx.stroke(); cx.beginPath(); cx.arc(0, 0, k * .25, 0, Math.PI * 2); cx.stroke(); }
  }
  cx.restore();
}
function gear(x, y, r, a, col){
  cx.save(); cx.translate(x, y); cx.rotate(a); cx.fillStyle = col; cx.beginPath();
  for (let i = 0; i < 16; i++) { const ang = i * Math.PI / 8, rad = i % 2 ? r * .72 : r; cx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); }
  cx.closePath(); cx.fill(); cx.fillStyle = "#121826"; cx.beginPath(); cx.arc(0, 0, r * .32, 0, Math.PI * 2); cx.fill(); cx.restore();
}
function computeLayout(){
  const wrap = $("#floorWrap"); W = wrap.clientWidth || 800;
  const pad = 14, gap = 12, cols = Math.max(3, Math.min(7, Math.floor((W - pad * 2 + gap) / 118)));
  const S = Math.min(116, (W - pad * 2 - gap * (cols - 1)) / cols);
  layout = []; let y = pad;
  for (const d of DISTRICTS) {
    const list = C.filter(c => c.district === d.id && c.type === "order");
    const built = list.filter(done), head = LINES[d.id === "sql" ? "data" : "code"].find(c => !done(c));
    const next = head && head.district === d.id && head.type === "order" ? head : null;
    const opened = built.length || next;
    const slots = built.length + (next ? 1 : 0), rows = Math.max(1, Math.ceil(slots / cols));
    const block = {d, y, h: 34 + (opened ? rows * (S + 34) : 70), items: [], opened};
    built.concat(next ? [next] : []).forEach((c, i) => block.items.push({c, x: pad + (i % cols) * (S + gap), y: y + 34 + Math.floor(i / cols) * (S + 34), s: S, next: c === next}));
    layout.push(block); y += block.h + 10;
  }
  H = y + 4;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px";
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
let lastT = performance.now(), lastSave = Date.now(), lastHud = 0, layoutKey = "";
function frame(t){
  requestAnimationFrame(frame);
  const dt = Math.min(.25, (t - lastT) / 1000); lastT = t;
  ty.coins += rate() * dt;
  if (t - lastHud > 120) { hud(); lastHud = t; }
  if (Date.now() - lastSave > 20000) { saveTy(); lastSave = Date.now(); }
  if ($("#view-factory").hidden) return;
  const key = W + "|" + C.filter(done).length + "|" + ($("#floorWrap").clientWidth || 0);
  if (key !== layoutKey) { computeLayout(); layoutKey = W + "|" + C.filter(done).length + "|" + ($("#floorWrap").clientWidth || 0); }
  draw(t / 1000);
}
function draw(T){
  cx.clearRect(0, 0, W, H);
  for (const b of layout) {
    const col = COL[b.d.id];
    // district header strip
    cx.fillStyle = "rgba(255,255,255,.03)"; rr(6, b.y - 6, W - 12, b.h, 12); cx.fill();
    cx.fillStyle = col; cx.font = COL.head;
    cx.fillText(b.d.name.toUpperCase(), 16, b.y + 14);
    const hw = cx.measureText(b.d.name.toUpperCase()).width;
    const ms = b.items.filter(i => !i.next).map(i => i.c), r = ms.reduce((s, m) => s + income(m), 0);
    cx.fillStyle = COL.mute; cx.font = "600 11px ui-monospace, Consolas, monospace";
    cx.fillText(b.opened ? `${ms.length} machine${ms.length === 1 ? "" : "s"}  |  ${fmt(r)} / s` : "", 16 + hw + 16, b.y + 14);
    if (!b.opened) {
      cx.fillStyle = "rgba(255,255,255,.05)"; rr(14, b.y + 30, W - 28, 50, 10); cx.fill();
      cx.fillStyle = COL.mute; cx.font = "600 12px ui-monospace, Consolas, monospace";
      cx.fillText(b.d.id === "auto" ? (W < 560 ? "Locked: finish the Python orders" : "Locked: finish the Python Workshop orders to open the dock") : "Locked", 28, b.y + 60);
      continue;
    }
    // conveyor under each row
    const rowsY = [...new Set(b.items.map(i => i.y))];
    for (const ry of rowsY) {
      const by = ry + b.items[0].s + 6;
      cx.fillStyle = COL.belt; rr(10, by, W - 20, 10, 5); cx.fill();
      cx.strokeStyle = COL.belt2; cx.lineWidth = 2;
      for (let x = 10 + ((T * 40) % 20); x < W - 12; x += 20) { cx.beginPath(); cx.moveTo(x, by + 2); cx.lineTo(x - 5, by + 8); cx.stroke(); }
      // documents riding the belt
      cx.fillStyle = "#E4E9F2";
      for (let k = 0; k < Math.ceil(W / 140); k++) { const x = ((T * 40 + k * 140) % (W + 40)) - 20; cx.fillRect(x, by - 7, 9, 11); cx.fillStyle = "#AAB4CC"; cx.fillRect(x + 2, by - 4, 5, 1); cx.fillRect(x + 2, by - 1, 5, 1); cx.fillStyle = "#E4E9F2"; }
    }
    for (const it of b.items) drawMachine(it, T, col);
  }
  // floating coin numbers and particles
  floaters = floaters.filter(f => T - f.t < 1.1);
  for (const f of floaters) { const a = 1 - (T - f.t) / 1.1; cx.globalAlpha = a; cx.fillStyle = COL.gold; cx.font = "800 13px ui-monospace, Consolas, monospace"; cx.fillText(f.txt, f.x, f.y - (T - f.t) * 34); }
  cx.globalAlpha = 1;
  parts = parts.filter(p => T - p.t < p.life);
  for (const p of parts) { const k = (T - p.t) / p.life; cx.globalAlpha = 1 - k; cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x + p.vx * (T - p.t), p.y + p.vy * (T - p.t) + (p.g || 0) * (T - p.t) ** 2, p.r * (p.grow ? 1 + k * 2 : 1), 0, Math.PI * 2); cx.fill(); }
  cx.globalAlpha = 1;
}
function drawMachine(it, T, col){
  const {c, x, y, s} = it;
  if (it.next) {
    const pulse = .5 + .5 * Math.sin(T * 3);
    cx.setLineDash([6, 5]); cx.strokeStyle = col; cx.globalAlpha = .45 + .4 * pulse; cx.lineWidth = 2; rr(x + 2, y + 2, s - 4, s - 4, 12); cx.stroke(); cx.setLineDash([]);
    cx.fillStyle = col; cx.font = `800 ${Math.round(s * .3)}px sans-serif`; cx.textAlign = "center"; cx.fillText("+", x + s / 2, y + s / 2 + s * .08);
    cx.font = "600 10px ui-monospace, Consolas, monospace"; cx.fillText("NEXT ORDER", x + s / 2, y + s - 10); cx.textAlign = "left"; cx.globalAlpha = 1;
    return;
  }
  const jam = jammedBy(c), lv = level(c.id), sp = spawn[c.id] ? (performance.now() - spawn[c.id]) / 1000 : 9;
  const sc = sp < .6 ? .3 + .7 * (1 - Math.pow(1 - sp / .6, 3)) : 1;
  const shake = jam ? Math.sin(T * 40) * 1.2 : 0;
  cx.save(); cx.translate(x + s / 2 + shake, y + s / 2); cx.scale(sc, sc); cx.translate(-s / 2, -s / 2);
  // body
  const g = cx.createLinearGradient(0, 0, 0, s); g.addColorStop(0, "#2A3450"); g.addColorStop(1, "#171D2C");
  cx.fillStyle = g; rr(0, s * .08, s, s * .92, 12); cx.fill();
  cx.strokeStyle = jam ? COL.bad : col; cx.lineWidth = 2; rr(1, s * .08 + 1, s - 2, s * .92 - 2, 11); cx.stroke();
  // screen with the machine's icon
  cx.fillStyle = "#0B0F18"; rr(s * .14, s * .22, s * .72, s * .44, 7); cx.fill();
  icon(c.machine.icon, s / 2, s * .44, s * .32, jam ? COL.bad : col);
  // gear on top, faster with each level
  gear(s * .8, s * .12, s * .13, jam ? 0 : T * (1.5 + lv * .4), jam ? "#5A6378" : col);
  // status light and level pips
  const on = jam ? (Math.sin(T * 8) > 0) : true;
  cx.fillStyle = jam ? (on ? COL.bad : "#4A2020") : COL.ok; cx.beginPath(); cx.arc(s * .14, s * .16, s * .05, 0, Math.PI * 2); cx.fill();
  for (let i = 0; i < Math.min(lv, 8); i++) { cx.fillStyle = COL.gold; cx.fillRect(s * .14 + i * s * .09, s * .74, s * .06, s * .06); }
  cx.restore();
  // name under the machine
  cx.fillStyle = jam ? COL.bad : COL.ink; cx.font = "600 11px ui-monospace, Consolas, monospace"; cx.textAlign = "center";
  let name = c.machine.name; while (cx.measureText(name).width > s && name.length > 4) name = name.slice(0, -2);
  cx.fillText(name !== c.machine.name ? name + "." : name, x + s / 2, y + s + 26); cx.textAlign = "left";
  if (hover === c) { cx.strokeStyle = "#fff"; cx.lineWidth = 2; rr(x - 3, y + s * .08 - 3, s + 6, s * .92 + 6, 14); cx.stroke(); }
  if (jam) {
    if (Math.random() < .08) parts.push({x: x + s * .8, y: y + s * .1, vx: (Math.random() - .5) * 10, vy: -18, r: 3 + Math.random() * 3, c: "rgba(160,170,190,.6)", t: T, life: 1.4, grow: true});
    cx.fillStyle = COL.bad; cx.beginPath(); cx.arc(x + s - 6, y + 6, 10, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = "#fff"; cx.font = "800 13px sans-serif"; cx.textAlign = "center"; cx.fillText("!", x + s - 6, y + 11); cx.textAlign = "left";
    return;
  }
  // pay out every cycle: a coin number floats up
  const cycle = 2.4 / (1 + lv * .15);
  if (!lastPay[c.id] || T - lastPay[c.id] > cycle) {
    if (lastPay[c.id]) floaters.push({x: x + s * .3, y: y + s * .1, txt: "+" + fmt(income(c) * cycle), t: T});
    lastPay[c.id] = T;
  }
  if (sp < .9) for (let i = 0; i < 3; i++) parts.push({x: x + s / 2, y: y + s / 2, vx: (Math.random() - .5) * 160, vy: (Math.random() - .8) * 160, g: 200, r: 2.5, c: Math.random() < .5 ? COL.gold : col, t: T, life: .7});
}
function hit(ev){
  const r = cv.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
  for (const b of layout) for (const it of b.items) if (px >= it.x && px <= it.x + it.s && py >= it.y && py <= it.y + it.s + 30) return it;
  return null;
}
cv.addEventListener("mousemove", ev => {
  const it = hit(ev); hover = it && !it.next ? it.c : null;
  const tip = $("#floorTip");
  if (!it) { tip.hidden = true; return; }
  const c = it.c, jam = !it.next && jammedBy(c);
  tip.innerHTML = it.next ? `<b>Next order</b><br>${esc(c.title)}` : `<b>${esc(c.machine.name)}</b><br>Level ${level(c.id)}, ${jam ? "jammed" : fmt(income(c)) + " coins / s"}<br>Click to upgrade or open its code`;
  tip.hidden = false; tip.style.left = Math.min(it.x + it.s + 8, W - 250) + "px"; tip.style.top = it.y + "px";
});
cv.addEventListener("mouseleave", () => { hover = null; $("#floorTip").hidden = true; });
cv.addEventListener("click", ev => {
  const it = hit(ev); if (!it) return;
  if (it.next) { if (available(it.c)) openWork(it.c, "order"); else toast("Not yet", "Buy the license in the Orders list first."); }
  else machinePanel(it.c);
});
window.addEventListener("resize", () => { layoutKey = ""; });

/* ---- shared hooks ---- */
const baseOnEngines = onEngines;
onEngines = function(){
  baseOnEngines();
  for (const id of ["wRun", "wStep", "wSubmit"]) $("#" + id).disabled = !engineReady();
};
function welcomeBack(){
  const away = Math.min(OFFLINE_CAP, (Date.now() - (ty.seen || Date.now())) / 1000), earned = Math.round(rate() * away * OFFLINE_RATE);
  ty.seen = Date.now();
  if (earned >= 1 && away > 60) {
    ty.coins += earned; saveTy();
    const h = Math.floor(away / 3600), m = Math.floor(away % 3600 / 60);
    openModal("While you were away", `<p class="center">Your machines kept running for ${h ? h + " h " : ""}${m} min.</p><div class="big gold">+${fmt(earned)}</div><p class="center rows">Machines earn at half speed while you are away, for up to 8 hours.</p><div class="row"><button class="btn go" id="wbOk">Collect</button></div>`);
    $("#wbOk").onclick = () => { closeModal(); sfx("coin"); };
  }
}
// the account copy can replace local progress after the page starts
function storyReload(){ ty = Object.assign(freshTy(), store.get("pq-ty", {})); shownCoins = ty.coins; muteLabel(); renderOrders(); layoutKey = ""; }
const baseShow = show;
show = function(v){ baseShow(v); layoutKey = ""; setTimeout(() => wEd.refresh(), 0); };
document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => show(b.dataset.view));
document.addEventListener("visibilitychange", () => { if (document.hidden) saveTy(); else welcomeBack(); });
window.addEventListener("pagehide", saveTy);

/* ---- self test: every order is solvable, starters fail, every lesson is covered ---- */
window.__selfTestTycoon = () => {
  const problems = [];
  const covered = new Set(C.flatMap(c => c.covers || []));
  for (const l of LESSONS) if (!covered.has(l.id)) problems.push(["coverage", l.id, "no order covers this lesson"]);
  for (const c of C) {
    if (c.of && (!byId(c.of) || C.indexOf(byId(c.of)) > C.indexOf(c))) problems.push([c.id, "of", "must point to an earlier order"]);
    const r = checkC(c, c.solution); if (!r.ok) problems.push([c.id, "solution", r.msg.slice(0, 300)]);
    const st = c.type === "update" ? byId(c.of).solution : c.starter;
    if (checkC(c, st).ok) problems.push([c.id, "starter", "already passes"]);
    if (c.par && codeLines(c.solution) > c.par) problems.push([c.id, "par", `${codeLines(c.solution)} lines > par ${c.par}`]);
    if (isSql(c) && !c.verify) { try { if (!withDb(db => { if (c.setup) db.exec(c.setup); return db.exec(c.solution); }, "company").length) problems.push([c.id, "sql", "no result table"]); } catch(e){ problems.push([c.id, "sql", e.message]); } }
  }
  const from = EXAMPLES.length;
  C.forEach(c => c.skill && c.skill.example && md(`~~~${isSql(c) ? "sql" : "python"}\n${c.skill.example}\n~~~`, isSql(c) ? "company" : undefined));
  EXAMPLES.slice(from).forEach((ex, k) => {
    if (ex.lang === "sql") { try { if (!withDb(db => db.exec(ex.code), ex.db).length) problems.push(["example", k, "no table"]); } catch(e){ problems.push(["example", k, e.message]); } }
    else { const r = py(ex.code, ex.stdin, clone(SEED_FS), "", true); if (r.err) problems.push(["example", k, r.err.slice(-200)]); else if (!r.out.trim()) problems.push(["example", k, "printed nothing"]); }
  });
  return {orders: C.length, problems};
};

muteLabel(); renderOrders(); hud();
requestAnimationFrame(frame);
setTimeout(welcomeBack, 1500);
