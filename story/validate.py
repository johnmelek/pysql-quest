"""Check story content with CPython before it goes on the page.

    python story/validate.py                       every missions and cases file
    python story/validate.py story/missions/x.json one file (missions or cases)

Missions: the solution must pass every map, the starter must fail at least one map, the
solution must fit the par, every example in "power" must run and print, and text must not
contain dashes the house style forbids or emojis. Cases: every step's solution must run
against story/city.sql and return rows, every brief example must return a table, the culprit
must be a suspect. The page runs the same checks again in the browser (window.__selfTestStory).
"""
import builtins, contextlib, glob, io, json, os, re, shutil, sqlite3, sys, tempfile, types

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = open(os.path.join(ROOT, 'src.html'), encoding='utf8').read()
LESSON_IDS = set(re.findall(r'\{id:"([a-z]+-[a-z]+)", track:', SRC))
BAD = re.compile('[–—\U0001F300-\U0001FAFF☀-➿]')
SEED_FS = None  # examples run with an empty disk here; the page gives them the sample files


def robot_module():
    mod = types.ModuleType('robot')
    exec(open(os.path.join(HERE, 'robot.py'), encoding='utf8').read(), mod.__dict__)
    return mod


def norm(s):
    return '\n'.join(l.rstrip() for l in s.replace('\r', '').split('\n')).strip()


def code_lines(code):
    return len([l for l in code.split('\n') if l.strip() and not l.strip().startswith('#')])


def run_world(m, w, code, test=''):
    """Run code on one map the way the page does: fresh world, files, databases and input lines."""
    bot = robot_module()
    sys.modules['robot'] = bot
    bot.load(w)
    tmp = tempfile.mkdtemp()
    cwd = os.getcwd()
    lines = (w.get('stdin') or '').split('\n') if w.get('stdin') else []
    def fake_input(prompt=''):
        if not lines:
            raise EOFError('EOF when reading a line')
        return lines.pop(0)
    out, err, test_res = io.StringIO(), '', ''
    try:
        for name, text in (w.get('fs') or {}).items():
            p = os.path.join(tmp, name)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'w', encoding='utf8', newline='').write(text)
        os.chdir(tmp)
        for name, sql in (w.get('dbs') or {}).items():
            con = sqlite3.connect(name)
            con.executescript(sql)
            con.commit()
            con.close()
        ns = {'__name__': '__main__', 'input': fake_input}
        old_input = builtins.input
        builtins.input = fake_input
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                exec(compile(code, '<string>', 'exec'), ns)
        except SystemExit:
            pass
        except BaseException as e:
            err = '%s: %s' % (type(e).__name__, e)
        finally:
            builtins.input = old_input
        if test and not err:
            files = {}
            for p in glob.glob('**/*', recursive=True):
                if os.path.isfile(p) and not p.endswith('.db'):
                    files[p.replace('\\', '/')] = open(p, encoding='utf8').read()
            ns['_out'] = out.getvalue()
            ns['_fs'] = files
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    exec(test, ns)
                test_res = 'pass'
            except AssertionError as e:
                test_res = str(e) or 'A check failed.'
            except BaseException as e:
                test_res = '%s: %s' % (type(e).__name__, e)
    finally:
        os.chdir(cwd)
        shutil.rmtree(tmp, ignore_errors=True)
    return out.getvalue(), err, test_res, json.loads(bot.state())


def judge(m, w, out, err, test_res, s):
    if s['crash']:
        return s['crash']
    if err:
        return err
    c = m.get('check') or {}
    if c.get('items') and s['items_left']:
        return 'items left on the floor: %d' % s['items_left']
    if c.get('doors') and s['doors_left']:
        return 'doors still locked: %d' % s['doors_left']
    if c.get('exit') and not s['at_exit']:
        return 'robot not on the exit (stopped at %d, %d)' % (s['x'], s['y'])
    if w.get('output') is not None and norm(out) != norm(w['output']):
        return 'output differs\nexpected:\n%s\ngot:\n%s' % (w['output'], out)
    if test_res and test_res != 'pass':
        return test_res
    return ''


def examples(md, lang):
    return re.findall(r'~~~%s[^\n]*\n(.*?)~~~' % lang, md, re.S)


