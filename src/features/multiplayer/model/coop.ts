// Coop in the run: one run for both players, in turns (BalatroEngine's coop
// mod). Both see the same table:
// - on the player's turn, the cards they select are sent to the match, and the
//   other player sees them selected;
// - the other player's actions come back here (the match's steps: each action
//   with what the game showed) and are played through the game's own functions,
//   with their animations, as if they had been clicked here;
// - on the other player's turn the hand can't be selected (the API refuses
//   their actions anyway), and their jokers can't be moved;
// - the shop is left once both players have asked to leave it.
import { G, play_sound } from '@/shared/lib/engine';
import { attention_text } from '@/shared/ui';
import { api, matches, type CoopStep, type MatchView } from '@/shared/api';
import { run, spectate, timeline_playing, finish_action, set_view, perform } from '@/entities/run';
import { mp, on_match, set_poll_interval } from './match';
import { tr } from '../ui/text';

const WATCH_POLL_MS = 600; // the match, read while the other player plays
const IDLE_POLL_MS = 1500;

export const coop = {
  /** the other player's actions are being played here */
  replaying: false,
};

let sent_selection = '';
let shown_selection = -1;
let original_toggle_shop: ((e?: any) => void) | null = null;

export function in_coop_run(m: MatchView | null = mp.match): m is MatchView {
  return !!m && m.mode === 'coop' && !!m.run_id && run.id === m.run_id && G.STAGE === G.STAGES.RUN;
}

/** it is this player's turn (from the run's view: the latest the screen shows) */
export function my_turn(): boolean {
  return !!run.view?.coop?.your_turn;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** the first visible UI element whose button is `name` */
function find_button(name: string): any {
  const find = (n: any): any => {
    if (!n) return null;
    if (n.config?.button === name && n.states?.visible) return n;
    for (const c of Object.values(n.children ?? {})) {
      const r = find(c);
      if (r) return r;
    }
    return null;
  };
  for (const box of [G.blind_select, G.round_eval, G.shop, G.buttons, G.booster_pack, ...(G.I?.UIBOX ?? [])]) {
    const n = box?.UIRoot && find(box.UIRoot);
    if (n) return n;
  }
  return null;
}

function card_in(areas: any[], id: number): any {
  for (const a of areas) {
    const c = a?.cards?.find((x: any) => x.api_id === id);
    if (c) return c;
  }
  return null;
}

/** the hand's selection set to these cards (in this order: a consumable's targets) */
function select(ids: number[]): boolean {
  const cards = ids.map((id) => card_in([G.hand], id));
  if (cards.some((c) => !c)) return false;
  for (const c of [...G.hand.highlighted]) G.hand.remove_from_highlighted(c, true);
  for (const c of cards) G.hand.add_to_highlighted(c, true);
  return true;
}

async function idle(ms = 60_000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (!run.busy && !timeline_playing() && !G.screenwipe) return true;
    await sleep(100);
  }
  return false;
}

/** one of the other player's actions, played here with its animations; false: it couldn't be */
async function play_step(step: CoopStep): Promise<boolean> {
  const a = step.action;
  const result = { game: step.game, events: step.events };
  const go = (fn: () => void) => {
    spectate.next = result;
    fn();
  };
  switch (a.type) {
    case 'select_blind': case 'skip_blind': case 'cash_out': {
      const b = find_button(a.type);
      if (!b) return false;
      go(() => G.FUNCS[a.type](b));
      break;
    }
    case 'reroll_boss': go(() => G.FUNCS.reroll_boss(find_button('reroll_boss') ?? {})); break;
    case 'play': case 'discard': {
      if (G.STATE !== G.STATES.SELECTING_HAND || !select(a.cards ?? [])) return false;
      const fn = a.type === 'play' ? 'play_cards_from_highlighted' : 'discard_cards_from_highlighted';
      go(() => G.FUNCS[fn]());
      break;
    }
    case 'sort': go(() => G.FUNCS[a.mode === 'suit' ? 'sort_hand_suit' : 'sort_hand_value']()); break;
    case 'buy': {
      const card = card_in([G.shop_jokers, G.shop_vouchers, G.shop_booster], a.card);
      if (!card) return false;
      if (card.area === G.shop_jokers) go(() => G.FUNCS.buy_from_shop({ config: { ref_table: card, id: a.use ? 'buy_and_use' : undefined } }));
      else go(() => G.FUNCS.use_card({ config: { ref_table: card } }));
      break;
    }
    case 'reroll': go(() => G.FUNCS.reroll_shop()); break;
    case 'end_shop': {
      if (step.game.phase === 'shop') {
        // (only their vote: the shop stays)
        set_view(step.game);
        finish_action(step.game);
        return true;
      }
      go(() => original_toggle_shop?.());
      break;
    }
    case 'use': case 'pick': {
      const card = card_in(a.type === 'use' ? [G.consumeables] : [G.pack_cards], a.card);
      if (!card || !select(a.targets ?? [])) return false;
      go(() => G.FUNCS.use_card({ config: { ref_table: card } }));
      break;
    }
    case 'sell': {
      const card = card_in([G.jokers, G.consumeables], a.card);
      if (!card) return false;
      go(() => G.FUNCS.sell_card({ config: { ref_table: card } }));
      break;
    }
    case 'skip_pack': go(() => G.FUNCS.skip_booster()); break;
    case 'move': {
      // their jokers (or the hand, the consumables) rearranged: the card to its new place
      const card = card_in([G.jokers, G.hand, G.consumeables], a.card);
      if (!card) return false;
      const area = card.area;
      area.cards.splice(area.cards.indexOf(card), 1);
      area.cards.splice(a.to, 0, card);
      area.set_ranks();
      go(() => void perform({ type: 'move', card: a.card, to: a.to }));
      break;
    }
    default: return false;
  }
  if (spectate.next) { // (the function didn't take the action: the screen wasn't where it was played)
    spectate.next = null;
    return false;
  }
  return idle();
}

