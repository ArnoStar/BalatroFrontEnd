// Helpers for data that comes from Lua tables (via JSON): a Lua sequence is a
// JSON array, but an empty or holed table becomes an object.

/** the values of a Lua sequence (ipairs): arrays as they are, objects by their numeric keys 1, 2, ... */
export function ipairs<T = any>(t: any): T[] {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  if (typeof t !== 'object') return [];
  const out: T[] = [];
  for (let i = 1; t[i] !== undefined || t[String(i)] !== undefined; i++) out.push(t[i] ?? t[String(i)]);
  return out;
}

/** Lua's `#t` for a sequence */
export function len(t: any): number {
  return ipairs(t).length;
}

/** Lua truthiness: only nil and false are false */
export function truthy(v: any): boolean {
  return v !== undefined && v !== null && v !== false;
}

/** `next(t) ~= nil`: the table has any entry */
export function has_entries(t: any): boolean {
  if (!t) return false;
  if (Array.isArray(t)) return t.length > 0;
  return Object.keys(t).length > 0;
}
