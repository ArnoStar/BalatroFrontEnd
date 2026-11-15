// /play/?seed=<seed>&deck=<deck>&stake=<stake>: a seed a friend shared (the
// portal's chat). Once the title screen is up, the run setup opens on New Run
// with the seed filled in and the deck and stake chosen (as far as the player
// has unlocked them): the player looks, and plays it.
import { G } from '@/shared/lib/engine';
import { profile } from '@/shared/config';

const frames = (n: number) => new Promise<void>((done) => {
  const step = () => (n-- <= 0 ? done() : requestAnimationFrame(step));
  step();
});

function when_menu_ready(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (G.STAGE === G.STAGES.MAIN_MENU && !G.screenwipe && G.FUNCS?.setup_run ? resolve() : requestAnimationFrame(check));
    check();
  });
}

export async function open_seed_link_if_asked() {
  const q = new URLSearchParams(location.search);
  const seed = (q.get('seed') ?? '').toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(seed) || q.has('watch') || q.has('report')) return;
  await when_menu_ready();
  const mem = profile().MEMORY;
  const deck = G.P_CENTERS[q.get('deck') ?? ''];
  if (deck?.set === 'Back') mem.deck = deck.name;
  const stake = Number(q.get('stake'));
  if (Number.isInteger(stake) && stake >= 1 && stake <= 8) mem.stake = stake;
  history.replaceState(history.state, '', location.pathname); // (reloading doesn't open it again)
  G.FUNCS.setup_run({ config: { id: 'seed_link' } });
  // as if the player switched Seeded Run on, once the setup is on screen (toggle_seeded_run takes its
  // placeholder away on the first frames): the seed box shows the seed
  await frames(5);
  G.setup_seed = seed;
  G.run_setup_seed = true;
}
