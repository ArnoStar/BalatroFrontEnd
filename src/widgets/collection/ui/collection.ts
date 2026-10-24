// Your Collection (UI_definitions.lua: create_UIBox_your_collection and its
// pages, create_UIBox_blind_popup; button_callbacks.lua: your_collection_*,
// your_collection_*_page). Everything is discovered in this front end's profile.
import { G, UIBox, Sprite, AnimatedSprite, DynaText, Moveable, Node, Event, play_sound, number_format, lighten, mix_colours, pseudorandom_element } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { create_UIBox_generic_options, create_option_cycle, UIBox_button } from '@/shared/ui';
import { get_stake_sprite } from '@/shared/ui/stake';
import { profile } from '@/shared/config';
import { Card, CardArea } from '@/entities/card';
import { Tag } from '@/entities/tag';
import { Back } from '@/entities/back';

/** set_discover_tallies (misc_functions.lua) */
function set_discover_tallies() {
  const T: Record<string, { tally: number; of: number }> = {};
  for (const k of ['blinds', 'tags', 'jokers', 'consumeables', 'tarots', 'planets', 'spectrals', 'vouchers', 'boosters', 'editions', 'backs', 'total']) T[k] = { tally: 0, of: 0 };
  const add = (k: string, ok: boolean) => { T[k].of++; if (ok) T[k].tally++; };
  for (const k of Object.keys(G.P_CENTERS)) {
    const v = G.P_CENTERS[k];
    if (v.omit || !v.set) continue;
    if (v.set === 'Joker' || v.consumeable || v.set === 'Edition' || v.set === 'Voucher' || v.set === 'Back' || v.set === 'Booster') add('total', !!v.discovered);
    if (v.set === 'Joker') add('jokers', !!v.discovered);
    if (v.set === 'Back') add('backs', !!v.unlocked);
    if (v.consumeable) {
      add('consumeables', !!v.discovered);
      if (v.set === 'Planet') add('planets', !!v.discovered);
      else if (v.set === 'Spectral') add('spectrals', !!v.discovered);
      else if (v.set === 'Tarot') add('tarots', !!v.discovered);
    }
    if (v.set === 'Voucher') add('vouchers', !!v.discovered);
    if (v.set === 'Booster') add('boosters', !!v.discovered);
    if (v.set === 'Edition') add('editions', !!v.discovered);
  }
  for (const k of Object.keys(G.P_TAGS)) add('tags', !!G.P_TAGS[k].discovered);
  for (const k of Object.keys(G.P_BLINDS)) add('blinds', !!G.P_BLINDS[k].discovered);
  G.DISCOVER_TALLIES = T;
}

