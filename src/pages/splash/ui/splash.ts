// The splash screen: Game:splash_screen (game.lua). A joker dissolves, two
// hundred cards are sucked into a vortex, and the main menu fades in.
import { G, Sprite, Event, prep_stage, ease_value, play_sound, pseudorandom_element, delete_run } from '@/shared/lib/engine';
import { Card } from '@/entities/card';
import { init_game_object } from '@/entities/run';

export function show_splash(main_menu: (ctx?: 'splash' | 'game') => void) {
  if (G.SETTINGS.skip_splash === 'Yes') { main_menu(); return; }
  prep_stage(G.STAGES.MAIN_MENU, G.STATES.SPLASH, init_game_object);
  G.FUNCS.skip_splash = () => { delete_run(); main_menu(); };

  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate',
    func: () => {
      G.TIMERS.TOTAL = 0;
      G.TIMERS.REAL = 0;
      G.SPLASH_BACK = new Sprite(-30, -13, G.ROOM.T.w + 60, G.ROOM.T.h + 22, G.ASSET_ATLAS.ui_1, { x: 2, y: 0 });
      G.SPLASH_BACK.define_draw_steps([{
        shader: 'splash',
        send: [
          { name: 'time', ref_table: G.TIMERS, ref_value: 'REAL' },
          { name: 'vort_speed', val: 1 },
          { name: 'colour_1', ref_table: G.C, ref_value: 'BLUE' },
          { name: 'colour_2', ref_table: G.C, ref_value: 'WHITE' },
          { name: 'mid_flash', val: 0 },
          { name: 'vort_offset', val: (2 * 90.15315131 * Math.floor(Date.now() / 1000)) % 100000 },
        ],
      }]);
      G.SPLASH_BACK.set_alignment({ major: G.ROOM_ATTACH, type: 'cm', offset: { x: 0, y: 0 } });
      G.SPLASH_FRONT = new Sprite(0, -20, G.ROOM.T.w * 2, G.ROOM.T.h * 4, G.ASSET_ATLAS.ui_1, { x: 2, y: 0 });
      G.SPLASH_FRONT.define_draw_steps([{
        shader: 'flash',
        send: [{ name: 'time', ref_table: G.TIMERS, ref_value: 'REAL' }, { name: 'mid_flash', val: 1 }],
      }]);
      G.SPLASH_FRONT.set_alignment({ major: G.ROOM_ATTACH, type: 'cm', offset: { x: 0, y: 0 } });

      let SC: any = null;
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: 0.2,
        func: () => {
          const s = 1.2;
          SC = new Card(G.ROOM.T.w / 2 - s * G.CARD_W / 2, 10 + G.ROOM.T.h / 2 - s * G.CARD_H / 2, s * G.CARD_W, s * G.CARD_H, undefined, G.P_CENTERS.j_joker);
          SC.T.y = G.ROOM.T.h / 2 - s * G.CARD_H / 2;
          SC.ambient_tilt = 1;
          SC.states.drag.can = false;
          SC.states.hover.can = false;
          SC.no_ui = true;
          G.VIBRATION += 2;
          play_sound('whoosh1', 0.7, 0.2);
          play_sound('introPad1', 0.704, 0.6);
          return true;
        },
      }));
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: 1.8,
        func: () => {
          SC.start_dissolve([G.C.WHITE, G.C.WHITE], true, 12, true);
          play_sound('magic_crumple', 1, 0.5);
          play_sound('splash_buildup', 1, 0.7);
          return true;
        },
      }));

      const make_splash_card = (args: { scale?: number }) => {
        const angle = Math.random() * 2 * 3.14;
        const card_size = (args.scale ?? 1.5) * (Math.random() + 1);
        const card_pos = { x: (18 + card_size) * Math.sin(angle), y: (18 + card_size) * Math.cos(angle) };
        const card = new Card(card_pos.x + G.ROOM.T.w / 2 - G.CARD_W * card_size / 2, card_pos.y + G.ROOM.T.h / 2 - G.CARD_H * card_size / 2,
          card_size * G.CARD_W, card_size * G.CARD_H, pseudorandom_element(G.P_CARDS)[0], G.P_CENTERS.c_base);
        if (Math.random() > 0.8) { card.sprite_facing = 'back'; card.facing = 'back'; }
        card.no_shadow = true;
        card.states.hover.can = false;
        card.states.drag.can = false;
        card.vortex = true;
        card.T.r = angle;
        return [card, card_pos] as const;
      };

      G.vortex_time = G.TIMERS.REAL;
      let temp_del: number | null = null;
      for (let i = 1; i <= 200; i++) {
        temp_del = temp_del ?? 3;
        G.E_MANAGER.add_event(new Event({
          trigger: 'after', blockable: false, delay: temp_del,
          func: () => {
            const [card, card_pos] = make_splash_card({ scale: 2 - i / 300 });
            const speed = Math.max(2 - i * 0.005, 0.001);
            ease_value(card.T, 'scale', -card.T.scale, undefined, undefined, undefined, 1 * speed, 'elastic');
            ease_value(card.T, 'x', -card_pos.x, undefined, undefined, undefined, 0.9 * speed);
            ease_value(card.T, 'y', -card_pos.y, undefined, undefined, undefined, 0.9 * speed);
            const temp_pitch = i * 0.007 + 0.6;
            G.E_MANAGER.add_event(new Event({
              blockable: false,
              func: () => {
                if (card.T.scale <= 0) {
                  if (i < 30) play_sound('whoosh1', temp_pitch + Math.random() * 0.05, 0.25 * (1 - i / 50));
                  if (i === 15) play_sound('whoosh_long', 0.9, 0.7);
                  G.VIBRATION += 0.1;
                  card.remove();
                  return true;
                }
                return false;
              },
            }));
            return true;
          },
        }));
        temp_del = temp_del + Math.max(1 / i, Math.max(0.2 * (170 - i) / 500, 0.016));
      }

      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: 2,
        func: () => {
          G.SPLASH_BACK.remove();
          G.SPLASH_BACK = G.SPLASH_FRONT;
          G.SPLASH_FRONT = null;
          main_menu('splash');
          return true;
        },
      }));
      return true;
    },
  }));
}