function reload() {
  if (run.id) G.FUNCS.start_run(null, { open_id: run.id });
}

/** the other player's actions since the screen's version, played here */
async function catch_up(m: MatchView) {
  const v = run.view;
  if (coop.replaying || !v || run.busy || timeline_playing() || G.screenwipe) return;
  if (m.run_version === null || m.run_version <= v.version) return;
  coop.replaying = true;
  try {
    const st = await matches.steps(m.id, v.version);
    let ok = st.complete;
    for (const step of st.steps) {
      if (!ok) break;
      if (step.version < (run.view?.version ?? 0)) continue; // (already on screen: this player's own)
      ok = await play_step(step);
    }
    if (ok && run.id) {
      // this player's own view again (the legal actions are theirs)
      const mine = await api.getGame(run.id);
      if (mine.phase === run.view?.phase && mine.state === run.view?.state) {
        set_view(mine);
        finish_action(mine);
      } else ok = false;
    }
    if (!ok) reload();
  } catch (err) {
    console.warn('[coop] the other player\'s actions could not be played here', err);
    reload();
  } finally {
    coop.replaying = false;
  }
}

/** the hand on the other player's turn: theirs to select (shown as they select it) */
function lock_hand() {
  const mine = my_turn();
  for (const c of G.hand?.cards ?? []) {
    c.states.click.can = mine;
    c.states.drag.can = mine;
  }
  const seat = run.view?.coop?.seat;
  for (const c of G.jokers?.cards ?? []) {
    const owner = run.view?.jokers.find((j) => j.id === c.api_id)?.owner;
    if (owner !== undefined && owner !== null) c.states.drag.can = owner === seat;
  }
}

/** this player's selection, sent on their turn; the other one's, shown on theirs */
function selections(m: MatchView) {
  if (!m.coop || coop.replaying || run.busy || timeline_playing() || G.STATE !== G.STATES.SELECTING_HAND) return;
  if (my_turn()) {
    const ids = (G.hand?.highlighted ?? []).map((c: any) => c.api_id).filter((x: any) => x !== undefined);
    const key = ids.join(',');
    if (key !== sent_selection) {
      sent_selection = key;
      void matches.selection(m.id, ids).catch(() => { sent_selection = ''; });
    }
  } else if (m.coop.selection_seq !== shown_selection) {
    shown_selection = m.coop.selection_seq;
    select(m.coop.selection.filter((id) => card_in([G.hand], id)));
  }
}

function step_match(m: MatchView | null) {
  if (!in_coop_run(m) || m.status !== 'playing') {
    set_poll_interval(IDLE_POLL_MS);
    return;
  }
  set_poll_interval(m.coop?.your_turn ? IDLE_POLL_MS : WATCH_POLL_MS);
  void catch_up(m);
  selections(m);
}

export function register_coop_funcs() {
  on_match(step_match);
  setInterval(() => {
    const m = mp.match;
    if (!in_coop_run(m)) return;
    lock_hand();
    selections(m);
  }, 250);
  // the blind's choice is the turn's player's: the other one is told whose turn it is
  for (const name of ['select_blind', 'skip_blind', 'reroll_boss']) {
    const original = G.FUNCS[name];
    G.FUNCS[name] = (e?: any) => {
      if (!in_coop_run() || my_turn() || spectate.next) return original?.(e);
      play_sound('cancel', 0.8, 0.6);
      const name_of = mp.match?.players.find((p) => !p.you)?.name ?? '';
      if (e?.T) attention_text({ text: tr('their_turn', { name: name_of }), scale: 0.5, hold: 1.2 * (G.SETTINGS.GAMESPEED || 1), major: e, align: 'cm', backdrop_colour: G.C.RED });
    };
  }
  // leaving the shop is a vote: the first one only says so (the shop stays), the second one leaves it
  original_toggle_shop = G.FUNCS.toggle_shop;
  G.FUNCS.toggle_shop = (e?: any) => {
    const c = run.view?.coop;
    if (!in_coop_run() || !c || c.seat === null) return original_toggle_shop?.(e);
    const other = 1 - c.seat;
    if (c.shop_votes.includes(other)) return original_toggle_shop?.(e);
    if (e?.config) e.config.button = null;
    void perform({ type: 'end_shop' }, { refused: () => { if (e?.config) e.config.button = 'toggle_shop'; } });
  };
}
