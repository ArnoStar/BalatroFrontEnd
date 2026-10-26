// A bug report seen again: /play/?report=<id> (developers only).
//
// The run is rebuilt in the API from the report's history up to where the
// recording can start (the last time the run was opened, or the first action
// the recording still has), opened like a run the player continues, and then
// the player's recorded inputs are replayed on it. Each input waits for the
// same number of finished actions as when it was recorded, then for the same
// delay after the last one, so a slower or faster API doesn't shift the
// clicks. The rebuilt run is exact (the engine is deterministic); the inputs
// are replayed as faithfully as the frames allow.
//
//   ?report=<id>             rebuild, open, replay the inputs
//   ?report=<id>&at=<v>      rebuild at version v and open it (no inputs)
//   ?report=<id>&inputs=0    rebuild where the recording starts, without the inputs
import { G } from '@/shared/lib/engine';
import { api, reports, type ReportView } from '@/shared/api';
import { save_settings } from '@/shared/config';
import { input_state, key_down, key_up, pointer_down, pointer_move, pointer_up, to_screen } from '@/shared/lib/input';
import { recorder, type RecordedEvent } from '@/shared/lib/recorder';
import { hud } from '../ui/replay-hud';

interface PlannedInput {
  e: RecordedEvent;
  sync: number; // finished actions (after the start) it waits for
  delay: number; // seconds after that sync point
}

export interface Plan {
  version: number;
  inputs: PlannedInput[];
  actions: Array<{ type: string; action: unknown }>; // what the player did, in order (to spot divergence)
  approximate: boolean; // started mid-session (the run's opening fell off the recording)
}

/** where the replay starts, and what it plays (pure: tested on recordings) */
export function make_plan(report: Pick<ReportView, 'game_id' | 'game_version' | 'history' | 'recording'>, at?: number | null): Plan {
  const events = report.recording.events ?? [];
  const max = report.history?.commands.length ?? 0;
  if (at !== undefined && at !== null) return { version: Math.max(0, Math.min(at, max)), inputs: [], actions: [], approximate: false };
  let anchor = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.k === 'run' && (!report.game_id || e.id === report.game_id)) { anchor = i; break; }
  }
  let approximate = false;
  if (anchor < 0) {
    anchor = events.findIndex((e) => e.k === 'action' && e.phase === 'end');
    approximate = true;
  }
  if (anchor < 0) return { version: Math.min(report.game_version ?? max, max), inputs: [], actions: [], approximate: true };
  const version = Math.min(Number(events[anchor].version), max);
  const syncs = [events[anchor].t];
  const inputs: PlannedInput[] = [];
  const actions: Plan['actions'] = [];
  for (const e of events.slice(anchor + 1)) {
    if (e.k === 'action' && e.phase === 'end') syncs.push(e.t);
    else if (e.k === 'action' && e.phase === 'start') actions.push({ type: String(e.type), action: e.action });
    else if (e.k === 'input') inputs.push({ e, sync: syncs.length - 1, delay: e.t - syncs[syncs.length - 1] });
  }
  return { version, inputs, actions, approximate };
}

function dispatch(e: RecordedEvent) {
  const [x, y] = typeof e.x === 'number' ? to_screen(e.x, e.y as number) : [0, 0];
  if (e.type === 'move') pointer_move(x, y);
  else if (e.type === 'down') pointer_down(x, y, Number(e.button ?? 0));
  else if (e.type === 'up') pointer_up(x, y, Number(e.button ?? 0));
  else if (e.type === 'key') key_down(String(e.key));
  else if (e.type === 'keyup') key_up(String(e.key));
}

/**
 * The player's settings that decide what a click hits (the report's
 * client.settings): the game speed (how far an animation is when the click
 * comes) and where Play and Discard are. Returns how to put the developer's back.
 */
const PLAYER_SETTINGS: Record<string, string> = { game_speed: 'GAMESPEED', play_button_pos: 'play_button_pos' };

function use_players_settings(client: Record<string, unknown> | null | undefined): () => void {
  const theirs = (client?.settings ?? null) as Record<string, unknown> | null;
  const mine: Record<string, unknown> = {};
  for (const [from, to] of Object.entries(PLAYER_SETTINGS)) {
    if (theirs?.[from] === undefined || theirs[from] === null) continue;
    mine[to] = G.SETTINGS[to];
    G.SETTINGS[to] = theirs[from];
  }
  return () => {
    const moved = 'play_button_pos' in mine && mine.play_button_pos !== G.SETTINGS.play_button_pos;
    Object.assign(G.SETTINGS, mine);
    save_settings();
    // the run screen rebuilds its buttons in the developer's order (update_selecting_hand)
    if (moved && G.buttons) { G.buttons.remove(); G.buttons = null; }
  };
}

