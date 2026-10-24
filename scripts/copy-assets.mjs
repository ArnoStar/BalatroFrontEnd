// Copies what the front end needs from a copy of the game (textures, sounds,
// shaders), extracts its static data and English text (LuaJIT), and dumps its
// pixel font as LÖVE renders it (LÖVE 11).
//
//   npm run assets                    # game source in ../balatro_src
//   BALATRO_SRC=/path/to/game npm run assets
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
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
console.log(`copied textures, sounds and shaders to ${out}`);

mkdirSync(resolve(root, 'src/shared/config/generated'), { recursive: true });
execFileSync('luajit', [resolve(root, 'tools/lua/extract_ui_data.lua'), resolve(root, 'src/shared/config/generated/game.json')], {
  stdio: 'inherit', env: { ...process.env, BALATRO_SRC: src },
});

const fonts = resolve(root, 'public/fonts');
mkdirSync(fonts, { recursive: true });
execFileSync('love', [resolve(root, 'tools/love/fontdump')], {
  stdio: 'inherit',
  env: {
    ...process.env, SDL_VIDEODRIVER: process.env.SDL_VIDEODRIVER ?? 'offscreen',
    FONT: resolve(src, 'resources/fonts/m6x11plus.ttf'), SIZE: '200', NAME: 'm6x11plus', OUT: fonts,
  },
});