/** get_blind_amount (misc_functions.lua): the blinds' base scores, for the collection's ante column */
function get_blind_amount(ante: number) {
  const k = 0.75;
  const scaling = G.GAME.modifiers?.scaling ?? 1;
  const amounts = scaling === 2 ? [300, 900, 2600, 8000, 20000, 36000, 60000, 100000]
    : scaling === 3 ? [300, 1000, 3200, 9000, 25000, 60000, 110000, 200000]
      : [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
  if (ante < 1) return 100;
  if (ante <= 8) return amounts[ante - 1];
  const a = amounts[7], b = 1.6, c = ante - 8, d = 1 + 0.2 * (ante - 8);
  let amount = Math.floor(a * (b + (k * c) ** d) ** c);
  amount = amount - amount % (10 ** Math.floor(Math.log10(amount) - 1));
  return amount;
}

export function create_UIBox_your_collection() {
  set_discover_tallies();
  const T = G.DISCOVER_TALLIES;
  return create_UIBox_generic_options({ back_func: G.STAGE === G.STAGES.RUN ? 'options' : 'exit_overlay_menu', contents: [
    { n: G.UIT.C, config: { align: 'cm', padding: 0.15 }, nodes: [
      UIBox_button({ button: 'your_collection_jokers', label: [localize('b_jokers')], count: T.jokers, minw: 5, minh: 1.7, scale: 0.6, id: 'your_collection_jokers' }),
      UIBox_button({ button: 'your_collection_decks', label: [localize('b_decks')], count: T.backs, minw: 5 }),
      UIBox_button({ button: 'your_collection_vouchers', label: [localize('b_vouchers')], count: T.vouchers, minw: 5, id: 'your_collection_vouchers' }),
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1, r: 0.2, colour: G.C.BLACK }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', maxh: 2.9 }, nodes: [
          { n: G.UIT.T, config: { text: localize('k_cap_consumables'), scale: 0.45, colour: G.C.L_BLACK, vert: true, maxh: 2.2 } },
        ] },
        { n: G.UIT.C, config: { align: 'cm', padding: 0.15 }, nodes: [
          UIBox_button({ button: 'your_collection_tarots', label: [localize('b_tarot_cards')], count: T.tarots, minw: 4, id: 'your_collection_tarots', colour: G.C.SECONDARY_SET.Tarot }),
          UIBox_button({ button: 'your_collection_planets', label: [localize('b_planet_cards')], count: T.planets, minw: 4, id: 'your_collection_planets', colour: G.C.SECONDARY_SET.Planet }),
          UIBox_button({ button: 'your_collection_spectrals', label: [localize('b_spectral_cards')], count: T.spectrals, minw: 4, id: 'your_collection_spectrals', colour: G.C.SECONDARY_SET.Spectral }),
        ] },
      ] },
    ] },
    { n: G.UIT.C, config: { align: 'cm', padding: 0.15 }, nodes: [
      UIBox_button({ button: 'your_collection_enhancements', label: [localize('b_enhanced_cards')], minw: 5 }),
      UIBox_button({ button: 'your_collection_seals', label: [localize('b_seals')], minw: 5, id: 'your_collection_seals' }),
      UIBox_button({ button: 'your_collection_editions', label: [localize('b_editions')], count: T.editions, minw: 5, id: 'your_collection_editions' }),
      UIBox_button({ button: 'your_collection_boosters', label: [localize('b_booster_packs')], count: T.boosters, minw: 5, id: 'your_collection_boosters' }),
      UIBox_button({ button: 'your_collection_tags', label: [localize('b_tags')], count: T.tags, minw: 5, id: 'your_collection_tags' }),
      UIBox_button({ button: 'your_collection_blinds', label: [localize('b_blinds')], count: T.blinds, minw: 5, minh: 2.0, id: 'your_collection_blinds', focus_args: { snap_to: true } }),
    ] },
  ] });
}

interface Grid {
  pool: string;
  rows: number;
  /** a row's card limit and width (in card widths) */
  row: (j: number) => { limit: number; w: number; h?: number; type?: any };
  /** the pool index of card i (1-based) of row j (1-based) on page p (0-based) */
  index: (i: number, j: number, p: number) => number;
  per_page: number;
  pages: (n: number) => number;
  materialize?: boolean;
  card_scale?: number;
  callback: string;
  pad?: number;
}

