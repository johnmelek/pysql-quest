# Writing story content for PySQL Quest Story

The story page is a second, separate page built from the same engine as the course. It has two
games and keeps the full course as a reference called the Codex:

- **Bot Escape** (Python and automation): the learner programs a small robot through a factory.
- **Case Files** (SQL): the learner is a detective who queries city records to solve crimes.
- **Codex**: the original 54 lessons, unchanged. Every mission and case step links to the lessons it covers.

The promise to the learner is **zero to hero with nothing left out**. Every concept of every
course lesson must be taught and used somewhere in the story. The course lessons are the source
of truth for what must be covered:

- Lesson list (ids, titles, tasks, hints): `src.html`, the `LESSONS` array (search `id:"py-hello"`).
- Lesson bodies (the full explanations): `content/py1.json`, `content/py2.json`, `content/auto.json`, `content/sql.json` (keyed by lesson id).

Read the full body of every lesson you cover. Every `### ` heading and every new keyword,
function or idea in it must appear in your mission's "power" text (explained, with an example)
or be required by the mission's goal. When in doubt, include it.

## House style (strict)

- Plain English for absolute beginners. Explain every new word the first time. Short sentences.
- **Never use the em dash or the en dash characters.** Use commas, colons, parentheses or a new sentence. Hyphens in normal words are fine.
- **No emojis.**
- The fun comes from the story and the goal, not from jokes. Keep stories short (2 to 5 sentences), concrete and a little dramatic.
- Text fields are a small Markdown dialect: paragraphs, `- ` lists, `### ` headings, and fenced blocks `~~~python`, `~~~sql`, `~~~text`. Inline HTML `<code>`, `<b>` and `<i>` work. No other Markdown (no `**bold**`, no backticks, no links).

## Bot Escape: the story bible

Unit B-17, called **Bit**, is a small maintenance robot. It wakes up after a power cut in the
abandoned Ironworks factory. The factory's security system, **WARDEN**, has locked everything
down. The learner is the programmer on Bit's radio link: they write the code Bit runs. Chapters:

1. **Wake-up Bay** (Foundations): Bit boots up, learns to talk and count.
2. **The Corridors** (Control flow): long and changing corridors, traps.
3. **The Archive** (Data structures): terminals full of records, keys and codes stored in lists and dicts.
4. **The Assembly Line** (Functions): repeating patterns, reusable moves, recursive stairwells.
5. **The Flooded Basement** (Robust code): broken sensors, error logs, the factory's files.
6. **The Workshop** (Objects): Bit builds helper drones and parts as classes.
7. **The Core** (Pro tools): WARDEN's core, streams of data, wrapped functions, coded messages. Boss: WARDEN's inventory.
8. **The Control Room** (Automation): Bit is out and takes over the factory office to shut WARDEN down for good: reports, configs, logs, files, letters, the factory database, schedules. Boss: the full pipeline.

## Mission format

Each missions file is a JSON array of missions, in play order. Missions unlock one after another.

```json
{
  "id": "m-a-wake-up",
  "chapter": "Wake-up Bay",
  "title": "Wake up, Bit",
  "covers": ["py-hello"],
  "xp": 10,
  "story": "Two to five sentences of story.",
  "power": "The new concept, explained for a beginner, with runnable ~~~python examples.",
  "goal": "What to do, in one to three sentences.",
  "starter": "from robot import *\n\n# your code here\n",
  "solution": "from robot import *\n\nsay(\"Online\")\nmove()\n",
  "hint": "One helpful sentence, not the answer.",
  "par": 6,
  "check": {"exit": true, "items": false, "doors": false},
  "test": "assert 'greet' in dir(), 'Write a function called greet.'",
  "worlds": [
    {"map": ["#####", "#>..E", "#####"], "output": "Online\n"}
  ]
}
```

