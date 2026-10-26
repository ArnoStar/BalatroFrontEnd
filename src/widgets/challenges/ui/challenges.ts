// The challenges (UI_definitions.lua: G.UIDEF.challenges, challenge_list,
// challenge_list_page, challenge_description, challenge_description_tab;
// button_callbacks.lua: challenge_list, change_challenge_description,
// change_challenge_list_page, start_challenge_run, deck_view_challenge).
import { G, UIBox, Moveable, AnimatedSprite, Sprite, Node, Event, play_sound, adjust_alpha } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { create_UIBox_generic_options, create_tabs, create_option_cycle, UIBox_button } from '@/shared/ui';
import { profile } from '@/shared/config';
import { Card, CardArea } from '@/entities/card';
import { Tag } from '@/entities/tag';
import { get_starting_params } from '@/entities/run';

const ch = (id: number) => G.CHALLENGES[id - 1];

function get_challenge_rule(_challenge: any, _type: string, _id: string) {
  for (const v of _challenge?.rules?.[_type] ?? []) if (v.id === _id) return v.value;
  return undefined;
}

export function challenges(from_game_over?: any) {
  if (profile().all_unlocked) profile().challenges_unlocked = G.CHALLENGES.length;
  G.run_setup_seed = null;
  if (G.OVERLAY_MENU) {
    const seed_toggle = G.OVERLAY_MENU.get_UIE_by_ID('run_setup_seed');
    if (seed_toggle) seed_toggle.states.visible = false;
  }
  const completed = profile().challenge_progress.completed;
  const _ch_tot = G.CHALLENGES.length;
  const _ch_comp = G.CHALLENGES.filter((v: any) => v.id && completed[v.id]).length;
  const _ch_tab = { comp: _ch_comp, unlocked: profile().challenges_unlocked };
  return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.1, colour: G.C.CLEAR, minh: 8, minw: 7 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1, r: 0.1, colour: G.C.BLACK }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
        { n: G.UIT.T, config: { text: localize('k_challenge_mode'), scale: 0.4, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
      { n: G.UIT.R, config: { align: 'cm', minw: 8.5, minh: 1.5, padding: 0.2 }, nodes: [
        UIBox_button({ id: from_game_over ? 'from_game_over' : null, label: [localize('b_new_challenge')], button: 'challenge_list', minw: 4, scale: 0.4, minh: 0.6 }),
      ] },
      { n: G.UIT.R, config: { align: 'cm', minh: 0.8, r: 0.1, minw: 4.5, colour: G.C.L_BLACK, emboss: 0.05,
        progress_bar: { max: _ch_tot, ref_table: _ch_tab, ref_value: 'unlocked', empty_col: G.C.L_BLACK, filled_col: G.C.FILTER } }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0.05, r: 0.1, minw: 4.5 }, nodes: [
          { n: G.UIT.T, config: { text: localize({ type: 'variable', key: 'unlocked', vars: [_ch_tab.unlocked, _ch_tot] }), scale: 0.3, colour: G.C.WHITE, shadow: true } },
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', minh: 0.8, r: 0.1, minw: 4.5, colour: G.C.L_BLACK, emboss: 0.05,
        progress_bar: { max: _ch_tot, ref_table: _ch_tab, ref_value: 'comp', empty_col: G.C.L_BLACK, filled_col: adjust_alpha(G.C.GREEN, 0.5) } }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0.05, r: 0.1, minw: 4.5 }, nodes: [
          { n: G.UIT.T, config: { text: localize({ type: 'variable', key: 'completed', vars: [_ch_comp, _ch_tot] }), scale: 0.3, colour: G.C.WHITE, shadow: true } },
        ] },
      ] },
    ] },
  ] };
}

