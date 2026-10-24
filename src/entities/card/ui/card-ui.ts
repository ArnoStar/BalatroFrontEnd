// A card's description popup: Card:generate_UIBox_ability_table (card.lua),
// generate_card_ui (common_events.lua) and the popup layout (G.UIDEF.card_h_popup,
// desc/info/name rows, badges) from UI_definitions.lua.
import { G, DynaText, Moveable, mix_colours, lighten, darken, adjust_alpha, tostring } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { desc_from_rows, info_tip_from_rows, name_from_rows, create_badge, get_badge_colour } from '@/shared/ui';
import type { Def } from '@/shared/ui';

const prob = () => '' + tostring(G.GAME?.probabilities?.normal ?? 1);

/** Card:generate_UIBox_ability_table */
export function generate_UIBox_ability_table(card: any) {
  let card_type = card.ability.set ?? 'None';
  let hide_desc: boolean | null = null;
  let loc_vars: any = null;
  let main_start: any = null, main_end: any = null;
  let no_badge: boolean | null = null;
  const a = card.ability;
  const center = card.config.center;
  if (!card.bypass_lock && center.unlocked !== false &&
    (a.set === 'Joker' || a.set === 'Edition' || a.consumeable || a.set === 'Voucher' || a.set === 'Booster') &&
    !center.discovered && ((card.area !== G.jokers && card.area !== G.consumeables && card.area) || !card.area)) {
    card_type = 'Undiscovered';
  }
  if (center.unlocked === false && !card.bypass_lock) {
    card_type = 'Locked';
    if (card.area && card.area === G.shop_demo) { loc_vars = []; no_badge = true; }
  } else if (card_type === 'Undiscovered' && !card.bypass_discovery_ui) {
    hide_desc = true;
  } else if (card.debuff) {
    loc_vars = withProps([], { debuffed: true, playing_card: !!card.base.colour, value: card.base.value, suit: card.base.suit, colour: card.base.colour });
  } else if (card_type === 'Default' || card_type === 'Enhanced') {
    const bonus = a.bonus + (a.perma_bonus ?? 0);
    loc_vars = withProps([], {
      playing_card: !!card.base.colour, value: card.base.value, suit: card.base.suit, colour: card.base.colour,
      nominal_chips: card.base.nominal > 0 ? card.base.nominal : null,
      bonus_chips: bonus > 0 ? bonus : null,
    });
  } else if (a.set === 'Joker') {
    const r = joker_loc_vars(card);
    loc_vars = r.loc_vars;
    if (r.main_start) main_start = r.main_start;
    if (r.main_end !== undefined) main_end = r.main_end;
  }
  const badges: any = [];
  if ((card_type !== 'Locked' && card_type !== 'Undiscovered' && card_type !== 'Default') || card.debuff) badges.card_type = card_type;
  if (a.set === 'Joker' && card.bypass_discovery_ui && !no_badge) badges.force_rarity = true;
  if (card.edition) {
    if (card.edition.type === 'negative' && a.consumeable) badges.push('negative_consumable');
    else badges.push(card.edition.type === 'holo' ? 'holographic' : card.edition.type);
  }
  if (card.seal) badges.push(card.seal.toLowerCase() + '_seal');
  if (a.eternal) badges.push('eternal');
  if (a.perishable) {
    loc_vars = loc_vars ?? [];
    loc_vars.perish_tally = a.perish_tally;
    badges.push('perishable');
  }
  if (a.rental) badges.push('rental');
  if (card.pinned) badges.push('pinned_left');
  if (card.sticker || (card.sticker_run && card.sticker_run !== 'NONE' && G.SETTINGS.run_stake_stickers)) {
    loc_vars = loc_vars ?? [];
    loc_vars.sticker = card.sticker ?? card.sticker_run;
  }
  return generate_card_ui(center, null, loc_vars, card_type, badges, hide_desc, main_start, main_end);
}

function withProps(arr: any[], props: any) { return Object.assign(arr, props); }

