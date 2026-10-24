// One player action, end to end: send it to the API, play the game's ported
// reaction (the choreography, in G.E_MANAGER) together with the returned
// events (the timeline), then make the screen match the returned GameView.
import { G, Event } from '@/shared/lib/engine';
import { api, ApiError, type ActionResult, type GameView, type PlayerAction } from '@/shared/api';
import { check_and_set_high_score } from '@/shared/config';
import { run, set_view } from './store';
import { Timeline, type TimelineHooks } from './timeline';
import { sync_game, reconcile_all } from './sync';
import { full_deck } from './deck';

export interface Choreography {
  /** the game's reaction at the click, before the answer (stop_use, buttons off...) */
  before?(): void;
  /** with the answer: queues the action's ported events; `tl` plays the API's events */
  play?(tl: Timeline, result: ActionResult, prev: GameView): void;
  /** the click was refused (the run is unchanged): undo what `before` did */
  refused?(err: unknown): void;
  hooks?: TimelineHooks;
  /** the API re-selects the cards first: the player already sees that */
  skip_selection?: boolean;
}

/** called when the run must be rebuilt from the API (version conflict, network error) */
export const resync = { handler: null as null | ((view: GameView) => void) };

/** the timeline being played, if any */
export const playing: { tl: Timeline | null } = { tl: null };

export function finish_action(view: GameView) {
  check_and_set_high_score('furthest_round', view.round);
  check_and_set_high_score('furthest_ante', view.ante);
  check_and_set_high_score('most_money', view.dollars);
  sync_game(view);
  reconcile_all(view);
  G.playing_cards = full_deck(view);
}

/** a debug helper (POST /debug, development only), played like an action */
export async function perform_debug(command: Record<string, unknown>, ch: Choreography = {}): Promise<boolean> {
  return perform({ type: 'debug' } as any, ch, () => api.debug(run.id!, command, run.view!.version));
}

export async function perform(action: PlayerAction, ch: Choreography = {}, send?: () => Promise<ActionResult>): Promise<boolean> {
  if (run.busy || !run.view || !run.id) return false;
  run.busy = true;
  G.CONTROLLER.locks.api = true;
  // the API's times count from the click
  const click_time = G.TIMERS.REAL;
  const prev = run.view;
  ch.before?.();
  let result: ActionResult;
  try {
    result = await (send ? send() : api.act(run.id, action, prev.version));
  } catch (err) {
    G.CONTROLLER.locks.api = null;
    run.busy = false;
    ch.refused?.(err);
    if (err instanceof ApiError && err.code === 'illegal_action') {
      console.warn('[api] refused:', err.message);
    } else {
      console.error('[api]', err);
      try {
        const view = await api.getGame(run.id);
        resync.handler?.(view);
      } catch (e2) { console.error('[api] resync failed', e2); }
    }
    return false;
  }
  G.CONTROLLER.locks.api = null;
  const tl = new Timeline(result.events, result.game, ch.hooks, { skip_selection: ch.skip_selection, action: action.type });
  playing.tl = tl;
  set_view(result.game);
  ch.play?.(tl, result, prev);
  tl.start(undefined, click_time);
  // when the timeline is done, the view is the truth (the choreography's own
  // events keep their place in the queue: this one blocks nothing)
  G.E_MANAGER.add_event(new Event({
    blocking: false, blockable: false,
    func: () => {
      if (!tl.done) return false;
      if (playing.tl === tl) playing.tl = null;
      finish_action(result.game);
      run.busy = false;
      return true;
    },
  }));
  return true;
}

/** true while an action's timeline is still playing */
export function timeline_playing() {
  return !!playing.tl && !playing.tl.done;
}