- `id`: unique, lowercase, prefixed with your prefix (given in your brief).
- `covers`: lesson ids this mission teaches. Every lesson id in your range must appear in at least one mission.
- `xp`: 10 to 20 early, 20 to 40 mid, 40 to 60 for bosses.
- `power`: this is where the teaching happens. Explain every concept of the covered lessons, each with a small runnable example. Examples must be self-contained: no robot (the robot needs a map), and create any file you read in the same example. Every example must print something. The learner can press Run and Step through on each example.
- `starter`: what the editor starts with. Must NOT already solve the mission. Usually `from robot import *` plus a comment or a first line.
- `solution`: a clean, idiomatic solution a beginner could write with what they have learned so far.
- `par`: number of code lines (blank lines and comment lines do not count) of a good solution. Three stars need `lines <= par`. The solution must fit within par. Leave a little slack (one or two lines).
- `check`: what must be true at the end on every map. `exit`: robot stands on E. `items`: every key and coin picked up. `doors`: every door opened. Omit what does not apply.
- `test`: optional Python run after the learner's code, in the same namespace (so it can see their variables, functions and classes). It also gets `_out` (everything printed) and `_fs` (a dict of every file on the sandbox disk after the run, path to text). Use `assert condition, "a friendly message saying what is missing"`. Use it to require the concept (for example a function with a given name, a class, a list comprehension result, a file written with given content).
- `worlds`: one or more maps. **Use several maps whenever the concept is about repetition or decisions**, with different lengths, positions or data, so hardcoding the moves fails and the loop or `if` is really needed. Each world can have:
  - `map`: list of strings, all the same length is best, at most about 14 wide and 9 tall.
  - `output`: optional exact expected printed output (trailing spaces and the final newline are ignored).
  - `stdin`: optional lines given to `input()`, separated by `\n`. Use different input on different maps.
  - `data`: values returned by `scan()` on terminal squares, keyed by the terminal digit as a string, like `{"1": [3, 5, 2]}`. Any JSON value.
  - `codes`: door codes keyed by door letter, like `{"A": "4417"}`. A door without a code opens with a key.
  - `fs`: files on the sandbox disk for this run, path to text, like `{"logs/power.log": "..."}`. `open()`, `os.listdir`, `os.rename`, `os.remove`, `glob.glob` and `os.path.exists` work on it.
  - `dbs`: SQLite databases, file name to SQL script, like `{"factory.db": "CREATE TABLE ...; INSERT ..."}`. `sqlite3.connect("factory.db")` opens it.
  - `battery`: actions allowed before the battery runs out (default 400).

### Map legend

| Char | Meaning |
|---|---|
| `#` | wall |
| `.` | floor |
| `>` `<` `^` `v` | Bit's start square and the direction it faces (exactly one per map) |
| `E` | exit |
| `k` | key (pick it up with `pick()`) |
| `$` | coin (pick it up with `pick()`) |
| `A` `B` `C` `D` | locked door. With a code in `codes` it needs `unlock(code)`; without a code it needs one key |
| `1` to `9` | terminal; `scan()` while standing on it returns `data["1"]` and so on |
| `x` | hole (falling in fails the run) |

Coordinates: x grows to the right, y grows downward, `(0, 0)` is the top-left character.

### Robot controls (`from robot import *`)

Actions (each uses one unit of battery): `move()`, `turn_left()`, `turn_right()`, `pick()` (returns
`'key'` or `'coin'`), `unlock(code)` (the door in front), `say(*parts)` (prints like `print` and shows a speech bubble).

Sensors (free): `front_is_clear()`, `front()` (one of `'wall' 'floor' 'door' 'hole' 'exit' 'key' 'coin' 'terminal'`),
`here()` (same names, for the square under Bit), `at_exit()`, `scan()`, `position()` as `(x, y)`,
`facing()` as `'N' 'E' 'S' 'W'`, `bag()` as `{'key': n, 'coin': n}`.

Errors: walking into a wall or a locked door, falling into a hole, a wrong code, `pick()` on an
empty square, `scan()` off a terminal, or an empty battery raise `RobotError` and fail the run.
Plain `print()` works too and counts as output.

## Case Files: the story bible