function joker_loc_vars(card: any): { loc_vars: any; main_start?: any; main_end?: any } {
  const a = card.ability, n = a.name, x = a.extra;
  const ph = (k: string) => localize(k, 'poker_hands');
  const cr = G.GAME?.current_round ?? {};
  const blueprint_end = () => {
    a.blueprint_compat_ui = a.blueprint_compat_ui ?? '';
    a.blueprint_compat_check = null;
    return (card.area && card.area === G.jokers) ? [
      { n: G.UIT.C, config: { align: 'bm', minh: 0.4 }, nodes: [
        { n: G.UIT.C, config: { ref_table: card, align: 'm', colour: G.C.JOKER_GREY, r: 0.05, padding: 0.06, func: 'blueprint_compat' }, nodes: [
          { n: G.UIT.T, config: { ref_table: a, ref_value: 'blueprint_compat_ui', colour: G.C.UI.TEXT_LIGHT, scale: 0.32 * 0.8 } },
        ] },
      ] },
    ] : null;
  };
  switch (n) {
    case 'Joker': return { loc_vars: [a.mult] };
    case 'Jolly Joker': case 'Zany Joker': case 'Mad Joker': case 'Crazy Joker': case 'Droll Joker':
      return { loc_vars: [a.t_mult, ph(a.type)] };
    case 'Sly Joker': case 'Wily Joker': case 'Clever Joker': case 'Devious Joker': case 'Crafty Joker':
      return { loc_vars: [a.t_chips, ph(a.type)] };
    case 'Half Joker': return { loc_vars: [x.mult, x.size] };
    case 'Fortune Teller': return { loc_vars: [x, G.GAME?.consumeable_usage_total?.tarot ?? 0] };
    case 'Steel Joker': return { loc_vars: [x, 1 + x * (a.steel_tally ?? 0)] };
    case 'Chaos the Clown': return { loc_vars: [x] };
    case 'Space Joker': return { loc_vars: [prob(), x] };
    case 'Stone Joker': return { loc_vars: [x, x * (a.stone_tally ?? 0)] };
    case 'Drunkard': return { loc_vars: [a.d_size] };
    case 'Green Joker': return { loc_vars: [x.hand_add, x.discard_sub, a.mult] };
    case 'Credit Card': return { loc_vars: [x] };
    case 'Greedy Joker': case 'Lusty Joker': case 'Wrathful Joker': case 'Gluttonous Joker':
      return { loc_vars: [x.s_mult, localize(x.suit, 'suits_singular')] };
    case 'Blue Joker': return { loc_vars: [x, x * (G.deck?.cards ? G.deck.cards.length : 52)] };
    case 'Sixth Sense': return { loc_vars: [] };
    case 'Hack': return { loc_vars: [x + 1] };
    case 'Faceless Joker': return { loc_vars: [x.dollars, x.faces] };
    case 'Juggler': return { loc_vars: [a.h_size] };
    case 'Golden Joker': return { loc_vars: [x] };
    case 'Joker Stencil': return { loc_vars: [a.x_mult] };
    case 'Ceremonial Dagger': return { loc_vars: [a.mult] };
    case 'Banner': return { loc_vars: [x] };
    case 'Misprint': {
      const r_mults: string[] = [];
      for (let i = x.min; i <= x.max; i++) r_mults.push(tostring(i));
      const loc_mult = ' ' + localize('k_mult') + ' ';
      const last = G.deck?.cards?.[0] ? G.deck.cards[G.deck.cards.length - 1] : null;
      return {
        loc_vars: null,
        main_start: [
          { n: G.UIT.T, config: { text: '  +', colour: G.C.MULT, scale: 0.32 } },
          { n: G.UIT.O, config: { object: new DynaText({ string: r_mults, colours: [G.C.RED], pop_in_rate: 9999999, silent: true, random_element: true, pop_delay: 0.5, scale: 0.32, min_cycle_time: 0 }) } },
          { n: G.UIT.O, config: { object: new DynaText({
            string: [
              { string: 'rand()', colour: G.C.JOKER_GREY },
              { string: '#@' + (last ? last.base.id : 11) + (last ? String(last.base.suit).charAt(0) : 'D'), colour: G.C.RED },
              ...Array(13).fill(loc_mult),
            ],
            colours: [G.C.UI.TEXT_DARK], pop_in_rate: 9999999, silent: true, random_element: true, pop_delay: 0.2011, scale: 0.32, min_cycle_time: 0,
          }) } },
        ],
      };
    }
    case 'Mystic Summit': return { loc_vars: [x.mult, x.d_remaining] };
    case 'Loyalty Card':
      return { loc_vars: [x.Xmult, x.every + 1, localize({ type: 'variable', key: a.loyalty_remaining === 0 ? 'loyalty_active' : 'loyalty_inactive', vars: [a.loyalty_remaining] })] };
    case '8 Ball': return { loc_vars: [prob(), x] };
    case 'Dusk': return { loc_vars: [x + 1] };
    case 'Fibonacci': case 'Scary Face': case 'Delayed Gratification': case 'Even Steven': case 'Odd Todd': case 'Superposition':
    case 'Egg': case 'Burglar': case 'DNA': case 'Hiker': case 'Astronomer': case 'Golden Ticket': case 'Acrobat':
    case 'Certificate': case 'Hanging Chad': case 'Rough Gem': case 'Arrowhead': case 'Onyx Agate': case 'Flower Pot':
    case 'Seeing Double': case 'Matador': case 'Riff-raff': case 'Vagabond': case 'Baron': case 'Photograph': case 'Gift Card':
    case 'To the Moon': case 'Baseball Card': case 'Trading Card': case 'Seltzer': case 'Smiley Face': case 'Shoot the Moon':
    case 'Triboulet': case 'Perkeo':
      return { loc_vars: [x] };
    case 'Abstract Joker': return { loc_vars: [x, (G.jokers?.cards ? G.jokers.cards.length : 0) * x] };
    case 'Gros Michel': return { loc_vars: [x.mult, prob(), x.odds] };
    case 'Scholar': return { loc_vars: [x.mult, x.chips] };
    case 'Business Card': return { loc_vars: [prob(), x] };
    case 'Spare Trousers': return { loc_vars: [x, ph('Two Pair'), a.mult] };
    case 'Ride the Bus': return { loc_vars: [x, a.mult] };
    case 'Blackboard': return { loc_vars: [x, localize('Spades', 'suits_plural'), localize('Clubs', 'suits_plural')] };
    case 'Runner': case 'Ice Cream': case 'Wee Joker': case 'Square Joker': return { loc_vars: [x.chips, x.chip_mod] };
    case 'Constellation': case 'Throwback': case 'Glass Joker': case 'Hit the Road': case 'Madness': case 'Vampire':
    case 'Hologram': case 'Obelisk': case 'Lucky Cat': case 'Campfire':
      return { loc_vars: [x, a.x_mult] };
    case 'To Do List': return { loc_vars: [x.dollars, ph(a.to_do_poker_hand)] };
    case 'Blueprint': case 'Brainstorm': return { loc_vars: null, main_end: blueprint_end() };
    case 'Sock and Buskin': return { loc_vars: [x + 1] };
    case 'Swashbuckler': return { loc_vars: [a.mult] };
    case 'Troubadour': return { loc_vars: [x.h_size, -x.h_plays] };
    case 'Bloodstone': return { loc_vars: [prob(), x.odds, x.Xmult] };
    case 'Merry Andy': return { loc_vars: [a.d_size, a.h_size] };
    case 'The Idol':
      return { loc_vars: withProps([x, localize(cr.idol_card?.rank, 'ranks'), localize(cr.idol_card?.suit, 'suits_plural')], { colours: [G.C.SUITS[cr.idol_card?.suit]] }) };
    case 'The Duo': case 'The Trio': case 'The Family': case 'The Order': case 'The Tribe':
      return { loc_vars: [a.x_mult, ph(a.type)] };
    case 'Cavendish': return { loc_vars: [x.Xmult, prob(), x.odds] };
    case 'Card Sharp': return { loc_vars: [x.Xmult] };
    case 'Red Card': return { loc_vars: [x, a.mult] };
    case 'Seance': return { loc_vars: [ph(x.poker_hand)] };
    case 'Cloud 9': return { loc_vars: [x, x * (a.nine_tally ?? 0)] };
    case 'Rocket': return { loc_vars: [x.dollars, x.increase] };
    case 'Luchador': {
      const has_message = G.GAME && card.area && card.area === G.jokers;
      if (has_message) {
        const disableable = G.GAME.blind && !G.GAME.blind.disabled && G.GAME.blind.get_type?.() === 'Boss';
        return { loc_vars: null, main_end: [
          { n: G.UIT.C, config: { align: 'bm', minh: 0.4 }, nodes: [
            { n: G.UIT.C, config: { ref_table: card, align: 'm', colour: disableable ? G.C.GREEN : G.C.RED, r: 0.05, padding: 0.06 }, nodes: [
              { n: G.UIT.T, config: { text: ' ' + localize(disableable ? 'k_active' : 'ph_no_boss_active') + ' ', colour: G.C.UI.TEXT_LIGHT, scale: 0.32 * 0.9 } },
            ] },
          ] },
        ] };
      }
      return { loc_vars: null };
    }
    case 'Turtle Bean': return { loc_vars: [x.h_size, x.h_mod] };
    case 'Erosion': {
      const pcs = G.playing_cards ? G.playing_cards.length : null;
      return { loc_vars: [x, Math.max(0, x * (pcs !== null ? (G.GAME.starting_deck_size - pcs) : 0)), G.GAME.starting_deck_size] };
    }
    case 'Reserved Parking': return { loc_vars: [x.dollars, prob(), x.odds] };
    case 'Mail-In Rebate': return { loc_vars: [x, localize(cr.mail_card?.rank, 'ranks')] };
    case 'Hallucination': return { loc_vars: [G.GAME.probabilities.normal, x] };
    case 'Bull': return { loc_vars: [x, x * Math.max(0, G.GAME.dollars)] };
    case 'Diet Cola': return { loc_vars: [localize({ type: 'name_text', set: 'Tag', key: 'tag_double', nodes: [] })] };
    case 'Flash Card': return { loc_vars: [x, a.mult] };
    case 'Popcorn': return { loc_vars: [a.mult, x] };
    case 'Ramen': return { loc_vars: [a.x_mult, x] };
    case 'Ancient Joker':
      return { loc_vars: withProps([x, localize(cr.ancient_card?.suit, 'suits_singular')], { colours: [G.C.SUITS[cr.ancient_card?.suit]] }) };
    case 'Walkie Talkie': return { loc_vars: [x.chips, x.mult] };
    case 'Castle':
      return { loc_vars: withProps([x.chip_mod, localize(cr.castle_card?.suit, 'suits_singular'), x.chips], { colours: [G.C.SUITS[cr.castle_card?.suit]] }) };
    case 'Stuntman': return { loc_vars: [x.chip_mod, x.h_size] };
    case 'Invisible Joker': return { loc_vars: [x, a.invis_rounds] };
    case 'Satellite': {
      let planets_used = 0;
      for (const v of Object.values<any>(G.GAME?.consumeable_usage ?? {})) if (v.set === 'Planet') planets_used++;
      return { loc_vars: [x, planets_used * x] };
    }
    case "Driver's License": return { loc_vars: [x, a.driver_tally ?? '0'] };
    case 'Bootstraps': return { loc_vars: [x.mult, x.dollars, x.mult * Math.floor((G.GAME.dollars + (G.GAME.dollar_buffer ?? 0)) / x.dollars)] };
    case 'Caino': return { loc_vars: [x, a.caino_xmult] };
    case 'Yorick': return { loc_vars: [x.xmult, x.discards, a.yorick_discards, a.x_mult] };
    default: return { loc_vars: null };
  }
}

