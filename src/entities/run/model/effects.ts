// The game's on-screen reactions to state changes (common_events.lua):
// ease_dollars, ease_chips, ease_hands_played, ease_discard, ease_ante,
// ease_round, update_hand_text, card_eval_status_text, play_area_status_text,
// highlight_card. Each is split in two: the game queues an event, and the
// event's body shows the change. Timeline events from the API run the body at
// the time the game showed it (`*_now`).
import { G, Event, play_sound, mix_colours, tostring, ease_colour, ease_background_colour, darken, lighten } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { attention_text } from '@/shared/ui';

const HUD = (id: string) => G.HUD?.get_UIE_by_ID(id);

export function ease_dollars_now(mod: number, total?: number) {
  const dollar_UI = HUD('dollar_text_UI');
  mod = mod ?? 0;
  let text = '+' + localize('$');
  let col = G.C.MONEY;
  if (mod < 0) { text = '-' + localize('$'); col = G.C.RED; }
  G.GAME.dollars = total ?? G.GAME.dollars + mod;
  if (!dollar_UI) return;
  dollar_UI.config.object.update();
  G.HUD.recalculate();
  attention_text({ text: text + tostring(Math.abs(mod)), scale: 0.8, hold: 0.7, cover: dollar_UI.parent, cover_colour: col, align: 'cm' });
  play_sound('coin1');
}

export function ease_dollars(mod: number, instant?: boolean) {
  if (instant) ease_dollars_now(mod);
  else G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { ease_dollars_now(mod); return true; } }));
}

export function ease_chips_now(mod: number) {
  const chip_UI = HUD('chip_UI_count');
  G.E_MANAGER.add_event(new Event({
    trigger: 'ease', blockable: false, ref_table: G.GAME, ref_value: 'chips', ease_to: mod ?? 0, delay: 0.3,
    func: (t: number) => Math.floor(t),
  }));
  chip_UI?.juice_up();
  play_sound('chips2');
}

export function ease_chips(mod: number) {
  G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { ease_chips_now(mod); return true; } }));
}

function count_change(ui_id: string, field: 'hands_left' | 'discards_left', mod: number, silent?: boolean, target?: number) {
  const ui = HUD(ui_id);
  let text = '+', col = G.C.GREEN;
  if (mod < 0) { text = ''; col = G.C.RED; }
  G.GAME.current_round[field] = target ?? G.GAME.current_round[field] + mod;
  if (!ui) return;
  ui.config.object.update();
  G.HUD.recalculate();
  attention_text({ text: text + mod, scale: 0.8, hold: 0.7, cover: ui.parent, cover_colour: col, align: 'cm' });
  if (!silent) play_sound('chips2');
}

/** `target`: the API's value after the change (the change may be shown after the view was synced) */
export function ease_hands_played(mod: number, instant?: boolean, target?: number) {
  const f = () => count_change('hand_UI_count', 'hands_left', mod, false, target);
  if (instant) f(); else G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { f(); return true; } }));
}

export function ease_discard(mod: number, instant?: boolean, silent?: boolean, target?: number) {
  const f = () => {
    if (Math.abs(Math.max(G.GAME.current_round.discards_left, mod)) === 0) return;
    mod = Math.max(-G.GAME.current_round.discards_left, mod);
    count_change('discard_UI_count', 'discards_left', mod, silent, target);
  };
  if (instant) f(); else G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { f(); return true; } }));
}

function round_ante_change(ui: any, mod: number, apply: () => void, sound: () => void, minus: string) {
  let text = '+', col = G.C.IMPORTANT;
  if (mod < 0) { text = minus; col = G.C.RED; }
  apply();
  if (!ui) return;
  ui.config.object.update();
  G.HUD.recalculate();
  attention_text({ text: text + tostring(Math.abs(mod)), scale: 1, hold: 0.7, cover: ui.parent, cover_colour: col, align: 'cm' });
  sound();
}

export function ease_ante(mod: number, target?: number) {
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate',
    func: () => {
      round_ante_change(G.hand_text_area?.ante, mod ?? 0, () => { G.GAME.round_resets.ante = target ?? G.GAME.round_resets.ante + (mod ?? 0); },
        () => { play_sound('highlight2', 0.685, 0.2); play_sound('generic1'); }, '-');
      return true;
    },
  }));
}

export function ease_round(mod: number, target?: number) {
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate',
    func: () => {
      round_ante_change(G.hand_text_area?.round, mod ?? 0, () => { G.GAME.round = target ?? G.GAME.round + (mod ?? 0); },
        () => { play_sound('timpani', 0.8); play_sound('generic1'); }, '');
      return true;
    },
  }));
}

