"""Check Script City contracts with CPython before they go on the page.

    python tycoon/validate.py            every file in tycoon/contracts
    python tycoon/validate.py --strict   also fail when a lesson is not covered yet

Python orders: the solution passes every test, the starter fails one (for an update, the solution of
the order it updates must fail), the solution fits the par, skill examples run and print. SQL orders:
the solution returns a table with rows on tycoon/company.sql (or its verify queries return tables),
the starter gives a different result. Text must not hold dashes the house style forbids or emojis.
The page runs the same checks again in the browser (window.__selfTestTycoon).
"""
import builtins, contextlib, glob, io, json, os, shutil, sqlite3, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'story'))
from validate import BAD, LESSON_IDS, code_lines, examples, norm, sqlite_split, text_fields  # noqa: E402

COMPANY = open(os.path.join(HERE, 'company.sql'), encoding='utf8').read()
REQUIRED = ('id', 'district', 'client', 'title', 'covers', 'brief', 'task', 'starter', 'solution', 'hint', 'par')


def run_py(t, code, test=''):
    """Run code on one test the way the page does: fresh files, databases and input lines."""
    tmp, cwd = tempfile.mkdtemp(), os.getcwd()
    lines = t['stdin'].split('\n') if t.get('stdin') else []
    def fake_input(prompt=''):
        if not lines:
            raise EOFError('EOF when reading a line')
        return lines.pop(0)
    out, err, res = io.StringIO(), '', ''
    try:
        for name, text in (t.get('fs') or {}).items():
            p = os.path.join(tmp, name)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'w', encoding='utf8', newline='').write(text)
        os.chdir(tmp)
        for name, sql in (t.get('dbs') or {}).items():
            con = sqlite3.connect(name)
            con.executescript(sql or '')
            con.commit()
            con.close()
        ns = {'__name__': '__main__', 'input': fake_input}
        old = builtins.input
        builtins.input = fake_input
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                exec(compile(code, '<string>', 'exec'), ns)
        except SystemExit:
            pass
        except BaseException as e:
            err = '%s: %s' % (type(e).__name__, e)
        finally:
            builtins.input = old
        if test and not err:
            files = {}
            for p in glob.glob('**/*', recursive=True):
                if os.path.isfile(p) and not p.endswith('.db'):
                    files[p.replace('\\', '/')] = open(p, encoding='utf8').read()
            ns['_out'], ns['_fs'] = out.getvalue(), files
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    exec(test, ns)
                res = 'pass'
            except AssertionError as e:
                res = str(e) or 'A check failed.'
            except BaseException as e:
                res = '%s: %s' % (type(e).__name__, e)
    finally:
        os.chdir(cwd)
        shutil.rmtree(tmp, ignore_errors=True)
    if err:
        return err
    if t.get('output') is not None and norm(out.getvalue()) != norm(t['output']):
        return 'output differs\nexpected:\n%s\ngot:\n%s' % (t['output'], out.getvalue())
    return '' if res in ('', 'pass') else res


def sql_result(c, code):
    """Last table of code (or of each verify query) on a fresh company database; raises on SQL errors."""
    con = sqlite3.connect(':memory:')
    try:
        con.executescript(COMPANY)
        if c.get('setup'):
            con.executescript(c['setup'])
        cur, last = con.cursor(), None
        for stmt in [s for s in sqlite_split(code) if s.strip()]:
            cur.execute(stmt)
            if cur.description:
                last = ([d[0] for d in cur.description], cur.fetchall())
        if c.get('verify'):
            last = []
            for v in c['verify']:
                for stmt in [s for s in sqlite_split(v) if s.strip()]:
                    cur.execute(stmt)
                    if cur.description:
                        got = ([d[0] for d in cur.description], cur.fetchall())
                last.append(got)
        return last
    finally:
        con.close()


def same(a, b, ordered):
    if a is None or b is None:
        return a is b
    pairs = list(zip(a, b)) if isinstance(a, list) else [(a, b)]
    for (ca, ra), (cb, rb) in pairs:
        if len(ca) != len(cb):
            return False
        ra, rb = [repr(r) for r in ra], [repr(r) for r in rb]
        if (ra if ordered else sorted(ra)) != (rb if ordered else sorted(rb)):
            return False
    return True


