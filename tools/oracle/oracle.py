"""Timing oracle: plays a scenario with BalatroEngine and prints, relative to
each action, when each queued event function runs (by qualname), the STATE
changes and the API's events (feedback). The front end's port of an action
can be compared with it frame by frame.

    cd ../BalatroEngine && uv run --no-sync python ../BalatroFrontEnd/tools/oracle/oracle.py \
        ../BalatroFrontEnd/tools/oracle/charm_tag.py

A scenario is Python run with `Game` and `run(G, name, fn)` in scope; `ALL=1`
also prints the noisy events (draws, floors, stop_use...).
"""
import os, sys, json
sys.path.insert(0, os.environ.get('BALATRO_ENGINE', os.path.join(os.path.dirname(__file__), '../../../BalatroEngine')))
from balatro import Game
from balatro import common, events
import balatro.game as gm

REC = {'on': False, 't0': 0, 'log': []}
SN = {v: k for k, v in gm.STATES.__dict__.items() if isinstance(v, int)}
NOISE = () if os.environ.get('ALL') else ('floor', 'dec_stop_use', 'update_hand_text', 'card_eval_status_text', 'draw_card')

orig_ev = common.CommonMixin.ev
def ev(self, fn=None, **kw):
    if fn is not None:
        q = getattr(fn, '__qualname__', '?'); f0 = fn
        def fn2():
            if REC['on']: REC['log'].append((round(self.TIMERS['REAL'] - REC['t0'], 3), 'ev', q))
            return f0()
        fn = fn2
    return orig_ev(self, fn, **kw)
common.CommonMixin.ev = ev

orig_init = events.Event.__init__
def ev_init(self, G, func=None, **kw):
    if func is not None and REC['on']:
        f = func; q = getattr(f, '__qualname__', '?')
        def wrapped(*a, **k):
            r = f(*a, **k)
            if REC['on'] and r not in (None, False) and not q.startswith('CommonMixin.ev.<locals>'):
                REC['log'].append((round(G.TIMERS['REAL'] - REC['t0'], 3), 'ev', q))
            return r
        func = wrapped
    orig_init(self, G, func, **kw)
events.Event.__init__ = ev_init

orig_sa = Game.__setattr__
def sa(self, k, v):
    if k == 'STATE' and REC['on']: REC['log'].append((round(self.TIMERS['REAL'] - REC['t0'], 3), 'STATE', SN.get(v, v)))
    orig_sa(self, k, v)
Game.__setattr__ = sa

def run(G, name, fn):
    REC['on'] = True; REC['t0'] = G.TIMERS['REAL']; REC['log'] = []
    fb = G.start_feedback(); fn(); G.stop_feedback(); REC['on'] = False
    rows = REC['log'] + [(e['t'], 'fb', e['type'] + ' ' + json.dumps({k: v for k, v in e.items() if k not in ('t', 'type')})) for e in fb]
    rows.sort(key=lambda r: r[0])
    print('=====', name)
    for t, kind, q in rows:
        if kind == 'ev' and any(n in q for n in NOISE): continue
        print(f'  {t:7.3f} {kind:5s} {q}')

if __name__ == '__main__':
    exec(open(sys.argv[1]).read())
