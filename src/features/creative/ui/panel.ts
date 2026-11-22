// Creative mode (a run played with a creative mod, BalatroEngine's creative
// command): a CREATIVE button in the run, and its panel drawn as the game's
// menus. Every change goes to the API (POST /games/{id}/creative), which
// plays it through the game's own functions and records it, so the run
// replays with it. Numbers and cards change at once on screen; winning the
// round and new tags play like an action (their animations); a new boss or
// ante opens the run again.
import { G, UIBox, DynaText } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { create_UIBox_generic_options, create_option_cycle, UIBox_button } from '@/shared/ui';
import { api, ApiError, type CreativeRequest, type GameView } from '@/shared/api';
import { Card, CardArea } from '@/entities/card';
import { run, set_view, finish_action, resync } from '@/entities/run';
import { tr } from './text';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
const SUITS = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
const ENHANCEMENTS = ['none', 'm_bonus', 'm_mult', 'm_wild', 'm_glass', 'm_steel', 'm_stone', 'm_gold', 'm_lucky'];
const SEALS = ['none', 'Gold', 'Red', 'Blue', 'Purple'];
const EDITIONS = ['none', 'foil', 'holo', 'polychrome', 'negative'];
const SETS = ['Joker', 'Tarot', 'Planet', 'Spectral', 'Voucher', 'Tag', 'Playing', 'Boss'] as const;
type PickSet = (typeof SETS)[number];
const PER_PAGE = 12;

const st = {
  open: false,
  screen: 'main' as 'main' | 'pick',
  set: 'Joker' as PickSet,
  page: 0,
  hand: 'Flush',
  card: { rank: 'Ace', suit: 'Spades', enhancement: 'none', seal: 'none', edition: 'none' },
  form: { status: '' },
  busy: false,
};
let button_box: any = null;
let button_run: string | null = null;

// ------------------------------------------------------------------ talking to the API
function why(err: unknown) {
  return err instanceof ApiError ? (err.problem?.detail ?? err.message) : String((err as Error)?.message ?? err);
}

/** a change shown at once: the run's new view, its cards reconciled */
async function change(c: CreativeRequest, done?: (v: GameView) => string | void) {
  if (st.busy || !run.id || !run.view || run.busy) return;
  st.busy = true;
  try {
    const r = await api.creative(run.id, c, run.view.version);
    set_view(r.game);
    finish_action(r.game);
    st.form.status = (done?.(r.game) as string | undefined) ?? '';
  } catch (err) {
    st.form.status = tr('failed', { why: why(err) });
  }
  st.busy = false;
  render();
}

/** a change the game animates (winning the round, a tag): played like an action, the panel closed */
function animated(c: CreativeRequest) {
  close_panel();
  G.FUNCS.creative_command(c);
}

/** a change of what the blind select shows: the run opens again */
async function reopen(c: CreativeRequest) {
  if (!run.id || !run.view) return;
  try {
    const r = await api.creative(run.id, c, run.view.version);
    close_panel();
    resync.handler?.(r.game);
  } catch (err) {
    st.form.status = tr('failed', { why: why(err) });
    render();
  }
}

// ------------------------------------------------------------------ the panel
function text(t: string, scale: number, colour = G.C.UI.TEXT_LIGHT, maxw?: number) {
  return { n: G.UIT.T, config: { text: t, scale, colour, shadow: true, maxw } };
}

function small(label: string, fn: string, ref: any, colour: any, minw = 0.6) {
  return UIBox_button({ button: fn, ref_table: ref, label: [label], minw, minh: 0.45, scale: 0.3, colour, col: true });
}