const GRIDS: Record<string, Grid> = {
  jokers: { pool: 'Joker', rows: 3, row: () => ({ limit: 5, w: 5, h: 0.95 }), index: (i, j, p) => i + (j - 1) * 5 + 15 * p, per_page: 15, pages: (n) => Math.ceil(n / 15), callback: 'your_collection_joker_page', pad: 0.07 },
  tarots: { pool: 'Tarot', rows: 2, row: (j) => ({ limit: 4 + j, w: 4.25 + j }), index: (i, j, p) => i + (j - 1) * 5 + 11 * p, per_page: 11, pages: (n) => Math.floor(n / 11), materialize: true, callback: 'your_collection_tarot_page' },
  boosters: { pool: 'Booster', rows: 2, row: () => ({ limit: 4, w: 5.25, h: 1.3 }), index: (i, j, p) => i + (j - 1) * 4 + 8 * p, per_page: 8, pages: (n) => Math.ceil(n / 8), materialize: true, card_scale: 1.27, callback: 'your_collection_booster_page' },
  spectrals: { pool: 'Spectral', rows: 2, row: (j) => ({ limit: 3 + j, w: 3.25 + j }), index: (i, j, p) => i + (j - 1) * 4 + 9 * p, per_page: 9, pages: (n) => Math.floor(n / 9), materialize: true, callback: 'your_collection_spectral_page' },
  vouchers: { pool: 'Voucher', rows: 2, row: () => ({ limit: 4, w: 4.25, type: 'voucher' }), index: (i, j, p) => i + (j - 1) * 4 + 8 * p, per_page: 8, pages: (n) => Math.ceil(n / 8), materialize: true, callback: 'your_collection_voucher_page' },
  planets: { pool: 'Planet', rows: 2, row: () => ({ limit: 6, w: 6.25 }), index: (i, j) => i + (j - 1) * 6, per_page: 12, pages: () => 0, materialize: true, callback: '' },
};

function fill_grid(g: Grid, page: number) {
  const pool = G.P_CENTER_POOLS[g.pool];
  const s = g.card_scale ?? 1;
  const order_rows_first = g.pool === 'Joker' || g.pool === 'Voucher';
  const place = (i: number, j: number) => {
    const center = pool[g.index(i, j, page) - 1];
    if (!center) return false;
    const area = G.your_collection[j - 1];
    const card: any = new Card(area.T.x + area.T.w / 2, area.T.y, G.CARD_W * s, G.CARD_H * s, null, center);
    if (g.pool === 'Voucher') card.ability.order = g.index(i, j, page);
    if (g.materialize) card.start_materialize(undefined, i > 1 || j > 1);
    area.emplace(card);
    return true;
  };
  if (order_rows_first) {
    for (let i = 1; i <= g.row(1).limit; i++) for (let j = 1; j <= g.rows; j++) if (!place(i, j)) break;
  } else {
    for (let j = 1; j <= g.rows; j++) for (let i = 1; i <= g.row(j).limit; i++) if (!place(i, j)) break;
  }
}

function grid_page(name: string) {
  const g = GRIDS[name];
  const deck_tables: any[] = [];
  G.your_collection = [];
  for (let j = 1; j <= g.rows; j++) {
    const r = g.row(j);
    const area = new CardArea(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, r.w * G.CARD_W, (r.h ?? 1) * G.CARD_H, { card_limit: r.limit, type: r.type ?? 'title', highlight_limit: 0, collection: true });
    G.your_collection.push(area);
    deck_tables.push({ n: G.UIT.R, config: { align: 'cm', padding: g.pad ?? 0, no_fill: true }, nodes: [{ n: G.UIT.O, config: { object: area } }] });
  }
  fill_grid(g, 0);
  const n = G.P_CENTER_POOLS[g.pool].length;
  const options: string[] = [];
  const pages = name === 'spectrals' ? Math.floor(G.P_CENTER_POOLS.Tarot.length / 9) : g.pages(n);
  for (let i = 1; i <= pages; i++) options.push(localize('k_page') + ' ' + i + '/' + (name === 'spectrals' ? Math.floor(n / 9) : g.pages(n)));
  const black = name === 'jokers'
    ? { n: G.UIT.R, config: { align: 'cm', r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: deck_tables }
    : { n: G.UIT.R, config: { align: 'cm', minw: 2.5, padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: deck_tables };
  return create_UIBox_generic_options({ back_func: 'your_collection', contents: [
    black,
    name === 'planets'
      ? { n: G.UIT.R, config: { align: 'cm', padding: 0.7 }, nodes: [] }
      : { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
        create_option_cycle({ options, w: 4.5, cycle_shoulders: true, opt_callback: g.callback, current_option: 1, colour: G.C.RED, no_pips: true, focus_args: { snap_to: true, nav: 'wide' } }),
      ] },
  ] });
}

function page_func(name: string) {
  return (args: any) => {
    if (!args || !args.cycle_config) return;
    for (const area of G.your_collection) {
      for (let i = area.cards.length - 1; i >= 0; i--) {
        const c = area.remove_card(area.cards[i]);
        c?.remove();
      }
    }
    fill_grid(GRIDS[name], args.cycle_config.current_option - 1);
  };
}

function single_row(cards: () => any[], limit: number, w: number, infotip = true, exit?: string) {
  G.your_collection = new CardArea(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, w * G.CARD_W, 1.03 * G.CARD_H, { card_limit: limit, type: 'title', highlight_limit: 0 });
  for (const c of cards()) G.your_collection.emplace(c);
  return create_UIBox_generic_options({ infotip: infotip ? localize('ml_edition_seal_enhancement_explanation') : undefined, back_func: exit ?? 'your_collection', snap_back: true, contents: [
    { n: G.UIT.R, config: { align: 'cm', minw: 2.5, padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0, no_fill: true }, nodes: [{ n: G.UIT.O, config: { object: G.your_collection } }] },
    ] },
  ] });
}

