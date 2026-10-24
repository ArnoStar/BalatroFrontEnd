// Starting, opening and leaving runs (button_callbacks.lua: start_run,
// start_setup_run, go_to_menu, notify_then_setup_run, copy_seed, wipe_on,
// wipe_off). A new run is created by the API; an open run is fetched.
import { G, UIBox, DynaText, Particles, Event, HEX, play_sound, delete_run, pseudorandom_element } from '@/shared/lib/engine';
import { api, type GameView, type NewGameRequest } from '@/shared/api';
import { Card } from '@/entities/card';
import { clear_run } from '@/entities/run';

export function wipe_on(message?: string[], no_card?: boolean, timefac = 1, alt_colour?: any) {
  if (G.screenwipe) return;
  G.CONTROLLER.locks.wipe = true;
  G.STAGE_OBJECT_INTERRUPT = true;
  const colours = { black: HEX('4f6367FF'), white: [1, 1, 1, 1] };
  if (!no_card) {
    G.screenwipecard = new Card(1, 1, G.CARD_W, G.CARD_H, pseudorandom_element(G.P_CARDS)[0], G.P_CENTERS.c_base);
    G.screenwipecard.sprite_facing = 'back';
    G.screenwipecard.facing = 'back';
    G.screenwipecard.states.hover.can = false;
    G.screenwipecard.juice_up(0.5, 1);
  }
  let message_t: any[] | null = null;
  if (message) {
    message_t = message.map((v, k) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.O, config: { object: new DynaText({ string: v ?? '', colours: [Math.min(G.C.BACKGROUND.C[0], G.C.BACKGROUND.C[1]) > 0.5 ? G.C.BLACK : G.C.WHITE], shadow: true, silent: k !== 0, float: true, scale: 1.3, pop_in: 0, pop_in_rate: 2, rotate: 1 }) } },
    ] }));
  }
  G.screenwipe = new UIBox({
    definition: { n: G.UIT.ROOT, config: { align: 'cm', minw: 0, minh: 0, padding: 0.15, r: 0.1, colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        message_t ? { n: G.UIT.R, config: { id: 'text', align: 'cm', padding: 0.7 }, nodes: message_t } : null,
        !no_card ? { n: G.UIT.O, config: { object: G.screenwipecard, role: { role_type: 'Major' } } } : null,
      ] },
    ] },
    config: { align: 'cm', offset: { x: 0, y: 0 }, major: G.ROOM_ATTACH },
  });
  G.screenwipe.colours = colours;
  G.screenwipe.children.particles = new Particles(0, 0, 0, 0, {
    timer: 0, max: 1, scale: 40, speed: 0, lifespan: 1.7 * timefac, attach: G.screenwipe, colours: [alt_colour ?? G.C.BACKGROUND.C],
  });
  G.STAGE_OBJECT_INTERRUPT = null;
  G.screenwipe.alignment.offset.y = 0;
  if (message) for (const v of G.screenwipe.get_UIE_by_ID('text').children) v.children[0].config.object.pulse();
  G.E_MANAGER.add_event(new Event({
    trigger: 'before', delay: 0.7, no_delete: true, blockable: false,
    func: () => {
      if (!no_card) { G.screenwipecard.flip(); play_sound('cardFan2'); }
      return true;
    },
  }));
}

export function wipe_off() {
  G.E_MANAGER.add_event(new Event({
    no_delete: true,
    func: () => {
      G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.3, func: () => true }));
      G.screenwipe.children.particles.max = 0;
      for (const c of [G.screenwipe.colours.black, G.screenwipe.colours.white]) {
        G.E_MANAGER.add_event(new Event({
          trigger: 'ease', no_delete: true, blockable: false, blocking: false, timer: 'REAL', ref_table: c, ref_value: 3, ease_to: 0, delay: 0.3,
          func: (t: number) => t,
        }));
      }
      return true;
    },
  }));
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 0.55, no_delete: true, blocking: false, timer: 'REAL',
    func: () => {
      if (G.screenwipecard) G.screenwipecard.start_dissolve([G.C.BLACK, G.C.ORANGE, G.C.GOLD, G.C.RED]);
      const text = G.screenwipe.get_UIE_by_ID('text');
      if (text) for (const v of text.children) v.children[0].config.object.pop_out(4);
      return true;
    },
  }));
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 1.1, no_delete: true, blocking: false, timer: 'REAL',
    func: () => {
      G.screenwipe.children.particles.remove();
      G.screenwipe.remove();
      G.screenwipe.children.particles = null;
      G.screenwipe = null;
      G.screenwipecard = null;
      return true;
    },
  }));
  G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 1.2, no_delete: true, blocking: true, timer: 'REAL', func: () => true }));
}

/** G.FUNCS.start_run: wipes the screen while the API creates (or returns) the run */
export function start_run(req: NewGameRequest | null, open_id?: string) {
  G.SETTINGS.paused = true;
  G.E_MANAGER.clear_queue();
  wipe_on();
  const got: { view: GameView | null; error: unknown } = { view: null, error: null };
  const p = open_id ? api.getGame(open_id) : api.newGame(req ?? {});
  p.then((v) => {
    got.view = v;
    if (req?.seed) { try { localStorage.setItem('balatro-fe.seeded.' + v.id, '1'); } catch { /* no storage */ } }
  }).catch((err) => { got.error = err ?? 'error'; console.error('[api]', err); });
  G.E_MANAGER.add_event(new Event({ no_delete: true, func: () => { delete_run(); clear_run(); return true; } }));
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate', no_delete: true,
    func: () => {
      if (got.error) { G.main_menu('game'); return true; }
      if (!got.view) return false;
      G.start_run_page(got.view);
      return true;
    },
  }));
  wipe_off();
}

export function register_run_lifecycle_funcs() {
  G.FUNCS.wipe_on = wipe_on;
  G.FUNCS.wipe_off = wipe_off;
  G.FUNCS.start_run = (_e: any, args: any = {}) => start_run(args.request ?? {}, args.open_id);

  G.FUNCS.go_to_menu = () => {
    G.SETTINGS.paused = true;
    G.E_MANAGER.clear_queue();
    wipe_on();
    G.E_MANAGER.add_event(new Event({ no_delete: true, func: () => { delete_run(); clear_run(); return true; } }));
    G.E_MANAGER.add_event(new Event({ no_delete: true, blockable: true, blocking: false, func: () => { G.main_menu('game'); return true; } }));
    wipe_off();
  };

  G.FUNCS.notify_then_setup_run = (e: any) => {
    G.FUNCS.exit_overlay_menu?.();
    G.FUNCS.setup_run(e);
  };

  G.FUNCS.copy_seed = () => {
    navigator.clipboard?.writeText(String(G.GAME.pseudorandom.seed)).catch(() => {});
  };

  /** hold R: a new run with the same deck and stake */
  G.FUNCS.quick_restart = () => {
    if (G.STAGE !== G.STAGES.RUN) return;
    const s = G.GAME.selected_back_key?.key ?? 'b_red';
    start_run({ deck: s, stake: G.GAME.stake ?? 1, game_speed: G.SETTINGS.GAMESPEED });
  };
}