function counter(label: string, what: string, value: number, steps: number[] = [-1, 1]) {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', minw: 2.6 }, nodes: [text(label, 0.32)] },
    ...steps.filter((s) => s < 0).map((s) => small(String(s), 'creative_step', { what, value: value + s }, G.C.RED)),
    { n: G.UIT.C, config: { align: 'cm', minw: 1.2 }, nodes: [text(what === 'money' ? `$${value}` : String(value), 0.4, what === 'money' ? G.C.MONEY : G.C.FILTER)] },
    ...steps.filter((s) => s > 0).map((s) => small('+' + s, 'creative_step', { what, value: value + s }, G.C.GREEN)),
  ] };
}

function selected_card(): any | null {
  for (const area of [G.jokers, G.consumeables, G.hand]) {
    const c = area?.highlighted?.[0];
    if (c?.api_id !== undefined) return c;
  }
  return null;
}

function card_name(c: any) {
  const center = c.config.center;
  if (c.ability.set === 'Default' || c.ability.set === 'Enhanced') return `${localize(c.base.value, 'ranks')} ${localize(c.base.suit, 'suits_plural')}`;
  return localize({ type: 'name_text', key: center.key, set: center.set });
}

function edit_rows() {
  const c = selected_card();
  if (!c) return [{ n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [text(tr('select_hint'), 0.28, G.C.UI.TEXT_INACTIVE)] }];
  const playing = c.ability.set === 'Default' || c.ability.set === 'Enhanced';
  const row = (label: string, items: string[], field: string, names: (x: string) => string) => ({ n: G.UIT.R, config: { align: 'cm', padding: 0.02 }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', minw: 1.8 }, nodes: [text(label, 0.28)] },
    ...items.map((x) => small(names(x), 'creative_edit', { card: c.api_id, field, value: x }, G.C.BLUE, 0.9)),
  ] });
  const ed = (x: string) => (x === 'none' ? tr('none') : localize({ type: 'name_text', set: 'Edition', key: 'e_' + x }));
  return [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: [text(tr('selected', { name: card_name(c) }), 0.34, G.C.FILTER)] },
    row(tr('edition'), playing ? EDITIONS.slice(0, 4) : EDITIONS, 'edition', ed),
    ...(playing ? [
      row(tr('seal'), SEALS, 'seal', (x) => (x === 'none' ? tr('none') : localize({ type: 'name_text', set: 'Other', key: x.toLowerCase() + '_seal' }))),
      row(tr('enhancement'), ENHANCEMENTS.slice(0, 5), 'enhancement', (x) => (x === 'none' ? tr('none') : localize({ type: 'name_text', set: 'Enhanced', key: x }))),
      row('', ENHANCEMENTS.slice(5), 'enhancement', (x) => localize({ type: 'name_text', set: 'Enhanced', key: x })),
    ] : []),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: [
      ...(!playing ? [small(tr('eternal'), 'creative_edit', { card: c.api_id, field: 'eternal', value: !c.ability.eternal }, c.ability.eternal ? G.C.UI.BACKGROUND_INACTIVE : G.C.PURPLE, 1.6)] : []),
      small(tr('remove'), 'creative_remove', { card: c.api_id }, G.C.RED, 1.6),
    ] },
  ];
}