export interface HandTextVals { chips?: any; mult?: any; handname?: any; chip_total?: any; level?: any; StatusText?: boolean }
export interface HandTextConfig { delay?: number; immediate?: boolean; nopulse?: boolean; sound?: string; volume?: number; pitch?: number; modded?: boolean }

/** the body of update_hand_text's event */
export function update_hand_text_now(config: HandTextConfig, vals: HandTextVals) {
  const ch = G.GAME.current_round.current_hand;
  const hta = G.hand_text_area;
  let col = G.C.GREEN;
  if (vals.chips !== undefined && vals.chips !== null && ch.chips !== vals.chips) {
    let delta: any = (typeof vals.chips === 'number' && typeof ch.chips === 'number') ? vals.chips - ch.chips : 0;
    if (delta < 0) { delta = '' + delta; col = G.C.RED; } else if (delta > 0) delta = '+' + delta; else delta = '' + delta;
    if (typeof vals.chips === 'string') delta = vals.chips;
    ch.chips = vals.chips;
    hta?.chips.update(0);
    if (vals.StatusText && hta) {
      attention_text({ text: delta, scale: 0.8, hold: 1, cover: hta.chips.parent, cover_colour: mix_colours(G.C.CHIPS, col, 0.1), emboss: 0.05, align: 'cm', cover_align: 'cr' });
    }
  }
  if (vals.mult !== undefined && vals.mult !== null && ch.mult !== vals.mult) {
    let delta: any = (typeof vals.mult === 'number' && typeof ch.mult === 'number') ? vals.mult - ch.mult : 0;
    if (delta < 0) { delta = '' + delta; col = G.C.RED; } else if (delta > 0) delta = '+' + delta; else delta = '' + delta;
    if (typeof vals.mult === 'string') delta = vals.mult;
    ch.mult = vals.mult;
    hta?.mult.update(0);
    if (vals.StatusText && hta) {
      attention_text({ text: delta, scale: 0.8, hold: 1, cover: hta.mult.parent, cover_colour: mix_colours(G.C.MULT, col, 0.1), emboss: 0.05, align: 'cm', cover_align: 'cl' });
    }
    if (!G.TAROT_INTERRUPT) hta?.mult.juice_up();
  }
  if (vals.handname !== undefined && vals.handname !== null && ch.handname !== vals.handname) {
    ch.handname = vals.handname;
    if (!config.nopulse) hta?.handname.config.object.pulse(0.2);
  }
  if (vals.chip_total !== undefined && vals.chip_total !== null) {
    ch.chip_total = vals.chip_total;
    hta?.chip_total.config.object.pulse(0.5);
  }
  if (vals.level !== undefined && vals.level !== null && ch.hand_level !== ' ' + localize('k_lvl') + tostring(vals.level)) {
    if (vals.level === '') {
      ch.hand_level = vals.level;
    } else {
      ch.hand_level = ' ' + localize('k_lvl') + tostring(vals.level);
      if (hta) {
        if (typeof vals.level === 'number') hta.hand_level.config.colour = G.C.HAND_LEVELS[Math.min(vals.level, 7)];
        else hta.hand_level.config.colour = G.C.HAND_LEVELS[1];
        hta.hand_level.juice_up();
      }
    }
  }
  if (config.sound && !config.modded) play_sound(config.sound, config.pitch ?? 1, config.volume ?? 1);
  if (config.modded) {
    G.HUD_blind?.get_UIE_by_ID('HUD_blind_debuff_1')?.juice_up(0.3, 0);
    G.HUD_blind?.get_UIE_by_ID('HUD_blind_debuff_2')?.juice_up(0.3, 0);
    G.GAME.blind?.juice_up();
    G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.06 * G.SETTINGS.GAMESPEED, blockable: false, blocking: false, func: () => { play_sound('tarot2', 0.76, 0.4); return true; } }));
    play_sound('tarot2', 1, 0.4);
  }
}

export function update_hand_text(config: HandTextConfig, vals: HandTextVals) {
  G.E_MANAGER.add_event(new Event({
    trigger: 'before', blockable: !config.immediate, delay: config.delay ?? 0.8,
    func: () => { update_hand_text_now(config, vals); return true; },
  }));
}

export interface StatusExtra { [k: string]: any; message?: string; colour?: any; edition?: boolean; mult_mod?: any; Xmult_mod?: any; chip_mod?: any; swap?: any; delay?: number; instant?: boolean; no_juice?: boolean; focus?: any }

