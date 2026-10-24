// The cash-out screen: create_UIBox_round_evaluation (UI_definitions.lua),
// add_round_eval_row (common_events.lua) and G.FUNCS.evaluate_round
// (state_events.lua), with the rows the API computed.
import { G, UIBox, DynaText, AnimatedSprite, Sprite, Event, play_sound, copy_table, delay, scale_number } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { UIBox_dyn_container } from '@/shared/ui';
import { get_stake_sprite } from '@/shared/ui/stake';
import type { RoundEvalView } from '@/shared/api';
import { ease_background_colour_blind, run } from '@/entities/run';
import { react_tags } from '@/entities/tag';

export function create_UIBox_round_evaluation() {
  const width = G.hand.T.w - 2;
  return { n: G.UIT.ROOT, config: { align: 'tm', colour: G.C.CLEAR }, nodes: [
    UIBox_dyn_container([
      { n: G.UIT.R, config: { align: 'tm', minw: width, minh: 3, padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', minw: width, minh: 1.4 }, nodes: [] },
        { n: G.UIT.R, config: { align: 'cm', minw: width, id: 'base_round_eval' }, nodes: [] },
        { n: G.UIT.R, config: { align: 'cm', minw: width, id: 'bonus_round_eval' }, nodes: [] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', minh: 0.05 }, nodes: [] },
      { n: G.UIT.R, config: { align: 'cm', minw: width, id: 'eval_bottom' }, nodes: [] },
    ], false),
  ] };
}

interface RowConfig {
  name: string; dollars?: number; pitch?: number; saved?: boolean; bonus?: boolean; disp?: number; card?: any;
  condition?: string; pos?: any;
}

export function add_round_eval_row(config: RowConfig) {
  const width = G.round_eval.T.w - 0.51;
  const num_dollars = config.dollars ?? 1;
  const scale = 0.9;
  if (config.name !== 'bottom') {
    if (config.name !== 'blind1') {
      if (!G.round_eval.divider_added) {
        G.E_MANAGER.add_event(new Event({
          trigger: 'after', delay: 0.25,
          func: () => {
            const spacer = { n: G.UIT.R, config: { align: 'cm', minw: width }, nodes: [
              { n: G.UIT.O, config: { object: new DynaText({ string: ['......................................'], colours: [G.C.WHITE], shadow: true, float: true, y_offset: -30, scale: 0.45, spacing: 13.5, font: G.LANGUAGES['en-us'].font, pop_in: 0 }) } },
            ] };
            G.round_eval.add_child(spacer, G.round_eval.get_UIE_by_ID(config.bonus ? 'bonus_round_eval' : 'base_round_eval'));
            return true;
          },
        }));
        delay(0.6);
        G.round_eval.divider_added = true;
      }
    } else {
      delay(0.2);
    }
    delay(0.2);
    G.E_MANAGER.add_event(new Event({
      trigger: 'before', delay: 0.5,
      func: () => {
        const left_text: any[] = [];
        if (config.name === 'blind1') {
          const stake_sprite = get_stake_sprite(G.GAME.stake || 1, 0.5);
          const blind_sprite = new AnimatedSprite(0, 0, 1.2, 1.2, G.ANIMATION_ATLAS.blind_chips, copy_table(G.GAME.blind.pos ?? G.P_BLINDS.bl_small.pos));
          blind_sprite.define_draw_steps([{ shader: 'dissolve', shadow_height: 0.05 }, { shader: 'dissolve' }]);
          left_text.push({ n: G.UIT.O, config: { w: 1.2, h: 1.2, object: blind_sprite, hover: true, can_collide: false } });
          left_text.push(config.saved
            ? { n: G.UIT.C, config: { padding: 0.05, align: 'cm' }, nodes: [
              { n: G.UIT.R, config: { align: 'cm' }, nodes: [
                { n: G.UIT.O, config: { object: new DynaText({ string: [' ' + localize('ph_mr_bones') + ' '], colours: [G.C.FILTER], shadow: true, pop_in: 0, scale: 0.5 * scale, silent: true }) } },
              ] },
            ] }
            : { n: G.UIT.C, config: { padding: 0.05, align: 'cm' }, nodes: [
              { n: G.UIT.R, config: { align: 'cm' }, nodes: [
                { n: G.UIT.O, config: { object: new DynaText({ string: [' ' + localize('ph_score_at_least') + ' '], colours: [G.C.UI.TEXT_LIGHT], shadow: true, pop_in: 0, scale: 0.4 * scale, silent: true }) } },
              ] },
              { n: G.UIT.R, config: { align: 'cm', minh: 0.8 }, nodes: [
                { n: G.UIT.O, config: { w: 0.5, h: 0.5, object: stake_sprite, hover: true, can_collide: false } },
                { n: G.UIT.T, config: { text: G.GAME.blind.chip_text, scale: scale_number(G.GAME.blind.chips, scale, 100000), colour: G.C.RED, shadow: true } },
              ] },
            ] });
        } else if (config.name.includes('tag')) {
          const blind_sprite = new Sprite(0, 0, 0.7, 0.7, G.ASSET_ATLAS.tags, copy_table(config.pos));
          blind_sprite.define_draw_steps([{ shader: 'dissolve', shadow_height: 0.05 }, { shader: 'dissolve' }]);
          blind_sprite.juice_up();
          left_text.push({ n: G.UIT.O, config: { w: 0.7, h: 0.7, object: blind_sprite, hover: true, can_collide: false } });
          left_text.push({ n: G.UIT.O, config: { object: new DynaText({ string: [config.condition], colours: [G.C.UI.TEXT_LIGHT], shadow: true, pop_in: 0, scale: 0.4 * scale, silent: true }) } });
        } else if (config.name === 'hands') {
          left_text.push({ n: G.UIT.T, config: { text: config.disp ?? config.dollars, scale: 0.8 * scale, colour: G.C.BLUE, shadow: true, juice: true } });
          left_text.push({ n: G.UIT.O, config: { object: new DynaText({ string: [' ' + localize({ type: 'variable', key: 'remaining_hand_money', vars: [G.GAME.modifiers.money_per_hand ?? 1] })], colours: [G.C.UI.TEXT_LIGHT], shadow: true, pop_in: 0, scale: 0.4 * scale, silent: true }) } });
        } else if (config.name === 'discards') {
          left_text.push({ n: G.UIT.T, config: { text: config.disp ?? config.dollars, scale: 0.8 * scale, colour: G.C.RED, shadow: true, juice: true } });
          left_text.push({ n: G.UIT.O, config: { object: new DynaText({ string: [' ' + localize({ type: 'variable', key: 'remaining_discard_money', vars: [G.GAME.modifiers.money_per_discard ?? 0] })], colours: [G.C.UI.TEXT_LIGHT], shadow: true, pop_in: 0, scale: 0.4 * scale, silent: true }) } });
        } else if (config.name.includes('joker')) {
          left_text.push({ n: G.UIT.O, config: { object: new DynaText({ string: localize({ type: 'name_text', set: config.card.config.center.set, key: config.card.config.center.key }), colours: [G.C.FILTER], shadow: true, pop_in: 0, scale: 0.6 * scale, silent: true }) } });
        } else if (config.name === 'interest') {
          left_text.push({ n: G.UIT.T, config: { text: num_dollars, scale: 0.8 * scale, colour: G.C.MONEY, shadow: true, juice: true } });
          left_text.push({ n: G.UIT.O, config: { object: new DynaText({ string: [' ' + localize({ type: 'variable', key: 'interest', vars: [G.GAME.interest_amount, 5, G.GAME.interest_amount * G.GAME.interest_cap / 5] })], colours: [G.C.UI.TEXT_LIGHT], shadow: true, pop_in: 0, scale: 0.4 * scale, silent: true }) } });
        }
        const full_row = { n: G.UIT.R, config: { align: 'cm', minw: 5 }, nodes: [
          { n: G.UIT.C, config: { padding: 0.05, minw: width * 0.55, minh: 0.61, align: 'cl' }, nodes: left_text },
          { n: G.UIT.C, config: { padding: 0.05, minw: width * 0.45, align: 'cr' }, nodes: [{ n: G.UIT.C, config: { align: 'cm', id: 'dollar_' + config.name }, nodes: [] }] },
        ] };
        if (config.name === 'blind1') G.GAME.blind.juice_up();
        G.round_eval.add_child(full_row, G.round_eval.get_UIE_by_ID(config.bonus ? 'bonus_round_eval' : 'base_round_eval'));
        play_sound('cancel', config.pitch ?? 1);
        play_sound('highlight1', 1.5 * (config.pitch ?? 1), 0.2);
        if (config.card) config.card.juice_up(0.7, 0.46);
        return true;
      },
    }));
    let dollar_row = 0;
    if (num_dollars > 60) {
      G.E_MANAGER.add_event(new Event({
        trigger: 'before', delay: 0.38,
        func: () => {
          G.round_eval.add_child(
            { n: G.UIT.R, config: { align: 'cm', id: 'dollar_row_' + (dollar_row + 1) + '_' + config.name }, nodes: [
              { n: G.UIT.O, config: { object: new DynaText({ string: [localize('$') + num_dollars], colours: [G.C.MONEY], shadow: true, pop_in: 0, scale: 0.65, float: true }) } },
            ] },
            G.round_eval.get_UIE_by_ID('dollar_' + config.name));
          play_sound('coin3', 0.9 + 0.2 * Math.random(), 0.7);
          play_sound('coin6', 1.3, 0.8);
          return true;
        },
      }));
    } else {
      for (let i = 1; i <= (num_dollars || 1); i++) {
        G.E_MANAGER.add_event(new Event({
          trigger: 'before', delay: 0.18 - (num_dollars > 20 ? 0.13 : num_dollars > 9 ? 0.1 : 0),
          func: () => {
            if (i % 30 === 1) {
              G.round_eval.add_child({ n: G.UIT.R, config: { align: 'cm', id: 'dollar_row_' + (dollar_row + 1) + '_' + config.name }, nodes: [] },
                G.round_eval.get_UIE_by_ID('dollar_' + config.name));
              dollar_row += 1;
            }
            const r = { n: G.UIT.T, config: { text: localize('$'), colour: G.C.MONEY, scale: num_dollars > 20 ? 0.28 : num_dollars > 9 ? 0.43 : 0.58, shadow: true, hover: true, can_collide: false, juice: true } };
            play_sound('coin3', 0.9 + 0.2 * Math.random(), 0.7 - (num_dollars > 20 ? 0.2 : 0));
            if (config.name === 'blind1') {
              G.GAME.current_round.dollars_to_be_earned = String(G.GAME.current_round.dollars_to_be_earned ?? '').substring(1);
            }
            G.round_eval.add_child(r, G.round_eval.get_UIE_by_ID('dollar_row_' + dollar_row + '_' + config.name));
            G.VIBRATION += 0.4;
            return true;
          },
        }));
      }
    }
  } else {
    delay(0.4);
    G.E_MANAGER.add_event(new Event({
      trigger: 'before', delay: 0.5,
      func: () => {
        new UIBox({
          definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
            { n: G.UIT.R, config: { id: 'cash_out_button', align: 'cm', padding: 0.1, minw: 7, r: 0.15, colour: G.C.ORANGE, shadow: true, hover: true, one_press: true, button: 'cash_out', focus_args: { snap_to: true } }, nodes: [
              { n: G.UIT.T, config: { text: localize('b_cash_out') + ': ', scale: 1, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
              { n: G.UIT.T, config: { text: localize('$') + config.dollars, scale: 1.2 * scale, colour: G.C.WHITE, shadow: true, juice: true } },
            ] },
          ] },
          config: { align: 'tmi', offset: { x: 0, y: 0.4 }, major: G.round_eval },
        });
        G.GAME.current_round.dollars = config.dollars;
        play_sound('coin6', config.pitch ?? 1);
        G.VIBRATION += 1;
        return true;
      },
    }));
  }
}

/** G.FUNCS.evaluate_round with the API's rows (in the game's order) */
export function evaluate_round(ev: RoundEvalView) {
  let pitch = 0.95;
  const GAME = G.GAME;
  const blind_row = ev.rows.find((r) => r.kind === 'blind');
  const saved = (GAME.chips ?? 0) < (GAME.blind.chips ?? 0);
  add_round_eval_row({ dollars: saved ? 0 : (blind_row?.dollars ?? 0), name: 'blind1', pitch, saved });
  pitch += 0.06;
  G.E_MANAGER.add_event(new Event({
    trigger: 'before', delay: 1.3 * Math.min((GAME.blind.dollars ?? 0) + 2, 7) / 2 * 0.15 + 0.5,
    func: () => { GAME.blind.defeat(); return true; },
  }));
  delay(0.2);
  G.E_MANAGER.add_event(new Event({ func: () => { ease_background_colour_blind(G.STATES.ROUND_EVAL, ''); return true; } }));
  // the tags' turn (Tag:apply_to_run 'eval': the Investment Tag), after the jokers
  let tags_done = false;
  const eval_tags = () => {
    if (tags_done) return;
    tags_done = true;
    if (run.view) react_tags(run.view.tags, undefined, ['eval']);
  };
  ev.rows.forEach((r, i) => {
    if (r.kind === 'blind') return;
    if (r.kind === 'tag' || r.kind === 'interest') eval_tags();
    if (r.kind === 'hands') {
      const hands = GAME.current_round.hands_left;
      GAME.modifiers.money_per_hand = hands > 0 ? r.dollars / hands : GAME.modifiers.money_per_hand;
      add_round_eval_row({ dollars: r.dollars, disp: hands, bonus: true, name: 'hands', pitch });
    } else if (r.kind === 'discards') {
      const d = GAME.current_round.discards_left;
      GAME.modifiers.money_per_discard = d > 0 ? r.dollars / d : GAME.modifiers.money_per_discard;
      add_round_eval_row({ dollars: r.dollars, disp: d, bonus: true, name: 'discards', pitch });
    } else if (r.kind === 'joker') {
      const card = G.jokers.cards.find((c: any) => c.config.center.key === r.key) ?? G.jokers.cards[0];
      add_round_eval_row({ dollars: r.dollars, bonus: true, name: 'joker' + (i + 1), pitch, card });
    } else if (r.kind === 'tag') {
      const tag = G.P_TAGS[r.key ?? ''];
      add_round_eval_row({ dollars: r.dollars, bonus: true, name: 'tag' + (i + 1), pitch, condition: localize('ph_defeat_the_boss'), pos: tag?.pos ?? { x: 0, y: 0 } });
    } else if (r.kind === 'interest') {
      add_round_eval_row({ bonus: true, name: 'interest', pitch, dollars: r.dollars });
    }
    pitch += 0.06;
  });
  eval_tags();
  pitch += 0.06;
  add_round_eval_row({ name: 'bottom', dollars: ev.total });
}