function main_screen() {
  const v = run.view!;
  const hands = v.poker_hands.filter((h) => h.visible);
  if (!hands.find((h) => h.name === st.hand)) st.hand = hands[0]?.name ?? 'High Card';
  const level = v.poker_hands.find((h) => h.name === st.hand)?.level ?? 1;
  const left = { n: G.UIT.C, config: { align: 'tm', padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05, minw: 6.4 }, nodes: [
    counter(tr('money'), 'money', v.dollars, [-10, -1, 1, 10]),
    counter(tr('hands'), 'hands', v.hands_left),
    counter(tr('discards'), 'discards', v.discards_left),
    counter(tr('hand_size'), 'hand_size', v.hand_size),
    counter(tr('joker_slots'), 'joker_slots', v.joker_slots),
    counter(tr('consumable_slots'), 'consumable_slots', v.consumable_slots),
    counter(tr('ante'), 'ante', v.ante),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [
        create_option_cycle({ label: tr('hand_level'), scale: 0.6, w: 3.2, options: hands.map((h) => localize(h.name, 'poker_hands')),
          current_option: Math.max(1, hands.findIndex((h) => h.name === st.hand) + 1), opt_callback: 'creative_pick_hand', colour: G.C.RED }),
      ] },
      small('-', 'creative_level', { value: level - 1 }, G.C.RED),
      { n: G.UIT.C, config: { align: 'cm', minw: 1.1 }, nodes: [text(tr('level', { n: level }), 0.34, G.C.FILTER)] },
      small('+', 'creative_level', { value: level + 1 }, G.C.GREEN),
    ] },
  ] };
  const right = { n: G.UIT.C, config: { align: 'tm', padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05, minw: 6.6 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      UIBox_button({ button: 'creative_open_pick', label: [tr('add_cards')], minw: 3, minh: 0.6, scale: 0.36, colour: G.C.GREEN, col: true }),
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      UIBox_button({ button: 'creative_win', label: [tr('win')], minw: 2.6, minh: 0.55, scale: 0.32, colour: v.phase === 'playing' ? G.C.ORANGE : G.C.UI.BACKGROUND_INACTIVE, col: true }),
      { n: G.UIT.C, config: { minw: 0.1 }, nodes: [] },
      UIBox_button({ button: 'creative_open_boss', label: [tr('boss')], minw: 2.6, minh: 0.55, scale: 0.32, colour: v.phase === 'blind_select' ? G.C.RED : G.C.UI.BACKGROUND_INACTIVE, col: true }),
    ] },
    { n: G.UIT.R, config: { align: 'cm', minh: 0.1 }, nodes: [] },
    ...edit_rows(),
  ] };
  return [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      { n: G.UIT.O, config: { object: new DynaText({ string: [tr('title')], colours: [G.C.SECONDARY_SET.Spectral], shadow: true, float: true, bump: true, scale: 0.7, pop_in: 0, silent: true }) } },
    ] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [text(tr('note'), 0.28, G.C.UI.TEXT_INACTIVE)] },
    { n: G.UIT.R, config: { align: 'tm', padding: 0.1 }, nodes: [left, { n: G.UIT.C, config: { minw: 0.15 }, nodes: [] }, right] },
    { n: G.UIT.R, config: { align: 'cm', minh: 0.35 }, nodes: [{ n: G.UIT.T, config: { ref_table: st.form, ref_value: 'status', scale: 0.3, colour: G.C.FILTER, shadow: true } }] },
  ];
}

// the card picker: a set's cards, the run's mods' first (what creative mode tests most), click one to add it
function pool_keys(set: PickSet): string[] {
  let items: any[];
  if (set === 'Tag') items = G.P_CENTER_POOLS.Tag ?? [];
  else if (set === 'Boss') items = Object.values<any>(G.P_BLINDS).filter((b) => b.boss).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  else items = G.P_CENTER_POOLS[set] ?? [];
  return [...items.filter((c) => c.mod), ...items.filter((c) => !c.mod)].map((c) => c.key);
}

function card_grid(keys: string[]) {
  const rows: any[] = [];
  const size = 0.85;
  for (let r = 0; r < 2; r++) {
    const slice = keys.slice(r * 6, r * 6 + 6);
    if (!slice.length) break;
    const area = new CardArea(0, 0, 6 * size * G.CARD_W * 1.05, size * G.CARD_H, { card_limit: 6, card_w: size * G.CARD_W, type: 'title_2', highlight_limit: 0 });
    for (const k of slice) {
      const card: any = new Card(0, 0, G.CARD_W * size, G.CARD_H * size, null, G.P_CENTERS[k], { bypass_discovery_center: true, bypass_discovery_ui: true, bypass_lock: true });
      card.click = () => { void add_center(k); };
      card.states.drag.can = false;
      area.emplace(card);
    }
    rows.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: G.C.UI.TRANSPARENT_DARK }, nodes: [{ n: G.UIT.O, config: { object: area } }] });
  }
  return rows;
}