/** the visual of card_eval_status_text, at once */
export function card_eval_status_text_now(card: any, eval_type: string, amt?: any, percent?: number, dir?: string, extra?: StatusExtra) {
  percent = percent ?? (0.9 + 0.2 * Math.random());
  if (dir === 'down') percent = 1 - percent;
  if (extra && extra.focus) card = extra.focus;
  if (!card) return;
  let text = '';
  let sound: string | null = null;
  let volume = 1;
  let card_aligned = 'bm';
  let y_off = 0.15 * G.CARD_H;
  if (card.area === G.jokers || card.area === G.consumeables) y_off = 0.05 * card.T.h;
  else if (card.area === G.hand || card.area === G.play || card.jimbo) { y_off = -0.05 * G.CARD_H; card_aligned = 'tm'; }
  const config: any = {};
  let delay = 0.65;
  let colour = config.colour ?? extra?.colour ?? G.C.FILTER;
  if (eval_type === 'debuff') {
    sound = 'cancel'; amt = 1; colour = G.C.RED; config.scale = 0.6; text = localize('k_debuffed');
  } else if (eval_type === 'chips') {
    sound = 'chips1'; colour = G.C.CHIPS; text = localize({ type: 'variable', key: 'a_chips', vars: [amt] }); delay = 0.6;
  } else if (eval_type === 'mult' || eval_type === 'h_mult') {
    sound = 'multhit1'; text = localize({ type: 'variable', key: 'a_mult', vars: [amt] }); colour = G.C.MULT; config.type = 'fade'; config.scale = 0.7;
  } else if (eval_type === 'x_mult' || eval_type === 'h_x_mult') {
    sound = 'multhit2'; volume = 0.7; text = localize({ type: 'variable', key: 'a_xmult', vars: [amt] }); colour = G.C.XMULT; config.type = 'fade'; config.scale = 0.7;
  } else if (eval_type === 'dollars') {
    sound = 'coin3'; text = (amt < -0.01 ? '-' : '') + localize('$') + tostring(Math.abs(amt)); colour = amt < -0.01 ? G.C.RED : G.C.MONEY;
  } else if (eval_type === 'swap') {
    sound = 'generic1'; text = localize('k_swapped_ex'); colour = G.C.PURPLE;
  } else if (eval_type === 'extra' || eval_type === 'jokers') {
    const ex = extra ?? {};
    sound = ex.edition ? 'foil2' : ex.mult_mod ? 'multhit1' : ex.Xmult_mod ? 'multhit2' : 'generic1';
    if (ex.edition) colour = G.C.DARK_EDITION;
    volume = ex.edition ? 0.3 : sound === 'multhit2' ? 0.7 : 1;
    delay = ex.delay ?? 0.75;
    amt = 1;
    text = ex.message ?? text;
    if (!ex.edition && (ex.mult_mod || ex.Xmult_mod)) colour = G.C.MULT;
    config.type = 'fall';
    config.scale = 0.7;
    if (ex.chip_mod) colour = G.C.CHIPS;
    else if (ex.swap) colour = G.C.PURPLE;
  }
  delay = delay * 1.25;
  if (amt > 0 || amt < 0) {
    attention_text({ text, scale: config.scale ?? 1, hold: delay - 0.2, backdrop_colour: colour, align: card_aligned, major: card, offset: { x: 0, y: y_off } });
    play_sound(sound, 0.8 + percent * 0.2, volume);
    if (!extra || !extra.no_juice) {
      card.juice_up(0.6, 0.1);
      G.ROOM.jiggle += 0.7;
    }
  }
}

export function play_area_status_text_now(text: string, silent?: boolean) {
  attention_text({ scale: 0.9, text, hold: 0.9, align: 'tm', major: G.play, offset: { x: 0, y: -1 } });
  if (!silent) {
    G.ROOM.jiggle += 2;
    play_sound('cardFan2');
  }
}

export function highlight_card(card: any, percent = 0.5, dir?: string) {
  let highlight = true;
  if (dir === 'down') { percent = 1 - percent; highlight = false; }
  G.E_MANAGER.add_event(new Event({
    trigger: 'before', delay: 0.1,
    func: () => { card.highlight(highlight); play_sound('cardSlide1', 0.85 + percent * 0.2); return true; },
  }));
}

