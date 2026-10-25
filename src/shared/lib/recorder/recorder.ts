// The game's flight recorder, for bug reports: the last minutes of what
// happened, in order, so a developer can see the bug again.
//
//   input   the player's mouse and keys, in game units (shared/lib/input)
//   api     every request to the game API, its response and request id
//   action  each player action: start (what was sent) and end (the version after)
//   run     a run opened (its id and version): where a replay can start
//   state   G.STATE / G.STAGE changes
//   log     console warnings and errors; uncaught errors are also in `errors`
//
// Times (`t`) are seconds since the page loaded (performance.now). Old events
// fall off after WINDOW_S or MAX_EVENTS; errors are kept apart (MAX_ERRORS),
// so a report always has them. Only the last few API responses are kept
// whole: the run's history rebuilds every state exactly anyway.

export type RecordedEvent = { t: number; k: string; [key: string]: unknown };

export interface RecordedError {
  t: number;
  message: string;
  stack?: string;
  source: 'console' | 'uncaught' | 'rejection';
}

export interface Recording {
  format: 1;
  /** when the page loaded (ISO time) */
  page_started_at: string;
  /** seconds since the page loaded, when the recording was taken */
  t: number;
  /** events that fell off the start of the buffer */
  dropped: number;
  events: RecordedEvent[];
  errors: RecordedError[];
}

const WINDOW_S = 15 * 60;
const MAX_EVENTS = 40_000;
const MAX_ERRORS = 100;
const FULL_RESPONSES = 4;
const MAX_TEXT = 4_000;

type Listener = (e: RecordedEvent) => void;

function clip(s: string, n = MAX_TEXT) {
  return s.length > n ? `${s.slice(0, n)}… (${s.length - n} more)` : s;
}

function describe(arg: unknown): string {
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/** a GameView (or an ActionResult) in a few fields */
function digest(body: any): unknown {
  if (!body || typeof body !== 'object') return body;
  const g = body.game && typeof body.game === 'object' ? body.game : body;
  if (typeof g.version !== 'number') return { keys: Object.keys(body).slice(0, 12) };
  return {
    version: g.version, phase: g.phase, state: g.state, ante: g.ante, round: g.round, dollars: g.dollars,
    hand: Array.isArray(g.hand) ? g.hand.map((c: any) => c.id) : undefined,
    jokers: Array.isArray(g.jokers) ? g.jokers.map((c: any) => c.key ?? c.id) : undefined,
    events: Array.isArray(body.events) ? body.events.length : undefined,
  };
}

class Recorder {
  private events: RecordedEvent[] = [];
  private errors: RecordedError[] = [];
  private dropped = 0;
  private full: RecordedEvent[] = []; // api events that still hold their whole response
  private listeners = new Set<Listener>();
  private shots: Array<(url: string | null) => void> = [];
  private installed = false;
  readonly page_started_at = new Date().toISOString();
  /** false while a report is being written (its typing isn't the game's) */
  enabled = true;

  now() {
    return performance.now() / 1000;
  }

  record(k: string, data: Record<string, unknown> = {}): RecordedEvent {
    const e: RecordedEvent = { t: Math.round(this.now() * 1000) / 1000, k, ...data };
    if (this.enabled) {
      this.events.push(e);
      this.trim(e.t);
    }
    for (const l of this.listeners) {
      try {
        l(e);
      } catch {
        /* a listener's problem isn't the recording's */
      }
    }
    return e;
  }

  private trim(now: number) {
    let cut = 0;
    while (cut < this.events.length && (this.events.length - cut > MAX_EVENTS || now - this.events[cut].t > WINDOW_S)) cut++;
    if (cut) {
      this.events.splice(0, cut);
      this.dropped += cut;
    }
  }

  /** an API call and its answer */
  api(method: string, path: string, req: unknown, status: number, ms: number, request_id: string | null, res: unknown) {
    const e = this.record('api', { method, path, status, ms: Math.round(ms), rid: request_id, req, res });
    if (res && typeof res === 'object') {
      this.full.push(e);
      while (this.full.length > FULL_RESPONSES) {
        const old = this.full.shift()!;
        old.res = digest(old.res);
      }
    }
  }

  error(message: unknown, source: RecordedError['source'], extra?: unknown) {
    const text = clip(describe(message));
    const err: RecordedError = { t: Math.round(this.now() * 1000) / 1000, message: text.split('\n')[0], source };
    if (text.includes('\n')) err.stack = text;
    if (extra !== undefined) err.stack = clip(`${err.stack ?? ''}\n${describe(extra)}`.trim());
    this.errors.push(err);
    if (this.errors.length > MAX_ERRORS) this.errors.splice(0, this.errors.length - MAX_ERRORS);
    this.record('log', { level: 'error', message: err.message });
    for (const l of this.listeners) l({ t: err.t, k: 'error', message: err.message });
  }

  /** console errors and warnings, uncaught errors and rejections */
  install() {
    if (this.installed) return;
    this.installed = true;
    const con = console as any;
    for (const level of ['error', 'warn'] as const) {
      const original = con[level].bind(console);
      con[level] = (...args: unknown[]) => {
        if (level === 'error') this.error(args.map(describe).join(' '), 'console');
        else this.record('log', { level, message: clip(args.map(describe).join(' '), 1000) });
        original(...args);
      };
    }
    window.addEventListener('error', (e) => this.error(e.error ?? e.message, 'uncaught', e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined));
    window.addEventListener('unhandledrejection', (e) => this.error(e.reason, 'rejection'));
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** a copy of the buffer (for a report) */
  snapshot(): Recording {
    return {
      format: 1, page_started_at: this.page_started_at, t: Math.round(this.now() * 1000) / 1000, dropped: this.dropped,
      events: JSON.parse(JSON.stringify(this.events)), errors: [...this.errors],
    };
  }

  /** the canvas as a JPEG data URL, read right after the next frame is drawn */
  screenshot(): Promise<string | null> {
    return new Promise((resolve) => {
      this.shots.push(resolve);
      setTimeout(() => {
        const i = this.shots.indexOf(resolve);
        if (i >= 0) {
          this.shots.splice(i, 1);
          resolve(null); // no frame drawn (the loop stopped)
        }
      }, 2000);
    });
  }

  /** the game loop calls this right after drawing a frame */
  after_draw(canvas: HTMLCanvasElement) {
    if (!this.shots.length) return;
    let url: string | null = null;
    try {
      url = canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      url = null;
    }
    for (const done of this.shots.splice(0)) done(url);
  }
}

export const recorder = new Recorder();