def check(items):
    problems, seen = [], {}
    for c in items:
        cid = c.get('id', '?')
        for key in REQUIRED + (('machine',) if c.get('type', 'order') == 'order' else ('of',)):
            if key not in c:
                problems.append((cid, 'missing field ' + key))
        if cid in seen:
            problems.append((cid, 'duplicate id'))
        if c.get('of') and c['of'] not in seen:
            problems.append((cid, '"of" must name an earlier contract: ' + str(c.get('of'))))
        if c.get('type', 'order') == 'order' and c.get('of'):
            problems.append((cid, 'an order has no "of"; use type update or bug'))
        if c.get('district') not in ('py', 'auto', 'sql'):
            problems.append((cid, 'district must be py, auto or sql'))
        for l in c.get('covers', []):
            if l not in LESSON_IDS:
                problems.append((cid, 'unknown lesson id ' + l))
        for path, t in text_fields(c):
            if BAD.search(t):
                problems.append((cid, 'dash or emoji in ' + path))
        seen[cid] = c
        if 'solution' not in c:
            continue
        starter = seen[c['of']]['solution'] if c.get('type') == 'update' and c.get('of') in seen else c.get('starter', '')
        lang = 'sql' if c.get('district') == 'sql' else 'python'
        if lang == 'python':
            tests = c.get('tests') or []
            if not tests:
                problems.append((cid, 'no tests'))
            for i, t in enumerate(tests, 1):
                why = run_py(t, c['solution'], c.get('test', ''))
                if why:
                    problems.append((cid, 'solution fails test %d: %s' % (i, why)))
            if tests and all(not run_py(t, starter, c.get('test', '')) for t in tests):
                problems.append((cid, 'the starter already passes every test'))
        else:
            try:
                sol = sql_result(c, c['solution'])
                if sol is None:
                    problems.append((cid, 'solution returns no table'))
                elif not c.get('verify') and not sol[1]:
                    problems.append((cid, 'solution returns zero rows'))
                else:
                    try:
                        if same(sql_result(c, starter), sol, c.get('ordered')):
                            problems.append((cid, 'the starter already gives the right result'))
                    except Exception:
                        pass
            except Exception as e:
                problems.append((cid, 'solution fails: %s' % e))
        if code_lines(c['solution']) > c.get('par', 0):
            problems.append((cid, 'solution has %d lines, par is %d' % (code_lines(c['solution']), c.get('par', 0))))
        sk = c.get('skill') or {}
        for k, ex in enumerate([sk['example']] if sk.get('example') else [], 1):
            if lang == 'sql':
                try:
                    if sql_result({}, ex) is None:
                        problems.append((cid, 'skill example returns no table'))
                except Exception as e:
                    problems.append((cid, 'skill example fails: %s' % e))
                continue
            buf, tmp, cwd = io.StringIO(), tempfile.mkdtemp(), os.getcwd()
            os.chdir(tmp)
            try:
                with contextlib.redirect_stdout(buf):
                    exec(ex, {'__name__': '__main__'})
                if not buf.getvalue().strip():
                    problems.append((cid, 'skill example prints nothing'))
            except Exception as e:
                problems.append((cid, 'skill example fails: %s: %s' % (type(e).__name__, e)))
            finally:
                os.chdir(cwd)
                shutil.rmtree(tmp, ignore_errors=True)
    return problems


def main(args):
    paths = sorted(glob.glob(os.path.join(HERE, 'contracts', '*.json')))
    items, bad = [], 0
    for p in paths:
        part = json.load(open(p, encoding='utf8'))
        items += part
        print('%s: %d contract(s)' % (os.path.relpath(p, HERE), len(part)))
    probs = check(items)
    for who, what in probs:
        print('  [%s] %s' % (who, what))
    missing = sorted(LESSON_IDS - {l for c in items for l in c.get('covers', [])})
    print('%d contracts, %d problem(s), %d lesson(s) not covered%s' % (len(items), len(probs), len(missing), (': ' + ' '.join(missing)) if missing else ''))
    return 1 if probs or ('--strict' in args and missing) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