function collection_seals(exit?: string) {
  return single_row(() => G.P_CENTER_POOLS.Seal.map((v: any) => {
    const c: any = new Card(0, 0, G.CARD_W, G.CARD_H, G.P_CARDS.empty, G.P_CENTERS.c_base);
    c.set_seal(v.key, true);
    return c;
  }), 4, 4.25, true, exit);
}

function collection_enhancements(exit?: string) {
  const deck_tables: any[] = [];
  G.your_collection = [];
  for (let j = 1; j <= 2; j++) {
    const area = new CardArea(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, 4.25 * G.CARD_W, 1.03 * G.CARD_H, { card_limit: 4, type: 'title', highlight_limit: 0 });
    G.your_collection.push(area);
    deck_tables.push({ n: G.UIT.R, config: { align: 'cm', padding: 0, no_fill: true }, nodes: [{ n: G.UIT.O, config: { object: area } }] });
  }
  for (let i = 1; i <= 4; i++) {
    for (let j = 1; j <= 2; j++) {
      const center = G.P_CENTER_POOLS.Enhanced[i + (j - 1) * 4 - 1];
      const area = G.your_collection[j - 1];
      area.emplace(new Card(area.T.x + area.T.w / 2, area.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, center));
    }
  }
  return create_UIBox_generic_options({ infotip: localize('ml_edition_seal_enhancement_explanation'), back_func: exit ?? 'your_collection', snap_back: true, contents: [
    { n: G.UIT.R, config: { align: 'cm', minw: 2.5, padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: deck_tables },
  ] });
}

function collection_editions() {
  G.your_collection = [new CardArea(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, 5.3 * G.CARD_W, 1.03 * G.CARD_H, { card_limit: 5, type: 'title', highlight_limit: 0, collection: true })];
  const area = G.your_collection[0];
  for (const e of ['base', 'foil', 'holo', 'polychrome', 'negative']) {
    const card: any = new Card(area.T.x + area.T.w / 2, area.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, G.P_CENTERS['e_' + e]);
    card.start_materialize();
    if (G.P_CENTERS['e_' + e].discovered) card.set_edition({ [e]: true }, true, true);
    area.emplace(card);
  }
  return create_UIBox_generic_options({ infotip: localize('ml_edition_seal_enhancement_explanation'), back_func: 'your_collection', snap_back: true, contents: [
    { n: G.UIT.R, config: { align: 'cm', minw: 2.5, padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0, no_fill: true }, nodes: [{ n: G.UIT.O, config: { object: area } }] },
    ] },
  ] });
}

