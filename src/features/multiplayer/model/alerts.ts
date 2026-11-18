// What a player of a match must not miss while the game is in another tab: the
// tab's title blinks with it ("● Your turn") and a sound plays, until the tab is
// seen again. In view, the game's own screens say it.
//
// - the match has started (the host started it) or a player joined your lobby;
// - coop: your turn comes;
// - PvP: the other player waits for you (and the timer runs);
// - after a match: the other player asks for a rematch.
import { play_sound } from '@/shared/lib/engine';
import type { MatchView } from '@/shared/api';
import { on_match } from './match';
import { tr } from '../ui/text';

const BLINK_MS = 1000;

let base_title = '';
let blink: ReturnType<typeof setInterval> | null = null;
let before: MatchView | null = null;

function stop() {
  if (blink) clearInterval(blink);
  blink = null;
  if (base_title) document.title = base_title;
}

/** the tab says `text` (blinking) until it is seen; a sound once */
export function alert_player(text: string) {
  if (document.visibilityState === 'visible') return;
  if (!blink) base_title = document.title;
  else clearInterval(blink);
  let on = false;
  blink = setInterval(() => {
    on = !on;
    document.title = on ? `● ${text}` : base_title;
  }, BLINK_MS);
  document.title = `● ${text}`;
  play_sound('gong', 1.2, 0.5);
}

function other_name(m: MatchView): string {
  return m.players.find((p) => !p.you)?.name ?? '?';
}

function check(m: MatchView | null) {
  const was = before && m && before.id === m.id ? before : null;
  before = m;
  if (!m || !was) return;
  if (was.status === 'lobby' && m.status === 'playing') return alert_player(tr('alert_started'));
  if (m.status === 'lobby' && m.host && m.players.length > was.players.length) return alert_player(tr('alert_joined', { name: other_name(m) }));
  if (m.coop && m.status === 'playing' && m.coop.your_turn && !was.coop?.your_turn) return alert_player(tr('your_turn'));
  if (m.pvp && m.status === 'playing' && m.pvp.opponent_waiting && !was.pvp?.opponent_waiting) {
    return alert_player(tr('alert_waiting', { name: other_name(m) }));
  }
  if (m.rematch && !m.rematch.by_you && m.rematch.open && !was.rematch) return alert_player(tr('wants_rematch', { name: other_name(m) }));
}

export function start_alerts() {
  on_match(check);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') stop(); });
}