/** ease_background_colour_blind (common_events.lua): the run's colours for a state and blind */
export function ease_background_colour_blind(state: number, blind_override?: string) {
  let blindname = blind_override || (G.GAME.blind && G.GAME.blind.name !== '' && G.GAME.blind.name) || 'Small Blind';
  if (blindname === '') blindname = 'Small Blind';
  const S = G.STATES;
  if (state === S.SHOP) ease_colour(G.C.DYN_UI.MAIN, mix_colours(G.C.RED, G.C.BLACK, 0.9));
  else if (state === S.TAROT_PACK) ease_colour(G.C.DYN_UI.MAIN, mix_colours(G.C.WHITE, G.C.BLACK, 0.9));
  else if (state === S.SPECTRAL_PACK) ease_colour(G.C.DYN_UI.MAIN, mix_colours(G.C.SECONDARY_SET.Spectral, G.C.BLACK, 0.9));
  else if (state === S.STANDARD_PACK) ease_colour(G.C.DYN_UI.MAIN, G.C.RED);
  else if (state === S.BUFFOON_PACK) ease_colour(G.C.DYN_UI.MAIN, G.C.FILTER);
  else if (state === S.PLANET_PACK) ease_colour(G.C.DYN_UI.MAIN, mix_colours(G.C.SECONDARY_SET.Planet, G.C.BLACK, 0.9));
  else if (G.GAME.blind) G.GAME.blind.change_colour();

  if (state === S.TAROT_PACK) ease_background_colour({ new_colour: G.C.PURPLE, special_colour: darken(G.C.BLACK, 0.2), contrast: 1.5 });
  else if (state === S.SPECTRAL_PACK) ease_background_colour({ new_colour: G.C.SECONDARY_SET.Spectral, special_colour: darken(G.C.BLACK, 0.2), contrast: 2 });
  else if (state === S.STANDARD_PACK) ease_background_colour({ new_colour: darken(G.C.BLACK, 0.2), special_colour: G.C.RED, contrast: 3 });
  else if (state === S.BUFFOON_PACK) ease_background_colour({ new_colour: G.C.FILTER, special_colour: G.C.BLACK, contrast: 2 });
  else if (state === S.PLANET_PACK) ease_background_colour({ new_colour: G.C.BLACK, contrast: 3 });
  else if (G.GAME.won) ease_background_colour({ new_colour: G.C.BLIND.won, contrast: 1 });
  else if (blindname === 'Small Blind' || blindname === 'Big Blind' || blindname === '') ease_background_colour({ new_colour: G.C.BLIND.Small, contrast: 1 });
  else {
    let boss_col = G.C.BLACK;
    for (const k of Object.keys(G.P_BLINDS)) {
      const v = G.P_BLINDS[k];
      if (v.name === blindname) {
        if (v.boss && v.boss.showdown) {
          ease_background_colour({ new_colour: G.C.BLUE, special_colour: G.C.RED, tertiary_colour: darken(G.C.BLACK, 0.4), contrast: 3 });
          return;
        }
        boss_col = v.boss_colour ?? G.C.BLACK;
      }
    }
    ease_background_colour({ new_colour: lighten(mix_colours(boss_col, G.C.BLACK, 0.3), 0.1), special_colour: boss_col, contrast: 2 });
  }
}

/** stop_use (misc_functions.lua): blocks using cards for a few frames */
export function stop_use() {
  G.GAME.STOP_USE = (G.GAME.STOP_USE ?? 0) + 1;
  dec_stop_use(6);
}

function dec_stop_use(depth: number) {
  if (depth > 0) {
    G.E_MANAGER.add_event(new Event({ blocking: false, no_delete: true, func: () => { dec_stop_use(depth - 1); return true; } }));
  } else {
    G.E_MANAGER.add_event(new Event({ blocking: false, no_delete: true, func: () => { G.GAME.STOP_USE = Math.max(G.GAME.STOP_USE - 1, 0); return true; } }));
  }
}

/** alert_no_space (misc_functions.lua) */
export function alert_no_space(card: any, area: any) {
  G.CONTROLLER.locks.no_space = true;
  attention_text({ scale: 0.9, text: localize('k_no_space_ex'), hold: 0.9, align: 'cm', cover: area, cover_padding: 0.1, cover_colour: [G.C.BLACK[0], G.C.BLACK[1], G.C.BLACK[2], 0.7] });
  card.juice_up(0.3, 0.2);
  for (const c of area.cards) c.juice_up(0.15);
  G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.06 * G.SETTINGS.GAMESPEED, blockable: false, blocking: false, func: () => { play_sound('tarot2', 0.76, 0.4); return true; } }));
  play_sound('tarot2', 1, 0.4);
  G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.5 * G.SETTINGS.GAMESPEED, blockable: false, blocking: false, func: () => { G.CONTROLLER.locks.no_space = null; return true; } }));
}