function collection_decks() {
  G.GAME.viewed_back = new Back(G.P_CENTERS.b_red);
  const area = new CardArea(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, 1.2 * G.CARD_W, 1.2 * G.CARD_H, { card_limit: 52, type: 'deck', highlight_limit: 0 });
  for (let i = 1; i <= 52; i++) {
    const card: any = new Card(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, G.CARD_W * 1.2, G.CARD_H * 1.2, pseudorandom_element(G.P_CARDS)[0], G.P_CENTERS.c_base, { playing_card: i, viewed_back: true });
    card.sprite_facing = 'back';
    card.facing = 'back';
    area.emplace(card);
    if (i === 52) G.sticker_card = card;
  }
  const ordered_names = G.P_CENTER_POOLS.Back.map((v: any) => v.name);
  return create_UIBox_generic_options({ back_func: 'your_collection', contents: [
    create_option_cycle({ options: ordered_names, opt_callback: 'change_viewed_back', current_option: 1, colour: G.C.RED, w: 4.5, focus_args: { snap_to: true }, mid:
      { n: G.UIT.R, config: { align: 'cm', minw: 2.5, padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0.2, colour: G.C.BLACK, r: 0.2 }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', padding: 0 }, nodes: [{ n: G.UIT.O, config: { object: area } }] },
          { n: G.UIT.C, config: { align: 'tm', minw: 3.7, minh: 2.1, r: 0.1, colour: G.C.L_BLACK, padding: 0.1 }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', emboss: 0.1, r: 0.1, minw: 4, maxw: 4, minh: 0.6 }, nodes: [
              { n: G.UIT.O, config: { id: null, func: 'RUN_SETUP_check_back_name', object: new Moveable() } },
            ] },
            { n: G.UIT.R, config: { align: 'cm', colour: G.C.WHITE, emboss: 0.1, minh: 2.2, r: 0.1 }, nodes: [
              { n: G.UIT.O, config: { id: G.GAME.viewed_back.name, func: 'RUN_SETUP_check_back', object: new UIBox({ definition: G.GAME.viewed_back.generate_UI(), config: { offset: { x: 0, y: 0 } } }) } },
            ] },
          ] },
        ] },
      ] } }),
  ] });
}

function collection_tags() {
  const tag_matrix: any[][] = [[], [], [], []];
  const tags = Object.keys(G.P_TAGS).map((k) => G.P_TAGS[k]).sort((a: any, b: any) => a.order - b.order);
  tags.forEach((v: any, k: number) => {
    const t = new Tag(v.key, true);
    if (!v.discovered) t.hide_ability = true;
    const [ui] = t.generate_UI();
    tag_matrix[Math.ceil(k / 6 + 0.001) - 1][k % 6] = { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [ui] };
  });
  return create_UIBox_generic_options({ back_func: 'your_collection', contents: [
    { n: G.UIT.C, config: { align: 'cm', r: 0.1, colour: G.C.BLACK, padding: 0.1, emboss: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [
        { n: G.UIT.R, config: { align: 'cm' }, nodes: tag_matrix.map((row) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: row })) },
      ] },
    ] },
  ] });
}

