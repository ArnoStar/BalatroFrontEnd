// Game:start_up, Game:set_render_settings and Game:set_language (game.lua):
// textures, shaders, the font, the controller and the shared sprites.
import { G, Sprite, Controller, EventManager, init_sources, init_window } from '@/shared/lib/engine';
import { love, loadImage, loadFont, loadShader } from '@/shared/lib/love';
import { init_localization } from '@/shared/lib/localization';
import { load_game_data, init_profile, load_settings } from '@/shared/config';

const RES = '/resources';

const COLLABS = ['AU', 'TW', 'VS', 'DTD', 'CYP', 'STS', 'TBoI', 'SV', 'SK', 'DS', 'CL', 'D2', 'PC', 'WF', 'EG', 'XR', 'CR', 'BUG', 'FO', 'DBD', 'C7', 'R', 'AC', 'STP'];

const SHADERS = ['background', 'booster', 'CRT', 'debuff', 'dissolve', 'flame', 'flash', 'foil', 'gold_seal', 'holo', 'hologram',
  'negative', 'negative_shine', 'played', 'polychrome', 'skew', 'splash', 'voucher', 'vortex'];

async function set_render_settings(progress: (p: number) => void) {
  const ts = G.SETTINGS.GRAPHICS.texture_scaling;
  const animation_atli = [
    { name: 'blind_chips', path: `${ts}x/BlindChips.png`, px: 34, py: 34, frames: 21 },
    { name: 'shop_sign', path: `${ts}x/ShopSignAnimation.png`, px: 113, py: 57, frames: 4 },
  ];
  const asset_atli: { name: string; path: string; px: number; py: number }[] = [
    { name: 'cards_1', path: `${ts}x/8BitDeck.png`, px: 71, py: 95 },
    { name: 'cards_2', path: `${ts}x/8BitDeck_opt2.png`, px: 71, py: 95 },
    { name: 'centers', path: `${ts}x/Enhancers.png`, px: 71, py: 95 },
    { name: 'Joker', path: `${ts}x/Jokers.png`, px: 71, py: 95 },
    { name: 'Tarot', path: `${ts}x/Tarots.png`, px: 71, py: 95 },
    { name: 'Voucher', path: `${ts}x/Vouchers.png`, px: 71, py: 95 },
    { name: 'Booster', path: `${ts}x/boosters.png`, px: 71, py: 95 },
    { name: 'ui_1', path: `${ts}x/ui_assets.png`, px: 18, py: 18 },
    { name: 'ui_2', path: `${ts}x/ui_assets_opt2.png`, px: 18, py: 18 },
    { name: 'balatro', path: `${ts}x/balatro.png`, px: 333, py: 216 },
    { name: 'gamepad_ui', path: `${ts}x/gamepad_ui.png`, px: 32, py: 32 },
    { name: 'icons', path: `${ts}x/icons.png`, px: 66, py: 66 },
    { name: 'tags', path: `${ts}x/tags.png`, px: 34, py: 34 },
    { name: 'stickers', path: `${ts}x/stickers.png`, px: 71, py: 95 },
    { name: 'chips', path: `${ts}x/chips.png`, px: 29, py: 29 },
  ];
  for (const c of COLLABS) {
    asset_atli.push({ name: `collab_${c}_1`, path: `${ts}x/collabs/collab_${c}_1.png`, px: 71, py: 95 });
    asset_atli.push({ name: `collab_${c}_2`, path: `${ts}x/collabs/collab_${c}_2.png`, px: 71, py: 95 });
  }
  const asset_images = [
    { name: 'playstack_logo', path: '1x/playstack-logo.png', px: 1417, py: 1417 },
    { name: 'localthunk_logo', path: '1x/localthunk-logo.png', px: 1390, py: 560 },
  ];
  const total = animation_atli.length + asset_atli.length + asset_images.length;
  let done = 0;
  const tick = () => progress(++done / total);
  await Promise.all([
    ...animation_atli.map(async (a) => {
      const image = await loadImage(`${RES}/textures/${a.path}`, { mipmaps: true, dpiscale: ts });
      G.ANIMATION_ATLAS[a.name] = { name: a.name, image, px: a.px, py: a.py, frames: a.frames };
      tick();
    }),
    ...asset_atli.map(async (a) => {
      const image = await loadImage(`${RES}/textures/${a.path}`, { mipmaps: true, dpiscale: ts });
      G.ASSET_ATLAS[a.name] = { name: a.name, image, px: a.px, py: a.py };
      tick();
    }),
    ...asset_images.map(async (a) => {
      const image = await loadImage(`${RES}/textures/${a.path}`, { mipmaps: true, dpiscale: 1 });
      G.ASSET_ATLAS[a.name] = { name: a.name, image, px: a.px, py: a.py };
      tick();
    }),
  ]);
  G.ASSET_ATLAS.Planet = G.ASSET_ATLAS.Tarot;
  G.ASSET_ATLAS.Spectral = G.ASSET_ATLAS.Tarot;
}