export function challenge_list(from_game_over?: any) {
  G.CHALLENGE_PAGE_SIZE = 10;
  const pages: string[] = [];
  const n = Math.ceil(G.CHALLENGES.length / G.CHALLENGE_PAGE_SIZE);
  for (let i = 1; i <= n; i++) pages.push(localize('k_page') + ' ' + i + '/' + n);
  G.E_MANAGER.add_event(new Event({ func: () => { G.FUNCS.change_challenge_list_page({ cycle_config: { current_option: 1 } }); return true; } }));
  const completed = profile().challenge_progress.completed;
  const _ch_comp = G.CHALLENGES.filter((v: any) => v.id && completed[v.id]).length;
  void from_game_over;
  return create_UIBox_generic_options({ back_func: 'setup_run', back_id: 'challenge_list', contents: [
    { n: G.UIT.C, config: { align: 'cm', padding: 0.0 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1, minh: 7, minw: 4.2 }, nodes: [
        { n: G.UIT.O, config: { id: 'challenge_list', object: new Moveable() } },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
        create_option_cycle({ id: 'challenge_page', scale: 0.9, h: 0.3, w: 3.5, options: pages, cycle_shoulders: true, opt_callback: 'change_challenge_list_page', current_option: 1, colour: G.C.RED, no_pips: true, focus_args: { snap_to: true } }),
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
        { n: G.UIT.T, config: { text: localize({ type: 'variable', key: 'challenges_completed', vars: [_ch_comp, G.CHALLENGES.length] }), scale: 0.4, colour: G.C.WHITE } },
      ] },
    ] },
    { n: G.UIT.C, config: { align: 'cm', minh: 9, minw: 11.5 }, nodes: [
      { n: G.UIT.O, config: { id: 'challenge_area', object: new Moveable() } },
    ] },
  ] });
}

function challenge_list_page(_page: number) {
  let snapped = false;
  const list: any[] = [];
  const completed = profile().challenge_progress.completed;
  G.CHALLENGES.forEach((v: any, i: number) => {
    const k = i + 1;
    if (k > G.CHALLENGE_PAGE_SIZE * _page && k <= G.CHALLENGE_PAGE_SIZE * (_page + 1)) {
      const done = completed[v.id ?? ''];
      const unlocked = profile().challenges_unlocked >= k;
      list.push({ n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.C, config: { align: 'cl', minw: 0.8 }, nodes: [{ n: G.UIT.T, config: { text: k + '', scale: 0.4, colour: G.C.WHITE } }] },
        UIBox_button({ id: k, col: true, label: [unlocked ? localize(v.id, 'challenge_names') : localize('k_locked')], button: unlocked ? 'change_challenge_description' : 'nil', colour: unlocked ? G.C.RED : G.C.GREY, minw: 4, scale: 0.4, minh: 0.6, focus_args: { snap_to: !snapped } }),
        { n: G.UIT.C, config: { align: 'cm', padding: 0.05, minw: 0.6 }, nodes: [
          { n: G.UIT.C, config: { minh: 0.4, minw: 0.4, emboss: 0.05, r: 0.1, colour: done ? G.C.GREEN : G.C.BLACK }, nodes: [
            done ? { n: G.UIT.O, config: { object: new Sprite(0, 0, 0.4, 0.4, G.ASSET_ATLAS.icons, { x: 1, y: 0 }) } } : null,
          ] },
        ] },
      ] });
      snapped = true;
    }
  });
  return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.1, colour: G.C.CLEAR }, nodes: list };
}

function card_row(list: any[] | undefined, w: number, limit: number | undefined, extra: any = {}) {
  const joker_size = 0.6;
  const area = new CardArea(0, 0, w * joker_size, 0.6 * G.CARD_H, { card_limit: limit, card_w: joker_size * G.CARD_W, type: 'title_2', highlight_limit: 0, ...extra });
  for (const v of list ?? []) {
    const card: any = new Card(0, 0, G.CARD_W * joker_size, G.CARD_H * joker_size, null, G.P_CENTERS[v.id], { bypass_discovery_center: true, bypass_discovery_ui: true, bypass_lock: true });
    if (v.edition) card.set_edition({ [v.edition]: true }, true, true);
    if (v.eternal) card.ability.eternal = true;
    if (v.pinned) card.pinned = true;
    area.emplace(card);
  }
  return area;
}