export function create_UIBox_blind_popup(blind: any, discovered: boolean, vars?: any) {
  const blind_text: any[] = [];
  const _dollars = blind.dollars;
  const loc_target: string[] = localize({ type: 'raw_descriptions', key: blind.key, set: 'Blind', vars: vars ?? blind.vars }) ?? [];
  const loc_name = localize({ type: 'name_text', key: blind.key, set: 'Blind' });
  if (discovered) {
    const ability_text = loc_target.map((v, k) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.T, config: { text: (k === 0 && blind.name === 'The Wheel' ? '1' : '') + v, scale: 0.35, shadow: true, colour: G.C.WHITE } },
    ] }));
    blind_text.push({ n: G.UIT.R, config: { align: 'cm', emboss: 0.05, r: 0.1, minw: 2.5, padding: 0.07, colour: G.C.WHITE }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', maxw: 2.4 }, nodes: [{ n: G.UIT.T, config: { text: localize('ph_blind_score_at_least'), scale: 0.35, colour: G.C.UI.TEXT_DARK } }] },
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.O, config: { object: get_stake_sprite(G.GAME.stake || 1, 0.4) } },
        { n: G.UIT.T, config: { text: blind.mult + localize('k_x_base'), scale: 0.4, colour: G.C.RED } },
      ] },
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.T, config: { text: localize('ph_blind_reward'), scale: 0.35, colour: G.C.UI.TEXT_DARK } },
        { n: G.UIT.O, config: { object: new DynaText({ string: [_dollars ? localize('$').repeat(_dollars) : '-'], colours: [G.C.MONEY], rotate: true, bump: true, silent: true, scale: 0.45 }) } },
      ] },
      ability_text[0] ? { n: G.UIT.R, config: { align: 'cm', padding: 0.08, colour: mix_colours(blind.boss_colour ?? G.C.GREY, G.C.GREY, 0.4), r: 0.1, emboss: 0.05, minw: 2.5, minh: 0.9 }, nodes: ability_text } : null,
    ] });
  } else {
    blind_text.push({ n: G.UIT.R, config: { align: 'cm', emboss: 0.05, r: 0.1, minw: 2.5, padding: 0.1, colour: G.C.WHITE }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: localize('ph_defeat_this_blind_1'), scale: 0.4, colour: G.C.UI.TEXT_DARK } }] },
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: localize('ph_defeat_this_blind_2'), scale: 0.4, colour: G.C.UI.TEXT_DARK } }] },
    ] });
  }
  return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.05, colour: lighten(G.C.JOKER_GREY, 0.5), r: 0.1, emboss: 0.05 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', emboss: 0.05, r: 0.1, minw: 2.5, padding: 0.1, colour: !discovered ? G.C.JOKER_GREY : blind.boss_colour ?? G.C.GREY }, nodes: [
      { n: G.UIT.O, config: { object: new DynaText({ string: discovered ? loc_name : localize('k_not_discovered'), colours: [G.C.UI.TEXT_LIGHT], shadow: true, rotate: !discovered, spacing: discovered ? 2 : 0, bump: true, scale: 0.4 }) } },
    ] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: blind_text },
  ] };
}

