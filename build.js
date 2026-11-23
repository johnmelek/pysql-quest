// node build.js : builds the course and the story page from src.html.
//   index.html                     course, published artifact (libraries from CDNs)
//   pysql-quest-offline.html       course, one self-contained file that works with no internet
//   story.html                     story mode (Bot Escape, Case Files, Codex), a separate artifact
//   pysql-quest-story-offline.html story mode, self-contained
//   tycoon.html                    Script City, the automation tycoon, a separate artifact
//   script-city-offline.html       Script City, self-contained
const fs = require("fs"), https = require("https"), path = require("path");
const dir = __dirname, vendor = path.join(dir, "vendor");

const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.18/codemirror.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.18/codemirror.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.18/mode/python/python.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.18/mode/sql/sql.min.js",
  "https://cdn.jsdelivr.net/npm/brython@3.13.2/brython.min.js",
  "https://cdn.jsdelivr.net/npm/brython@3.13.2/brython_stdlib.js",
  "https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-asm.js",
];
const local = url => path.join(vendor, url.split("/").slice(-1)[0]);
const get = url => new Promise((res, rej) => https.get(url, r => {
  if (r.statusCode !== 200) return rej(new Error(url + " " + r.statusCode));
  const chunks = []; r.on("data", c => chunks.push(c)); r.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
}).on("error", rej));
// a library must never close the <script> tag it is inlined into
const inline = js => js.replace(/<\/script/gi, "<\\/script");
// data inlined into a script: JSON.stringify already escapes U+2028/U+2029, "</" is escaped so it cannot close the tag
const js = v => JSON.stringify(v).split("</").join("<\\/");
const read = (...p) => fs.readFileSync(path.join(dir, ...p), "utf8");
const jsonFiles = sub => { const d = path.join(dir, sub); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(read(sub, f))) : []; };

(async () => {
  fs.mkdirSync(vendor, {recursive: true});
  for (const u of LIBS) if (!fs.existsSync(local(u))) fs.writeFileSync(local(u), await get(u));
  const lib = u => fs.readFileSync(local(u), "utf8");
  // lesson bodies written as JSON (content/*.json)
  const bodies = Object.assign({}, ...jsonFiles("content"));
  const base = read("src.html").replace("<!--LOGO-->", () => read("logo.svg").trim()).replace("/*CMCSS*/", lib(LIBS[0])).replace("/*BODIES*/{}", () => js(bodies));

  const course = base.replace("/*STORY-CSS*/", "").replace("<!--STORY-VIEWS-->\n", "").replace("/*STORY-JS*/\n", "");
  const missions = jsonFiles("story/missions").flat(), cases = jsonFiles("story/cases").flat();
  const story = base
    .replace("<title>PySQL Quest</title>", "<title>PySQL Quest Story</title>")
    .replace("PySQL Quest</div>", "PySQL Quest Story</div>")
    .replace(/<nav class="tabs"[\s\S]*?<\/nav>/, () => read("story", "nav.html"))
    .replace("/*STORY-CSS*/", () => read("story", "story.css"))
    .replace("<!--STORY-VIEWS-->\n", () => read("story", "views.html"))
    .replace("/*STORY-JS*/\n", () => `const MISSIONS = ${js(missions)};\nconst CASES = ${js(cases)};\nconst CITY_SQL = ${js(read("story", "city.sql"))};\n`
      + `window.pqModules = ${js(JSON.stringify({robot: read("story", "robot.py")}))};\n` + read("story", "story.js") + "\n");

  const contracts = jsonFiles("tycoon/contracts").flat();
  const tycoon = base
    .replace("<title>PySQL Quest</title>", "<title>Script City</title>")
    .replace("PySQL Quest</div>", "Script City</div>")
    .replace(/<nav class="tabs"[\s\S]*?<\/nav>/, () => read("tycoon", "nav.html"))
    .replace("/*STORY-CSS*/", () => read("tycoon", "game.css"))
    .replace("<!--STORY-VIEWS-->\n", () => read("tycoon", "views.html"))
    .replace("/*STORY-JS*/\n", () => `const CONTRACTS = ${js(contracts)};\nconst COMPANY_SQL = ${js(read("tycoon", "company.sql"))};\n` + read("tycoon", "game.js") + "\n");

  const offline = src => {
    let off = src;
    for (const u of LIBS.slice(1, 4)) off = off.replace(`<script src="${u}"></script>`, () => `<script>${inline(lib(u))}</script>`);
    const engines = LIBS.slice(4).map(u => `<script>${inline(lib(u))}</script>`).join("\n");
    off = off.replace('<script type="text/python" id="runner">', () => `<script>window.PQ_OFFLINE = true; /* inlined Brython has no script URL to find itself from */ globalThis.__BRYTHON__ = {brython_path: location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "")};</script>\n${engines}\n<script type="text/python" id="runner">`);
    if (off.includes('src="https://')) throw new Error("offline build still references a CDN script");
    const head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
      + "<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>";
    return head + off + "</body></html>";
  };
  for (const [name, page] of [["index.html", course], ["story.html", story], ["tycoon.html", tycoon]]) {
    // refuse to build a page whose own script does not parse (a broken string blanks the whole page)
    for (const m of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]);
    if (/STORY-(CSS|VIEWS|JS)/.test(page)) throw new Error(name + " still has a story marker");
    fs.writeFileSync(path.join(dir, name), page);
  }
  fs.writeFileSync(path.join(dir, "pysql-quest-offline.html"), offline(course));
  fs.writeFileSync(path.join(dir, "pysql-quest-story-offline.html"), offline(story));
  fs.writeFileSync(path.join(dir, "script-city-offline.html"), offline(tycoon));
  // GitHub Pages copy (docs/): a landing page and the three pages, with GitHub sign-in and gist saving switched on
  const ALLOW = ["johnmelek"];
  const pageHead = title => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + `<title>${title}</title><link rel="icon" href="logo.svg" type="image/svg+xml">`
    + "<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>";
  const site = path.join(dir, "docs");
  fs.mkdirSync(site, {recursive: true});
  for (const [name, page, title] of [["course.html", course, "PySQL Quest"], ["story.html", story, "PySQL Quest Story"], ["city.html", tycoon, "Script City"]])
    fs.writeFileSync(path.join(site, name), pageHead(title) + `<script>window.PQ_GITHUB = ${js({allow: ALLOW})};</script>\n` + page + "</body></html>");
  fs.writeFileSync(path.join(site, "index.html"), read("landing.html").replace("<!--LOGO-->", () => read("logo.svg").trim()));
  fs.copyFileSync(path.join(dir, "logo.svg"), path.join(site, "logo.svg"));
  fs.writeFileSync(path.join(site, ".nojekyll"), "");
  console.log(`built index.html, story.html (${missions.length} missions, ${cases.length} cases), tycoon.html (${contracts.length} contracts), the offline copies and docs/ for GitHub Pages`);
})().catch(e => { console.error(e); process.exit(1); });
