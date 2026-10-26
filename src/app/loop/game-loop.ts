// Game:update and Game:draw (game.lua) and love.run's timing (main.lua).
import { G, modulate_sound, update_canvas_juice, reset_drawhash, each } from '@/shared/lib/engine';
import { love } from '@/shared/lib/love';

export function game_update(dt: number) {
  G.MAJORS = 0;
  G.MINORS = 0;
  G.FRAMES.MOVE += 1;
  modulate_sound(dt);
  update_canvas_juice(dt);
  G.TIMERS.REAL += dt;
  G.TIMERS.REAL_SHADER = G.SETTINGS.reduced_motion ? 300 : G.TIMERS.REAL;
  G.TIMERS.UPTIME += dt;
  G.TIMERS.BACKGROUND += dt * (G.ARGS.spin ? G.ARGS.spin.amount : 0);
  G.real_dt = dt;

  if (G.SETTINGS.paused) dt = 0;
  if (G.STATE !== G.ACC_state) G.ACC = 0;
  G.ACC_state = G.STATE;
  if (G.STATE === G.STATES.HAND_PLAYED || G.STATE === G.STATES.NEW_ROUND) G.ACC = Math.min((G.ACC ?? 0) + dt * 0.2 * G.SETTINGS.GAMESPEED, 16);
  else G.ACC = 0;
  G.SPEEDFACTOR = (G.STAGE === G.STAGES.RUN && !G.SETTINGS.paused && !G.screenwipe) ? G.SETTINGS.GAMESPEED : 1;
  G.SPEEDFACTOR += Math.max(0, Math.abs(G.ACC) - 2);
  G.TIMERS.TOTAL += dt * G.SPEEDFACTOR;

  const T = G.TIMERS.REAL;
  G.C.DARK_EDITION[0] = 0.6 + 0.2 * Math.sin(T * 1.3);
  G.C.DARK_EDITION[2] = 0.6 + 0.2 * (1 - Math.sin(T * 1.3));
  G.C.DARK_EDITION[1] = Math.min(G.C.DARK_EDITION[2], G.C.DARK_EDITION[0]);
  G.C.EDITION[0] = 0.7 + 0.2 * (1 + Math.sin(T * 1.5 + 0));
  G.C.EDITION[2] = 0.7 + 0.2 * (1 + Math.sin(T * 1.5 + 3));
  G.C.EDITION[1] = 0.7 + 0.2 * (1 + Math.sin(T * 1.5 + 6));

  G.E_MANAGER.update(G.real_dt);

  // the stage's per-frame logic (the run's boss warning), then the state's
  G.STAGE_UPDATE?.(dt);
  const state_update = G.STATE_UPDATES?.[G.STATE];
  if (state_update) state_update(dt);

  for (const v of [...G.ANIMATIONS]) v.animate(G.real_dt * G.SPEEDFACTOR);

  G.exp_times.xy = Math.exp(-50 * G.real_dt);
  G.exp_times.scale = Math.exp(-60 * G.real_dt);
  G.exp_times.r = Math.exp(-190 * G.real_dt);
  const move_dt = Math.min(1 / 20, G.real_dt);
  G.exp_times.max_vel = 70 * move_dt;
  for (const v of [...G.MOVEABLES]) if (v.FRAME.MOVE < G.FRAMES.MOVE) v.move(move_dt);
  for (const v of [...G.MOVEABLES]) {
    v.update(dt * G.SPEEDFACTOR);
    v.states.collide.is = false;
  }

  G.CONTROLLER.update(G.real_dt);

  const rr = G.GAME?.round_resets;
  if (rr && (G.prev_small_state !== rr.blind_states.Small || G.prev_large_state !== rr.blind_states.Big ||
    G.prev_boss_state !== rr.blind_states.Boss || G.RESET_BLIND_STATES)) {
    G.RESET_BLIND_STATES = null;
    G.prev_small_state = rr.blind_states.Small;
    G.prev_large_state = rr.blind_states.Big;
    G.prev_boss_state = rr.blind_states.Boss;
    const loc = G.localization.misc.blind_states ?? {};
    rr.loc_blind_states.Small = loc[rr.blind_states.Small] ?? 'ERROR';
    rr.loc_blind_states.Big = loc[rr.blind_states.Big] ?? 'ERROR';
    rr.loc_blind_states.Boss = loc[rr.blind_states.Boss] ?? 'ERROR';
  }
}

function drawAt(v: any) {
  const g = love.graphics;
  g.push();
  v.translate_container();
  v.draw();
  g.pop();
}