function name_grid(keys: string[], set: 'Tag' | 'Blind', fn: string) {
  const rows: any[] = [];
  for (let r = 0; r < 4; r++) {
    const slice = keys.slice(r * 3, r * 3 + 3);
    if (!slice.length) break;
    rows.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: slice.map((k) =>
      UIBox_button({ button: fn, ref_table: { key: k }, label: [localize({ type: 'name_text', key: k, set })], minw: 3.6, minh: 0.55, scale: 0.32, colour: set === 'Tag' ? G.C.BLUE : (G.P_BLINDS[k]?.boss_colour ?? G.C.RED), col: true })) });
  }
  return rows;
}

function playing_rows() {
  const cyc = (label: string, opts: string[], names: (x: string) => string, field: keyof typeof st.card, w = 2.6) => ({ n: G.UIT.C, config: { align: 'cm', padding: 0.04 }, nodes: [
    create_option_cycle({ label, scale: 0.55, w, options: opts.map(names), current_option: Math.max(1, opts.indexOf(st.card[field]) + 1), opt_callback: 'creative_card_field', colour: G.C.RED, pick: { field, opts } }),
  ] });
  const v = run.view!;
  return [
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      cyc(tr('rank'), RANKS, (x) => localize(x, 'ranks'), 'rank', 2),
      cyc(tr('suit'), SUITS, (x) => localize(x, 'suits_plural'), 'suit', 2.2),
    ] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      cyc(tr('enhancement'), ENHANCEMENTS, (x) => (x === 'none' ? tr('none') : localize({ type: 'name_text', set: 'Enhanced', key: x })), 'enhancement'),
      cyc(tr('seal'), SEALS, (x) => (x === 'none' ? tr('none') : localize({ type: 'name_text', set: 'Other', key: x.toLowerCase() + '_seal' })), 'seal', 2),
      cyc(tr('edition'), EDITIONS.slice(0, 4), (x) => (x === 'none' ? tr('none') : localize({ type: 'name_text', set: 'Edition', key: 'e_' + x })), 'edition', 2.2),
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      UIBox_button({ button: 'creative_add_card', ref_table: { to: 'hand' }, label: [tr('to_hand')], minw: 2.8, minh: 0.6, scale: 0.34, colour: v.phase === 'playing' ? G.C.GREEN : G.C.UI.BACKGROUND_INACTIVE, col: true }),
      { n: G.UIT.C, config: { minw: 0.2 }, nodes: [] },
      UIBox_button({ button: 'creative_add_card', ref_table: { to: 'deck' }, label: [tr('to_deck')], minw: 2.8, minh: 0.6, scale: 0.34, colour: G.C.BLUE, col: true }),
    ] },
  ];
}

function set_label(s: PickSet) {
  switch (s) {
    case 'Joker': return localize('k_jokers_cap') ?? 'Jokers';
    case 'Tarot': return localize('b_tarot_cards');
    case 'Planet': return localize('b_planet_cards');
    case 'Spectral': return localize('b_spectral_cards');
    case 'Voucher': return localize('b_vouchers');
    case 'Tag': return tr('tags');
    case 'Playing': return tr('playing_cards');
    case 'Boss': return localize('b_blinds');
  }
}