function collection_blinds(exit?: string) {
  const blind_matrix: any[][] = [[], [], [], [], [], []];
  const blinds = Object.keys(G.P_BLINDS).map((k) => G.P_BLINDS[k]).sort((a: any, b: any) => a.order - b.order);
  blinds.forEach((v: any, idx: number) => {
    const k = idx + 1;
    const discovered = !!v.discovered;
    const temp_blind: any = new AnimatedSprite(0, 0, 1.3, 1.3, G.ANIMATION_ATLAS.blind_chips, discovered ? v.pos : G.b_undiscovered.pos);
    temp_blind.define_draw_steps([{ shader: 'dissolve', shadow_height: 0.05 }, { shader: 'dissolve' }]);
    if (k === 1) G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { G.CONTROLLER.snap_to?.({ node: temp_blind }); return true; } }));
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
          temp_blind.config.h_popup = create_UIBox_blind_popup(v, discovered);
          temp_blind.config.h_popup_config = { align: 'cl', offset: { x: -0.1, y: 0 }, parent: temp_blind };
          Node.prototype.hover.call(temp_blind);
        }
      }
      temp_blind.stop_hover = () => { temp_blind.hovering = false; Node.prototype.stop_hover.call(temp_blind); temp_blind.hover_tilt = 0; };
    };
    blind_matrix[Math.ceil((k - 1) / 5 + 0.001) - 1][(k - 1) % 5] = { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [
      (k === 6 || k === 16 || k === 26) ? { n: G.UIT.B, config: { h: 0.2, w: 0.5 } } : null,
      { n: G.UIT.O, config: { object: temp_blind, focus_with_object: true } },
      (k === 5 || k === 15 || k === 25) ? { n: G.UIT.B, config: { h: 0.2, w: 0.5 } } : null,
    ] };
  });
  const furthest = profile().high_scores.furthest_ante.amt;
  const ante_amounts: any[] = [];
  for (let i = 1; i <= Math.min(16, Math.max(16, furthest)); i++) {
    const spacing = 1 - Math.min(20, Math.max(15, furthest)) * 0.06;
    if (spacing > 0 && i > 1) ante_amounts.push({ n: G.UIT.R, config: { minh: spacing }, nodes: [] });
    const blind_chip = new Sprite(0, 0, 0.2, 0.2, G.ASSET_ATLAS['ui_' + (G.SETTINGS.colourblind_option ? 2 : 1)], { x: 0, y: 0 });
    blind_chip.states.drag.can = false;
    ante_amounts.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minw: 0.7 }, nodes: [{ n: G.UIT.T, config: { text: i, scale: 0.4, colour: G.C.FILTER, shadow: true } }] },
      { n: G.UIT.C, config: { align: 'cr', minw: 2.8 }, nodes: [
        { n: G.UIT.O, config: { object: blind_chip } },
        { n: G.UIT.C, config: { align: 'cm', minw: 0.03, minh: 0.01 }, nodes: [] },
        { n: G.UIT.T, config: { text: number_format(get_blind_amount(i)), scale: 0.4, colour: i <= furthest ? G.C.RED : G.C.JOKER_GREY, shadow: true } },
      ] },
    ] });
  }
  return create_UIBox_generic_options({ back_func: exit ?? 'your_collection', contents: [
    { n: G.UIT.C, config: { align: 'cm', r: 0.1, colour: G.C.BLACK, padding: 0.1, emboss: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', r: 0.1, colour: G.C.L_BLACK, padding: 0.1, force_focus: true, focus_args: { nav: 'tall' } }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', minw: 0.7 }, nodes: [{ n: G.UIT.T, config: { text: localize('k_ante_cap'), scale: 0.4, colour: lighten(G.C.FILTER, 0.2), shadow: true } }] },
          { n: G.UIT.C, config: { align: 'cr', minw: 2.8 }, nodes: [{ n: G.UIT.T, config: { text: localize('k_base_cap'), scale: 0.4, colour: lighten(G.C.RED, 0.2), shadow: true } }] },
        ] },
        { n: G.UIT.R, config: { align: 'cm' }, nodes: ante_amounts },
      ] },
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [
        { n: G.UIT.R, config: { align: 'cm' }, nodes: blind_matrix.map((row) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: row })) },
      ] },
    ] },
  ] });
}

export function register_collection_funcs() {
  G.UIDEF.blind_popup = create_UIBox_blind_popup;
  const open = (def: () => any) => () => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: def() });
  };
  G.FUNCS.your_collection = open(create_UIBox_your_collection);
  G.FUNCS.your_collection_jokers = open(() => grid_page('jokers'));
  G.FUNCS.your_collection_tarots = open(() => grid_page('tarots'));
  G.FUNCS.your_collection_planets = open(() => grid_page('planets'));
  G.FUNCS.your_collection_spectrals = open(() => grid_page('spectrals'));
  G.FUNCS.your_collection_vouchers = open(() => grid_page('vouchers'));
  G.FUNCS.your_collection_boosters = open(() => grid_page('boosters'));
  G.FUNCS.your_collection_enhancements = open(() => collection_enhancements());
  G.FUNCS.your_collection_seals = open(() => collection_seals());
  G.FUNCS.your_collection_editions = open(collection_editions);
  G.FUNCS.your_collection_decks = open(collection_decks);
  G.FUNCS.your_collection_tags = open(collection_tags);
  G.FUNCS.your_collection_blinds = open(() => collection_blinds());
  G.FUNCS.your_collection_joker_page = page_func('jokers');
  G.FUNCS.your_collection_tarot_page = page_func('tarots');
  G.FUNCS.your_collection_spectral_page = page_func('spectrals');
  G.FUNCS.your_collection_booster_page = page_func('boosters');
  G.FUNCS.your_collection_voucher_page = page_func('vouchers');
}