The learner is a new detective in the **Harbor City Police data unit**. Every case is a crime
solved only through records: people, places, phone calls, card payments, door badge logs,
camera sightings, vehicles, and so on. Each case has 3 to 5 suspects with alibis, and the
clues from the case's steps, combined, point to exactly one of them. Red herrings are welcome
as long as the evidence is fair and the closing explains how the clues prove it.

All cases share one database, `story/city.sql` (SQLite). Design it so every case's evidence is
in it, the tables feel like real city records, and every SQL concept has natural data to work
with (NULLs for IN/IS NULL and COALESCE, a manager or "reports to" column for self joins, a
chain or hierarchy for recursive queries, dates and amounts for windows and aggregates).

## Case format

Each cases file is a JSON array of cases, in play order. Cases unlock one after another; steps
inside a case unlock one after another; the last item of each case is "Name the culprit".

```json
{
  "id": "case-1",
  "title": "The Harbor Market Break-in",
  "covers": ["sql-select", "sql-where"],
  "story": "The case opening, 3 to 6 sentences.",
  "suspects": [{"name": "Rosa Vidal", "note": "night guard, says she was on her rounds"}],
  "culprit": "Rosa Vidal",
  "closing": "How the clues prove it, 2 to 4 sentences.",
  "xp_accuse": 40,
  "steps": [
    {
      "title": "Who was on the market's staff list?",
      "covers": ["sql-select"],
      "xp": 10,
      "brief": "The SQL concept, explained for a beginner, with runnable ~~~sql examples on the city tables.",
      "ask": "The question to answer with one query.",
      "starter": "SELECT\nFROM staff;",
      "solution": "SELECT name, role FROM staff;",
      "ordered": false,
      "hint": "One helpful sentence.",
      "clue": "What this result tells the detective, written as a note for the board."
    }
  ]
}
```

- How a step is checked: the learner's query and the solution run on two fresh copies of the
  city database. The **last result table** of each is compared: same number of columns, same
  rows (column names are not compared; numbers are rounded to 2 decimals). Row order matters
  only with `"ordered": true` (use it when the question asks for a sorted result, and make the
  sort order unambiguous).
- For steps that change data (INSERT, UPDATE, DELETE, CREATE TABLE, VIEW, INDEX, TRIGGER,
  transactions), add `"verify": ["SELECT ..."]`: those queries run on both databases after the
  learner's code and their results are compared instead. A verify entry may contain several
  statements; its last table is compared (for a trigger, do an UPDATE then SELECT the log).
- `setup`: optional SQL run on both copies before the learner's code.
- `brief` examples run on a fresh copy of the city database and must return a table.
- The solution must return at least one row (evidence should show something).
- `ask` should make the expected columns clear ("show the name and the time").

## Engine quirks to respect (the page runs Python with Brython, in the browser)

- In a regex character class put the hyphen first: `[-\w.]`, never `[\w.-]`.
- `dict.setdefault` with **non-string** keys is broken. Use `d[k] = d.get(k, default)` patterns, or string keys.
- Avoid attribute or variable names that start with two underscores (other than special methods like `__init__`).
- A program has 3 seconds. Keep loops small.
- Do not print `random` values in anything that is checked. Do not use threads, networking or `time.sleep`.
- Floats print like CPython. f-strings, `match`, comprehensions, generators, decorators, classes, `datetime`, `json`, `csv`, `re`, `collections`, `itertools`, `functools`, `string.Template`, `sqlite3` all work.
- In examples, `input()` has no lines to read unless the fence says `~~~python stdin=line one|line two`.

## Validate before you finish

```bash
python story/validate.py story/missions/your-file.json
python story/validate.py story/cases/your-file.json
```

It must report 0 problems. It runs every solution on every map with CPython using the same
robot code as the page, checks that the starter does not already pass, that the solution fits
par, that every example runs and prints, that every lesson id exists, and that no em dash, en
dash or emoji slipped in. Write the JSON with a small Python script (json.dump with
`ensure_ascii=False, indent=1`) rather than by hand, so escaping is never a problem; keep that
script outside the repository (for example in your temp folder). Do not edit any other file.
