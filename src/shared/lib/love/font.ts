// Fonts as LÖVE 11 renders them: glyph bitmaps, bearings and advances dumped
// from LÖVE itself (tools/love/fontdump), laid out with LÖVE's
// Font::generateVertices rules.
import type { Graphics, Image, Colour } from './graphics';

export interface GlyphInfo {
  cp: number; w: number; h: number; bx: number; by: number; adv: number; spacing: number; x: number; y: number;
  /** the atlas page (0 when absent) */
  page?: number;
  /** the bitmap's size, when it was rasterized smaller than the metrics (bitmapScale) */
  bw?: number; bh?: number;
}
export interface FontDump {
  size: number; height: number; baseline: number; ascent: number; descent: number; lineHeight: number;
  atlasW: number; atlasH: number; glyphs: GlyphInfo[]; kerning: [number, number, number][];
  /** each page's height (one page when absent) */
  pageH?: number[];
  /** glyph bitmaps at this fraction of the font's size (1 when absent): stretched to the glyph's box */
  bitmapScale?: number;
}

// a character the font lacks, drawn as a close one it has (LÖVE draws the font's empty glyph 0 for these)
const STAND_IN: Record<number, number> = {
  0xa0: 32, 0x2018: 39, 0x2019: 39, 0x201a: 44, 0x201c: 34, 0x201d: 34, 0x201e: 34,
};

/** a colored string as LÖVE accepts: 'text' or {colour, 'text', colour, 'text', ...} */
export type ColoredText = string | (Colour | string)[];

export class Font {
  image: Image;
  /** the atlas pages (pages[0] is image) */
  pages: Image[];
  dump: FontDump;
  glyphs = new Map<number, GlyphInfo>();
  kerning = new Map<number, number>();

  constructor(image: Image | Image[], dump: FontDump) {
    this.pages = Array.isArray(image) ? image : [image];
    this.image = this.pages[0];
    this.dump = dump;
    for (const g of dump.glyphs) this.glyphs.set(g.cp, g);
    for (const [a, b, k] of dump.kerning) this.kerning.set(a * 65536 + b, k);
  }

  private glyph(cp: number): GlyphInfo | undefined {
    return this.glyphs.get(cp) ?? (STAND_IN[cp] !== undefined ? this.glyphs.get(STAND_IN[cp]) : undefined) ?? this.glyphs.get(63);
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

interface PlacedGlyph { x0: number; y0: number; x1: number; y1: number; u0: number; v0: number; u1: number; v1: number; c: Colour; page: number }

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
    const tw = d.atlasW;
    const bs = d.bitmapScale ?? 1;
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
          const page = g.page ?? 0;
          const th = d.pageH?.[page] ?? d.atlasH;
          const bw = g.bw ?? g.w, bh = g.bh ?? g.h, bo = o * bs;
          const x0 = dx - o + g.bx, y0 = dy + heightoffset - o - g.by;
          this.placed.push({
            x0, y0, x1: x0 + g.w + 2 * o, y1: y0 + g.h + 2 * o,
            u0: (g.x - bo) / tw, v0: (g.y - bo) / th, u1: (g.x + bw + bo) / tw, v1: (g.y + bh + bo) / th,
            c, page,
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
    const pages = this.font.pages;
    for (const p of this.placed) g.glyphQuad(pages[p.page] ?? pages[0], p.x0, p.y0, p.x1, p.y1, p.u0, p.v0, p.u1, p.v1, p.c);
  }
}