function pick_screen() {
  const keys = st.set === 'Playing' ? [] : pool_keys(st.set);
  const per = st.set === 'Tag' || st.set === 'Boss' ? 12 : PER_PAGE;
  const pages = Math.max(1, Math.ceil(keys.length / per));
  st.page = Math.min(st.page, pages - 1);
  const shown = keys.slice(st.page * per, st.page * per + per);
  const body = st.set === 'Playing' ? playing_rows()
    : st.set === 'Tag' ? name_grid(shown, 'Tag', 'creative_add_tag')
      : st.set === 'Boss' ? name_grid(shown, 'Blind', 'creative_boss')
        : card_grid(shown);
  return [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: SETS.slice(0, 4).map((s) =>
      UIBox_button({ button: 'creative_set', ref_table: { set: s }, label: [set_label(s)], minw: 2.6, minh: 0.5, scale: 0.3, colour: st.set === s ? G.C.RED : G.C.GREY, col: true })) },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: SETS.slice(4).map((s) =>
      UIBox_button({ button: 'creative_set', ref_table: { set: s }, label: [set_label(s)], minw: 2.6, minh: 0.5, scale: 0.3, colour: st.set === s ? G.C.RED : G.C.GREY, col: true })) },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [text(st.set === 'Playing' || st.set === 'Boss' || st.set === 'Tag' ? ' ' : tr('click_to_add'), 0.28, G.C.UI.TEXT_INACTIVE)] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.08, minh: 4.2, minw: 11 }, nodes: body },
    ...(pages > 1 ? [{ n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      small('<', 'creative_page', { d: -1 }, st.page > 0 ? G.C.RED : G.C.UI.BACKGROUND_INACTIVE, 0.8),
      { n: G.UIT.C, config: { align: 'cm', minw: 2 }, nodes: [text(`${localize('k_page')} ${st.page + 1}/${pages}`, 0.32)] },
      small('>', 'creative_page', { d: 1 }, st.page < pages - 1 ? G.C.RED : G.C.UI.BACKGROUND_INACTIVE, 0.8),
    ] }] : []),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      UIBox_button({ button: 'creative_back', label: [tr('back')], minw: 2.4, minh: 0.55, scale: 0.34, colour: G.C.GREY, col: true }),
    ] },
    { n: G.UIT.R, config: { align: 'cm', minh: 0.35 }, nodes: [{ n: G.UIT.T, config: { ref_table: st.form, ref_value: 'status', scale: 0.3, colour: G.C.FILTER, shadow: true } }] },
  ];
}

function render() {
  if (!st.open || !run.view) return;
  const contents = st.screen === 'pick' ? pick_screen() : main_screen();
  G.FUNCS.overlay_menu({ definition: create_UIBox_generic_options({ back_func: 'creative_close', contents, minw: 13 }) });
}

function open_panel() {
  if (!run.view || run.busy) return;
  st.open = true;
  st.screen = 'main';
  st.form.status = '';
  render();
}

function close_panel() {
  if (!st.open) return;
  st.open = false;
  G.FUNCS.exit_overlay_menu();
}

async function add_center(key: string) {
  const center = G.P_CENTERS[key];
  const name = localize({ type: 'name_text', key, set: center?.set });
  await change({ op: 'add', key }, () => tr('added', { name }));
}

// ------------------------------------------------------------------ the button in the run
function button_definition() {
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, func: 'creative_button_check' }, nodes: [
    UIBox_button({ button: 'creative_open', label: [tr('creative')], minw: 2, minh: 0.32, scale: 0.28, colour: G.C.SECONDARY_SET.Spectral }),
  ] };
}

/** a run opened: the CREATIVE button when it is played with a creative mod */
export function creative_on_run(view: GameView) {
  button_box?.remove?.();
  button_box = null;
  button_run = null;
  if (!view.settings.mods?.some((m) => m.creative)) return;
  button_run = view.id;
  // (under the joker row, as the PvP board's button: over a card area, the area would take the clicks)
  button_box = new UIBox({ definition: button_definition(), config: { major: G.jokers, align: 'bm', offset: { x: 0, y: 0.1 }, bond: 'Weak' } });
}

