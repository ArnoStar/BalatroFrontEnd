// Colour helpers from misc_functions.lua. Colours are [r, g, b, a] in 0..1.
export type Colour = number[];

export function HEX(hex: string): Colour {
  if (hex.length <= 6) hex = hex + 'FF';
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16), a = parseInt(hex.slice(6, 8), 16);
  return [r / 255, g / 255, b / 255, Number.isNaN(a) ? 1 : a / 255];
}

export function mix_colours(C1: Colour, C2: Colour, p: number): Colour {
  return [
    (C1[0] ?? 0.5) * p + (C2[0] ?? 0.5) * (1 - p),
    (C1[1] ?? 0.5) * p + (C2[1] ?? 0.5) * (1 - p),
    (C1[2] ?? 0.5) * p + (C2[2] ?? 0.5) * (1 - p),
    (C1[3] ?? 1) * p + (C2[3] ?? 1) * (1 - p),
  ];
}

export function lighten(c: Colour, percent: number): Colour {
  return [c[0] * (1 - percent) + percent, c[1] * (1 - percent) + percent, c[2] * (1 - percent) + percent, c[3]];
}

export function darken(c: Colour, percent: number): Colour {
  return [c[0] * (1 - percent), c[1] * (1 - percent), c[2] * (1 - percent), c[3]];
}

export function adjust_alpha(c: Colour, a: number): Colour {
  return [c[0], c[1], c[2], a];
}

/** a deep copy (copy_table) of plain data: arrays and objects */
export function copy_table<T>(o: T): T {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map((v) => copy_table(v)) as any;
  const out: any = {};
  for (const k of Object.keys(o as any)) out[k] = copy_table((o as any)[k]);
  return out;
}
