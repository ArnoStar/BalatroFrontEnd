// Engine helpers from misc_functions.lua (drawing, vectors, tables).
import { G } from './globals';
import { love } from '../love';

/** Lua's math.random(): [0,1), (m) -> 1..m, (m, n) -> m..n */
export function math_random(m?: number, n?: number): number {
  if (m === undefined) return Math.random();
  if (n === undefined) return 1 + Math.floor(Math.random() * m);
  return m + Math.floor(Math.random() * (n - m + 1));
}

/** pseudorandom_element(t) for visuals: a random value (and its key) of an array or object */
export function pseudorandom_element<T = any>(t: any): [T, any] {
  const keys = Array.isArray(t) ? t.map((_: any, i: number) => i) : Object.keys(t).sort();
  const key = keys[Math.floor(Math.random() * keys.length)];
  return [t[key], key];
}

/** clears a table in place (EMPTY) */
export function EMPTY<T extends object>(t: T | undefined | null): T {
  if (!t) return (Array.isArray(t) ? [] : {}) as T;
  if (Array.isArray(t)) { t.length = 0; return t; }
  for (const k of Object.keys(t)) delete (t as any)[k];
  return t;
}

export function interp(per: number, max: number, min = 0) {
  return per * (max - min) + min;
}

/** iterate a Lua-style children table: array entries and named entries */
export function each(t: any, f: (v: any, k: string) => void) {
  if (!t) return;
  for (const k of Object.keys(t)) {
    const v = t[k];
    if (v !== undefined && v !== null) f(v, k);
  }
}

/** remove_all: removes every node of a list or children table */
export function remove_all(t: any) {
  if (!t) return;
  if (Array.isArray(t)) {
    for (let i = t.length - 1; i >= 0; i--) {
      const v = t[i];
      t.splice(i, 1);
      if (v && v.children) remove_all(v.children);
      if (v) v.remove();
    }
  }
  for (const k of Object.keys(t)) {
    const v = t[k];
    if (!v) continue;
    if (v.children) remove_all(v.children);
    v.remove();
  }
}

export function Vector_Dist(t1: any, t2: any, mid?: boolean) {
  const x = t1.x - t2.x + (mid ? 0.5 * (t1.w - t2.w) : 0);
  const y = t1.y - t2.y + (mid ? 0.5 * (t1.h - t2.h) : 0);
  return Math.sqrt(x * x + y * y);
}

export function Vector_Len(t: any) { return Math.sqrt(t.x * t.x + t.y * t.y); }
export function Vector_Sub(a: any, b: any) { return { x: a.x - b.x, y: a.y - b.y }; }

export function get_index(t: any[], val: any) {
  let index: number | null = null;
  t.forEach((v, i) => { if (v === val) index = i; });
  return index;
}

export function table_length(t: any) { return t ? Object.keys(t).length : 0; }

/** remove an element from an array by identity */
export function array_remove(t: any[], v: any) {
  const i = t.indexOf(v);
  if (i >= 0) t.splice(i, 1);
  return i >= 0;
}

export function reset_drawhash() { G.DRAW_HASH.length = 0; }
export function add_to_drawhash(obj: any) { if (obj) G.DRAW_HASH.push(obj); }

export function prep_draw(moveable: any, scale: number, rotate?: number, offset?: { x: number; y: number }) {
  const g = love.graphics;
  g.push();
  g.scale(G.TILESCALE * G.TILESIZE);
  const lp = moveable.layered_parallax ?? moveable.parent?.layered_parallax;
  g.translate(
    moveable.VT.x + moveable.VT.w / 2 + (offset ? offset.x : 0) + (lp?.x ?? 0),
    moveable.VT.y + moveable.VT.h / 2 + (offset ? offset.y : 0) + (lp?.y ?? 0),
  );
  if (moveable.VT.r !== 0 || moveable.juice || rotate) g.rotate(moveable.VT.r + (rotate ?? 0));
  g.translate(-scale * moveable.VT.w * moveable.VT.scale / 2, -scale * moveable.VT.h * moveable.VT.scale / 2);
  g.scale(moveable.VT.scale * scale);
}

export function get_chosen_triangle_from_rect(x: number, y: number, w: number, h: number, vert: boolean) {
  const scale = 2;
  if (vert) {
    x = x + Math.min(0.6 * Math.sin(G.TIMERS.REAL * 9) * scale + 0.2, 0);
    return [x - 3.5 * scale, y + h / 2 - 1.5 * scale, x - 0.5 * scale, y + h / 2, x - 3.5 * scale, y + h / 2 + 1.5 * scale];
  }
  y = y + Math.min(0.6 * Math.sin(G.TIMERS.REAL * 9) * scale + 0.2, 0);
  return [x + w / 2 - 1.5 * scale, y - 4 * scale, x + w / 2, y - 1.1 * scale, x + w / 2 + 1.5 * scale, y - 4 * scale];
}

export function point_translate(T: { x: number; y: number }, d: { x: number; y: number }) {
  T.x = (T.x + d.x) || 0;
  T.y = (T.y + d.y) || 0;
}

export function point_rotate(T: { x: number; y: number }, angle: number) {
  const c = Math.cos(angle + Math.PI / 2), s = Math.sin(angle + Math.PI / 2), ox = T.x, oy = T.y;
  T.x = -oy * c + ox * s;
  T.y = oy * s + ox * c;
}
