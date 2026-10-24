// The `love` namespace the game's code is written against, backed by the
// browser: graphics (WebGL2), audio (WebAudio), mouse, timer and system.
import { Graphics, Image, Canvas, Quad, Texture } from './graphics';
import type { Colour } from './graphics';
import { Shader } from './shader';
import { Font, Text } from './font';
import type { FontDump, ColoredText } from './font';
import { Audio } from './audio';
import type { Source } from './audio';

export { Graphics, Image, Canvas, Quad, Texture, Shader, Font, Text, Audio };
export type { Colour, Source, FontDump, ColoredText };

interface Love {
  graphics: Graphics;
  audio: Audio;
  mouse: {
    x: number; y: number;
    getPosition(): [number, number];
    setVisible(v: boolean): void;
    isVisible(): boolean;
  };
  timer: { getTime(): number };
  system: {
    getOS(): string;
    openURL(url: string): void;
    setClipboardText(t: string): void;
    getClipboardText(): string;
  };
}

export const love = {} as Love;

export function initLove(canvas: HTMLCanvasElement, soundBase: string) {
  love.graphics = new Graphics(canvas);
  love.audio = new Audio(soundBase);
  let visible = true;
  love.mouse = {
    x: 0, y: 0,
    getPosition() { return [this.x, this.y]; },
    setVisible(v: boolean) { visible = v; canvas.style.cursor = v ? 'default' : 'none'; },
    isVisible() { return visible; },
  };
  love.timer = { getTime: () => performance.now() / 1000 };
  let clip = '';
  love.system = {
    getOS: () => 'Web',
    openURL: (url) => { window.open(url, '_blank', 'noopener'); },
    setClipboardText: (t) => { clip = t; navigator.clipboard?.writeText(t).catch(() => {}); },
    getClipboardText: () => clip,
  };
  return love;
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const blob = await r.blob();
  return createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}

/** love.graphics.newImage(path, {mipmaps, dpiscale}) */
export async function loadImage(url: string, opts: { mipmaps?: boolean; dpiscale?: number } = {}): Promise<Image> {
  const bmp = await loadBitmap(url);
  const img = love.graphics.newImageFromSource(bmp, bmp.width, bmp.height, opts);
  bmp.close();
  return img;
}

export async function loadFont(base: string, name: string): Promise<Font> {
  const [dump, img] = await Promise.all([
    fetch(`${base}/${name}.json`).then((r) => r.json() as Promise<FontDump>),
    loadImage(`${base}/${name}.png`),
  ]);
  return new Font(img, dump);
}

export async function loadShader(url: string, name: string): Promise<Shader> {
  const code = await (await fetch(url)).text();
  return new Shader(love.graphics, code, name);
}
