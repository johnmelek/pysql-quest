# The robot's controls for Bot Escape. The world lives here, in Python, so the page and the
# local validator (story/validate.py) run exactly the same rules. Every action is recorded
# as a frame the page replays as an animation.
import json

DIRS = 'NESW'
STEP = {'N': (0, -1), 'E': (1, 0), 'S': (0, 1), 'W': (-1, 0)}
START = {'^': 'N', '>': 'E', 'v': 'S', '<': 'W'}
ITEMS = {'k': 'key', '$': 'coin'}

class RobotError(Exception):
    pass

W = {'grid': [], 'x': 0, 'y': 0, 'd': 'E', 'frames': [], 'crash': '', 'bag': {}, 'opened': [],
     'codes': {}, 'data': {}, 'battery': 400}

def load(spec_json):
    """Set up a fresh world from a mission map (called by the page before each run)."""
    spec = json.loads(spec_json) if isinstance(spec_json, str) else spec_json
    grid = [list(row) for row in spec['map']]
    for y in range(len(grid)):
        for x in range(len(grid[y])):
            if grid[y][x] in START:
                W['x'], W['y'], W['d'] = x, y, START[grid[y][x]]
                grid[y][x] = '.'
    W['grid'] = grid
    W['frames'] = []
    W['crash'] = ''
    W['bag'] = {'key': 0, 'coin': 0}
    W['opened'] = []
    W['codes'] = spec.get('codes', {})
    W['data'] = spec.get('data', {})
    W['battery'] = spec.get('battery', 400)

def _cell(x, y):
    g = W['grid']
    if y < 0 or y >= len(g) or x < 0 or x >= len(g[y]):
        return '#'
    return g[y][x]

def _ahead():
    dx, dy = STEP[W['d']]
    return W['x'] + dx, W['y'] + dy

def _frame(act, **extra):
    W['battery'] -= 1
    f = {'act': act, 'x': W['x'], 'y': W['y'], 'd': W['d']}
    f.update(extra)
    W['frames'].append(f)
    if W['battery'] < 0:
        _fail("The battery is empty: the robot made too many moves. Your code probably has a loop that never stops.")

def _fail(msg):
    W['crash'] = msg
    W['frames'].append({'act': 'crash', 'x': W['x'], 'y': W['y'], 'd': W['d'], 'msg': msg})
    raise RobotError(msg)

def _name(c):
    if c == '#':
        return 'wall'
    if c == 'x':
        return 'hole'
    if c == 'E':
        return 'exit'
    if c in ITEMS:
        return ITEMS[c]
    if c in 'ABCD':
        return 'door'
    if c in '123456789':
        return 'terminal'
    return 'floor'

# ---- actions
def move():
    """Move one square forward."""
    x, y = _ahead()
    c = _cell(x, y)
    if c == '#':
        _fail("Crash! The robot walked into a wall at (%d, %d)." % (x, y))
    if c in 'ABCD':
        _fail("Crash! Door %s at (%d, %d) is locked. Unlock it first." % (c, x, y))
    W['x'], W['y'] = x, y
    if c == 'x':
        _fail("The robot fell into a hole at (%d, %d)." % (x, y))
    _frame('move')

def turn_left():
    """Turn 90 degrees to the left."""
    W['d'] = DIRS[(DIRS.index(W['d']) + 3) % 4]
    _frame('turn')

def turn_right():
    """Turn 90 degrees to the right."""
    W['d'] = DIRS[(DIRS.index(W['d']) + 1) % 4]
    _frame('turn')

def pick():
    """Pick up the item the robot stands on (a key or a coin)."""
    c = _cell(W['x'], W['y'])
    if c not in ITEMS:
        _fail("There is nothing to pick up at (%d, %d)." % (W['x'], W['y']))
    W['bag'][ITEMS[c]] = W['bag'][ITEMS[c]] + 1
    W['grid'][W['y']][W['x']] = '.'
    _frame('pick', item=ITEMS[c])
    return ITEMS[c]

def unlock(code):
    """Unlock the door in front of the robot with a code."""
    x, y = _ahead()
    c = _cell(x, y)
    if c not in 'ABCD' or c == '':
        _fail("There is no locked door in front of the robot.")
    want = W['codes'].get(c)
    if want is None:
        if W['bag']['key'] < 1:
            _fail("Door %s needs a key and the robot has none." % c)
        W['bag']['key'] = W['bag']['key'] - 1
    elif str(code) != str(want):
        _fail("Alarm! %r is the wrong code for door %s." % (code, c))
    W['grid'][y][x] = '.'
    W['opened'].append(c)
    _frame('open', at=[x, y], door=c)

def say(*parts):
    """Speak: shows a speech bubble and prints the text."""
    text = ' '.join(str(p) for p in parts)
    print(text)
    _frame('say', text=text)

# ---- sensors (free: they do not use the battery)
def front_is_clear():
    """True when the square ahead can be walked on."""
    return _name(_cell(*_ahead())) not in ('wall', 'door', 'hole')

def front():
    """What is ahead: 'wall', 'floor', 'door', 'hole', 'exit', 'key', 'coin' or 'terminal'."""
    return _name(_cell(*_ahead()))

def here():
    """What the robot stands on (same names as front())."""
    return _name(_cell(W['x'], W['y']))

def at_exit():
    """True when the robot stands on the exit."""
    return _cell(W['x'], W['y']) == 'E'

def scan():
    """Read the terminal the robot stands on. Returns its data (text, a number, a list or a dict)."""
    c = _cell(W['x'], W['y'])
    if c not in '123456789':
        _fail("There is no terminal under the robot to scan.")
    return W['data'].get(c)

def position():
    """The robot's (x, y) square."""
    return (W['x'], W['y'])

def facing():
    """'N', 'E', 'S' or 'W'."""
    return W['d']

def bag():
    """What the robot carries, like {'key': 1, 'coin': 3}."""
    return dict(W['bag'])

__all__ = ['move', 'turn_left', 'turn_right', 'pick', 'unlock', 'say', 'front_is_clear', 'front',
           'here', 'at_exit', 'scan', 'position', 'facing', 'bag', 'RobotError']

def state():
    """Everything the page needs after a run, as JSON."""
    items = sum(1 for row in W['grid'] for c in row if c in ITEMS)
    doors = sum(1 for row in W['grid'] for c in row if c in 'ABCD')
    return json.dumps({'frames': W['frames'], 'crash': W['crash'], 'at_exit': at_exit(),
                       'items_left': items, 'doors_left': doors, 'bag': W['bag'],
                       'x': W['x'], 'y': W['y'], 'd': W['d']})

try:
    from browser import window
    window.pqBotLoad = load
    window.pqBotState = state
except ImportError:
    pass