async function set_language() {
  const font = await loadFont('/fonts', 'm6x11plus');
  G.FONTS = [
    { file: 'resources/fonts/m6x11plus.ttf', render_scale: G.TILESIZE * 10, TEXT_HEIGHT_SCALE: 0.83, TEXT_OFFSET: { x: 10, y: -20 }, FONTSCALE: 0.1, squish: 1, DESCSCALE: 1, FONT: font },
  ];
  G.LANGUAGES = { 'en-us': { font: G.FONTS[0], label: 'English', key: 'en-us' } };
  G.LANG = G.LANGUAGES['en-us'];
  init_localization();
}

export async function start_up(progress: (p: number) => void) {
  load_settings();
  G.SETTINGS.version = G.VERSION;
  G.SETTINGS.paused = null;
  const proto = G.C['SO_' + (G.SETTINGS.colourblind_option ? 2 : 1)];
  G.C.SUITS.Hearts = proto.Hearts;
  G.C.SUITS.Diamonds = proto.Diamonds;
  G.C.SUITS.Spades = proto.Spades;
  G.C.SUITS.Clubs = proto.Clubs;

  init_sources();
  init_window();
  load_game_data();
  init_profile();

  G.SHADERS = {};
  await Promise.all([
    ...SHADERS.map(async (name) => { G.SHADERS[name] = await loadShader(`${RES}/shaders/${name}.fs`, name); }),
    set_render_settings(progress),
    set_language(),
  ]);

  G.CONTROLLER = new Controller();
  G.SETTINGS.QUEUED_CHANGE = {};
  G.SETTINGS.music_control = { desired_track: '', current_track: '', lerp: 1 };

  G.shared_debuff = new Sprite(0, 0, G.CARD_W, G.CARD_H, G.ASSET_ATLAS.centers, { x: 4, y: 0 });
  G.shared_soul = new Sprite(0, 0, G.CARD_W, G.CARD_H, G.ASSET_ATLAS.centers, G.P_CENTERS.soul.pos);
  G.shared_undiscovered_joker = new Sprite(0, 0, G.CARD_W, G.CARD_H, G.ASSET_ATLAS.centers, G.P_CENTERS.undiscovered_joker.pos);
  G.shared_undiscovered_tarot = new Sprite(0, 0, G.CARD_W, G.CARD_H, G.ASSET_ATLAS.centers, G.P_CENTERS.undiscovered_tarot.pos);
  G.shared_sticker_eternal = new Sprite(0, 0, G.CARD_W, G.CARD_H, G.ASSET_ATLAS.stickers, { x: 0, y: 0 });
  G.shared_sticker_perishable = new Sprite(0, 0, G.CARD_W, G.CARD_H, G.ASSET_ATLAS.stickers, { x: 0, y: 2 });
  G.shared_sticker_rental = new Sprite(0, 0, G.CARD_W, G.CARD_H, G.ASSET_ATLAS.stickers, { x: 1, y: 2 });
  const st = (x: number, y: number) => new Sprite(0, 0, G.CARD_W, G.CARD_H, G.ASSET_ATLAS.stickers, { x, y });
  G.shared_stickers = {
    White: st(1, 0), Red: st(2, 0), Green: st(3, 0), Black: st(0, 1), Blue: st(4, 0), Purple: st(1, 1), Orange: st(2, 1), Gold: st(3, 1),
  };
  const seal = (x: number, y: number) => new Sprite(0, 0, G.CARD_W, G.CARD_H, G.ASSET_ATLAS.centers, { x, y });
  G.shared_seals = { Gold: seal(2, 0), Purple: seal(4, 4), Red: seal(5, 4), Blue: seal(6, 4) };
  G.sticker_map = ['White', 'Red', 'Green', 'Black', 'Blue', 'Purple', 'Orange', 'Gold'];

  G.STAGE_OBJECT_INTERRUPT = true;
  G.CURSOR = new Sprite(0, 0, 0.3, 0.3, G.ASSET_ATLAS.gamepad_ui, { x: 18, y: 0 });
  G.CURSOR.states.collide.can = false;
  G.STAGE_OBJECT_INTERRUPT = false;

  G.E_MANAGER = new EventManager();
  G.SPEEDFACTOR = 1;
  void love;
}
