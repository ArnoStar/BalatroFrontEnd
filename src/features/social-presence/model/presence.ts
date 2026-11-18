// The game's presence for the player's friends (the social service): what the
// player is doing, sent when it changes and every minute while the game is
// seen. A run's deck, stake and ante (a multiplayer run's mode); the menu;
// watching a run again. Nothing is sent for a player who isn't signed in, nor
// while a bug report is replayed.
import { G } from '@/shared/lib/engine';
import { social, type Activity } from '@/shared/api';
import { run } from '@/entities/run';

const CHECK_EVERY = 5_000;
const BEAT_EVERY = 60_000;

function activity(): Activity {
  const q = new URLSearchParams(location.search);
  if (q.has('watch')) return { kind: 'watching' };
  const v = run.view;
  if (G.STAGE === G.STAGES?.RUN && v) {
    const mode = v.settings.mode;
    return {
      kind: 'run', deck: v.settings.deck, stake: v.settings.stake, ante: v.ante, seeded: !!v.settings.seeded,
      challenge: v.settings.challenge ?? null, mode: mode === 'pvp' || mode === 'coop' ? mode : null,
    };
  }
  return { kind: 'menu' };
}

export function start_presence() {
  if (new URLSearchParams(location.search).has('report')) return;
  let last = '';
  let sent_at = 0;
  let pause_until = 0;
  const check = () => {
    const now = Date.now();
    if (document.visibilityState !== 'visible' || now < pause_until) return;
    const a = activity();
    const key = JSON.stringify(a);
    if (key === last && now - sent_at < BEAT_EVERY) return;
    last = key;
    sent_at = now;
    social.presence(a).then(
      (signed_in) => { if (!signed_in) pause_until = now + BEAT_EVERY; },
      () => { pause_until = now + 5 * BEAT_EVERY; }, // (the social service isn't there: try again later)
    );
  };
  setInterval(check, CHECK_EVERY);
  document.addEventListener('visibilitychange', check);
  check();
}
