// The blind select screen (UI_definitions.lua: create_UIBox_blind_select,
// create_UIBox_blind_choice, create_UIBox_blind_tag) and its callbacks
// (button_callbacks.lua: blind_choice_handler, hover_tag_proxy,
// reroll_boss_button). The blinds' scores and rewards are the API's.
import {
  G, UIBox, DynaText, AnimatedSprite, mix_colours, darken, adjust_alpha, number_format, score_number_scale, play_sound,
  Event,
} from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { UIBox_button, UIBox_dyn_container, create_UIBox_card_alert } from '@/shared/ui';
import { get_stake_sprite } from '@/shared/ui/stake';
import { get_blind_main_colour } from '@/entities/blind';
import { Tag } from '@/entities/tag';
import { card_h_popup } from '@/entities/card';
import { is_legal } from '@/entities/run';

type Slot = 'Small' | 'Big' | 'Boss';

export function create_UIBox_blind_tag(blind_choice: Slot, run_info?: boolean) {
  const rr = G.GAME.round_resets;
  rr.blind_tags = rr.blind_tags ?? {};
  if (!rr.blind_tags[blind_choice]) return null;
  const tv = rr.blind_tag_views?.[blind_choice];
  const _tag = new Tag(rr.blind_tags[blind_choice], false, blind_choice, tv?.orbital_hand ?? null);
  const [_tag_ui, _tag_sprite] = _tag.generate_UI();
  _tag_sprite.states.collide.can = !!run_info;
  return { n: G.UIT.R, config: { id: 'tag_container', ref_table: _tag, align: 'cm' }, nodes: [
    { n: G.UIT.R, config: { align: 'tm', minh: 0.65 }, nodes: [
      { n: G.UIT.T, config: { text: localize('k_or'), scale: 0.55, colour: G.C.WHITE, shadow: true } },
    ] },
    { n: G.UIT.R, config: { id: 'tag_' + blind_choice, align: 'cm', r: 0.1, padding: 0.1, minw: 1, can_collide: true, ref_table: _tag_sprite }, nodes: [
      { n: G.UIT.C, config: { id: 'tag_desc', align: 'cm', minh: 1 }, nodes: [_tag_ui] },
      !run_info
        ? { n: G.UIT.C, config: { align: 'cm', colour: G.C.UI.BACKGROUND_INACTIVE, minh: 0.6, minw: 2, maxw: 2, padding: 0.07, r: 0.1, shadow: true, hover: true, one_press: true, button: 'skip_blind', func: 'hover_tag_proxy', ref_table: _tag }, nodes: [
          { n: G.UIT.T, config: { text: localize('b_skip_blind'), scale: 0.4, colour: G.C.UI.TEXT_INACTIVE } },
        ] }
        : { n: G.UIT.C, config: { align: 'cm', padding: 0.1, emboss: 0.05, colour: mix_colours(G.C.BLUE, G.C.BLACK, 0.4), r: 0.1, maxw: 2 }, nodes: [
          { n: G.UIT.T, config: { text: localize('b_skip_reward'), scale: 0.35, colour: G.C.WHITE } },
        ] },
    ] },
  ] };
}

