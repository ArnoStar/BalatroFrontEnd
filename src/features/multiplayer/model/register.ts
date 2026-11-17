// The multiplayer feature's entry points: the MULTIPLAYER button, the PvP run's
// buttons and panel, and /play/?match=<code> (an invite link).
import { G } from '@/shared/lib/engine';
import { join_match, open_lobby, open_match_run } from '../ui/lobby';
import { start_pvp_hud } from '../ui/pvp-hud';
import { tr } from '../ui/text';
import { load_current, mp } from './match';
import { register_pvp_funcs } from './pvp';

export function register_multiplayer_funcs() {
  register_pvp_funcs(open_match_run);
  start_pvp_hud();
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

function when_menu_ready(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (G.STAGE === G.STAGES.MAIN_MENU && !G.screenwipe && G.MAIN_MENU_UI ? resolve() : requestAnimationFrame(check));
    check();
  });
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
