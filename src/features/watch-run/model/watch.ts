// Watching a run again: /play/?watch=<id>.
//
// The API makes a copy of the run at its start (a run of the viewer's, not
// listed and not counted) and gives the player's actions in order. Each one
// is played here through the same functions the player's click called (the
// selection is set, then G.FUNCS.play_cards_from_highlighted, use_card,
// buy_from_shop ...), so every action has the game's own animations. A
// pointer shows the player's clicks first (the cards selected one by one, the
// button), at a pace the viewer can follow; nothing moves while a menu has
// paused the game. The engine is deterministic: the copy goes exactly the way
// the run went. When it ends, or when the viewer stops it, the copy is theirs
// to play on.
import { G } from '@/shared/lib/engine';
import { api, ApiError, type WatchView } from '@/shared/api';
import { recorder } from '@/shared/lib/recorder';
import { run, perform, timeline_playing } from '@/entities/run';
import { hud } from '../ui/watch-hud';
import { ghost, wait } from '../ui/ghost-cursor';

type Step = WatchView['steps'][number];
type Action = Record<string, any>;

const SPEEDS = [1, 2, 4];
// the player's pace (shorter at a higher speed, but always long enough to follow)
const THINK_MS = 900; // a look at the screen before each action
const MOVE_MS = 380; // the pointer's way to each card or button
const CLICK_MS = 160; // after each click