export function challenge_description(_id: number, _daily?: boolean, is_row?: boolean) {
  const challenge = ch(_id);
  if (!challenge) {
    return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.BLACK, minh: 8.82, minw: 11.5, r: 0.1 }, nodes: [
      { n: G.UIT.T, config: { text: localize('ph_select_challenge'), scale: 0.3, colour: G.C.UI.TEXT_LIGHT } },
    ] };
  }
  const jokers = card_row(challenge.jokers, 10, get_challenge_rule(challenge, 'modifiers', 'joker_limit') ?? 5);
  const consumeables = card_row(challenge.consumeables, 3, get_challenge_rule(challenge, 'modifiers', 'consumable_limit') ?? 2, { spread: true });
  const vouchers = card_row(challenge.vouchers, 3, undefined, { spread: true });
  const col = (label: string, scale: number, area: any, minw?: number) => ({ n: G.UIT.C, config: { align: 'cm', padding: 0.05, colour: G.C.L_BLACK, r: 0.1, maxh: 1.8 }, nodes: [
    { n: G.UIT.T, config: { text: label, scale, colour: G.C.UI.TEXT_LIGHT, vert: true, shadow: true } },
    { n: G.UIT.C, config: { align: 'cm', minh: 0.6 * G.CARD_H, minw, r: 0.1, colour: G.C.UI.TRANSPARENT_DARK }, nodes: [{ n: G.UIT.O, config: { object: area } }] },
  ] });
  return { n: is_row ? G.UIT.R : G.UIT.ROOT, config: { align: 'cm', r: 0.1, colour: G.C.BLACK }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      col(localize('k_jokers_cap'), 0.5, jokers, 5), col(localize('k_cap_consumables'), 0.3, consumeables), col(localize('k_vouchers_cap'), 0.33, vouchers),
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
      create_tabs({ tabs: [
        { label: localize('b_rules'), chosen: true, tab_definition_function: challenge_description_tab, tab_definition_function_args: { _id, _tab: 'Rules' } },
        { label: localize('b_restrictions'), tab_definition_function: challenge_description_tab, tab_definition_function_args: { _id, _tab: 'Restrictions' } },
        { label: localize('b_deck'), tab_definition_function: challenge_description_tab, tab_definition_function_args: { _id, _tab: 'Deck' } },
      ], tab_h: 5, padding: 0, text_scale: 0.36, scale: 0.85, no_shoulders: true, no_loop: true }),
    ] },
    !is_row ? { n: G.UIT.R, config: { align: 'cm', minh: 0.9 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1, minh: 0.7, minw: 9, r: 0.1, hover: true, colour: G.C.BLUE, button: 'start_challenge_run', shadow: true, id: _id }, nodes: [
        { n: G.UIT.T, config: { text: localize('b_play_cap'), scale: 0.5, colour: G.C.UI.TEXT_LIGHT, func: 'set_button_pip', focus_args: { button: 'x', set_button_pip: true } } },
      ] },
    ] } : null,
  ] };
}

