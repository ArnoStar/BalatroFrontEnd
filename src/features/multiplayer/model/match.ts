// The player's multiplayer match (BalatroWebAPI's /matches): the latest view of
// it, read again every second or two while it lasts. Reading it is also how the
// match catches up with the timer on the server, so both players' games keep
// reading it while they play.
import { matches, ApiError, type MatchView } from '@/shared/api';

const POLL_MS = 1500;

type Listener = (m: MatchView | null) => void;

export const mp = {
  match: null as MatchView | null,
  /** Date.now() when `match` came (its server_time was then) */
  received_at: 0,
};

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let in_flight = false;

export function set_match(m: MatchView | null) {
  const before = mp.match;
  mp.match = m;
  mp.received_at = Date.now();
  if (m && m.status !== 'finished') start_polling();
  else if (m && before?.id === m.id && before.status !== 'finished') follow_finished();
  for (const l of [...listeners]) {
    try { l(m); } catch (err) { console.error('[multiplayer]', err); }
  }
}

/** called with every new view of the match (null: no match any more) */
export function on_match(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function refresh(): Promise<MatchView | null> {
  const m = mp.match;
  if (!m || in_flight) return mp.match;
  in_flight = true;
  try {
    const fresh = await matches.get(m.id);
    if (mp.match?.id === m.id) set_match(fresh);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && mp.match?.id === m.id) set_match(null);
    else console.warn('[multiplayer] the match could not be read', err);
  } finally {
    in_flight = false;
  }
  if (mp.match?.status === 'finished' && Date.now() > follow_until) stop_polling();
  return mp.match;
}

let poll_ms = POLL_MS;
let follow_until = 0;

const FOLLOW_MS = 3 * 60_000;

/** a match just over is still read for a while (a rematch the other player asks for) */
export function follow_finished(ms = FOLLOW_MS) {
  follow_until = Date.now() + ms;
  if (!timer && mp.match) timer = setInterval(() => { void refresh(); }, poll_ms);
}

export function start_polling() {
  if (timer) return;
  timer = setInterval(() => { void refresh(); }, poll_ms);
}

/** how often the match is read (a coop partner's turn is watched closely) */
export function set_poll_interval(ms: number) {
  if (ms === poll_ms) return;
  poll_ms = ms;
  if (timer) {
    stop_polling();
    start_polling();
  }
}

export function stop_polling() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** the match the player was playing (or waiting in), if any */
export async function load_current(): Promise<MatchView | null> {
  try {
    const m = await matches.current();
    set_match(m);
    return m;
  } catch (err) {
    console.warn('[multiplayer] no match service', err);
    return null;
  }
}

/** seconds until the timer's deadline (by the server's clock), or null */
export function seconds_left(m: MatchView | null = mp.match): number | null {
  const deadline = m?.pvp?.deadline;
  if (!m || !deadline) return null;
  const now = Date.parse(m.server_time) + (Date.now() - mp.received_at);
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
}

/** a refused request's message, for the player */
export function problem(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return String(err);
}