export function create_UIBox_blind_choice(type: Slot = 'Small', run_info?: boolean) {
  const GAME = G.GAME;
  const rr = GAME.round_resets;
  if (!GAME.blind_on_deck) GAME.blind_on_deck = 'Small';
  if (!run_info) rr.blind_states[GAME.blind_on_deck] = 'Select';
  const disabled = false;
  const blind_choice: any = { config: G.P_BLINDS[rr.blind_choices[type]] };
  blind_choice.animation = new AnimatedSprite(0, 0, 1.4, 1.4, G.ANIMATION_ATLAS.blind_chips, blind_choice.config.pos);
  blind_choice.animation.define_draw_steps([{ shader: 'dissolve', shadow_height: 0.05 }, { shader: 'dissolve' }]);
  let extras: any = null;
  const stake_sprite = get_stake_sprite(GAME.stake || 1, 0.5);

  if (type === 'Small' || type === 'Big') {
    extras = create_UIBox_blind_tag(type, run_info);
  } else if (!run_info) {
    const dt1 = new DynaText({ string: [{ string: localize('ph_up_ante_1'), colour: G.C.FILTER }], colours: [G.C.BLACK], scale: 0.55, silent: true, pop_delay: 4.5, shadow: true, bump: true, maxw: 3 });
    const dt2 = new DynaText({ string: [{ string: localize('ph_up_ante_2'), colour: G.C.WHITE }], colours: [G.C.CHANCE], scale: 0.35, silent: true, pop_delay: 4.5, shadow: true, maxw: 3 });
    const dt3 = new DynaText({ string: [{ string: localize('ph_up_ante_3'), colour: G.C.WHITE }], colours: [G.C.CHANCE], scale: 0.35, silent: true, pop_delay: 4.5, shadow: true, maxw: 3 });
    extras = { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.07, r: 0.1, colour: [0, 0, 0, 0.12], minw: 2.9 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.O, config: { object: dt1 } }] },
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.O, config: { object: dt2 } }] },
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.O, config: { object: dt3 } }] },
      ] },
    ] };
  }
  rr.blind_ante = rr.blind_ante ?? rr.ante;
  const loc_target: string[] = localize({ type: 'raw_descriptions', key: blind_choice.config.key, set: 'Blind', vars: [localize(GAME.current_round.most_played_poker_hand, 'poker_hands')] }) ?? [];
  const loc_name = localize({ type: 'name_text', key: blind_choice.config.key, set: 'Blind' });
  const text_table = loc_target;
  const blind_col = get_blind_main_colour(type);
  const blind_amt = rr.blind_chips?.[type] ?? 0;
  let blind_state = rr.blind_states[type];
  const reward = rr.blind_rewards?.[type] ?? blind_choice.config.dollars;
  const _reward = !(GAME.modifiers.no_blind_reward && GAME.modifiers.no_blind_reward[type]);
  if (blind_state === 'Select') blind_state = 'Current';
  const run_info_colour = run_info && (blind_state === 'Defeated' ? G.C.GREY : blind_state === 'Skipped' ? G.C.BLUE : blind_state === 'Upcoming' ? G.C.ORANGE : blind_state === 'Current' ? G.C.RED : G.C.GOLD);
  const ti = (c: any) => (disabled ? G.C.UI.TEXT_INACTIVE : c);
  return { n: G.UIT.R, config: { id: type, align: 'tm', func: 'blind_choice_handler', minh: !run_info ? 10 : null, ref_table: { deck: null, run_info }, r: 0.1, padding: 0.05 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', colour: mix_colours(G.C.BLACK, G.C.L_BLACK, 0.5), r: 0.1, outline: 1, outline_colour: G.C.L_BLACK }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.2 }, nodes: [
        !run_info
          ? { n: G.UIT.R, config: { id: 'select_blind_button', align: 'cm', ref_table: blind_choice.config, colour: disabled ? G.C.UI.BACKGROUND_INACTIVE : G.C.ORANGE, minh: 0.6, minw: 2.7, padding: 0.07, r: 0.1, shadow: true, hover: true, one_press: true, button: 'select_blind' }, nodes: [
            { n: G.UIT.T, config: { ref_table: rr.loc_blind_states, ref_value: type, scale: 0.45, colour: ti(G.C.UI.TEXT_LIGHT), shadow: !disabled } },
          ] }
          : { n: G.UIT.R, config: { id: 'select_blind_button', align: 'cm', ref_table: blind_choice.config, colour: run_info_colour, minh: 0.6, minw: 2.7, padding: 0.07, r: 0.1, emboss: 0.08 }, nodes: [
            { n: G.UIT.T, config: { text: localize(blind_state, 'blind_states'), scale: 0.45, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
          ] },
      ] },
      { n: G.UIT.R, config: { id: 'blind_name', align: 'cm', padding: 0.07 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', r: 0.1, outline: 1, outline_colour: blind_col, colour: darken(blind_col, 0.3), minw: 2.9, emboss: 0.1, padding: 0.07, line_emboss: 1 }, nodes: [
          { n: G.UIT.O, config: { object: new DynaText({ string: loc_name, colours: [ti(G.C.WHITE)], shadow: !disabled, float: !disabled, y_offset: -4, scale: 0.45, maxw: 2.8 }) } },
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
        { n: G.UIT.R, config: { id: 'blind_desc', align: 'cm', padding: 0.05 }, nodes: [
          { n: G.UIT.R, config: { align: 'cm' }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', minh: 1.5 }, nodes: [
              { n: G.UIT.O, config: { object: blind_choice.animation } },
            ] },
            text_table[0] ? { n: G.UIT.R, config: { align: 'cm', minh: 0.7, padding: 0.05, minw: 2.9 }, nodes: [
              text_table[0] ? { n: G.UIT.R, config: { align: 'cm', maxw: 2.8 }, nodes: [
                { n: G.UIT.T, config: { id: blind_choice.config.key, ref_table: { val: '' }, ref_value: 'val', scale: 0.32, colour: ti(G.C.WHITE), shadow: !disabled, func: 'HUD_blind_debuff_prefix' } },
                { n: G.UIT.T, config: { text: text_table[0] || '-', scale: 0.32, colour: ti(G.C.WHITE), shadow: !disabled } },
              ] } : null,
              text_table[1] ? { n: G.UIT.R, config: { align: 'cm', maxw: 2.8 }, nodes: [
                { n: G.UIT.T, config: { text: text_table[1] || '-', scale: 0.32, colour: ti(G.C.WHITE), shadow: !disabled } },
              ] } : null,
            ] } : null,
          ] },
          { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.05, minw: 3.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', maxw: 3 }, nodes: [
              { n: G.UIT.T, config: { text: localize('ph_blind_score_at_least'), scale: 0.3, colour: ti(G.C.WHITE), shadow: !disabled } },
            ] },
            { n: G.UIT.R, config: { align: 'cm', minh: 0.6 }, nodes: [
              { n: G.UIT.O, config: { w: 0.5, h: 0.5, colour: G.C.BLUE, object: stake_sprite, hover: true, can_collide: false } },
              { n: G.UIT.B, config: { h: 0.1, w: 0.1 } },
              { n: G.UIT.T, config: { text: number_format(blind_amt), scale: score_number_scale(0.9, blind_amt), colour: ti(G.C.RED), shadow: !disabled } },
            ] },
            _reward ? { n: G.UIT.R, config: { align: 'cm' }, nodes: [
              { n: G.UIT.T, config: { text: localize('ph_blind_reward'), scale: 0.35, colour: ti(G.C.WHITE), shadow: !disabled } },
              { n: G.UIT.T, config: { text: localize('$').repeat(reward) + '+', scale: 0.35, colour: ti(G.C.MONEY), shadow: !disabled } },
            ] } : null,
          ] },
        ] },
      ] },
    ] },
    { n: G.UIT.R, config: { id: 'blind_extras', align: 'cm' }, nodes: [extras] },
  ] };
}