function challenge_description_tab(args: any = {}) {
  const challenge = ch(args._id);
  if (args._tab === 'Rules') {
    let start_rules: any[] = [];
    let modded_starts: any[] | null = null;
    const game_rules: any[] = [];
    const sp = get_starting_params();
    const base: Record<string, any> = {
      dollars: { value: sp.dollars, order: 6 }, discards: { value: sp.discards, order: 2 }, hands: { value: sp.hands, order: 1 },
      reroll_cost: { value: sp.reroll_cost, order: 7 }, joker_slots: { value: sp.joker_slots, order: 4 },
      consumable_slots: { value: sp.consumable_slots, order: 5 }, hand_size: { value: sp.hand_size, order: 3 },
    };
    let bonus = 100;
    for (const v of challenge.rules?.modifiers ?? []) {
      base[v.id] = { value: v.value, order: base[v.id] ? base[v.id].order : bonus, custom: true, old_val: base[v.id]?.value };
      bonus++;
    }
    const list = Object.keys(base).map((k) => ({ ...base[k], key: k })).sort((a, b) => a.order - b.order);
    for (const v of list) {
      if (v.old_val !== undefined) {
        modded_starts = modded_starts ?? [];
        modded_starts.push({ n: G.UIT.R, config: { align: 'cl', maxw: 3.5 }, nodes: localize({ type: 'text', key: 'ch_m_' + v.key, vars: [v.value], default_col: G.C.L_BLACK }) });
      } else {
        start_rules.push({ n: G.UIT.R, config: { align: 'cl', maxw: 3.5 }, nodes: localize({ type: 'text', key: 'ch_m_' + v.key, vars: [v.value], default_col: !v.custom ? G.C.UI.TEXT_INACTIVE : null }) });
      }
    }
    if (modded_starts) {
      start_rules = [
        { n: G.UIT.R, config: { align: 'cl', padding: 0.05 }, nodes: modded_starts },
        { n: G.UIT.R, config: { align: 'cl', padding: 0.05, colour: G.C.GREY }, nodes: [] },
        { n: G.UIT.R, config: { align: 'cl', padding: 0.05 }, nodes: start_rules },
      ];
    }
    for (const v of challenge.rules?.custom ?? []) {
      game_rules.push({ n: G.UIT.R, config: { align: 'cl' }, nodes: localize({ type: 'text', key: 'ch_c_' + v.id, vars: [v.value] }) });
    }
    if (!start_rules[0] && !modded_starts) start_rules.push({ n: G.UIT.R, config: { align: 'cl' }, nodes: localize({ type: 'text', key: 'ch_m_none', vars: [] }) });
    if (!game_rules[0]) game_rules.push({ n: G.UIT.R, config: { align: 'cl' }, nodes: localize({ type: 'text', key: 'ch_c_none', vars: [] }) });
    const box = (title: string, nodes: any[], minw: number, maxw?: number) => ({ n: G.UIT.C, config: { align: 'cm', minw: 3, r: 0.1, colour: G.C.BLUE }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.08, minh: 0.6 }, nodes: [{ n: G.UIT.T, config: { text: title, scale: 0.4, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
      { n: G.UIT.R, config: { align: 'cm', minh: 4.1, minw, maxw, padding: 0.05, r: 0.1, colour: G.C.WHITE }, nodes },
    ] });
    return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.05, colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.1, colour: G.C.L_BLACK, r: 0.1, minw: 3 }, nodes: [
        box(localize('k_custom_rules'), game_rules, 6.8, 6.7), box(localize('k_game_modifiers'), start_rules, 4.2),
      ] },
    ] };
  }
  if (args._tab === 'Restrictions') {
    const banned_cards: any[] = [], banned_tags: any[] = [], banned_other: any[] = [];
    const r = challenge.restrictions ?? {};
    if (r.banned_cards) {
      const cards = r.banned_cards;
      const n_rows = Math.max(1, Math.floor(cards.length / 10) + 2 - Math.floor(Math.log(6) / Math.log(cards.length)));
      const rows: any[][] = [];
      let max_width = 1;
      cards.forEach((v: any, i: number) => {
        const _row = Math.floor(i * n_rows / cards.length);
        rows[_row] = rows[_row] ?? [];
        rows[_row].push(v);
        if (rows[_row].length > max_width) max_width = rows[_row].length;
      });
      const card_size = Math.max(0.3, 0.75 - 0.01 * (max_width * n_rows));
      for (const row of rows) {
        if (!row) continue;
        const area = new CardArea(0, 0, 6.7, 3.3 / n_rows, { card_limit: undefined, type: 'title_2', view_deck: true, highlight_limit: 0, card_w: G.CARD_W * card_size });
        banned_cards.push({ n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [{ n: G.UIT.O, config: { object: area } }] });
        for (const v of row) area.emplace(new Card(0, 0, G.CARD_W * card_size, G.CARD_H * card_size, null, G.P_CENTERS[v.id], { bypass_discovery_center: true, bypass_discovery_ui: true }));
      }
    }
    if (r.banned_tags) {
      const tags = r.banned_tags.map((v: any) => G.P_TAGS[v.id]).sort((a: any, b: any) => a.order - b.order);
      for (const v of tags) {
        const [ui] = new Tag(v.key).generate_UI(1.1 - 0.25 * Math.sqrt(r.banned_tags.length));
        banned_tags.push({ n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [ui] });
      }
    }
    if (r.banned_other) {
      const others = r.banned_other.filter((v: any) => v.type === 'blind').map((v: any) => G.P_BLINDS[v.id]).sort((a: any, b: any) => a.order - b.order);
      for (const v of others) {
        const temp_blind: any = new AnimatedSprite(0, 0, 1, 1, G.ANIMATION_ATLAS.blind_chips, v.pos);
        temp_blind.define_draw_steps([{ shader: 'dissolve', shadow_height: 0.05 }, { shader: 'dissolve' }]);
        temp_blind.float = true;
        temp_blind.states.hover.can = true;
        temp_blind.states.drag.can = false;
        temp_blind.states.collide.can = true;
        temp_blind.config = { blind: v, force_focus: true };
        temp_blind.hover = () => {
          if (!G.CONTROLLER.dragging.target || G.CONTROLLER.using_touch) {
            if (!temp_blind.hovering && temp_blind.states.visible) {
              temp_blind.hovering = true;
              temp_blind.hover_tilt = 3;
              temp_blind.juice_up(0.05, 0.02);
              play_sound('chips1', Math.random() * 0.1 + 0.55, 0.12);
              temp_blind.config.h_popup = G.UIDEF.blind_popup?.(v, true);
              temp_blind.config.h_popup_config = { align: 'cl', offset: { x: -0.1, y: 0 }, parent: temp_blind };
              Node.prototype.hover.call(temp_blind);
            }
          }
        };
        temp_blind.stop_hover = () => { temp_blind.hovering = false; Node.prototype.stop_hover.call(temp_blind); temp_blind.hover_tilt = 0; };
        banned_other.push({ n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [{ n: G.UIT.O, config: { object: temp_blind } }] });
      }
    }
    if (!banned_cards[0]) banned_cards.push({ n: G.UIT.R, config: { align: 'cl' }, nodes: localize({ type: 'text', key: 'ch_m_none', vars: [] }) });
    if (!banned_tags[0]) banned_tags.push({ n: G.UIT.R, config: { align: 'cl' }, nodes: localize({ type: 'text', key: 'ch_c_none', vars: [] }) });
    if (!banned_other[0]) banned_other.push({ n: G.UIT.R, config: { align: 'cl' }, nodes: localize({ type: 'text', key: 'ch_c_none', vars: [] }) });
    const box = (title: string, scale: number, nodes: any[], minw: number, maxw?: number) => ({ n: G.UIT.C, config: { align: 'cm', r: 0.1, colour: G.C.RED }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.08, minh: 0.6, maxw }, nodes: [{ n: G.UIT.T, config: { text: title, scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
      { n: G.UIT.R, config: { align: 'cm', minh: 4.1, minw, padding: 0.05, r: 0.1, colour: G.C.WHITE }, nodes },
    ] });
    return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.05, colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.1, colour: G.C.L_BLACK, r: 0.1 }, nodes: [
        box(localize('k_banned_cards'), 0.4, banned_cards, 7.33), box(localize('k_banned_tags'), 0.3, banned_tags, 1.48, 1.48), box(localize('k_other'), 0.4, banned_other, 2, 1.84),
      ] },
    ] };
  }
  // Deck
  const deck_tables: any[] = [];
  const SUITS: Record<string, Card[]> = { S: [], H: [], C: [], D: [] };
  const _de = challenge?.deck;
  let protos: any[] | null = _de?.cards ?? null;
  if (!protos) {
    protos = [];
    for (const k of Object.keys(G.P_CARDS)) {
      const _r = k.substring(2, 3), _s = k.substring(0, 1);
      let keep = true;
      if (_de) {
        if (_de.yes_ranks && !_de.yes_ranks[_r]) keep = false;
        if (_de.no_ranks && _de.no_ranks[_r]) keep = false;
        if (_de.yes_suits && !_de.yes_suits[_s]) keep = false;
        if (_de.no_suits && _de.no_suits[_s]) keep = false;
      }
      if (keep) protos.push({ s: _s, r: _r, e: _de?.enhancement, d: _de?.edition, g: _de?.seal });
    }
  }
  for (const v of protos) {
    const card: any = new Card(0, 0, G.CARD_W * 0.45, G.CARD_H * 0.45, G.P_CARDS[v.s + '_' + v.r], G.P_CENTERS[v.e ?? 'c_base']);
    if (v.d) card.set_edition({ [v.d]: true }, true, true);
    if (v.g) card.set_seal(v.g, true, true);
    SUITS[v.s].push(card);
  }
  for (const s of ['S', 'H', 'C', 'D']) {
    if (!SUITS[s][0]) continue;
    SUITS[s].sort((a, b) => b.get_nominal() - a.get_nominal());
    const area = new CardArea(0, 0, 5.5 * G.CARD_W, 0.42 * G.CARD_H, { card_limit: SUITS[s].length, type: 'title_2', view_deck: true, highlight_limit: 0, card_w: G.CARD_W * 0.5, draw_layers: ['card'] });
    deck_tables.push({ n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [{ n: G.UIT.O, config: { object: area } }] });
    for (const c of SUITS[s]) area.emplace(c);
  }
  return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0, colour: G.C.BLACK, r: 0.1, minw: 11.4, minh: 4.2 }, nodes: deck_tables };
}

