# Writing Script City contracts

Script City is an automation tycoon. A learner takes a client's order, writes real code, and the code becomes a
machine on a factory floor that earns coins. Every lesson of the course (src.html, `LESSONS`) must be covered by at
least one contract, and the learner must be able to solve each contract with the skill card plus what came before.

Files: `tycoon/contracts/*.json`, each a JSON array. Files are read in name order and form two lines played in order:
the **code line** (every `py` then `auto` contract, files 10 to 39) and the **data line** (`sql`, files 60 to 79).
Order inside a file matters: it is the order the learner meets the contracts.

## House style (strict)

- Never use an em dash or an en dash anywhere (use a colon, a comma, or two sentences). No emojis.
- Clients write like real people at work: short, concrete, a little personality. Two to four sentences in `brief`.
  No lecture in the brief; the teaching lives in `skill`.
- Real work tasks only: invoices, stock, logs, CSV exports, emails, rotas, reports, tickets. Not toy puzzles.
- The company database (`tycoon/company.sql`) is the client company for every SQL contract. Read its tables first.
- Text fields accept small HTML (`<code>`, `<b>`) and the lesson markdown: paragraphs, `- ` lists, `### ` headings,
  and fences `~~~python`, `~~~sql`, `~~~text`. Python and SQL fences become runnable examples.

## Contract format

```json
{
  "id": "t-py-unique-slug",
  "district": "py | auto | sql",
  "type": "order | update | bug",      // default order
  "of": "t-py-earlier-order",          // update and bug only: the machine this changes
  "client": "First Last, Company",
  "title": "Short title",
  "covers": ["py-for"],                 // lesson ids taught or drilled here
  "brief": "What the client asks, in their voice.",
  "skill": {"title": "...", "card": "2 to 4 sentences", "example": "tiny runnable code that prints"},
  "task": "Exact spec: names of variables/files/columns, exact output format. Use a ~~~text fence for exact output.",
  "starter": "code the editor starts with (must fail the tests)",
  "solution": "reference solution",
  "hint": "one nudge, may show the key line",
  "par": 6,                             // non comment, non blank lines of the solution, solution must fit
  "machine": {"name": "Two Words", "icon": "gear|chart|filter|mail|db|clock|folder|search|text|shield|list|calc"},
  "tests": [{"name": "March export", "fs": {"sales.csv": "..."}, "stdin": "line1\nline2", "dbs": {"shop.db": "CREATE TABLE ..."}, "output": "exact expected output"}],
  "test": "python asserts run after the code, with _out (printed text) and _fs (files dict) and the program's variables",
  "setup": "SQL run before the learner's query (sql only)",
  "ordered": true,                      // sql: row order matters (when the task says ORDER BY)
  "verify": ["SELECT ..."]              // sql: for DML/DDL tasks, queries whose results are compared instead
}
```

Rules:

- **Orders** (`type` order) build a new machine and need `machine` and `skill`.
- **Updates** come back later: the client changes the format or adds a rule. The editor opens on the learner's own
  shipped code of `of`, so the task must say exactly what changes. `starter` can be `""`. The solution of `of` must
  fail the update's tests. Put an update a few contracts after its order (2 to 6 later), so it feels like a return.
  No `skill` is needed, unless the update teaches something new (then add one and list the lesson in `covers`).
- **Bugs**: someone edited the machine and broke it. `starter` is the broken code (1 or 2 realistic bugs: off by one,
  wrong comparison, missing int(), wrong key, wrong indent). The task describes the symptom, not the fix.
- About one contract in four should be an update or a bug. Each lesson gets an order; boss lessons get a bigger order.
- Python orders: use **2 or more tests** with different data when the logic branches, so hard coding fails. Prefer
  `fs` and `stdin` data over values typed in the code, so the client can "send new data". `output` compares the
  printed text exactly (trailing spaces ignored). When checking, `input()` prompts are NOT part of the output
  (Run shows them, Ship it ignores them), so never put prompt text in `output`.
- Keep each solution short: 3 to 15 lines early, up to 25 for boss contracts. Set `par` to the solution's line count
  or a little more.
- SQL: no `starter` that is already correct. For SELECT tasks the result of `solution` is compared with the learner's
  (columns count and values; set `ordered` when the task asks for an order). For INSERT/UPDATE/DELETE/CREATE tasks,
  use `verify`.

## Engine quirks (the page runs Python with Brython 3.13 in the browser)

Read the "Engine quirks" section of `story/AUTHORING.md`. In short: put a hyphen first inside regex character classes, no names starting with two underscores inside class bodies,
3 second time limit, `sqlite3` works on the files named in `dbs`, `os`, `json`, `re`, `datetime`, `csv`, `shutil`,
`glob`, `pathlib` exist. Files in `fs` may live in folders (`"in/a.txt"`).

## Validate before you finish

```bash
python tycoon/validate.py
```

It must report 0 problems for your files. Then `node build.js` must succeed.