export function get_type_colour(_c: any, card?: any) {
  return ((_c.unlocked === false && !(card && card.bypass_lock)) && G.C.BLACK) ||
    (card && card.debuff && mix_colours(G.C.RED, G.C.GREY, 0.7)) ||
    (_c.set === 'Joker' && G.C.RARITY[_c.rarity]) ||
    (_c.set === 'Edition' && G.C.DARK_EDITION) ||
    (_c.set === 'Booster' && G.C.BOOSTER) ||
    G.C.SECONDARY_SET[_c.set] ||
    [0, 1, 1, 1];
}

const ENH_CONV = (_c: any) => [_c.config.max_highlighted, localize({ type: 'name_text', set: 'Enhanced', key: _c.config.mod_conv })];

/** generate_card_ui: the name, description and info boxes of a center */
export function generate_card_ui(_c: any, full_UI_table: any, specific_vars?: any, card_type?: string, badges?: any,
  hide_desc?: boolean | null, main_start?: any, main_end?: any) {
  let first_pass = false;
  if (!full_UI_table) {
    first_pass = true;
    full_UI_table = { main: [], info: [], type: {}, name: null, badges: badges ?? [] };
  }
  let desc_nodes = (!full_UI_table.name && full_UI_table.main) || full_UI_table.info;
  let name_override: string | null = null;
  const info_queue: any[] = [];
  if (full_UI_table.name) {
    full_UI_table.info.push([]);
    desc_nodes = full_UI_table.info[full_UI_table.info.length - 1];
  }
  if (!full_UI_table.name) {
    if (specific_vars && specific_vars.no_name) {
      full_UI_table.name = true;
    } else if (card_type === 'Locked') {
      full_UI_table.name = localize({ type: 'name', set: 'Other', key: 'locked', nodes: [] });
    } else if (card_type === 'Undiscovered') {
      full_UI_table.name = localize({ type: 'name', set: 'Other', key: 'undiscovered_' + String(_c.set).toLowerCase(), name_nodes: [] });
    } else if (specific_vars && (card_type === 'Default' || card_type === 'Enhanced')) {
      if (_c.name === 'Stone Card') full_UI_table.name = true;
      if (specific_vars.playing_card && _c.name !== 'Stone Card') {
        const nodes: any[] = [];
        localize({ type: 'other', key: 'playing_card', set: 'Other', nodes, vars: withProps([localize(specific_vars.value, 'ranks'), localize(specific_vars.suit, 'suits_plural')], { colours: [specific_vars.colour] }) });
        full_UI_table.name = nodes[0];
      }
    } else if (card_type === 'Booster') {
      // named below
    } else {
      full_UI_table.name = localize({ type: 'name', set: _c.set, key: _c.key, nodes: full_UI_table.name });
    }
    full_UI_table.card_type = card_type ?? _c.set;
  }
  let loc_vars: any = [];
  if (main_start) desc_nodes.push(main_start);

  if (_c.set === 'Other') {
    localize({ type: 'other', key: _c.key, nodes: desc_nodes, vars: specific_vars ?? _c.vars });
  } else if (card_type === 'Locked') {
    localize({ type: 'unlocks', key: _c.key, set: _c.set, nodes: desc_nodes, vars: loc_vars });
  } else if (hide_desc) {
    localize({ type: 'other', key: 'undiscovered_' + String(_c.set).toLowerCase(), set: _c.set, nodes: desc_nodes });
  } else if (specific_vars && specific_vars.debuffed) {
    localize({ type: 'other', key: 'debuffed_' + (specific_vars.playing_card ? 'playing_card' : 'default'), nodes: desc_nodes });
  } else if (_c.set === 'Joker') {
    const nm = _c.name;
    if (nm === 'Stone Joker' || nm === 'Marble Joker') info_queue.push(G.P_CENTERS.m_stone);
    else if (nm === 'Steel Joker') info_queue.push(G.P_CENTERS.m_steel);
    else if (nm === 'Glass Joker') info_queue.push(G.P_CENTERS.m_glass);
    else if (nm === 'Golden Ticket' || nm === 'Midas Mask') info_queue.push(G.P_CENTERS.m_gold);
    else if (nm === 'Lucky Cat') info_queue.push(G.P_CENTERS.m_lucky);
    else if (nm === 'Invisible Joker') {
      for (const v of G.jokers?.cards ?? []) {
        if (v.edition && v.edition.negative && G.localization.descriptions.Other.remove_negative) {
          const me: any[] = [];
          localize({ type: 'other', key: 'remove_negative', nodes: me, vars: [] });
          main_end = me[0];
          break;
        }
      }
    } else if (nm === 'Diet Cola') info_queue.push({ key: 'tag_double', set: 'Tag' });
    else if (nm === 'Perkeo') info_queue.push({ key: 'e_negative_consumable', set: 'Edition', config: { extra: 1 } });
    if (specific_vars && specific_vars.pinned) info_queue.push({ key: 'pinned_left', set: 'Other' });
    if (specific_vars && specific_vars.sticker) info_queue.push({ key: String(specific_vars.sticker).toLowerCase() + '_sticker', set: 'Other' });
    localize({ type: 'descriptions', key: _c.key, set: _c.set, nodes: desc_nodes, vars: specific_vars ?? [] });
  } else if (_c.set === 'Tag') {
    const tq: Record<string, string> = {
      'Negative Tag': 'e_negative', 'Foil Tag': 'e_foil', 'Holographic Tag': 'e_holo', 'Polychrome Tag': 'e_polychrome',
      'Charm Tag': 'p_arcana_mega_1', 'Meteor Tag': 'p_celestial_mega_1', 'Ethereal Tag': 'p_spectral_normal_1',
      'Standard Tag': 'p_standard_mega_1', 'Buffoon Tag': 'p_buffoon_mega_1',
    };
    if (tq[_c.name]) info_queue.push(G.P_CENTERS[tq[_c.name]]);
    localize({ type: 'descriptions', key: _c.key, set: 'Tag', nodes: desc_nodes, vars: specific_vars ?? [] });
  } else if (_c.set === 'Voucher') {
    const nm = _c.name;
    if (['Tarot Merchant', 'Tarot Tycoon', 'Planet Merchant', 'Planet Tycoon'].includes(nm)) loc_vars = [_c.config.extra_disp];
    else if (['Seed Money', 'Money Tree'].includes(nm)) loc_vars = [_c.config.extra / 5];
    else if (['Hone', 'Glow Up', 'Reroll Surplus', 'Reroll Glut', 'Grabber', 'Nacho Tong', 'Wasteful', 'Recyclomancy', 'Hieroglyph', 'Petroglyph',
      "Director's Cut", 'Retcon', 'Paint Brush', 'Palette', 'Telescope', 'Observatory', 'Clearance Sale', 'Liquidation'].includes(nm)) loc_vars = [_c.config.extra];
    localize({ type: 'descriptions', key: _c.key, set: _c.set, nodes: desc_nodes, vars: loc_vars });
  } else if (_c.set === 'Edition') {
    loc_vars = [_c.config.extra];
    localize({ type: 'descriptions', key: _c.key, set: _c.set, nodes: desc_nodes, vars: loc_vars });
  } else if (_c.set === 'Default' && specific_vars) {
    if (specific_vars.nominal_chips) localize({ type: 'other', key: 'card_chips', nodes: desc_nodes, vars: [specific_vars.nominal_chips] });
    if (specific_vars.bonus_chips) localize({ type: 'other', key: 'card_extra_chips', nodes: desc_nodes, vars: [specific_vars.bonus_chips] });
  } else if (_c.set === 'Enhanced') {
    if (specific_vars && _c.name !== 'Stone Card' && specific_vars.nominal_chips) {
      localize({ type: 'other', key: 'card_chips', nodes: desc_nodes, vars: [specific_vars.nominal_chips] });
    }
    const e = _c.effect;
    const p = G.GAME?.probabilities?.normal ?? 1;
    if (e === 'Mult Card') loc_vars = [_c.config.mult];
    else if (e === 'Glass Card') loc_vars = [_c.config.Xmult, p, _c.config.extra];
    else if (e === 'Steel Card') loc_vars = [_c.config.h_x_mult];
    else if (e === 'Stone Card') loc_vars = [(specific_vars && specific_vars.bonus_chips) || _c.config.bonus];
    else if (e === 'Gold Card') loc_vars = [_c.config.h_dollars];
    else if (e === 'Lucky Card') loc_vars = [p, _c.config.mult, 5, _c.config.p_dollars, 15];
    localize({ type: 'descriptions', key: _c.key, set: _c.set, nodes: desc_nodes, vars: loc_vars });
    if (_c.name !== 'Stone Card' && ((specific_vars && specific_vars.bonus_chips) || _c.config.bonus)) {
      localize({ type: 'other', key: 'card_extra_chips', nodes: desc_nodes, vars: [(specific_vars && specific_vars.bonus_chips) || _c.config.bonus] });
    }
  } else if (_c.set === 'Booster') {
    const map: Record<string, string> = {
      'Arcana Pack': 'p_arcana_normal', 'Jumbo Arcana Pack': 'p_arcana_jumbo', 'Mega Arcana Pack': 'p_arcana_mega',
      'Celestial Pack': 'p_celestial_normal', 'Jumbo Celestial Pack': 'p_celestial_jumbo', 'Mega Celestial Pack': 'p_celestial_mega',
      'Spectral Pack': 'p_spectral_normal', 'Jumbo Spectral Pack': 'p_spectral_jumbo', 'Mega Spectral Pack': 'p_spectral_mega',
      'Standard Pack': 'p_standard_normal', 'Jumbo Standard Pack': 'p_standard_jumbo', 'Mega Standard Pack': 'p_standard_mega',
      'Buffoon Pack': 'p_buffoon_normal', 'Jumbo Buffoon Pack': 'p_buffoon_jumbo', 'Mega Buffoon Pack': 'p_buffoon_mega',
    };
    const desc_override = map[_c.name] ?? 'p_arcana_normal';
    if (map[_c.name]) loc_vars = [_c.config.choose, _c.config.extra];
    name_override = desc_override;
    if (!full_UI_table.name) full_UI_table.name = localize({ type: 'name', set: 'Other', key: name_override, nodes: full_UI_table.name });
    localize({ type: 'other', key: desc_override, nodes: desc_nodes, vars: loc_vars });
  } else if (_c.set === 'Spectral') {
    const nm = _c.name;
    if (nm === 'Familiar' || nm === 'Grim' || nm === 'Incantation') loc_vars = [_c.config.extra];
    else if (nm === 'Immolate') loc_vars = [_c.config.extra.destroy, _c.config.extra.dollars];
    else if (nm === 'Hex') info_queue.push(G.P_CENTERS.e_polychrome);
    else if (nm === 'Talisman') info_queue.push({ key: 'gold_seal', set: 'Other' });
    else if (nm === 'Deja Vu') info_queue.push({ key: 'red_seal', set: 'Other' });
    else if (nm === 'Trance') info_queue.push({ key: 'blue_seal', set: 'Other' });
    else if (nm === 'Medium') info_queue.push({ key: 'purple_seal', set: 'Other' });
    else if (nm === 'Ankh') {
      for (const v of G.jokers?.cards ?? []) {
        if (v.edition && v.edition.negative && G.localization.descriptions.Other.remove_negative) {
          info_queue.push(G.P_CENTERS.e_negative);
          const me: any[] = [];
          localize({ type: 'other', key: 'remove_negative', nodes: me, vars: [] });
          main_end = me[0];
          break;
        }
      }
    } else if (nm === 'Cryptid') loc_vars = [_c.config.extra];
    if (nm === 'Ectoplasm') { info_queue.push(G.P_CENTERS.e_negative); loc_vars = [G.GAME?.ecto_minus ?? 1]; }
    if (nm === 'Aura') info_queue.push(G.P_CENTERS.e_foil, G.P_CENTERS.e_holo, G.P_CENTERS.e_polychrome);
    localize({ type: 'descriptions', key: _c.key, set: _c.set, nodes: desc_nodes, vars: loc_vars });
  } else if (_c.set === 'Planet') {
    const h = G.GAME.hands[_c.config.hand_type];
    loc_vars = withProps([h.level, localize(_c.config.hand_type, 'poker_hands'), h.l_mult, h.l_chips], {
      colours: [h.level === 1 ? G.C.UI.TEXT_DARK : G.C.HAND_LEVELS[Math.min(7, h.level)]],
    });
    localize({ type: 'descriptions', key: _c.key, set: _c.set, nodes: desc_nodes, vars: loc_vars });
  } else if (_c.set === 'Tarot') {
    const nm = _c.name;
    if (nm === 'The Fool') {
      const fool_c = G.GAME?.last_tarot_planet ? G.P_CENTERS[G.GAME.last_tarot_planet] : null;
      const last = fool_c ? localize({ type: 'name_text', key: fool_c.key, set: fool_c.set }) : localize('k_none');
      const colour = (!fool_c || fool_c.name === 'The Fool') ? G.C.RED : G.C.GREEN;
      main_end = [
        { n: G.UIT.C, config: { align: 'bm', padding: 0.02 }, nodes: [
          { n: G.UIT.C, config: { align: 'm', colour, r: 0.05, padding: 0.05 }, nodes: [
            { n: G.UIT.T, config: { text: ' ' + last + ' ', colour: G.C.UI.TEXT_LIGHT, scale: 0.3, shadow: true } },
          ] },
        ] },
      ];
      loc_vars = [last];
      if (!(!fool_c || fool_c.name === 'The Fool')) info_queue.push(fool_c);
    } else if (['The Magician', 'The Empress', 'The Hierophant', 'The Lovers', 'The Chariot', 'Justice', 'The Devil', 'The Tower'].includes(nm)) {
      loc_vars = ENH_CONV(_c);
      info_queue.push(G.P_CENTERS[_c.config.mod_conv]);
    } else if (nm === 'The High Priestess') loc_vars = [_c.config.planets];
    else if (nm === 'The Emperor') loc_vars = [_c.config.tarots];
    else if (nm === 'The Hermit') loc_vars = [_c.config.extra];
    else if (nm === 'The Wheel of Fortune') {
      loc_vars = [G.GAME.probabilities.normal, _c.config.extra];
      info_queue.push(G.P_CENTERS.e_foil, G.P_CENTERS.e_holo, G.P_CENTERS.e_polychrome);
    } else if (nm === 'Strength' || nm === 'The Hanged Man' || nm === 'Death') loc_vars = [_c.config.max_highlighted];
    else if (nm === 'Temperance') {
      let money = 0;
      for (const j of G.jokers?.cards ?? []) if (j.ability.set === 'Joker') money += j.sell_cost;
      loc_vars = [_c.config.extra, Math.min(_c.config.extra, money)];
    } else if (['The Star', 'The Moon', 'The Sun', 'The World'].includes(nm)) {
      loc_vars = withProps([_c.config.max_highlighted, localize(_c.config.suit_conv, 'suits_plural')], { colours: [G.C.SUITS[_c.config.suit_conv]] });
    }
    localize({ type: 'descriptions', key: _c.key, set: _c.set, nodes: desc_nodes, vars: loc_vars });
  }

  if (main_end) desc_nodes.push(main_end);

  if (!((specific_vars && !specific_vars.sticker) && (card_type === 'Default' || card_type === 'Enhanced'))) {
    if (desc_nodes === full_UI_table.main && !full_UI_table.name) {
      localize({ type: 'name', key: _c.key, set: _c.set, nodes: full_UI_table.name });
      if (!full_UI_table.name) full_UI_table.name = [];
    } else if (desc_nodes !== full_UI_table.main) {
      desc_nodes.name = localize({ type: 'name_text', key: name_override ?? _c.key, set: name_override ? 'Other' : _c.set });
    }
  }

  if (first_pass && _c.set !== 'Edition' && badges) {
    const pr = G.GAME?.perishable_rounds;
    for (const v of badges) {
      if (v === 'foil') info_queue.push(G.P_CENTERS.e_foil);
      if (v === 'holographic') info_queue.push(G.P_CENTERS.e_holo);
      if (v === 'polychrome') info_queue.push(G.P_CENTERS.e_polychrome);
      if (v === 'negative') info_queue.push(G.P_CENTERS.e_negative);
      if (v === 'negative_consumable') info_queue.push({ key: 'e_negative_consumable', set: 'Edition', config: { extra: 1 } });
      if (v === 'gold_seal' || v === 'blue_seal' || v === 'red_seal' || v === 'purple_seal' || v === 'eternal' || v === 'pinned_left') info_queue.push({ key: v, set: 'Other' });
      if (v === 'perishable') info_queue.push({ key: 'perishable', set: 'Other', vars: [pr ?? 1, specific_vars?.perish_tally ?? pr] });
      if (v === 'rental') info_queue.push({ key: 'rental', set: 'Other', vars: [G.GAME?.rental_rate ?? 1] });
    }
  }
  for (const v of info_queue) generate_card_ui(v, full_UI_table);
  return full_UI_table;
}

