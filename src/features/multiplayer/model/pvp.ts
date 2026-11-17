// PvP in the run: the player's run is an ordinary run of the API, and the match
// keeps the two players in step. Here, while the player's match run is on screen:
// - the blind's Select and Skip buttons send the player's choice to the match;
//   once both have chosen, the blind is played (or skipped, if both skip it)
//   with the game's own select_blind / skip_blind;
// - Cash Out waits until the other player has finished the round, then cashes out;
// - when the timer has moved the run on (the server played the late player's
//   moves), the run is opened again as it is now.
import { G } from '@/shared/lib/engine';
import { matches, type BlindChoice, type MatchView } from '@/shared/api';
import { run, timeline_playing } from '@/entities/run';
import { mp, on_match, problem, refresh, set_match } from './match';

export const pvp = {
  /** the choice the player sent for the blind on deck */
  choosing: null as BlindChoice | null,
  /** Cash Out pressed while the other player still plays the round */
  cash_out_pending: false,
  /** the last refused request */
  error: '',
};

type Func = (e: any) => void;
const original: { select_blind?: Func; skip_blind?: Func; cash_out?: Func } = {};
let performed_vote = ''; // the match and blind index whose decision was played
let reloaded_version = -1;
let last_status: Record<string, string> = {};
let open_run: ((m: MatchView) => void) | null = null;

/** the match's run is on screen */
export function in_match_run(m: MatchView | null = mp.match): m is MatchView {
  return !!m && m.mode === 'pvp' && !!m.run_id && run.id === m.run_id && G.STAGE === G.STAGES.RUN;
}

function playing(m: MatchView | null = mp.match): m is MatchView {
  return in_match_run(m) && m.status === 'playing';
}

/** the first visible UI element whose button is `name` */
function find_button(name: string): any {
  const find = (n: any): any => {
    if (!n) return null;
    if (n.config?.button === name && n.states?.visible) return n;
    for (const c of Object.values(n.children ?? {})) {
      const r = find(c);
      if (r) return r;
    }
    return null;
  };
  for (const box of [G.blind_select, G.round_eval, ...(G.I?.UIBOX ?? [])]) {
    const n = box?.UIRoot && find(box.UIRoot);
    if (n) return n;
  }
  return null;
}

async function choose(choice: BlindChoice, e: any) {
  // (one_press buttons: pressable again, to change one's mind until the other has chosen)
  if (e?.config) e.config.button = choice === 'skip' ? 'skip_blind' : 'select_blind';
  const m = mp.match;
  if (!m) return;
  if (m.pvp?.vote?.decision) {
    step(m);
    return;
  }
  pvp.choosing = choice;
  pvp.error = '';
  try {
    set_match(await matches.vote(m.id, choice));
  } catch (err) {
    pvp.choosing = null;
    pvp.error = problem(err);
    set_match(mp.match);
  }
}

async function cash_out(e: any) {
  if (e?.config) e.config.button = 'cash_out';
  pvp.cash_out_pending = true;
  const m = await refresh();
  step(m);
}

/** the match moved on: what the run does about it */
function step(m: MatchView | null) {
  if (m && last_status[m.id] === 'lobby' && m.status === 'playing' && G.STAGE !== G.STAGES.RUN) open_run?.(m);
  if (m) last_status = { [m.id]: m.status };
  if (!in_match_run(m)) return;
  // the timer played the run on (or another tab did): the run as it is now
  const v = run.view;
  if (m.run_version !== null && v && m.run_version > v.version && !run.busy && !timeline_playing()
      && reloaded_version !== m.run_version) {
    reloaded_version = m.run_version;
    pvp.cash_out_pending = false;
    G.FUNCS.start_run(null, { open_id: run.id });
    return;
  }
  const p = m.pvp;
  if (m.status !== 'playing' || !p) return;
  const vote = p.vote;
  const voted = vote ? `${m.id}:${vote.index}` : '';
  if (voted !== performed_vote) pvp.choosing = vote?.yours ?? null;
  if (vote?.decision && voted !== performed_vote && G.STATE === G.STATES.BLIND_SELECT && G.blind_select
      && !run.busy && !G.CONTROLLER.locked) {
    const name = vote.decision === 'skip' ? 'skip_blind' : 'select_blind';
    const e = find_button(name);
    if (e) {
      performed_vote = voted;
      pvp.choosing = null;
      (vote.decision === 'skip' ? original.skip_blind : original.select_blind)?.(e);
    }
  }
  if (G.STATE !== G.STATES.ROUND_EVAL) pvp.cash_out_pending = false;
  if (pvp.cash_out_pending && p.can_cash_out && G.round_eval && !run.busy) {
    const e = find_button('cash_out');
    if (e) {
      pvp.cash_out_pending = false;
      e.config.button = null; // (pressed: one_press)
      original.cash_out?.(e);
    }
  }
}

/** after the run funcs are registered: Select, Skip and Cash Out go through the match in a PvP run */
export function register_pvp_funcs(open_match_run: (m: MatchView) => void) {
  open_run = open_match_run;
  original.select_blind = G.FUNCS.select_blind;
  original.skip_blind = G.FUNCS.skip_blind;
  original.cash_out = G.FUNCS.cash_out;
  G.FUNCS.select_blind = (e: any) => (playing() ? void choose('select', e) : original.select_blind?.(e));
  G.FUNCS.skip_blind = (e: any) => (playing() ? void choose('skip', e) : original.skip_blind?.(e));
  G.FUNCS.cash_out = (e: any) => (playing() ? void cash_out(e) : original.cash_out?.(e));
  on_match(step);
}