export function game_draw() {
  const g = love.graphics;
  G.FRAMES.DRAW += 1;
  reset_drawhash();
  if (G.OVERLAY_TUTORIAL && !G.OVERLAY_MENU) G.under_overlay = true;
  g.setCanvas(G.CANVAS);
  g.push();
  g.scale(G.CANV_SCALE);
  g.setShader();
  g.clear(0, 0, 0, 1);

  if (G.SPLASH_BACK) drawAt(G.SPLASH_BACK);

  for (const v of [...G.I.NODE]) if (!v.parent) drawAt(v);
  for (const v of [...G.I.MOVEABLE]) if (!v.parent) drawAt(v);
  if (G.SPLASH_LOGO) drawAt(G.SPLASH_LOGO);

  if (!G.OVERLAY_MENU || !G.F_HIDE_BG) {
    for (const v of [...G.I.UIBOX]) {
      if (!v.attention_text && !v.parent && v !== G.OVERLAY_MENU && v !== G.screenwipe && v !== G.OVERLAY_TUTORIAL &&
        v !== G.debug_tools && v !== G.online_leaderboard && v !== G.achievement_notification) drawAt(v);
    }
    for (const v of [...G.I.CARDAREA]) if (!v.parent) drawAt(v);
    for (const v of [...G.I.CARD]) {
      if (!v.parent && v !== G.CONTROLLER.dragging.target && v !== G.CONTROLLER.focused.target) drawAt(v);
    }
    for (const v of [...G.I.UIBOX]) {
      if (v.attention_text && v !== G.debug_tools && v !== G.online_leaderboard && v !== G.achievement_notification) drawAt(v);
    }
    if (G.SPLASH_FRONT) drawAt(G.SPLASH_FRONT);
    G.under_overlay = false;
  }
  if (G.OVERLAY_MENU && G.OVERLAY_MENU !== G.CONTROLLER.dragging.target) drawAt(G.OVERLAY_MENU);

  G.ALERT_ON_SCREEN = null;
  for (const v of [...G.I.ALERT]) { drawAt(v); G.ALERT_ON_SCREEN = true; }

  const drag = G.CONTROLLER.dragging.target;
  if (drag && drag !== G.CONTROLLER.focused.target) drawAt(drag);
  for (const v of [...G.I.POPUP]) drawAt(v);
  // (notify_alert's "Unlocked!" box: over everything but the screen wipe)
  if (G.achievement_notification) drawAt(G.achievement_notification);
  if (G.screenwipe) drawAt(G.screenwipe);
  g.pop();

  // the CRT pass, as the game draws its canvas to the screen
  g.setCanvas(null);
  g.push();
  g.setColor(G.C.WHITE);
  G.ARGS.eased_cursor_pos = G.ARGS.eased_cursor_pos ?? {
    x: G.CURSOR.T.x, y: G.CURSOR.T.y, sx: G.CONTROLLER.cursor_position.x, sy: G.CONTROLLER.cursor_position.y,
  };
  G.screenwipe_amt = G.screenwipe_amt !== undefined ? 0.95 * G.screenwipe_amt + 0.05 * ((G.screenwipe ? 0.4 : G.screenglitch ? 0.4 : 0)) : 1;
  const crt = G.SETTINGS.GRAPHICS.crt * 0.3;
  const S = G.SHADERS.CRT;
  S.send('distortion_fac', [1.0 + 0.07 * crt / 100, 1.0 + 0.1 * crt / 100]);
  S.send('scale_fac', [1.0 - 0.008 * crt / 100, 1.0 - 0.008 * crt / 100]);
  S.send('feather_fac', 0.01);
  S.send('bloom_fac', G.SETTINGS.GRAPHICS.bloom - 1);
  S.send('time', 400 + G.TIMERS.REAL);
  S.send('noise_fac', 0.001 * crt / 100);
  S.send('crt_intensity', 0.16 * crt / 100);
  S.send('glitch_intensity', 0);
  S.send('scanlines', G.CANVAS.getPixelHeight() * 0.75 / G.CANV_SCALE);
  S.send('mouse_screen_pos', [G.ARGS.eased_cursor_pos.sx, G.ARGS.eased_cursor_pos.sy]);
  S.send('screen_scale', G.TILESCALE * G.TILESIZE);
  S.send('hovering', 1);
  g.setShader(S);
  g.draw(G.CANVAS, 0, 0);
  g.pop();
  g.setShader();
  g.present();
  void each;
}
