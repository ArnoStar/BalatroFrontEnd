// Copies what the front end needs from a copy of the game (textures, sounds,
// shaders), extracts its static data and its text in every language (LuaJIT),
// and dumps its fonts as LÖVE renders them (LÖVE 11): for each font, the
// characters its languages use (src/shared/config/languages.ts says which),
// and a small dump of each language's name for the language menu.
//
//   npm run assets                    # game source in ../balatro_src
//   BALATRO_SRC=/path/to/game npm run assets
import { cpSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(process.env.BALATRO_SRC ?? resolve(root, '../balatro_src'));
if (!existsSync(resolve(src, 'game.lua'))) {
  console.error(`No Balatro source at ${src} (set BALATRO_SRC)`);
  process.exit(1);
}

const out = resolve(root, 'public/resources');
rmSync(out, { recursive: true, force: true });
for (const dir of ['textures', 'sounds', 'shaders']) {
  cpSync(resolve(src, 'resources', dir), resolve(out, dir), { recursive: true });
}
// the pixel font itself, for the page's own text (the bug report dialog)
mkdirSync(resolve(out, 'fonts'), { recursive: true });
cpSync(resolve(src, 'resources/fonts/m6x11plus.ttf'), resolve(out, 'fonts/m6x11plus.ttf'));
console.log(`copied textures, sounds, shaders and the font to ${out}`);

mkdirSync(resolve(root, 'src/shared/config/generated'), { recursive: true });
execFileSync('luajit', [resolve(root, 'tools/lua/extract_ui_data.lua'), resolve(root, 'src/shared/config/generated/game.json')], {
  stdio: 'inherit', env: { ...process.env, BALATRO_SRC: src },
});

const loc = resolve(root, 'public/localization');
rmSync(loc, { recursive: true, force: true });
mkdirSync(loc, { recursive: true });
execFileSync('luajit', [resolve(root, 'tools/lua/extract_localization.lua'), loc], {
  stdio: 'inherit', env: { ...process.env, BALATRO_SRC: src },
});

// the fonts (Game:set_language's G.FONTS): file, size (render_scale), the
// languages that use it, and BITMAP_SCALE for those with thousands of glyphs
const FONTS = [
  { name: 'm6x11plus', file: 'm6x11plus.ttf', size: 200, langs: ['en-us', 'de', 'es_419', 'es_ES', 'fr', 'id', 'it', 'nl', 'pl', 'pt_BR'] },
  { name: 'NotoSansSC-Bold', file: 'NotoSansSC-Bold.ttf', size: 140, langs: ['zh_CN'], bitmap_scale: 0.5 },
  { name: 'NotoSansTC-Bold', file: 'NotoSansTC-Bold.ttf', size: 140, langs: ['zh_TW'], bitmap_scale: 0.5 },
  { name: 'NotoSansKR-Bold', file: 'NotoSansKR-Bold.ttf', size: 140, langs: ['ko'], bitmap_scale: 0.5 },
  { name: 'NotoSansJP-Bold', file: 'NotoSansJP-Bold.ttf', size: 140, langs: ['ja'], bitmap_scale: 0.5 },
  { name: 'NotoSans-Bold', file: 'NotoSans-Bold.ttf', size: 140, langs: ['ru'] },
];
// each language's name, in its own font (the language menu), and a beta language's warning
const LABELS = {
  ja: '日本語', ko: '한국어', zh_CN: '简体中文', zh_TW: '繁體中文',
  ru: 'Русский Этот язык все еще находится в Бета-версии. Чтобы помочь нам его улучшить, пожалуйста, нажмите на кнопку обратной связи. Щелкните снова, чтобы подтвердить',
};

function strings(v, acc) {
  if (typeof v === 'string') acc.push(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, acc);
  return acc;
}
const codepoints = (texts) => {
  const set = new Set();
  for (let cp = 32; cp <= 126; cp++) set.add(cp); // numbers, and this front end's own words
  for (const t of texts) for (const ch of t) set.add(ch.codePointAt(0));
  return [...set].filter((cp) => cp >= 32 && cp !== 0xfeff).sort((a, b) => a - b);
};

const fonts = resolve(root, 'public/fonts');
rmSync(fonts, { recursive: true, force: true });
mkdirSync(fonts, { recursive: true });
const work = resolve(root, 'node_modules/.cache/fontdump');
mkdirSync(work, { recursive: true });
function dump(font, name, cps, extra = {}) {
  const file = resolve(work, `${name}.txt`);
  writeFileSync(file, cps.join('\n'));
  execFileSync('love', [resolve(root, 'tools/love/fontdump')], {
    stdio: 'inherit',
    env: {
      ...process.env, SDL_VIDEODRIVER: process.env.SDL_VIDEODRIVER ?? 'offscreen',
      FONT: resolve(src, 'resources/fonts', font.file), SIZE: String(font.size), NAME: name, OUT: fonts, CPS: file, ...extra,
    },
  });
}
for (const font of FONTS) {
  const texts = font.langs.flatMap((k) => [...strings(JSON.parse(readFileSync(resolve(loc, `${k}.json`), 'utf8')), []), LABELS[k] ?? '']);
  if (font.name === 'm6x11plus') {
    // Latin-1 and the marks the first dump had, whatever the texts use
    for (let cp = 160; cp <= 255; cp++) texts.push(String.fromCodePoint(cp));
    texts.push('\u2019\u2018\u201C\u201D\u2014\u2013\u2026\u2022\u20AC');
  }
  dump(font, font.name, codepoints(texts), font.bitmap_scale ? { BITMAP_SCALE: String(font.bitmap_scale), NO_REFERENCE: '1' } : {});
  const label = font.langs.map((k) => LABELS[k]).filter(Boolean).join('');
  if (label) {
    const cps = [...new Set([...label].map((c) => c.codePointAt(0)))].sort((a, b) => a - b);
    dump(font, `${font.name}.label`, cps, { NO_REFERENCE: '1' });
  }
}