/** the first visible UI element whose button is `name` */
function find_button(name: string, boxes?: any[]): any {
  const find = (n: any): any => {
    if (!n) return null;
    if (n.config?.button === name && n.states?.visible) return n;
    for (const c of Object.values(n.children ?? {})) {
      const r = find(c);
      if (r) return r;
    }
    return null;
  };
  for (const box of boxes ?? [G.blind_select, G.round_eval, G.shop, G.buttons, G.booster_pack, ...(G.I?.UIBOX ?? [])]) {
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

/** the hand's selection, as the player had it */
function select(ids: number[] | null | undefined): boolean {
  const cards = (ids ?? []).map((id) => card_in([G.hand], id));
  if (cards.some((c) => !c)) return false;
  for (const c of [...G.hand.highlighted]) if (!cards.includes(c)) G.hand.remove_from_highlighted(c, true);
  for (const c of cards) if (!G.hand.highlighted.includes(c)) G.hand.add_to_highlighted(c, true);
  return true;
}

/** a click of the player's on a card or a UI element; `then`: what it did before the action (a card selected) */
interface Click { on: any; then?: () => void }

/** an action as the player took it: their clicks, then the action itself */
interface Plan { clicks: Click[]; go: () => void }

function button_click(name: string): Click[] {
  const b = find_button(name);
  return b ? [{ on: b }] : [];
}

/** the clicks that make the hand's selection the player's, left to right (null: a card isn't in the hand yet) */
function selection_clicks(ids: number[] | null | undefined): Click[] | null {
  const cards = (ids ?? []).map((id) => card_in([G.hand], id));
  if (cards.some((c) => !c)) return null;
  cards.sort((a, b) => G.hand.cards.indexOf(a) - G.hand.cards.indexOf(b));
  const off = G.hand.highlighted.filter((c: any) => !cards.includes(c))
    .map((c: any) => ({ on: c, then: () => G.hand.remove_from_highlighted(c) }));
  const on = cards.filter((c) => !G.hand.highlighted.includes(c))
    .map((c) => ({ on: c, then: () => { if (!G.hand.highlighted.includes(c)) G.hand.add_to_highlighted(c); } }));
  return [...off, ...on];
}

/** how to take this action once the screen offers it (null: not yet) */
function prepare(a: Action): Plan | null {
  switch (a.type) {
    case 'select_blind': case 'skip_blind': case 'cash_out': {
      const b = find_button(a.type);
      return b ? { clicks: [{ on: b }], go: () => G.FUNCS[a.type](b) } : null;
    }
    case 'reroll_boss': return { clicks: button_click('reroll_boss'), go: () => G.FUNCS.reroll_boss(find_button('reroll_boss') ?? {}) };
    case 'play': case 'discard': {
      if (G.STATE !== G.STATES.SELECTING_HAND || !G.buttons) return null;
      const picks = selection_clicks(a.cards);
      const fn = a.type === 'play' ? 'play_cards_from_highlighted' : 'discard_cards_from_highlighted';
      return picks ? { clicks: [...picks, ...button_click(fn)], go: () => { select(a.cards); G.FUNCS[fn](); } } : null;
    }
    case 'sort': {
      const fn = a.mode === 'suit' ? 'sort_hand_suit' : 'sort_hand_value';
      return { clicks: button_click(fn), go: () => G.FUNCS[fn]() };
    }
    case 'buy': {
      const card = card_in([G.shop_jokers, G.shop_vouchers, G.shop_booster], a.card);
      if (!card) return null;
      if (card.area === G.shop_jokers) return { clicks: [{ on: card }], go: () => G.FUNCS.buy_from_shop({ config: { ref_table: card, id: a.use ? 'buy_and_use' : undefined } }) };
      return { clicks: [{ on: card }], go: () => G.FUNCS.use_card({ config: { ref_table: card } }) };
    }
    case 'reroll': return G.shop ? { clicks: button_click('reroll_shop'), go: () => G.FUNCS.reroll_shop() } : null;
    case 'end_shop': return G.shop ? { clicks: button_click('toggle_shop'), go: () => G.FUNCS.toggle_shop() } : null;
    case 'use': case 'pick': {
      const card = card_in(a.type === 'use' ? [G.consumeables] : [G.pack_cards], a.card);
      const picks = card && selection_clicks(a.targets ?? []);
      if (!card || !picks) return null;
      return { clicks: [...picks, { on: card }], go: () => { select(a.targets ?? []); G.FUNCS.use_card({ config: { ref_table: card } }); } };
    }
    case 'sell': {
      const card = card_in([G.jokers, G.consumeables], a.card);
      return card ? { clicks: [{ on: card }], go: () => G.FUNCS.sell_card({ config: { ref_table: card } }) } : null;
    }
    case 'skip_pack': return G.pack_cards?.cards?.length ? { clicks: button_click('skip_booster'), go: () => G.FUNCS.skip_booster() } : null;
    case 'move': {
      const area = a.area === 'jokers' ? G.jokers : a.area === 'hand' ? G.hand : G.consumeables;
      const card = card_in([area], a.card);
      if (!card) return null;
      return {
        // the drag: from the card to where it goes
        clicks: [{ on: card }, { on: area.cards[a.to] ?? card }],
        go: () => {
          // the card's new place, then the game's drag end (it sends the move)
          area.cards.splice(area.cards.indexOf(card), 1);
          area.cards.splice(a.to, 0, card);
          area.set_ranks();
          G.FUNCS.card_drag_ended(card);
        },
      };
    }
    case 'continue': return { clicks: [], go: () => { void perform({ type: 'continue' }); } };
    case 'debug': return { clicks: [], go: () => G.FUNCS.debug_command(a.command) };
  }
  return null;
}

const strip = (x: any) => JSON.stringify(x && typeof x === 'object' ? { ...x, expected_version: undefined } : x);

/** the action as perform() records it (defaults filled in), to compare with the player's */
function same_action(want: Action, got: any): boolean {
  if (want.type === 'debug') return got?.type === 'debug' || got?.command !== undefined;
  const norm = (o: any) => {
    const r: any = { ...o };
    if (r.type === 'buy') r.use = !!r.use;
    if ('targets' in r && (r.targets === null || (Array.isArray(r.targets) && !r.targets.length))) delete r.targets;
    if (r.type === 'move') delete r.area;
    return r;
  };
  return strip(norm(want)) === strip(norm(got));
}

class Watch {
  next = 0;
  paused = false;
  stopped = false;
  private stepping = false;
  private acting = false;
  private quiet_since = 0;
  private started_at = 0;
  private waiting_start = false;
  private speed_before = G.SETTINGS.GAMESPEED;
  private off: () => void;

  constructor(readonly view: WatchView) {
    this.off = recorder.on((e) => {
      if (e.k !== 'action' || e.phase !== 'start' || !this.waiting_start) return;
      this.waiting_start = false;
      const want = this.view.steps[this.next - 1]?.action;
      if (want && !same_action(want, e.action)) {
        hud.warn(`Action ${this.next} went another way: the player did ${JSON.stringify(want)}, here ${JSON.stringify(e.action)}.`);
        this.paused = true;
      }
    });
  }

  /** nothing is moving */
  private settled(): boolean {
    return run.id === this.view.game.id && !run.busy && !G.CONTROLLER?.locked && !timeline_playing() && !G.screenwipe;
  }

  /** nothing is moving and no menu has paused the game: the player would have been deciding */
  private idle(): boolean {
    return this.settled() && !G.SETTINGS.paused;
  }

  /** the win screen's "Endless Mode" (the winning action ends once it is clicked) */
  private endless_button(): any {
    if (run.id !== this.view.game.id || !G.GAME?.won || !G.OVERLAY_MENU?.config?.no_esc) return null;
    return find_button('exit_overlay_menu', [G.OVERLAY_MENU]);
  }

  /** the player's pointer stays where it is: the watch is paused (but for one step), or the game is (a menu, not the win screen) */
  private held = () => !this.stopped && ((this.paused && !this.stepping) || (!!G.SETTINGS.paused && !this.endless_button()));

  /** the player's clicks for the action, then the action (`step`: the player's action it is, if one) */
  private async act(plan: Plan, step?: Step) {
    const k = Math.sqrt(G.SETTINGS.GAMESPEED || 1);
    for (const c of plan.clicks) {
      await ghost.move(c.on, MOVE_MS / k, this.held);
      if (this.stopped) return;
      ghost.click();
      c.then?.();
      await wait(CLICK_MS / k, this.held);
      if (this.stopped) return;
    }
    this.acting = false;
    this.stepping = false;
    this.waiting_start = !!step && step.action.type !== 'continue';
    this.started_at = performance.now();
    this.quiet_since = 0;
    plan.go();
    hud.message('');
  }

  tick = () => {
    if (this.stopped) return;
    hud.progress(this.next, this.view.steps.length);
    if (this.next >= this.view.steps.length) {
      if (this.settled() || this.endless_button()) { this.finish('The end of the run: it is yours to play from here.'); return; }
    } else if (!this.acting && (!this.paused || this.stepping)) {
      const now = performance.now();
      const endless = this.endless_button();
      if (!this.idle() && !endless) this.quiet_since = 0;
      else if (!this.quiet_since) this.quiet_since = now;
      if (this.quiet_since && now - this.quiet_since >= THINK_MS / Math.sqrt(G.SETTINGS.GAMESPEED || 1)) {
        const step: Step = this.view.steps[this.next];
        const plan = endless ? null : prepare(step.action);
        if (endless) {
          this.acting = true;
          void this.act({ clicks: [{ on: endless }], go: () => G.FUNCS.exit_overlay_menu() });
        } else if (plan) {
          this.next++;
          this.acting = true;
          hud.message('');
          void this.act(plan, step);
        } else if (now - this.quiet_since > 60000) {
          hud.warn(`Action ${this.next + 1} (${step.action.type}) can't be played on this screen: the replay stops here.`);
          this.finish('');
          return;
        } else if (now - this.quiet_since > 8000) {
          hud.message(`Waiting for the screen of action ${this.next + 1} (${step.action.type})…`);
        }
      }
    }
    if (this.waiting_start && performance.now() - this.started_at > 4000 && this.idle()) {
      this.waiting_start = false;
      hud.warn(`Action ${this.next} wasn't taken by the game: paused.`);
      this.paused = true;
    }
    requestAnimationFrame(this.tick);
  };

  toggle_pause = () => { this.paused = !this.paused; return this.paused; };
  step = () => { if (this.paused) this.stepping = true; };
  change_speed = () => {
    const i = SPEEDS.indexOf(G.SETTINGS.GAMESPEED);
    G.SETTINGS.GAMESPEED = SPEEDS[(i + 1) % SPEEDS.length];
    return G.SETTINGS.GAMESPEED;
  };

  finish(message: string) {
    if (this.stopped) return;
    this.stopped = true;
    this.off();
    ghost.hide();
    G.SETTINGS.GAMESPEED = this.speed_before;
    if (message) hud.message(message);
  }
}

function when_menu_ready(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (G.STAGE === G.STAGES.MAIN_MENU && !G.screenwipe && G.FUNCS?.start_run ? resolve() : requestAnimationFrame(check));
    check();
  });
}

/** /play/?watch=<id>: see a run again */
export async function start_watch_if_asked() {
  const id = new URLSearchParams(location.search).get('watch');
  if (!id) return;
  let current: Watch | null = null;
  hud.show({
    pause: () => current?.toggle_pause() ?? false,
    step: () => current?.step(),
    speed: () => current?.change_speed() ?? G.SETTINGS.GAMESPEED,
    stop: () => current?.finish('Stopped: the run is yours to play from here.'),
  });
  hud.message('Loading the run…');
  try {
    const view = await api.watch(id);
    await when_menu_ready();
    hud.title(view.owner_name ? `Watching ${view.owner_name}'s run` : 'Watching a run');
    hud.speed(G.SETTINGS.GAMESPEED);
    hud.message('');
    current = new Watch(view);
    ghost.show();
    G.FUNCS.start_run(null, { open_id: view.game.id });
    requestAnimationFrame(current.tick);
  } catch (err) {
    hud.message(err instanceof ApiError && err.code === 'game_not_found'
      ? "This run can't be watched: it isn't finished yet, or its player's profile is private."
      : `Couldn't load the run: ${(err as any)?.message ?? err}`);
  }
}
