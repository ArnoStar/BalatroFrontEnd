// engine/particles.lua
import { G } from './globals';
import { love } from '../love';
import { Moveable } from './moveable';
import { Event } from './event';
import { add_to_drawhash, prep_draw, pseudorandom_element, remove_all } from './util';

export interface ParticlesConfig {
  fill?: boolean; padding?: number; attach?: any; timer?: number; timer_type?: string; lifespan?: number;
  speed?: number; max?: number; pulse_max?: number; vel_variation?: number; scale?: number; colours?: any[];
  initialize?: boolean;
}

export class Particles extends Moveable {
  fill?: boolean;
  padding!: number;
  timer!: number;
  timer_type!: string;
  last_real_time!: number;
  last_drawn!: number;
  lifespan!: number;
  fade_alpha!: number;
  speed!: number;
  max!: number;
  pulse_max!: number;
  pulsed!: number;
  vel_variation!: number;
  particles!: any[];
  scale!: number;
  colours!: any[];

  constructor(X?: number, Y?: number, W?: number, H?: number, config?: ParticlesConfig) {
    super();
    if (X !== undefined) this.init_particles(X, Y!, W!, H!, config ?? {});
  }

  init_particles(X: number, Y: number, W: number, H: number, config: ParticlesConfig) {
    this.init_moveable(X, Y, W, H);
    this.fill = config.fill;
    this.padding = config.padding ?? 0;
    if (config.attach) {
      this.set_alignment({ major: config.attach, type: 'cm', bond: 'Strong' });
      const kids = this.role.major.children;
      if (Array.isArray(kids)) kids.push(this);
      else { let i = 0; while (kids[i] !== undefined) i++; kids[i] = this; }
      this.parent = this.role.major;
      this.T.x = this.role.major.T.x + this.padding;
      this.T.y = this.role.major.T.y + this.padding;
      if (this.fill) {
        this.T.w = this.role.major.T.w - this.padding;
        this.T.h = this.role.major.T.h - this.padding;
      }
    }
    this.states.hover.can = false;
    this.states.click.can = false;
    this.states.collide.can = false;
    this.states.drag.can = false;
    this.states.release_on.can = false;
    this.timer = config.timer ?? 0.5;
    this.timer_type = this.created_on_pause ? 'REAL' : (config.timer_type ?? 'REAL');
    this.last_real_time = (G.TIMERS as any)[this.timer_type] - this.timer;
    this.last_drawn = 0;
    this.lifespan = config.lifespan ?? 1;
    this.fade_alpha = 0;
    this.speed = config.speed ?? 1;
    this.max = config.max ?? 1000000000000000;
    this.pulse_max = Math.min(20, config.pulse_max ?? 0);
    this.pulsed = 0;
    this.vel_variation = config.vel_variation ?? 1;
    this.particles = [];
    this.scale = config.scale ?? 1;
    this.colours = config.colours ?? [G.C.BACKGROUND.D];
    if (config.initialize) {
      for (let i = 0; i < 60; i++) {
        this.last_real_time = this.last_real_time - 15 / 60;
        this.update(15 / 60);
        this.move(15 / 60);
      }
    }
    if (Object.getPrototypeOf(this) === Particles.prototype) G.I.MOVEABLE.push(this);
  }

  update(_dt: number) {
    if (G.SETTINGS.paused && !this.created_on_pause) { this.last_real_time = (G.TIMERS as any)[this.timer_type]; return; }
    let added = 0;
    const now = (G.TIMERS as any)[this.timer_type];
    while (now > this.last_real_time + this.timer && (this.particles.length < this.max || this.pulsed < this.pulse_max) && added < 20) {
      this.last_real_time = this.last_real_time + this.timer;
      let new_offset = {
        x: this.fill ? (0.5 - Math.random()) * this.T.w : 0,
        y: this.fill ? (0.5 - Math.random()) * this.T.h : 0,
      };
      if (this.fill && this.T.r < 0.1 && this.T.r > -0.1) {
        new_offset = {
          x: Math.sin(this.T.r) * new_offset.y + Math.cos(this.T.r) * new_offset.x,
          y: Math.sin(this.T.r) * new_offset.x + Math.cos(this.T.r) * new_offset.y,
        };
      }
      this.particles.push({
        draw: false,
        dir: Math.random() * 2 * Math.PI,
        facing: Math.random() * 2 * Math.PI,
        size: Math.random() * 0.5 + 0.1,
        age: 0,
        velocity: this.speed * (this.vel_variation * Math.random() + (1 - this.vel_variation)) * 0.7,
        r_vel: 0.2 * (0.5 - Math.random()),
        e_prev: 0,
        e_curr: 0,
        scale: 0,
        visible_scale: 0,
        time: now,
        colour: pseudorandom_element(this.colours)[0],
        offset: new_offset,
      });
      added++;
      if (this.pulsed <= this.pulse_max) this.pulsed++;
    }
  }

  move(dt: number) {
    if (G.SETTINGS.paused && !this.created_on_pause) return;
    super.move(dt);
    if (this.timer_type !== 'REAL') dt = dt * G.SPEEDFACTOR;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.draw = true;
      p.e_vel = p.e_vel ?? dt * this.scale;
      p.e_prev = p.e_curr;
      p.age = p.age + dt;
      p.e_curr = Math.min(2 * Math.min((p.age / this.lifespan) * this.scale, this.scale * ((this.lifespan - p.age) / this.lifespan)), this.scale);
      p.e_vel = (p.e_curr - p.e_prev) * this.scale * dt + (1 - this.scale * dt) * p.e_vel;
      p.scale = p.scale + p.e_vel;
      p.scale = Math.min(2 * Math.min((p.age / this.lifespan) * this.scale, this.scale * ((this.lifespan - p.age) / this.lifespan)), this.scale);
      if (p.scale < 0) {
        this.particles.splice(i, 1);
      } else {
        p.offset.x = p.offset.x + p.velocity * Math.sin(p.dir) * dt;
        p.offset.y = p.offset.y + p.velocity * Math.cos(p.dir) * dt;
        p.facing = p.facing + p.r_vel * dt;
        p.velocity = Math.max(0, p.velocity - p.velocity * 0.07 * dt);
      }
    }
  }

  fade(delay: number, to?: number) {
    G.E_MANAGER.add_event(new Event({
      trigger: 'ease', timer: this.timer_type as any, blockable: false, blocking: false,
      ref_value: 'fade_alpha', ref_table: this, ease_to: to ?? 1, delay,
    }));
  }

  draw(alpha?: number) {
    alpha = alpha ?? 1;
    const g = love.graphics;
    prep_draw(this, 1);
    g.translate(this.T.w / 2, this.T.h / 2);
    for (const v of this.particles) {
      if (v.draw) {
        g.push();
        g.setColor(v.colour[0], v.colour[1], v.colour[2], v.colour[3] * alpha * (1 - this.fade_alpha));
        g.translate(v.offset.x, v.offset.y);
        g.rotate(v.facing);
        g.rectangle('fill', -v.scale / 2, -v.scale / 2, v.scale, v.scale);
        g.pop();
      }
    }
    g.pop();
    add_to_drawhash(this);
    this.draw_boundingrect();
  }

  remove() {
    if (this.role.major) {
      const kids = this.role.major.children;
      if (Array.isArray(kids)) { const i = kids.indexOf(this); if (i >= 0) kids.splice(i, 1); }
      else for (const k of Object.keys(kids)) if (kids[k] === this && /^\d+$/.test(k)) delete kids[k];
    }
    remove_all(this.children);
    super.remove();
  }
}
