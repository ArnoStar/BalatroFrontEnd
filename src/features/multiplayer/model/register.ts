// The multiplayer feature's entry points: the MULTIPLAYER button, the PvP run's
// buttons and panel, and /play/?match=<code> (an invite link).
import { G } from '@/shared/lib/engine';
import { join_match, open_lobby, open_match_run, register_lobby_funcs, when_menu_ready } from '../ui/lobby';
import { start_board } from '../ui/board';
import { start_coop_board } from '../ui/coop-board';
import { register_emote_funcs } from '../ui/emotes';
import { register_stats_funcs } from '../ui/stats';
import { start_alerts } from './alerts';
import { register_coop_funcs } from './coop';
import { tr } from '../ui/text';
import { load_current, mp } from './match';
import { register_pvp_funcs } from './pvp';

export function register_multiplayer_funcs() {
  register_pvp_funcs(open_match_run);
  register_lobby_funcs();
  register_coop_funcs();
  register_emote_funcs();
  register_stats_funcs();
  start_board();
  start_coop_board();
  start_alerts();
  G.FUNCS.multiplayer = () => open_lobby();
  G.FUNCS.multiplayer_join = (code: string) => void join_match(code);
  G.FUNCS.multiplayer_rejoin = () => {
    const m = mp.match;
    if (m?.status === 'playing' && m.run_id) open_match_run(m);
  };
  G.UIDEF.multiplayer_label = () => tr('multiplayer');
  void load_current();
}

/** the round evaluation's line for a lost round of a PvP run (in place of Mr. Bones') */
export function round_lost_text(): string {
  return tr('round_lost_row');
}

/** /play/?match=<code>: a friend's invite, joined once the title screen is up */
export async function open_match_link_if_asked() {
  const q = new URLSearchParams(location.search);
  const code = (q.get('match') ?? '').toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code) || q.has('watch') || q.has('report')) return;
  await when_menu_ready();
  const params = new URLSearchParams(location.search);
  params.delete('match');
  history.replaceState(history.state, '', location.pathname + (params.size ? `?${params}` : '')); // (reloading doesn't join again)
  void join_match(code);
}
