// The expression language of content mods: the twin of BalatroEngine's
// balatro/mods/expr.py (keep both in step). The engine runs a mod's effects;
// the game evaluates the expressions its cards' descriptions show (`vars`).
//
// Grammar (lowest precedence first): or, and, not, a comparison (no chains),
// + -, * / %, unary -, ^ (right), field access (.name), then numbers,
// 'strings', true/false/nil, calls name(args) and names, ( ). As in Lua, only
// false and nil are false, `and`/`or` give an operand, / by zero is inf or
// nan, % is Lua's modulo; a type mismatch gives nil instead of an error.

export type Node =
  | ['num', number] | ['str', string] | ['const', boolean | null]
  | ['var', string, string[]] | ['field', Node, string] | ['call', string, Node[]]
  | ['and', Node, Node] | ['or', Node, Node] | ['not', Node] | ['neg', Node] | ['bin', string, Node, Node];

export class ExprError extends Error {}

export interface Env {
  lookup(root: string, path: string[]): unknown;
  field(value: unknown, name: string): unknown;
  call(name: string, args: unknown[]): unknown;
}

const MAX_LENGTH = 500;
const MAX_DEPTH = 32;
const TOKEN = /\s+|(\d+(?:\.\d+)?)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|[<>+\-*/%^(),.])/y;
const KEYWORDS = new Set(['and', 'or', 'not', 'true', 'false', 'nil']);
const COMPARE = new Set(['==', '!=', '<', '<=', '>', '>=']);

type Tok = [kind: 'num' | 'str' | 'name' | 'kw' | 'op' | 'end', text: string];

function tokens(src: string): Tok[] {
  const out: Tok[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < src.length) {
    const at = TOKEN.lastIndex;
    const m = TOKEN.exec(src);
    if (!m || m.index !== at) throw new ExprError(`unexpected '${src[at]}' at ${at + 1}`);
    if (m[1] !== undefined) out.push(['num', m[1]]);
    else if (m[2] !== undefined) out.push(['str', m[2]]);
    else if (m[3] !== undefined) out.push([KEYWORDS.has(m[3]) ? 'kw' : 'name', m[3]]);
    else if (m[4] !== undefined) out.push(['op', m[4]]);
  }
  out.push(['end', '']);
  return out;
}

class Parser {
  toks: Tok[];
  i = 0;
  depth = 0;
  constructor(src: string) { this.toks = tokens(src); }
  peek(): Tok { return this.toks[this.i]; }
  take(): Tok { return this.toks[this.i++]; }
  is(kind: string, text: string) { const t = this.peek(); return t[0] === kind && t[1] === text; }
  nest() { if (++this.depth > MAX_DEPTH) throw new ExprError('the expression is nested too deeply'); }
  expect(text: string) {
    const [kind, t] = this.take();
    if (t !== text || (kind !== 'op' && kind !== 'kw')) throw new ExprError(`expected '${text}', found '${t || 'the end'}'`);
  }
  parse(): Node {
    const n = this.or();
    if (this.peek()[0] !== 'end') throw new ExprError(`unexpected '${this.peek()[1]}'`);
    return n;
  }
  or(): Node { let n = this.and(); while (this.is('kw', 'or')) { this.take(); n = ['or', n, this.and()]; } return n; }
  and(): Node { let n = this.not(); while (this.is('kw', 'and')) { this.take(); n = ['and', n, this.not()]; } return n; }
  not(): Node {
    if (this.is('kw', 'not')) { this.take(); this.nest(); const n: Node = ['not', this.not()]; this.depth--; return n; }
    return this.compare();
  }
  compare(): Node {
    let n = this.sum();
    const [kind, t] = this.peek();
    if (kind === 'op' && COMPARE.has(t)) {
      this.take();
      n = ['bin', t, n, this.sum()];
      const [k2, t2] = this.peek();
      if (k2 === 'op' && COMPARE.has(t2)) throw new ExprError("comparisons don't chain: use 'and'");
    }
    return n;
  }
  sum(): Node {
    let n = this.product();
    while (this.peek()[0] === 'op' && (this.peek()[1] === '+' || this.peek()[1] === '-')) { const op = this.take()[1]; n = ['bin', op, n, this.product()]; }
    return n;
  }
  product(): Node {
    let n = this.unary();
    while (this.peek()[0] === 'op' && ['*', '/', '%'].includes(this.peek()[1])) { const op = this.take()[1]; n = ['bin', op, n, this.unary()]; }
    return n;
  }
  unary(): Node {
    if (this.is('op', '-')) { this.take(); this.nest(); const n: Node = ['neg', this.unary()]; this.depth--; return n; }
    return this.power();
  }
  power(): Node {
    let n = this.postfix();
    if (this.is('op', '^')) { this.take(); this.nest(); n = ['bin', '^', n, this.unary()]; this.depth--; }
    return n;
  }
  postfix(): Node {
    let n = this.primary();
    while (this.is('op', '.')) {
      this.take();
      const [kind, name] = this.take();
      if (kind !== 'name') throw new ExprError(`expected a field name after '.', found '${name || 'the end'}'`);
      n = n[0] === 'var' ? ['var', n[1], [...n[2], name]] : ['field', n, name];
    }
    return n;
  }
  primary(): Node {
    const [kind, t] = this.take();
    if (kind === 'num') return ['num', Number(t)];
    if (kind === 'str') return ['str', t.slice(1, -1).replace(/\\(.)/g, '$1')];
    if (kind === 'kw' && (t === 'true' || t === 'false' || t === 'nil')) return ['const', t === 'nil' ? null : t === 'true'];
    if (kind === 'name') {
      if (this.is('op', '(')) {
        this.take();
        this.nest();
        const args: Node[] = [];
        if (!this.is('op', ')')) {
          args.push(this.or());
          while (this.is('op', ',')) { this.take(); args.push(this.or()); }
        }
        this.expect(')');
        this.depth--;
        return ['call', t, args];
      }
      return ['var', t, []];
    }
    if (kind === 'op' && t === '(') { this.nest(); const n = this.or(); this.expect(')'); this.depth--; return n; }
    throw new ExprError(`unexpected '${t || 'the end'}'`);
  }
}

