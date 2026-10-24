// Generic timed effects from common_events.lua: easing values and colours,
// delays, the background colour, card juice and the screen shake.
import { G } from './globals';
import { Event } from './event';
import type { QueueName } from './event';

export function ease_value(ref_table: any, ref_value: any, mod?: number, floored?: boolean, timer_type?: any,
  not_blockable?: boolean | null, delay?: number, _ease_type?: string) {
  mod = mod ?? 0;
  // the game passes `type = ease_type`, which Event ignores: every ease is linear
  G.E_MANAGER.add_event(new Event({
    trigger: 'ease',
    blockable: not_blockable === false,
    blocking: false,
    ref_table,
    ref_value,
    ease_to: ref_table[ref_value] + mod,
    timer: timer_type,
    delay: delay ?? 0.3,
    func: (t: number) => (floored ? Math.floor(t) : t),
  }));
}

export function ease_colour(old_colour: number[], new_colour: number[], delay?: number) {
  ease_value(old_colour, 0, new_colour[0] - old_colour[0], false, 'REAL', null, delay);
  ease_value(old_colour, 1, new_colour[1] - old_colour[1], false, 'REAL', null, delay);
  ease_value(old_colour, 2, new_colour[2] - old_colour[2], false, 'REAL', null, delay);
  ease_value(old_colour, 3, new_colour[3] - old_colour[3], false, 'REAL', null, delay);
}

export function ease_background_colour(args: { new_colour?: number[]; special_colour?: number[]; tertiary_colour?: number[]; contrast?: number }) {
  const B = G.C.BACKGROUND;
  for (const k of ['L', 'D', 'C'] as const) {
    const v = B[k];
    if (!args.new_colour) continue;
    if (args.special_colour && args.tertiary_colour) {
      const col = k === 'L' ? args.new_colour : k === 'C' ? args.special_colour : args.tertiary_colour;
      for (let i = 0; i < 3; i++) ease_value(v, i, col[i] - v[i], false, null, true, 0.6);
    } else {
      const brightness = k === 'L' ? 1.3 : k === 'D' ? (args.special_colour ? 0.4 : 0.7) : 0.9;
      if (k === 'C' && args.special_colour) {
        for (let i = 0; i < 3; i++) ease_value(v, i, args.special_colour[i] - v[i], false, null, true, 0.6);
      } else {
        for (let i = 0; i < 3; i++) ease_value(v, i, args.new_colour[i] * brightness - v[i], false, null, true, 0.6);
      }
    }
  }
  if (args.contrast !== undefined) ease_value(B, 'contrast', args.contrast - B.contrast, false, null, true, 0.6);
}

export function delay(time?: number, queue?: QueueName) {
  G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: time ?? 1, func: () => true }), queue);
}

export function juice_card(card: any) {
  G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { card.juice_up(0.7); return true; } }));
}

export function juice_card_until(card: any, eval_func: (c: any) => any, first?: boolean, d?: number) {
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: d ?? 0.1, blocking: false, blockable: false, timer: 'REAL',
    func: () => {
      if (eval_func(card)) {
        card.juice_up(0.1, 0.1);
        juice_card_until(card, eval_func, undefined, 0.8);
      }
      return true;
    },
  }));
}

export function update_canvas_juice(dt: number) {
  G.JIGGLE_VIBRATION = G.ROOM.jiggle ?? 0;
  if (!G.SETTINGS.screenshake || typeof G.SETTINGS.screenshake !== 'number') {
    G.SETTINGS.screenshake = G.SETTINGS.reduced_motion ? 0 : 50;
  }
  let shake_amt = (G.SETTINGS.reduced_motion ? 0 : 1) * Math.max(0, G.SETTINGS.screenshake - 30) / 100;
  G.ARGS.eased_cursor_pos = G.ARGS.eased_cursor_pos ?? {
    x: G.CURSOR.T.x, y: G.CURSOR.T.y, sx: G.CONTROLLER.cursor_position.x, sy: G.CONTROLLER.cursor_position.y,
  };
  const e = G.ARGS.eased_cursor_pos;
  e.x = e.x * (1 - 3 * dt) + 3 * dt * (shake_amt * G.CURSOR.T.x + (1 - shake_amt) * G.ROOM.T.w / 2);
  e.y = e.y * (1 - 3 * dt) + 3 * dt * (shake_amt * G.CURSOR.T.y + (1 - shake_amt) * G.ROOM.T.h / 2);
  e.sx = e.sx * (1 - 3 * dt) + 3 * dt * (shake_amt * G.CONTROLLER.cursor_position.x + (1 - shake_amt) * G.WINDOWTRANS.real_window_w / 2);
  e.sy = e.sy * (1 - 3 * dt) + 3 * dt * (shake_amt * G.CONTROLLER.cursor_position.y + (1 - shake_amt) * G.WINDOWTRANS.real_window_h / 2);

  shake_amt = (G.SETTINGS.reduced_motion ? 0 : 1) * G.SETTINGS.screenshake / 100 * 3;
  if (shake_amt < 0.05) shake_amt = 0;

  G.ROOM.jiggle = (G.ROOM.jiggle ?? 0) * (1 - 5 * dt) * (shake_amt > 0.05 ? 1 : 0);
  G.ROOM.T.r = (0.001 * Math.sin(0.3 * G.TIMERS.REAL) + 0.002 * G.ROOM.jiggle * Math.sin(39.913 * G.TIMERS.REAL)) * shake_amt;
  G.ROOM.T.x = G.ROOM_ORIG.x + shake_amt * (0.015 * Math.sin(0.913 * G.TIMERS.REAL) + 0.01 * (G.ROOM.jiggle * shake_amt) * Math.sin(19.913 * G.TIMERS.REAL) + (e.x - 0.5 * (G.ROOM.T.w + G.ROOM_ORIG.x)) * 0.01);
  G.ROOM.T.y = G.ROOM_ORIG.y + shake_amt * (0.015 * Math.sin(0.952 * G.TIMERS.REAL) + 0.01 * (G.ROOM.jiggle * shake_amt) * Math.sin(21.913 * G.TIMERS.REAL) + (e.y - 0.5 * (G.ROOM.T.h + G.ROOM_ORIG.y)) * 0.01);

  G.JIGGLE_VIBRATION = G.JIGGLE_VIBRATION * (1 - 5 * dt);
  G.CURR_VIBRATION = G.CURR_VIBRATION ?? 0;
  G.CURR_VIBRATION = Math.min(1, G.CURR_VIBRATION + G.VIBRATION + G.JIGGLE_VIBRATION * 0.2);
  G.VIBRATION = 0;
  G.CURR_VIBRATION = (1 - 15 * dt) * G.CURR_VIBRATION;
}
