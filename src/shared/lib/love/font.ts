// Fonts as LÖVE 11 renders them: glyph bitmaps, bearings and advances dumped
// from LÖVE itself (tools/love/fontdump), laid out with LÖVE's
// Font::generateVertices rules.
import type { Graphics, Image, Colour } from './graphics';

export interface GlyphInfo {
  cp: number; w: number; h: number; bx: number; by: number; adv: number; spacing: number; x: number; y: number;
}
export interface FontDump {
  size: number; height: number; baseline: number; ascent: number; descent: number; lineHeight: number;
  atlasW: number; atlasH: number; glyphs: GlyphInfo[]; kerning: [number, number, number][];
}

/** a colored string as LÖVE accepts: 'text' or {colour, 'text', colour, 'text', ...} */
export type ColoredText = string | (Colour | string)[];

export class Font {
  image: Image;
  dump: FontDump;
  glyphs = new Map<number, GlyphInfo>();
  kerning = new Map<number, number>();

  constructor(image: Image, dump: FontDump) {
    this.image = image;
    this.dump = dump;
    for (const g of dump.glyphs) this.glyphs.set(g.cp, g);
    for (const [a, b, k] of dump.kerning) this.kerning.set(a * 65536 + b, k);
  }

  private glyph(cp: number): GlyphInfo | undefined {
    return this.glyphs.get(cp) ?? this.glyphs.get(63);
  }

  getHeight() { return this.dump.height; }
  getBaseline() { return this.dump.baseline; }
  getLineHeight() { return this.dump.lineHeight; }

  getKerning(a: number, b: number) {
    return this.kerning.get(a * 65536 + b) ?? 0;
  }

  /** width of the widest line, in font pixels */
  getWidth(text: string): number {
    let max = 0;
    for (const line of String(text).split('\n')) {
      let w = 0, prev = 0;
      for (const ch of line) {
        const cp = ch.codePointAt(0)!;
        if (cp === 13) continue;
        const g = this.glyph(cp);
        w += (g ? g.spacing : 0) + (prev ? this.getKerning(prev, cp) : 0);
        prev = cp;
      }
      if (w > max) max = w;
    }
    return max;
  }

  newText(text: ColoredText) {
    return new Text(this, text);
  }
}

interface PlacedGlyph { x0: number; y0: number; x1: number; y1: number; u0: number; v0: number; u1: number; v1: number; c: Colour }

export class Text {
  readonly isText = true;
  font: Font;
  private placed: PlacedGlyph[] = [];
  private width = 0;
  private height = 0;

  constructor(font: Font, text: ColoredText) {
    this.font = font;
    this.set(text);
  }

  set(text: ColoredText) {
    const f = this.font, img = f.image, d = f.dump;
    const parts: [Colour, string][] = [];
    if (typeof text === 'string' || typeof text === 'number') parts.push([[1, 1, 1, 1], String(text)]);
    else {
      let col: Colour = [1, 1, 1, 1];
      for (const p of text) {
        if (Array.isArray(p)) col = p;
        else parts.push([col, String(p)]);
      }
    }
    this.placed = [];
    const heightoffset = d.baseline;
    const lineStep = Math.floor(d.height * d.lineHeight + 0.5);
    let dx = 0, dy = 0, prev = 0, maxw = 0;
    const tw = d.atlasW, th = d.atlasH;
    for (const [col, str] of parts) {
      const c = [col[0] ?? 1, col[1] ?? 1, col[2] ?? 1, col[3] ?? 1];
      for (const ch of str) {
        const cp = ch.codePointAt(0)!;
        if (cp === 10) { maxw = Math.max(maxw, dx); dx = 0; dy += lineStep; prev = 0; continue; }
        if (cp === 13) continue;
        const g = (f as any).glyph(cp) as GlyphInfo | undefined;
        if (!g) continue;
        if (prev) dx += f.getKerning(prev, cp);
        if (g.w > 0 && g.h > 0) {
          const o = 1;
          const x0 = dx - o + g.bx, y0 = dy + heightoffset - o - g.by;
          this.placed.push({
            x0, y0, x1: x0 + g.w + 2 * o, y1: y0 + g.h + 2 * o,
            u0: (g.x - o) / tw, v0: (g.y - o) / th, u1: (g.x + g.w + o) / tw, v1: (g.y + g.h + o) / th,
            c,
          });
        }
        dx += g.spacing;
        prev = cp;
      }
    }
    this.width = Math.max(maxw, dx);
    this.height = dy + d.height;
    void img;
  }

  getWidth() { return this.width; }
  getHeight() { return this.height; }
  getDimensions(): [number, number] { return [this.width, this.height]; }

  emit(g: Graphics) {
    const tex = this.font.image;
    for (const p of this.placed) g.glyphQuad(tex, p.x0, p.y0, p.x1, p.y1, p.u0, p.v0, p.u1, p.v1, p.c);
  }
}