export function register_challenge_funcs() {
  G.UIDEF.challenges = challenges;
  G.UIDEF.challenge_list = challenge_list;
  G.UIDEF.challenge_description = challenge_description;
  G.FUNCS.challenge_list = (e: any) => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: challenge_list(e?.config?.id === 'from_game_over') });
  };
  G.FUNCS.change_challenge_description = (e: any) => {
    if (!G.OVERLAY_MENU) return;
    const desc_area = G.OVERLAY_MENU.get_UIE_by_ID('challenge_area');
    if (desc_area && desc_area.config.oid !== e.config.id) {
      if (desc_area.config.old_chosen) desc_area.config.old_chosen.config.chosen = null;
      e.config.chosen = 'vert';
      if (desc_area.config.object) desc_area.config.object.remove();
      desc_area.config.object = new UIBox({ definition: challenge_description(Number(e.config.id)) as any, config: { offset: { x: 0, y: 0 }, align: 'cm', parent: desc_area } });
      desc_area.config.oid = e.config.id;
      desc_area.config.old_chosen = e;
    }
  };
  G.FUNCS.change_challenge_list_page = (args: any) => {
    if (!args || !args.cycle_config || !G.OVERLAY_MENU) return;
    const list = G.OVERLAY_MENU.get_UIE_by_ID('challenge_list');
    if (!list) return;
    if (list.config.object) list.config.object.remove();
    list.config.object = new UIBox({ definition: challenge_list_page(args.cycle_config.current_option - 1), config: { offset: { x: 0, y: 0 }, align: 'cm', parent: list } });
    G.FUNCS.change_challenge_description({ config: { id: 'nil' } });
  };
  G.FUNCS.start_challenge_run = (e: any) => {
    if (G.OVERLAY_MENU) G.FUNCS.exit_overlay_menu();
    const c = ch(Number(e.config.id));
    G.FUNCS.start_run(e, { request: { stake: 1, challenge: c.id, game_speed: G.SETTINGS.GAMESPEED } });
  };
  G.FUNCS.deck_view_challenge = (e: any) => {
    const idx = G.CHALLENGES.findIndex((c: any) => c.id === (e.config.id?.id ?? '')) + 1;
    G.FUNCS.overlay_menu({ definition: create_UIBox_generic_options({ back_func: 'deck_info', contents: [challenge_description(idx, undefined, true)] }) });
  };
}
