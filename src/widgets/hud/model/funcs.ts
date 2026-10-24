// The HUD's per-frame callbacks (button_callbacks.lua): the score and hand
// texts that rescale and pulse when they change, the flames behind a winning
// hand, and the blind panel's debuff and reward rows.
import { G, Sprite, number_format, scale_number } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';

function text_super_juice(e: any, _amount: number) {
  e.config.object.set_quiver(0.03 * _amount);
  e.config.object.pulse(0.3 + 0.08 * _amount);
  e.config.object.update_text();
  e.config.object.align_letters();
  e.update_object();
}

const log10_or_1 = (v: any) => Math.max(0, Math.floor(Math.log10(typeof v === 'number' ? v : 1)));

export function register_hud_funcs() {
  G.FUNCS.text_super_juice = text_super_juice;

  G.FUNCS.chip_UI_set = (e: any) => {
    const new_chips_text = number_format(G.GAME.chips);
    if (G.GAME.chips_text !== new_chips_text) {
      e.config.scale = Math.min(0.8, scale_number(G.GAME.chips, 1.1));
      G.GAME.chips_text = new_chips_text;
    }
  };

  G.FUNCS.blind_chip_UI_scale = (e: any) => {
    if (G.GAME.blind && G.GAME.blind.chips !== undefined && G.GAME.blind.chips !== null) {
      e.config.scale = scale_number(G.GAME.blind.chips, 0.7, 100000);
    }
  };

  G.FUNCS.hand_mult_UI_set = (e: any) => {
    const ch = G.GAME.current_round.current_hand;
    const new_mult_text = number_format(ch.mult);
    if (new_mult_text !== ch.mult_text) {
      ch.mult_text = new_mult_text;
      e.config.object.scale = scale_number(ch.mult, 0.9, 1000);
      e.config.object.update_text();
      if (!G.TAROT_INTERRUPT_PULSE) text_super_juice(e, log10_or_1(ch.mult));
    }
  };

  G.FUNCS.hand_chip_UI_set = (e: any) => {
    const ch = G.GAME.current_round.current_hand;
    const new_chip_text = number_format(ch.chips);
    if (new_chip_text !== ch.chip_text) {
      ch.chip_text = new_chip_text;
      e.config.object.scale = scale_number(ch.chips, 0.9, 1000);
      e.config.object.update_text();
      if (!G.TAROT_INTERRUPT_PULSE) text_super_juice(e, log10_or_1(ch.chips));
    }
  };

  G.FUNCS.hand_chip_total_UI_set = (e: any) => {
    const ch = G.GAME.current_round.current_hand;
    if (ch.chip_total < 1) {
      ch.chip_total_text = '';
    } else {
      const new_chip_total_text = number_format(ch.chip_total);
      if (new_chip_total_text !== ch.chip_total_text) {
        e.config.object.scale = scale_number(ch.chip_total, 0.95, 100000000);
        ch.chip_total_text = new_chip_total_text;
        if (!G.ARGS.hand_chip_total_UI_set || G.ARGS.hand_chip_total_UI_set < ch.chip_total) {
          text_super_juice(e, Math.floor(Math.log10(ch.chip_total)));
        }
        G.ARGS.hand_chip_total_UI_set = ch.chip_total;
      }
    }
  };

  G.FUNCS.flame_handler = (e: any) => {
    G.C.UI_CHIPLICK = G.C.UI_CHIPLICK ?? [1, 1, 1, 1];
    G.C.UI_MULTLICK = G.C.UI_MULTLICK ?? [1, 1, 1, 1];
    for (let i = 0; i < 3; i++) {
      G.C.UI_CHIPLICK[i] = Math.min(Math.max(((G.C.UI_CHIPS[i] * 0.5 + G.C.YELLOW[i] * 0.5) + 0.1) ** 2, 0.1), 1);
      G.C.UI_MULTLICK[i] = Math.min(Math.max(((G.C.UI_MULT[i] * 0.5 + G.C.YELLOW[i] * 0.5) + 0.1) ** 2, 0.1), 1);
    }
    G.ARGS.flame_handler = G.ARGS.flame_handler ?? {
      chips: { id: 'flame_chips', arg_tab: 'chip_flames', colour: G.C.UI_CHIPS, accent: G.C.UI_CHIPLICK },
      mult: { id: 'flame_mult', arg_tab: 'mult_flames', colour: G.C.UI_MULT, accent: G.C.UI_MULTLICK },
    };
    for (const k of ['chips', 'mult']) {
      const v = G.ARGS.flame_handler[k];
      if (e.config.id !== v.id) continue;
      if (!(e.config.object instanceof Sprite) || e.config.object.ID !== v.ID) {
        e.config.object.remove();
        e.config.object = new Sprite(0, 0, 2.5, 2.5, G.ASSET_ATLAS.ui_1, { x: 2, y: 0 });
        v.ID = e.config.object.ID;
        G.ARGS[v.arg_tab] = {
          intensity: 0, real_intensity: 0, intensity_vel: 0, colour_1: v.colour, colour_2: v.accent, timer: G.TIMERS.REAL,
        };
        e.config.object.set_alignment({ major: e.parent, type: 'bmi', offset: { x: 0, y: 0 }, xy_bond: 'Weak' });
        e.config.object.define_draw_steps([{
          shader: 'flame',
          send: [
            { name: 'time', ref_table: G.ARGS[v.arg_tab], ref_value: 'timer' },
            { name: 'amount', ref_table: G.ARGS[v.arg_tab], ref_value: 'real_intensity' },
            { name: 'image_details', ref_table: e.config.object, ref_value: 'image_dims' },
            { name: 'texture_details', ref_table: e.config.object.RETS, ref_value: 'get_pos_pixel' },
            { name: 'colour_1', ref_table: G.ARGS[v.arg_tab], ref_value: 'colour_1' },
            { name: 'colour_2', ref_table: G.ARGS[v.arg_tab], ref_value: 'colour_2' },
            { name: 'id', val: e.config.object.ID },
          ],
        }]);
        e.config.object.get_pos_pixel();
      }
      const _F = G.ARGS[v.arg_tab];
      const exptime = Math.exp(-0.4 * G.real_dt);
      const si = G.ARGS.score_intensity ?? { earned_score: 0, required_score: 0 };
      if (si.earned_score >= si.required_score && si.required_score > 0) {
        _F.intensity = ((G.pack_cards && !G.pack_cards.REMOVED) || G.TAROT_INTERRUPT) ? 0 : Math.max(0, Math.log(si.earned_score) / Math.log(5) - 2);
      } else {
        _F.intensity = 0;
      }
      _F.timer = _F.timer + G.real_dt * (1 + _F.intensity * 0.2);
      if (_F.intensity_vel < 0) _F.intensity_vel = _F.intensity_vel * (1 - 10 * G.real_dt);
      _F.intensity_vel = (1 - exptime) * (_F.intensity - _F.real_intensity) * G.real_dt * 25 + exptime * _F.intensity_vel;
      _F.real_intensity = Math.max(0, _F.real_intensity + _F.intensity_vel);
      _F.change = (_F.change ?? 0) * (1 - 4 * G.real_dt) + (4 * G.real_dt) * (_F.real_intensity < _F.intensity - 0.0 ? 1 : 0) * _F.real_intensity;
    }
  };

  G.FUNCS.hand_text_UI_set = (e: any) => {
    const ch = G.GAME.current_round.current_hand;
    if (ch.handname !== ch.handname_text) {
      ch.handname_text = ch.handname;
      const len = new TextEncoder().encode(ch.handname).length;
      if (len >= 13) e.config.object.scale = 12 * 0.56 / len;
      else e.config.object.scale = 2.4 / Math.sqrt(len + 5);
      e.config.object.update_text();
    }
  };

  G.FUNCS.HUD_blind_visible = (_e: any) => {
    const b = G.GAME.blind;
    if (b && b.name !== '' && b.blind_set) b.states.visible = true;
    else if (b) b.states.visible = false;
  };

  G.FUNCS.HUD_blind_debuff = (e: any) => {
    const b = G.GAME.blind;
    if (b && b.loc_debuff_text && b.loc_debuff_text !== '') {
      if (e.parent.config.minh === 0 || e.config.prev_loc !== b.loc_debuff_text) {
        e.parent.config.minh = 0.35;
        e.config.scale = 0.36;
        if (b.loc_debuff_lines[e.config.ref_value] === '') { e.config.scale = 0.0; e.parent.config.minh = 0.001; }
        e.config.prev_loc = b.loc_debuff_text;
        e.UIBox.recalculate(true);
      }
    } else if (e.parent.config.minh > 0) {
      e.parent.config.minh = 0;
      e.config.scale = 0;
      e.UIBox.recalculate(true);
    }
  };

  G.FUNCS.HUD_blind_debuff_prefix = (e: any) => {
    if ((G.GAME.blind && G.GAME.blind.name === 'The Wheel' && !G.GAME.blind.disabled) || e.config.id === 'bl_wheel') {
      e.config.ref_table.val = '' + G.GAME.probabilities.normal;
      e.config.scale = 0.32;
    } else {
      e.config.ref_table.val = '';
      e.config.scale = 0;
    }
  };

  G.FUNCS.HUD_blind_reward = (e: any) => {
    const nbr = G.GAME.modifiers.no_blind_reward;
    if (nbr && G.GAME.blind && nbr[G.GAME.blind.get_type()]) {
      if (e.config.minh > 0.44) {
        e.config.minh = 0.4;
        e.children[0].config.text = localize('k_no_reward');
        e.UIBox.recalculate(true);
      }
    } else if (e.config.minh < 0.45) {
      e.config.minh = 0.45;
      e.children[0].config.text = localize('k_reward') + ': ';
      e.children[1].states.visible = true;
      e.UIBox.recalculate(true);
    }
  };
}
