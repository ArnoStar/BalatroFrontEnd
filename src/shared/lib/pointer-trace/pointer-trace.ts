// The player's pointer between two actions, sent with the second one (the
// API keeps it with the run), so a watched run shows the player's own
// movements and clicks instead of a made-up pointer (features/watch-run).
//
// A trace starts when an action ends (or a run opens) and is taken when the
// next action is sent. Its entries, in milliseconds since it started:
//
//   [t, 'm', x, y]            the pointer moved (game units, as shared/lib/input records them)
//   [t, 'd', x, y, button]    a button went down
//   [t, 'u', x, y, button]    and up
//   [t, 'h', area, ...ids]    the cards highlighted in an area changed (card ids): what the clicks selected
//
// It changes nothing in the game; the API stores it as it is.
import { G } from '@/shared/lib/engine';
import { recorder } from '@/shared/lib/recorder';

export type PointerEntry = (number | string)[];
export interface PointerTrace { v: 1; e: PointerEntry[] }

const MAX_ENTRIES = 4000; // the API's limit
const DROP = 500; // entries dropped from the start when it is full

/** the areas whose highlighted cards a trace follows, by the names its entries use */
export const TRACE_AREAS: Record<string, () => any> = {
  hand: () => G.hand,
  jokers: () => G.jokers,
  consumeables: () => G.consumeables,
  shop_jokers: () => G.shop_jokers,
  shop_vouchers: () => G.shop_vouchers,
  shop_booster: () => G.shop_booster,
  pack_cards: () => G.pack_cards,
};

const r2 = (v: unknown) => Math.round(Number(v) * 100) / 100;

function highlighted(area: any): number[] {
  return (area?.highlighted ?? []).map((c: any) => c.api_id).filter((id: unknown) => typeof id === 'number');
}

class Tracer {
  /** false while a run is watched (the pointer isn't the player's) */
  enabled = true;
  private entries: PointerEntry[] = [];
  private t0 = 0;
  private seen: Record<string, string> = {};
  private installed = false;

  install() {
    if (this.installed) return;
    this.installed = true;
    recorder.on((e) => {
      if (e.k === 'run' || (e.k === 'action' && e.phase === 'end')) this.restart();
      else if (e.k === 'input' && (e.type === 'move' || e.type === 'down' || e.type === 'up')) {
        const code = e.type === 'move' ? 'm' : e.type === 'down' ? 'd' : 'u';
        this.add(code === 'm' ? [code, r2(e.x), r2(e.y)] : [code, r2(e.x), r2(e.y), Number(e.button ?? 0)]);
      }
    });
    const frame = () => {
      this.check_highlights();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private now() {
    return performance.now();
  }

  private restart() {
    this.entries = [];
    this.t0 = this.now();
    this.seen = {};
    for (const [name, get] of Object.entries(TRACE_AREAS)) this.seen[name] = highlighted(get()).join(',');
  }

  private add(rest: PointerEntry) {
    if (!this.enabled || !this.t0) return;
    this.entries.push([Math.round(this.now() - this.t0), ...rest]);
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, DROP);
  }

  private check_highlights() {
    if (!this.enabled || !this.t0 || !G.STAGE) return;
    for (const [name, get] of Object.entries(TRACE_AREAS)) {
      const ids = highlighted(get());
      const sig = ids.join(',');
      if (sig !== (this.seen[name] ?? '')) {
        this.seen[name] = sig;
        this.add(['h', name, ...ids.slice(0, 20)]);
      }
    }
  }

  /** the trace so far, for the action being sent (null: nothing to send); the next one starts when it ends */
  take(): PointerTrace | null {
    if (!this.enabled || !this.t0) return null;
    this.check_highlights();
    const e = this.entries;
    this.entries = [];
    return e.length ? { v: 1, e } : null;
  }
}

export const pointer_trace = new Tracer();