def text_fields(obj, path=''):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k not in ('map', 'fs', 'dbs'):
                yield from text_fields(v, path + '.' + k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from text_fields(v, '%s[%d]' % (path, i))


def check_missions(items):
    problems = []
    for m in items:
        mid = m.get('id', '?')
        for key in ('id', 'chapter', 'title', 'covers', 'xp', 'story', 'power', 'goal', 'starter', 'solution', 'hint', 'par', 'worlds'):
            if key not in m:
                problems.append((mid, 'missing field ' + key))
        for l in m.get('covers', []):
            if l not in LESSON_IDS:
                problems.append((mid, 'unknown lesson id ' + l))
        for path, t in text_fields(m):
            if BAD.search(t):
                problems.append((mid, 'dash or emoji in ' + path))
        for i, w in enumerate(m.get('worlds', [])):
            starts = sum(row.count(ch) for row in w['map'] for ch in '^>v<')
            if starts != 1:
                problems.append((mid, 'map %d needs exactly one robot start (^ > v <), found %d' % (i + 1, starts)))
                continue
            out, err, t, s = run_world(m, w, m['solution'], m.get('test', ''))
            why = judge(m, w, out, err, t, s)
            if why:
                problems.append((mid, 'solution fails map %d: %s' % (i + 1, why)))
        if m.get('worlds') and all(not judge(m, w, *run_world(m, w, m['starter'], m.get('test', ''))) for w in m['worlds']):
            problems.append((mid, 'the starter already passes every map'))
        if code_lines(m.get('solution', '')) > m.get('par', 0):
            problems.append((mid, 'solution has %d lines, par is %d' % (code_lines(m['solution']), m['par'])))
        for k, ex in enumerate(examples(m.get('power', ''), 'python')):
            buf = io.StringIO()
            tmp, cwd = tempfile.mkdtemp(), os.getcwd()  # examples write files: keep them out of the repo
            os.chdir(tmp)
            try:
                with contextlib.redirect_stdout(buf):
                    exec(ex, {'__name__': '__main__'})
                if not buf.getvalue().strip():
                    problems.append((mid, 'power example %d prints nothing' % (k + 1)))
            except Exception as e:
                problems.append((mid, 'power example %d fails: %s: %s' % (k + 1, type(e).__name__, e)))
            finally:
                os.chdir(cwd)
                shutil.rmtree(tmp, ignore_errors=True)
    return problems


def check_cases(items):
    problems = []
    city = open(os.path.join(HERE, 'city.sql'), encoding='utf8').read()
    def db():
        con = sqlite3.connect(':memory:')
        con.executescript(city)
        return con
    for c in items:
        cid = c.get('id', '?')
        for path, t in text_fields(c):
            if BAD.search(t):
                problems.append((cid, 'dash or emoji in ' + path))
        if c.get('culprit') not in [p['name'] for p in c.get('suspects', [])]:
            problems.append((cid, 'culprit is not one of the suspects'))
        for k, s in enumerate(c.get('steps', []), 1):
            sid = '%s step %d' % (cid, k)
            for l in s.get('covers', []):
                if l not in LESSON_IDS:
                    problems.append((sid, 'unknown lesson id ' + l))
            con = db()
            try:
                if s.get('setup'):
                    con.executescript(s['setup'])
                cur = con.cursor()
                # run statement by statement like sql.js and keep the last result
                rows, cols = None, None
                for stmt in [x for x in sqlite_split(s['solution']) if x.strip()]:
                    cur.execute(stmt)
                    if cur.description:
                        rows, cols = cur.fetchall(), [d[0] for d in cur.description]
                if s.get('verify'):
                    for v in s['verify']:
                        desc = None
                        for stmt in [x for x in sqlite_split(v) if x.strip()]:
                            cur.execute(stmt)
                            desc = cur.description or desc
                        if not desc:
                            problems.append((sid, 'verify query returns no table: ' + v))
                elif rows is None:
                    problems.append((sid, 'solution returns no table'))
                elif not rows:
                    problems.append((sid, 'solution returns zero rows (evidence should show something)'))
            except Exception as e:
                problems.append((sid, 'solution fails: %s' % e))
            finally:
                con.close()
            for j, ex in enumerate(examples(s.get('brief', ''), 'sql'), 1):
                con = db()
                try:
                    cur = con.cursor()
                    got = False
                    for stmt in [x for x in sqlite_split(ex) if x.strip()]:
                        cur.execute(stmt)
                        got = got or bool(cur.description)
                    if not got:
                        problems.append((sid, 'brief example %d returns no table' % j))
                except Exception as e:
                    problems.append((sid, 'brief example %d fails: %s' % (j, e)))
                finally:
                    con.close()
    return problems


def sqlite_split(sql):
    """Split a script into complete statements (handles CREATE TRIGGER ... BEGIN ... END;)."""
    out, cur = [], ''
    for line in sql.split('\n'):
        cur += line + '\n'
        if sqlite3.complete_statement(cur):
            out.append(cur)
            cur = ''
    if cur.strip():
        out.append(cur)
    return out


def main(paths):
    if not paths:
        paths = sorted(glob.glob(os.path.join(HERE, 'missions', '*.json'))) + sorted(glob.glob(os.path.join(HERE, 'cases', '*.json')))
    total = []
    for p in paths:
        items = json.load(open(p, encoding='utf8'))
        is_cases = os.sep + 'cases' + os.sep in os.path.abspath(p)
        probs = check_cases(items) if is_cases else check_missions(items)
        print('%s: %d item(s), %d problem(s)' % (os.path.relpath(p, ROOT), len(items), len(probs)))
        for who, what in probs:
            print('  [%s] %s' % (who, what))
        total += probs
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