const cache = new Map<string, Node>();

/** The expression's syntax tree (a number or true/false stands for itself); ExprError if it doesn't parse. */
export function parse(src: string | number | boolean): Node {
  if (typeof src === 'number') return ['num', src];
  if (typeof src === 'boolean') return ['const', src];
  const hit = cache.get(src);
  if (hit) return hit;
  if (src.length > MAX_LENGTH) throw new ExprError(`an expression has at most ${MAX_LENGTH} characters`);
  if (!src.trim()) throw new ExprError('the expression is empty');
  const n = new Parser(src).parse();
  cache.set(src, n);
  return n;
}

export const truthy = (v: unknown) => v !== null && v !== undefined && v !== false;
const num = (v: unknown): v is number => typeof v === 'number';

function lua_mod(a: number, b: number) { return b === 0 ? NaN : a - Math.floor(a / b) * b; }

function same(a: unknown, b: unknown) {
  if (num(a) && num(b)) return a === b;
  if ((a ?? null) === null && (b ?? null) === null) return true;
  return a === b;
}

function arith(op: string, a: unknown, b: unknown): unknown {
  if (!num(a) || !num(b)) return null;
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '%': return lua_mod(a, b);
    case '^': return Math.pow(a, b);
    default: return null;
  }
}

function compare(op: string, a: unknown, b: unknown): unknown {
  if (op === '==') return same(a, b);
  if (op === '!=') return !same(a, b);
  if (!num(a) || !num(b)) return null;
  return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
}

const nums = (f: (...a: number[]) => number) => (...a: unknown[]) => (a.every(num) ? f(...(a as number[])) : null);
export const PURE_FUNCTIONS: Record<string, (...a: unknown[]) => unknown> = {
  min: nums(Math.min), max: nums(Math.max), floor: nums(Math.floor), ceil: nums(Math.ceil), abs: nums(Math.abs),
  round: nums((x) => Math.floor(x + 0.5)), clamp: nums((x, lo, hi) => Math.max(lo, Math.min(hi, x))),
};

export function evaluate(n: Node, env: Env): unknown {
  switch (n[0]) {
    case 'num': case 'str': case 'const': return n[1];
    case 'var': return env.lookup(n[1], n[2]);
    case 'field': { const base = evaluate(n[1], env); return base === null || base === undefined ? null : env.field(base, n[2]); }
    case 'and': { const a = evaluate(n[1], env); return truthy(a) ? evaluate(n[2], env) : a; }
    case 'or': { const a = evaluate(n[1], env); return truthy(a) ? a : evaluate(n[2], env); }
    case 'not': return !truthy(evaluate(n[1], env));
    case 'neg': { const v = evaluate(n[1], env); return num(v) ? -v : null; }
    case 'bin': {
      const a = evaluate(n[2], env), b = evaluate(n[3], env);
      return COMPARE.has(n[1]) ? compare(n[1], a, b) : arith(n[1], a, b);
    }
    case 'call': {
      const [, name, args] = n;
      if (name === 'if') return truthy(evaluate(args[0], env)) ? evaluate(args[1], env) : evaluate(args[2], env);
      const values = args.map((a) => evaluate(a, env));
      if (PURE_FUNCTIONS[name]) return PURE_FUNCTIONS[name](...values);
      return env.call(name, values);
    }
  }
}

/** Evaluate an expression's source; nil (null) when it doesn't parse. */
export function value_of(src: string | number | boolean, env: Env): unknown {
  try { return evaluate(parse(src), env); } catch { return null; }
}
