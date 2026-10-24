// Lua (LuaJIT) number formatting: tostring, string.format('%.Nf'/'%.Ng'),
// and the game's number_format / score_number_scale.

function trimZeros(s: string) {
  if (s.indexOf('.') < 0) return s;
  s = s.replace(/0+$/, '');
  return s.endsWith('.') ? s.slice(0, -1) : s;
}

/** C's %.<d>f, with round-half-even on exact ties */
export function fmtF(n: number, d = 6): string {
  if (!Number.isFinite(n)) return n > 0 ? 'inf' : n < 0 ? '-inf' : 'nan';
  const f = 10 ** d;
  const scaled = n * f;
  if (d <= 15 && Math.abs(scaled) < 2 ** 52 && Number.isInteger(scaled * 2) && !Number.isInteger(scaled)) {
    // an exact tie: round to even
    const lo = Math.floor(scaled);
    const even = lo % 2 === 0 ? lo : lo + 1;
    const s = (Math.abs(even) / f).toFixed(d);
    return (even < 0 || (even === 0 && n < 0) ? '-' : '') + s;
  }
  return n.toFixed(d);
}

/** C's %.<p>g */
export function fmtG(n: number, p = 6): string {
  if (!Number.isFinite(n)) return n > 0 ? 'inf' : n < 0 ? '-inf' : 'nan';
  if (p === 0) p = 1;
  if (n === 0) return Object.is(n, -0) ? '-0' : '0';
  const e = n.toExponential(p - 1);
  const X = parseInt(e.slice(e.indexOf('e') + 1), 10);
  if (X < -4 || X >= p) {
    const [mant, ex] = e.split('e');
    const xv = parseInt(ex, 10);
    const sign = xv < 0 ? '-' : '+';
    const digits = String(Math.abs(xv)).padStart(2, '0');
    return `${trimZeros(mant)}e${sign}${digits}`;
  }
  return trimZeros(n.toFixed(Math.max(0, p - 1 - X)));
}

/** Lua's tostring(): nil, booleans, strings and numbers as LuaJIT prints them */
export function tostring(v: any): string {
  if (v === null || v === undefined) return 'nil';
  if (typeof v === 'number') {
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    return fmtG(v, 14);
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

/** a tiny string.format for the specifiers the game uses */
export function format(fmt: string, ...args: any[]): string {
  let i = 0;
  return fmt.replace(/%([-0 +#]*)(\d*)(?:\.(\d+))?([sdfgi%])/g, (_m, flags: string, width: string, prec: string, conv: string) => {
    if (conv === '%') return '%';
    const v = args[i++];
    let s: string;
    if (conv === 's') s = tostring(v);
    else if (conv === 'd' || conv === 'i') s = String(Math.trunc(Number(v)));
    else if (conv === 'f') s = fmtF(Number(v), prec === undefined ? 6 : parseInt(prec, 10));
    else s = fmtG(Number(v), prec === undefined ? 6 : parseInt(prec, 10));
    const w = width ? parseInt(width, 10) : 0;
    if (s.length < w) s = flags.includes('-') ? s.padEnd(w) : s.padStart(w, flags.includes('0') ? '0' : ' ');
    return s;
  });
}

const reverse = (s: string) => [...s].reverse().join('');

export const E_SWITCH_POINT = 100000000000;

/** number_format: thousands separators, decimals by magnitude, e-notation above 1e11 */
export function number_format(num: any): string {
  if (num === null || num === undefined || typeof num !== 'number') return num ?? '';
  if (num >= E_SWITCH_POINT) {
    const x = Number(fmtG(num, 4));
    const fac = Math.floor(Math.log10(x));
    return fmtF(x / 10 ** fac, 3) + 'e' + fac;
  }
  const s = fmtF(num, num !== Math.floor(num) ? (num >= 100 ? 0 : num >= 10 ? 1 : 2) : 0);
  return reverse(reverse(s).replace(/(\d\d\d)/g, '$1,').replace(/,$/, ''));
}

export function score_number_scale(scale: number | undefined, amt: any): number {
  if (typeof amt !== 'number') return 0.7 * (scale ?? 1);
  if (amt >= E_SWITCH_POINT) return 0.7 * (scale ?? 1);
  if (amt >= 1000000) return 14 * 0.75 / (Math.floor(Math.log(amt)) + 4) * (scale ?? 1);
  return 0.75 * (scale ?? 1);
}

/** scale_number (button_callbacks.lua): shrinks a text's scale for big numbers */
export function scale_number(number: any, scale: number, max?: number) {
  const sp = E_SWITCH_POINT;
  if (number === undefined || number === null || typeof number !== 'number') return scale;
  if (!max) max = 10000;
  if (number >= sp) {
    scale = scale * Math.floor(Math.log10(max * 10)) / Math.floor(Math.log10(1000000 * 10));
  } else if (number >= max) {
    scale = scale * Math.floor(Math.log10(max * 10)) / Math.floor(Math.log10(number * 10));
  }
  return scale;
}
