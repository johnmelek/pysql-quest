# PySQL Quest

Python and SQL from zero to hero, in the browser. Three ways to play, one progress:

- **Script City**: an automation tycoon. Every script you write for a client becomes a machine that earns.
- **Story mode**: code a robot out of a locked factory, solve SQL cases in Harbor City.
- **The course**: every lesson in order, with runnable examples, step through and checked exercises.

Play: https://johnmelek.github.io/pysql-quest/

Progress saves to a secret gist in the player's GitHub account (sign in once per browser with a fine-grained
token that only has **Gists: Read and write**). Only the accounts listed in `ALLOW` in `build.js` can sign in.

## Build

```bash
node build.js
```

`docs/` is the GitHub Pages site. The same build also writes the claude.ai artifact pages and offline copies
(ignored by git). Content checks: `python story/validate.py` and `python tycoon/validate.py`.
