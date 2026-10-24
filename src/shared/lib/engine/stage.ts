// The room the game is drawn in: Game:init_window, Game:prep_stage and
// love.resize (main.lua), which fit the 20 x 11.5 tile room in the window.
import { G } from './globals';
import { love } from '../love';
import { Node } from './node';
import { Moveable } from './moveable';
import { remove_all } from './util';

export function init_window() {
  G.ROOM_PADDING_H = 0.7;
  G.ROOM_PADDING_W = 1;
  G.WINDOWTRANS = { x: 0, y: 0, w: G.TILE_W + 2 * G.ROOM_PADDING_W, h: G.TILE_H + 2 * G.ROOM_PADDING_H };
  G.window_prev = {
    orig_scale: G.TILESCALE,
    w: G.WINDOWTRANS.w * G.TILESIZE * G.TILESCALE,
    h: G.WINDOWTRANS.h * G.TILESIZE * G.TILESCALE,
    orig_ratio: (G.WINDOWTRANS.w * G.TILESIZE * G.TILESCALE) / (G.WINDOWTRANS.h * G.TILESIZE * G.TILESCALE),
  };
}

/** love.resize(w, h) */
export function resize(w: number, h: number) {
  if (w / h < 1) h = w / 1;
  if (w / h < G.window_prev.orig_ratio) G.TILESCALE = G.window_prev.orig_scale * w / G.window_prev.w;
  else G.TILESCALE = G.window_prev.orig_scale * h / G.window_prev.h;
  if (G.ROOM) {
    G.ROOM.T.w = G.TILE_W;
    G.ROOM.T.h = G.TILE_H;
    G.ROOM_ATTACH.T.w = G.TILE_W;
    G.ROOM_ATTACH.T.h = G.TILE_H;
    if (w / h < G.window_prev.orig_ratio) {
      G.ROOM.T.x = G.ROOM_PADDING_W;
      G.ROOM.T.y = (h / (G.TILESIZE * G.TILESCALE) - (G.ROOM.T.h + G.ROOM_PADDING_H)) / 2 + G.ROOM_PADDING_H / 2;
    } else {
      G.ROOM.T.y = G.ROOM_PADDING_H;
      G.ROOM.T.x = (w / (G.TILESIZE * G.TILESCALE) - (G.ROOM.T.w + G.ROOM_PADDING_W)) / 2 + G.ROOM_PADDING_W / 2;
    }
    G.ROOM_ORIG = { x: G.ROOM.T.x, y: G.ROOM.T.y, r: G.ROOM.T.r };
    if (G.buttons) G.buttons.recalculate();
    if (G.HUD) G.HUD.recalculate();
  }
  G.WINDOWTRANS = {
    x: 0, y: 0, w: G.TILE_W + 2 * G.ROOM_PADDING_W, h: G.TILE_H + 2 * G.ROOM_PADDING_H, real_window_w: w, real_window_h: h,
  };
  G.CANV_SCALE = 1;
  if (G.CANVAS) love.graphics.releaseCanvas(G.CANVAS);
  G.CANVAS = love.graphics.newCanvas(w * G.CANV_SCALE, h * G.CANV_SCALE);
}

/** Game:prep_stage: a new room for the main menu or a run */
export function prep_stage(new_stage?: number, new_state?: number, new_game?: () => any) {
  for (const k of Object.keys(G.CONTROLLER.locks)) G.CONTROLLER.locks[k] = null;
  if (new_game) G.GAME = new_game();
  G.STAGE = new_stage ?? G.STAGES.MAIN_MENU;
  G.STATE = new_state ?? G.STATES.MENU;
  G.STATE_COMPLETE = false;
  G.SETTINGS.paused = false;
  G.ROOM = new Node({ T: { x: G.ROOM_PADDING_W, y: G.ROOM_PADDING_H, w: G.TILE_W, h: G.TILE_H } });
  G.ROOM.jiggle = 0;
  G.ROOM.states.drag.can = false;
  G.ROOM.set_container(G.ROOM);
  G.ROOM_ATTACH = new Moveable({ T: { x: 0, y: 0, w: G.TILE_W, h: G.TILE_H } });
  G.ROOM_ATTACH.states.drag.can = false;
  G.ROOM_ATTACH.set_container(G.ROOM);
  resize(love.graphics.getWidth(), love.graphics.getHeight());
}

/** Game:delete_run: removes everything of the current stage */
export function delete_run() {
  if (G.ROOM) {
    remove_all(G.STAGE_OBJECTS[G.STAGE]);
    for (const k of ['buttons', 'deck_preview', 'shop', 'blind_select', 'booster_pack', 'MAIN_MENU_UI', 'SPLASH_FRONT', 'SPLASH_BACK',
      'SPLASH_LOGO', 'GAME_OVER_UI', 'collection_alert', 'HUD', 'HUD_blind', 'OVERLAY_MENU', 'PROFILE_BUTTON', 'round_eval', 'SHOP_SIGN']) {
      if (G[k]) { G[k].remove(); G[k] = null; }
    }
    if (G.HUD_tags) {
      for (const v of G.HUD_tags) v.remove();
      G.HUD_tags = null;
    }
    for (const k of Object.keys(G)) {
      const v = G[k];
      if (v && typeof v === 'object' && v.is_card_area) G[k] = null;
    }
    G.I.CARD = [];
  }
  G.VIEWING_DECK = null;
  G.E_MANAGER.clear_queue();
  G.CONTROLLER.mod_cursor_context_layer(-1000);
  if (G.GAME) G.GAME.won = false;
  G.STATE = -1;
}