/** G.UIDEF.card_h_popup */
export function card_h_popup(card: any): Def {
  if (!card.ability_UIBox_table) return null;
  const AUT = card.ability_UIBox_table;
  const debuffed = card.debuff;
  const card_type_colour = get_type_colour(card.config.center ?? card.config, card);
  const card_type_background =
    (AUT.card_type === 'Locked' && G.C.BLACK) ||
    (AUT.card_type === 'Undiscovered' && darken(G.C.JOKER_GREY, 0.3)) ||
    ((AUT.card_type === 'Enhanced' || AUT.card_type === 'Default') && darken(G.C.BLACK, 0.1)) ||
    (debuffed && darken(G.C.BLACK, 0.1)) ||
    (card_type_colour && darken(G.C.BLACK, 0.1)) ||
    G.C.SET[AUT.card_type] || [0, 1, 1, 1];
  const outer_padding = 0.05;
  let card_type = localize('k_' + String(AUT.card_type).toLowerCase());
  if (AUT.card_type === 'Joker' || (AUT.badges && AUT.badges.force_rarity)) {
    card_type = [localize('k_common'), localize('k_uncommon'), localize('k_rare'), localize('k_legendary')][card.config.center.rarity - 1];
  }
  if (AUT.card_type === 'Enhanced') card_type = localize({ type: 'name_text', key: card.config.center.key, set: 'Enhanced' });
  card_type = (debuffed && AUT.card_type !== 'Enhanced') ? localize('k_debuffed') : card_type;
  const is_playing_card = AUT.card_type === 'Enhanced' || AUT.card_type === 'Default';
  const info_boxes: any[] = [];
  const badges: any[] = [];
  if (AUT.badges.card_type || AUT.badges.force_rarity) {
    const nm = card.ability.name;
    badges.push(create_badge(((nm === 'Pluto' || nm === 'Ceres' || nm === 'Eris') && localize('k_dwarf_planet')) || (nm === 'Planet X' ? localize('k_planet_q') : card_type), card_type_colour, null, 1.2));
  }
  for (let v of AUT.badges as string[]) {
    if (v === 'negative_consumable') v = 'negative';
    badges.push(create_badge(localize(v, 'labels'), get_badge_colour(v)));
  }
  for (const v of AUT.info ?? []) {
    info_boxes.push({ n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', colour: lighten(G.C.JOKER_GREY, 0.5), r: 0.1, padding: 0.05, emboss: 0.05 }, nodes: [
        info_tip_from_rows(v, v.name),
      ] },
    ] });
  }
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', func: 'show_infotip', object: new Moveable(0, 0, 0, 0), ref_table: info_boxes.length ? info_boxes : null }, nodes: [
      { n: G.UIT.R, config: { padding: outer_padding, r: 0.12, colour: lighten(G.C.JOKER_GREY, 0.5), emboss: 0.07 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0.07, r: 0.1, colour: adjust_alpha(card_type_background, 0.8) }, nodes: [
          name_from_rows(AUT.name, is_playing_card ? G.C.WHITE : null),
          desc_from_rows(AUT.main),
          badges[0] ? { n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: badges } : null,
        ] },
      ] },
    ] },
  ] };
}

/** create_UIBox_detailed_tooltip: an info box for a center named in a description ({T:key}) */
export function create_UIBox_detailed_tooltip(_center: any): Def {
  const full_UI_table = { main: [], info: [], type: {}, name: 'done', badges: [] };
  const desc = generate_card_ui(_center, full_UI_table, null, _center.set, null);
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', colour: lighten(G.C.JOKER_GREY, 0.5), r: 0.1, padding: 0.05, emboss: 0.05 }, nodes: [
      info_tip_from_rows(desc.info[0], desc.info[0].name),
    ] },
  ] };
}