const choice_box = (type: Slot) => {
  const boss = type === 'Boss';
  return new UIBox({
    definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
      UIBox_dyn_container([create_UIBox_blind_choice(type)], false, get_blind_main_colour(type), boss ? mix_colours(G.C.BLACK, get_blind_main_colour('Boss'), 0.8) : undefined),
    ] },
    config: { align: 'bmi', offset: { x: 0, y: 0 } },
  });
};

export function create_UIBox_blind_select() {
  const GAME = G.GAME;
  const rr = GAME.round_resets;
  G.blind_prompt_box = new UIBox({
    definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, padding: 0.2 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.O, config: { object: new DynaText({ string: localize('ph_choose_blind_1'), colours: [G.C.WHITE], shadow: true, bump: true, scale: 0.6, pop_in: 0.5, maxw: 5 }), id: 'prompt_dynatext1' } },
      ] },
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.O, config: { object: new DynaText({ string: localize('ph_choose_blind_2'), colours: [G.C.WHITE], shadow: true, bump: true, scale: 0.7, pop_in: 0.5, maxw: 5, silent: true }), id: 'prompt_dynatext2' } },
      ] },
      (GAME.used_vouchers.v_retcon || GAME.used_vouchers.v_directors_cut)
        ? UIBox_button({ label: [localize('b_reroll_boss'), localize('$') + (rr.boss_reroll_cost ?? 10)], button: 'reroll_boss', func: 'reroll_boss_button' })
        : null,
    ] },
    config: { align: 'cm', offset: { x: 0, y: -15 }, major: G.HUD.get_UIE_by_ID('row_blind'), bond: 'Weak' },
  });
  G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { G.blind_prompt_box.alignment.offset.y = 0; return true; } }));

  const width = G.hand.T.w;
  const st = rr.blind_states;
  const out = (s: string) => s === 'Defeated' || s === 'Skipped' || s === 'Hide';
  GAME.blind_on_deck = !out(st.Small) ? 'Small' : !out(st.Big) ? 'Big' : 'Boss';
  G.blind_select_opts = {};
  G.blind_select_opts.small = st.Small !== 'Hide' ? choice_box('Small') : null;
  G.blind_select_opts.big = st.Big !== 'Hide' ? choice_box('Big') : null;
  G.blind_select_opts.boss = st.Boss !== 'Hide' ? choice_box('Boss') : null;
  return { n: G.UIT.ROOT, config: { align: 'tm', minw: width, r: 0.15, colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.5 }, nodes: [
      st.Small !== 'Hide' ? { n: G.UIT.O, config: { align: 'cm', object: G.blind_select_opts.small } } : null,
      st.Big !== 'Hide' ? { n: G.UIT.O, config: { align: 'cm', object: G.blind_select_opts.big } } : null,
      st.Boss !== 'Hide' ? { n: G.UIT.O, config: { align: 'cm', object: G.blind_select_opts.boss } } : null,
    ] },
  ] };
}