export function register_creative_funcs() {
  G.FUNCS.creative_on_run = creative_on_run;
  G.FUNCS.creative_button_check = (e: any) => {
    // (the run was left: the button goes with it)
    if (G.STAGE !== G.STAGES.RUN || !run.id || run.id !== button_run) {
      e.UIBox.remove();
      if (button_box === e.UIBox) { button_box = null; button_run = null; }
      return;
    }
    // (the joker area's counter box is made again as the row changes: it would take the button's clicks)
    const area_box = G.jokers?.children?.area_uibox;
    if (area_box) area_box.states.collide.can = false;
    // (drawn last of the boxes, so the blind select's or the shop's box, made later, doesn't take its clicks)
    const boxes = G.I.UIBOX;
    const i = boxes.indexOf(e.UIBox);
    if (i >= 0 && i !== boxes.length - 1) { boxes.splice(i, 1); boxes.push(e.UIBox); }
  };
  G.FUNCS.creative_open = () => open_panel();
  G.FUNCS.creative_close = () => close_panel();
  G.FUNCS.creative_step = (e: any) => {
    const { what, value } = e.config.ref_table;
    if (what === 'ante') { void reopen({ op: 'set', what, value }); return; }
    void change({ op: 'set', what, value });
  };
  G.FUNCS.creative_pick_hand = (args: any) => {
    const hands = run.view!.poker_hands.filter((h) => h.visible);
    st.hand = hands[args.to_key - 1]?.name ?? st.hand;
    render();
  };
  G.FUNCS.creative_level = (e: any) => {
    const value = Math.max(1, e.config.ref_table.value);
    void change({ op: 'level', hand: st.hand, value });
  };
  G.FUNCS.creative_win = () => {
    if (run.view?.phase !== 'playing') { st.form.status = tr('win_only'); render(); return; }
    animated({ op: 'win' });
  };
  G.FUNCS.creative_open_pick = () => { st.screen = 'pick'; st.page = 0; st.form.status = ''; render(); };
  G.FUNCS.creative_open_boss = () => {
    if (run.view?.phase !== 'blind_select') { st.form.status = tr('boss_only'); render(); return; }
    st.screen = 'pick'; st.set = 'Boss'; st.page = 0; render();
  };
  G.FUNCS.creative_back = () => { st.screen = 'main'; st.form.status = ''; render(); };
  G.FUNCS.creative_set = (e: any) => { st.set = e.config.ref_table.set; st.page = 0; st.form.status = ''; render(); };
  G.FUNCS.creative_page = (e: any) => { st.page = Math.max(0, st.page + e.config.ref_table.d); render(); };
  G.FUNCS.creative_add_tag = (e: any) => animated({ op: 'add', key: e.config.ref_table.key });
  G.FUNCS.creative_boss = (e: any) => { void reopen({ op: 'boss', key: e.config.ref_table.key }); };
  G.FUNCS.creative_card_field = (args: any) => {
    const { field, opts } = args.cycle_config.pick;
    (st.card as any)[field] = opts[args.to_key - 1];
  };
  G.FUNCS.creative_add_card = (e: any) => {
    const to = e.config.ref_table.to;
    if (to === 'hand' && run.view?.phase !== 'playing') return;
    const c = st.card;
    void change({
      op: 'add_card', rank: c.rank, suit: c.suit, to,
      ...(c.enhancement !== 'none' ? { enhancement: c.enhancement } : {}),
      ...(c.seal !== 'none' ? { seal: c.seal } : {}),
      ...(c.edition !== 'none' ? { edition: c.edition } : {}),
    }, () => tr('added', { name: `${localize(c.rank, 'ranks')} ${localize(c.suit, 'suits_plural')}` }));
  };
  G.FUNCS.creative_edit = (e: any) => {
    const { card, field, value } = e.config.ref_table;
    void change({ op: 'edit', card, [field]: value } as CreativeRequest);
  };
  G.FUNCS.creative_remove = (e: any) => { void change({ op: 'remove', card: e.config.ref_table.card }); };
}