function same(a: unknown, b: unknown) {
  const strip = (x: any) => (x && typeof x === 'object' ? { ...x, expected_version: undefined } : x);
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

class Replay {
  private syncs: number[] = [];
  private next = 0;
  private started_actions = 0;
  // time spent waiting for the screen since the last sync point (see tick)
  private lag = 0;
  private lag_sync = -1;
  private last_tick = 0;
  paused = false;
  stopped = false;
  diverged: string | null = null;
  private off: () => void;

  constructor(readonly report: ReportView, readonly plan: Plan, private restore_settings: () => void = () => {}) {
    this.off = recorder.on((e) => {
      if (e.k === 'run' && !this.syncs.length) this.syncs.push(recorder.now());
      else if (e.k === 'action' && e.phase === 'end' && this.syncs.length) this.syncs.push(recorder.now());
      else if (e.k === 'action' && e.phase === 'start' && this.syncs.length) {
        const want = this.plan.actions[this.started_actions++];
        if (!this.diverged && want && (want.type !== e.type || !same(want.action, e.action))) {
          this.diverged = `action ${this.started_actions}: the player did ${JSON.stringify(want.action)}, the replay ${JSON.stringify(e.action)}`;
          console.warn('[replay] diverged:', this.diverged);
        }
      }
    });
  }

  tick = () => {
    if (this.stopped) return;
    const now = recorder.now();
    // The player's inputs reached a game that took them: when an input comes due while
    // the game ignores input (a screen wipe, the controls locked: the screen is slower
    // here), it waits, and so do the inputs after it until the next sync point.
    const waiting_input = this.next < this.plan.inputs.length ? this.plan.inputs[this.next] : null;
    if (waiting_input && waiting_input.sync !== this.lag_sync) { this.lag_sync = waiting_input.sync; this.lag = 0; }
    if ((G.screenwipe || G.CONTROLLER?.locked) && this.last_tick) this.lag += now - this.last_tick;
    this.last_tick = now;
    // the inputs that are due, but only those of one recorded frame per frame:
    // a press, the moves of a drag and the release must reach the game in as
    // many frames as they did (all in one frame, a drag is a click)
    let frame: unknown;
    while (!this.paused && this.next < this.plan.inputs.length) {
      const p = this.plan.inputs[this.next];
      const base = this.syncs[p.sync];
      if (base === undefined || now - base - this.lag < p.delay) break;
      if (G.screenwipe || G.CONTROLLER?.locked) break;
      if (frame !== undefined && p.e.f !== frame) break;
      frame = p.e.f ?? null;
      dispatch(p.e);
      this.next++;
    }
    const waiting = this.next < this.plan.inputs.length ? this.plan.inputs[this.next] : null;
    hud.progress({
      inputs: this.next, total: this.plan.inputs.length, actions: Math.max(0, this.syncs.length - 1),
      total_actions: this.plan.actions.length, paused: this.paused, diverged: this.diverged,
      waiting_for_action: waiting && this.syncs[waiting.sync] === undefined ? waiting.sync : null,
      done: !waiting,
    });
    if (!waiting) {
      this.stop(false);
      return;
    }
    requestAnimationFrame(this.tick);
  };

  stop(by_user = true) {
    if (this.stopped) return;
    this.stopped = true;
    this.off();
    this.restore_settings();
    input_state.replaying = false;
    if (by_user) hud.message('Replay stopped: the run is yours to play.');
  }
}

let current: Replay | null = null;

function when_menu_ready(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (G.STAGE === G.STAGES.MAIN_MENU && !G.screenwipe && G.FUNCS?.start_run ? resolve() : requestAnimationFrame(check));
    check();
  });
}

/** /play/?report=<id>: see the report's bug again */
export async function start_replay_if_asked() {
  const q = new URLSearchParams(location.search);
  const id = q.get('report');
  if (!id) return;
  const at = q.has('at') ? Number(q.get('at')) : null;
  const with_inputs = q.get('inputs') !== '0' && at === null;
  hud.show(id, { pause: () => current && (current.paused = !current.paused), stop: () => current?.stop() });
  try {
    hud.message('Loading the report…');
    const report = await reports.get(id);
    hud.report(report);
    if (!report.history) {
      hud.message(report.game_id ? "This report has no history of its run: it can't be rebuilt." : 'This report was made outside a run: nothing to rebuild.');
      return;
    }
    const plan = make_plan(report, at);
    await when_menu_ready();
    hud.message(`Rebuilding the run at version ${plan.version} of ${report.history.commands.length}…`);
    // (the progress the run started from decides its pools: a rebuild needs it)
    const view = await api.importGame({
      settings: report.history.settings, commands: report.history.commands.slice(0, plan.version),
      start_profile: report.history.start_profile ?? null,
    });
    if (with_inputs && plan.inputs.length) {
      current = new Replay(report, plan, use_players_settings(report.client));
      input_state.replaying = true;
      requestAnimationFrame(current.tick);
      const speed = `at the player's game speed (x${G.SETTINGS.GAMESPEED})`;
      hud.message(plan.approximate
        ? `Replaying from the first action the recording has (the run was opened before it), ${speed}: the screen may differ a little.`
        : `Replaying the player's inputs ${speed}…`);
    } else {
      hud.message(`The run at version ${plan.version}. ${with_inputs ? 'No inputs were recorded after it.' : ''}`);
    }
    G.FUNCS.start_run(null, { open_id: view.id });
  } catch (err: any) {
    const code = err?.code;
    hud.message(code === 'not_admin' ? 'Only developers can open reports (BALATRO_REPORTS_ADMINS).'
      : code === 'import_forbidden' ? "The API doesn't let this account rebuild runs (BALATRO_API_ADMINS, or debug commands)."
        : `Couldn't replay the report: ${err?.message ?? err}`);
  }
}