/** the boss choice rebuilt after a reroll (G.FUNCS.reroll_boss's second half) */
export function replace_boss_choice() {
  const par = G.blind_select_opts.boss.parent;
  G.blind_select_opts.boss.remove();
  G.blind_select_opts.boss = new UIBox({
    T: [par.T.x, 0, 0, 0],
    definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
      UIBox_dyn_container([create_UIBox_blind_choice('Boss')], false, get_blind_main_colour('Boss'), mix_colours(G.C.BLACK, get_blind_main_colour('Boss'), 0.8)),
    ] },
    config: { align: 'bmi', offset: { x: 0, y: G.ROOM.T.y + 9 }, major: par, xy_bond: 'Weak' },
  });
  par.config.object = G.blind_select_opts.boss;
  par.config.object.recalculate();
  G.blind_select_opts.boss.parent = par;
  G.blind_select_opts.boss.alignment.offset.y = 0;
}

export function register_blind_select_funcs() {
  G.UIDEF.blind_choice = create_UIBox_blind_choice;
  G.FUNCS.blind_choice_handler = (e: any) => {
    if (!e.config.ref_table.run_info && G.blind_select && G.blind_select.VT.y < 10 && e.config.id && G.blind_select_opts[String(e.config.id).toLowerCase()]) {
      if (e.UIBox.role.xy_bond !== 'Weak') e.UIBox.set_role({ xy_bond: 'Weak' });
      const on_deck = G.GAME.blind_on_deck;
      if ((e.config.ref_table.deck !== 'on' && e.config.id === on_deck) || (e.config.ref_table.deck !== 'off' && e.config.id !== on_deck)) {
        const _blind_choice = G.blind_select_opts[String(e.config.id).toLowerCase()];
        const _top_button = e.UIBox.get_UIE_by_ID('select_blind_button');
        const _border = e.UIBox.UIRoot.children[0].children[0];
        const _tag = e.UIBox.get_UIE_by_ID('tag_' + e.config.id);
        const _tag_container = e.UIBox.get_UIE_by_ID('tag_container');
        if (_tag_container && !G.SETTINGS.tutorial_complete && !G.SETTINGS.tutorial_progress?.completed_parts?.shop_1) _tag_container.states.visible = false;
        else if (_tag_container) _tag_container.states.visible = true;
        if (e.config.id === on_deck) {
          e.config.ref_table.deck = 'on';
          e.config.draw_after = false;
          e.config.colour = G.C.CLEAR;
          _border.parent.config.outline = 2;
          _border.parent.config.outline_colour = G.C.UI.TRANSPARENT_DARK;
          _border.config.outline_colour = _border.config.outline ? _border.config.outline_colour : get_blind_main_colour(e.config.id);
          _border.config.outline = 1.5;
          _blind_choice.alignment.offset.y = -0.9;
          if (_tag && _tag_container) {
            _tag_container.children[1].config.draw_after = false;
            _tag_container.children[1].config.colour = G.C.BLACK;
            _tag.children[1].config.button = 'skip_blind';
            _tag.config.outline_colour = adjust_alpha(G.C.BLUE, 0.5);
            _tag.children[1].config.hover = true;
            _tag.children[1].config.colour = G.C.RED;
            _tag.children[1].children[0].config.colour = G.C.UI.TEXT_LIGHT;
            const _sprite = _tag.config.ref_table;
            _sprite.config.force_focus = null;
          }
          if (_top_button) {
            G.E_MANAGER.add_event(new Event({ func: () => { G.CONTROLLER.snap_to?.({ node: _top_button }); return true; } }));
            _top_button.config.button = 'select_blind';
            _top_button.config.colour = G.C.FILTER;
            _top_button.config.hover = true;
            _top_button.children[0].config.colour = G.C.WHITE;
          }
        } else {
          e.config.ref_table.deck = 'off';
          e.config.draw_after = true;
          const skipped = G.GAME.round_resets.blind_states[e.config.id] === 'Skipped';
          e.config.colour = adjust_alpha(skipped ? mix_colours(G.C.BLUE, G.C.L_BLACK, 0.1) : G.C.L_BLACK, 0.5);
          _border.parent.config.outline = null;
          _border.parent.config.outline_colour = null;
          _border.config.outline_colour = null;
          _border.config.outline = null;
          _blind_choice.alignment.offset.y = -0.2;
          if (_tag && _tag_container) {
            const s = G.GAME.round_resets.blind_states[e.config.id];
            if (s === 'Skipped' || s === 'Defeated') {
              _tag_container.children[1].set_role({ xy_bond: 'Weak' });
              _tag_container.children[1].align(0, 10);
              _tag_container.children[0].set_role({ xy_bond: 'Weak' });
              _tag_container.children[0].align(0, 10);
            }
            if (s === 'Skipped') {
              _blind_choice.children.alert = new UIBox({
                definition: create_UIBox_card_alert({ text_rot: -0.35, no_bg: true, text: localize('k_skipped_cap'), bump_amount: 1, scale: 0.9, maxw: 3.4 }),
                config: { align: 'tmi', offset: { x: 0, y: 2.2 }, major: _blind_choice, parent: _blind_choice },
              });
            }
            _tag.children[1].config.button = null;
            _tag.config.outline_colour = G.C.UI.BACKGROUND_INACTIVE;
            _tag.children[1].config.hover = false;
            _tag.children[1].config.colour = G.C.UI.BACKGROUND_INACTIVE;
            _tag.children[1].children[0].config.colour = G.C.UI.TEXT_INACTIVE;
            const _sprite = _tag.config.ref_table;
            _sprite.config.force_focus = true;
          }
          if (_top_button) {
            _top_button.config.colour = G.C.UI.BACKGROUND_INACTIVE;
            _top_button.config.button = null;
            _top_button.config.hover = false;
            _top_button.children[0].config.colour = G.C.UI.TEXT_INACTIVE;
          }
        }
      }
    }
  };

  G.FUNCS.hover_tag_proxy = (e: any) => {
    if (!e.parent || !e.parent.states) return;
    if ((e.states.hover.is || e.parent.states.hover.is) && (e.created_on_pause === G.SETTINGS.paused) && !e.parent.children.alert) {
      const _sprite = e.config.ref_table.get_uibox_table();
      e.parent.children.alert = new UIBox({
        definition: card_h_popup(_sprite) as any,
        config: { align: 'tm', offset: { x: 0, y: -0.1 }, major: e.parent, instance_type: 'POPUP' },
      });
      _sprite.juice_up(0.05, 0.02);
      play_sound('paper1', Math.random() * 0.1 + 0.55, 0.42);
      play_sound('tarot2', Math.random() * 0.1 + 0.55, 0.09);
      e.parent.children.alert.states.collide.can = false;
    } else if (e.parent.children.alert && ((!e.states.collide.is && !e.parent.states.collide.is) || (e.created_on_pause !== G.SETTINGS.paused))) {
      e.parent.children.alert.remove();
      e.parent.children.alert = null;
    }
  };

  G.FUNCS.reroll_boss_button = (e: any) => {
    const ok = is_legal('reroll_boss');
    e.config.colour = ok ? G.C.RED : G.C.UI.BACKGROUND_INACTIVE;
    e.config.button = ok ? 'reroll_boss' : null;
    e.children[0].children[0].config.shadow = ok;
    if (e.children[1]) e.children[1].children[0].config.shadow = ok;
  };
}
