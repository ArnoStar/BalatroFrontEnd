// engine/event.lua: timed events and the event queues.
import { G } from './globals';

export interface EventConfig {
  trigger?: 'immediate' | 'after' | 'before' | 'ease' | 'condition';
  blocking?: boolean;
  blockable?: boolean;
  start_timer?: boolean;
  func?: (...args: any[]) => any;
  delay?: number;
  no_delete?: boolean;
  pause_force?: boolean;
  timer?: 'TOTAL' | 'REAL' | 'UPTIME' | 'BACKGROUND' | 'REAL_SHADER';
  ease?: 'lerp' | 'elastic' | 'quad';
  ref_table?: any;
  ref_value?: string | number;
  ease_to?: number;
  stop_val?: any;
}

interface Results { blocking: boolean; completed: boolean; time_done: boolean; pause_skip: boolean }

export class Event {
  trigger: string;
  blocking: boolean;
  blockable: boolean;
  complete = false;
  start_timer: boolean;
  func: (...args: any[]) => any;
  delay: number;
  no_delete?: boolean;
  created_on_pause: boolean;
  timer: string;
  time: number;
  ease?: { type: string; ref_table: any; ref_value: any; start_val: number; end_val: number; start_time: number | null; end_time: number | null };
  condition?: { ref_table: any; ref_value: any; stop_val: any };

  constructor(config: EventConfig) {
    this.trigger = config.trigger ?? 'immediate';
    this.blocking = config.blocking ?? true;
    this.blockable = config.blockable ?? true;
    this.start_timer = config.start_timer ?? false;
    this.func = config.func ?? (() => true);
    this.delay = config.delay ?? 0;
    this.no_delete = config.no_delete;
    this.created_on_pause = !!(config.pause_force || G.SETTINGS.paused);
    this.timer = config.timer ?? (this.created_on_pause ? 'REAL' : 'TOTAL');

    if (this.trigger === 'ease') {
      this.ease = {
        type: config.ease ?? 'lerp',
        ref_table: config.ref_table,
        ref_value: config.ref_value,
        start_val: config.ref_table[config.ref_value as any],
        end_val: config.ease_to as number,
        start_time: null,
        end_time: null,
      };
      this.func = config.func ?? ((t: number) => t);
    }
    if (this.trigger === 'condition') {
      this.condition = { ref_table: config.ref_table, ref_value: config.ref_value, stop_val: config.stop_val };
      this.func = config.func ?? (() => this.condition!.ref_table[this.condition!.ref_value] === this.condition!.stop_val);
    }
    this.time = (G.TIMERS as any)[this.timer];
  }

  handle(r: Results) {
    r.blocking = this.blocking;
    r.completed = this.complete;
    if (this.created_on_pause === false && G.SETTINGS.paused) { r.pause_skip = true; return; }
    const now = () => (G.TIMERS as any)[this.timer] as number;
    if (!this.start_timer) { this.time = now(); this.start_timer = true; }
    if (this.trigger === 'after') {
      if (this.time + this.delay <= now()) {
        r.time_done = true;
        r.completed = truthy(this.func());
      }
    }
    if (this.trigger === 'ease') {
      const e = this.ease!;
      if (e.start_time === null) {
        e.start_time = now();
        e.end_time = now() + this.delay;
        e.start_val = e.ref_table[e.ref_value];
      }
      if (!this.complete) {
        if (e.end_time! >= now()) {
          let p = (e.end_time! - now()) / (e.end_time! - e.start_time!);
          if (e.type === 'lerp') {
            e.ref_table[e.ref_value] = this.func(p * e.start_val + (1 - p) * e.end_val);
          }
          if (e.type === 'elastic') {
            p = -Math.pow(2, 10 * p - 10) * Math.sin((p * 10 - 10.75) * 2 * Math.PI / 3);
            e.ref_table[e.ref_value] = this.func(p * e.start_val + (1 - p) * e.end_val);
          }
          if (e.type === 'quad') {
            p = p * p;
            e.ref_table[e.ref_value] = this.func(p * e.start_val + (1 - p) * e.end_val);
          }
        } else {
          e.ref_table[e.ref_value] = this.func(e.end_val);
          this.complete = true;
          r.completed = true;
          r.time_done = true;
        }
      }
    }
    if (this.trigger === 'condition') {
      if (!this.complete) r.completed = truthy(this.func());
      r.time_done = true;
    }
    if (this.trigger === 'before') {
      if (!this.complete) r.completed = truthy(this.func());
      if (this.time + this.delay <= now()) r.time_done = true;
    }
    if (this.trigger === 'immediate') {
      r.completed = truthy(this.func());
      r.time_done = true;
    }
    if (r.completed) this.complete = true;
  }
}

function truthy(v: any) { return v !== undefined && v !== null && v !== false; }

export type QueueName = 'unlock' | 'base' | 'tutorial' | 'achievement' | 'other';

export class EventManager {
  queues: Record<QueueName, Event[]> = { unlock: [], base: [], tutorial: [], achievement: [], other: [] };
  queue_timer: number;
  queue_dt = 1 / 60;
  queue_last_processed: number;
  private results: Results = { blocking: false, completed: false, time_done: false, pause_skip: false };

  constructor() {
    this.queue_timer = G.TIMERS.REAL;
    this.queue_last_processed = G.TIMERS.REAL;
  }

  add_event(event: Event, queue: QueueName = 'base', front = false) {
    if (!(event instanceof Event)) return;
    if (front) this.queues[queue].unshift(event);
    else this.queues[queue].push(event);
  }

  clear_queue(queue?: QueueName, exception?: QueueName) {
    const clear = (v: Event[]) => {
      let i = 0;
      while (i < v.length) {
        if (!v[i].no_delete) v.splice(i, 1);
        else i++;
      }
    };
    if (!queue) {
      for (const k of Object.keys(this.queues) as QueueName[]) clear(this.queues[k]);
    } else if (exception) {
      for (const k of Object.keys(this.queues) as QueueName[]) if (k !== exception) clear(this.queues[k]);
    } else {
      clear(this.queues[queue]);
    }
  }

  update(dt: number, forced = false) {
    this.queue_timer += dt;
    if (this.queue_timer >= this.queue_last_processed + this.queue_dt || forced) {
      this.queue_last_processed += forced ? 0 : this.queue_dt;
      for (const k of Object.keys(this.queues) as QueueName[]) {
        const v = this.queues[k];
        let blocked = false;
        let i = 0;
        while (i < v.length) {
          const r = this.results;
          r.blocking = false; r.completed = false; r.time_done = false; r.pause_skip = false;
          const ev = v[i];
          if (!blocked || !ev.blockable) ev.handle(r);
          if (r.pause_skip) {
            i++;
          } else {
            if (!blocked && r.blocking) blocked = true;
            if (r.completed && r.time_done) {
              // as table.remove(v, i), even if the event inserted others before it
              v.splice(i, 1);
            } else {
              i++;
            }
          }
        }
      }
    }
  }
}
