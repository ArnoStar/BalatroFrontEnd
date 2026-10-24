// play_sound / modulate_sound (misc_functions.lua) and the sound manager
// thread (engine/sound_manager.lua), run on the main thread.
import { G } from './globals';
import { love } from '../love';
import type { Source } from '../love';

interface SoundEntry {
  sound: Source;
  sound_code: string;
  original_pitch?: number;
  original_volume?: number;
  created_on_pause?: boolean;
  created_on_state?: number;
  sfx_handled?: number;
  transition_timer?: number;
  temp_pitch?: number;
  current_volume?: number;
  initialized?: boolean;
}

const SOURCES: Record<string, SoundEntry[]> = {};

export const SOUND_CODES = [
  'ambientFire1', 'ambientFire2', 'ambientFire3', 'ambientOrgan1', 'button', 'cancel', 'card1', 'card3', 'cardFan2',
  'cardSlide1', 'cardSlide2', 'chips1', 'chips2', 'coin1', 'coin2', 'coin3', 'coin4', 'coin5', 'coin6', 'coin7',
  'crumple1', 'crumple2', 'crumple3', 'crumple4', 'crumple5', 'crumpleLong1', 'crumpleLong2', 'explosion1',
  'explosion_buildup1', 'explosion_release1', 'foil1', 'foil2', 'generic1', 'glass1', 'glass2', 'glass3', 'glass4',
  'glass5', 'glass6', 'gold_seal', 'gong', 'highlight1', 'highlight2', 'holo1', 'introPad1', 'magic_crumple2',
  'magic_crumple3', 'magic_crumple', 'multhit1', 'multhit2', 'music1', 'music2', 'music3', 'music4', 'music5',
  'negative', 'other1', 'paper1', 'polychrome1', 'slice1', 'splash_buildup', 'tarot1', 'tarot2', 'timpani',
  'voice10', 'voice11', 'voice1', 'voice2', 'voice3', 'voice4', 'voice5', 'voice6', 'voice7', 'voice8', 'voice9',
  'whoosh1', 'whoosh2', 'whoosh_long', 'whoosh', 'win',
];

const isStream = (code: string) => code.includes('music') || code.includes('ambient');

export function init_sources() {
  for (const code of SOUND_CODES) {
    SOURCES[code] = [];
    if (!isStream(code)) love.audio.preload(code);
  }
}

function SET_SFX(s: SoundEntry, args: any) {
  if (s.sound_code.includes('music')) {
    if (s.sound_code === args.desired_track) {
      s.current_volume = s.current_volume ?? 1;
      s.current_volume = 1 * (args.dt * 3) + (1 - args.dt * 3) * s.current_volume;
    } else {
      s.current_volume = s.current_volume ?? 0;
      s.current_volume = 0 * (args.dt * 3) + (1 - args.dt * 3) * s.current_volume;
    }
    s.sound.setVolume(s.current_volume * s.original_volume! * (args.sound_settings.volume / 100) * (args.sound_settings.music_volume / 100));
    s.sound.setPitch(s.original_pitch! * args.pitch_mod);
  } else {
    if (s.temp_pitch !== s.original_pitch) {
      s.sound.setPitch(s.original_pitch!);
      s.temp_pitch = s.original_pitch;
    }
    let vol = s.original_volume! * (args.sound_settings.volume / 100) * (args.sound_settings.game_sounds_volume / 100);
    if (s.created_on_state === 13) vol = vol * args.splash_vol;
    if (vol <= 0) s.sound.stop();
    else s.sound.setVolume(vol);
  }
}

function PLAY_SOUND(args: any): SoundEntry {
  args.per = args.per ?? 1;
  args.vol = args.vol ?? 1;
  SOURCES[args.sound_code] = SOURCES[args.sound_code] ?? [];
  for (const s of SOURCES[args.sound_code]) {
    if (s.sound && !s.sound.isPlaying()) {
      s.original_pitch = args.per;
      s.original_volume = args.vol;
      s.created_on_pause = args.overlay_menu;
      s.created_on_state = args.state;
      s.sfx_handled = 0;
      s.transition_timer = 0;
      SET_SFX(s, args);
      s.sound.play();
      return s;
    }
  }
  const s: SoundEntry = {
    sound: love.audio.newSource(args.sound_code, isStream(args.sound_code) ? 'stream' : 'static'),
    sound_code: args.sound_code,
  };
  SOURCES[args.sound_code].push(s);
  s.original_pitch = args.per ?? 1;
  s.original_volume = args.vol ?? 1;
  s.created_on_pause = !!args.overlay_menu;
  s.created_on_state = args.state;
  s.sfx_handled = 0;
  s.transition_timer = 0;
  SET_SFX(s, args);
  s.sound.play();
  return s;
}

export function STOP_AUDIO() {
  for (const k of Object.keys(SOURCES)) for (const s of SOURCES[k]) if (s.sound.isPlaying()) s.sound.stop();
}

function RESTART_MUSIC(args: any) {
  // browsers only play audio after a user gesture
  if (love.audio.ctx.state !== 'running') return;
  for (const k of Object.keys(SOURCES)) {
    if (k.includes('music')) {
      for (const s of SOURCES[k]) { s.sound.stop(); s.sound.release(); }
      SOURCES[k] = [];
      args.per = 0.7;
      args.vol = 0.6;
      args.sound_code = k;
      const s = PLAY_SOUND(args);
      s.initialized = true;
    }
  }
}

function MODULATE(args: any) {
  for (const k of Object.keys(SOURCES)) {
    const v = SOURCES[k];
    if (k.includes('music') && args.desired_track !== '') {
      if (!(v[0] && v[0].sound && v[0].sound.isPlaying())) {
        RESTART_MUSIC(args);
        break;
      }
    }
  }
  for (const k of Object.keys(SOURCES)) {
    const v = SOURCES[k];
    let i = 0;
    while (i < v.length) {
      if (!v[i].sound.isPlaying()) { v[i].sound.release(); v.splice(i, 1); }
      else i++;
    }
    for (const s of v) if (s.sound && s.sound.isPlaying() && s.original_volume !== undefined) SET_SFX(s, args);
  }
}

function AMBIENT(args: any) {
  for (const k of Object.keys(SOURCES)) {
    const ac = args.ambient_control[k];
    if (ac) {
      let start = ac.vol * (args.sound_settings.volume / 100) * (args.sound_settings.game_sounds_volume / 100) > 0;
      for (const s of SOURCES[k]) {
        if (s.sound && s.sound.isPlaying() && s.original_volume !== undefined) {
          s.original_volume = ac.vol;
          SET_SFX(s, args);
          start = false;
        }
      }
      if (start) {
        args.sound_code = k;
        args.vol = ac.vol;
        args.per = ac.per;
        PLAY_SOUND(args);
      }
    }
  }
}

export function RESET_STATES(state: number) {
  for (const k of Object.keys(SOURCES)) for (const s of SOURCES[k]) s.created_on_state = state;
}

export function play_sound(sound_code: string | null | undefined, per?: number, vol?: number) {
  if (G.F_MUTE) return;
  if (sound_code && G.SETTINGS.SOUND.volume > 0.001) {
    G.ARGS.play_sound = G.ARGS.play_sound ?? {};
    const a = G.ARGS.play_sound;
    a.type = 'sound';
    a.time = G.TIMERS.REAL;
    a.crt = G.SETTINGS.GRAPHICS.crt;
    a.sound_code = sound_code;
    a.per = per;
    a.vol = vol;
    a.pitch_mod = G.PITCH_MOD;
    a.state = G.STATE;
    a.music_control = G.SETTINGS.music_control;
    a.sound_settings = G.SETTINGS.SOUND;
    a.splash_vol = G.SPLASH_VOL;
    a.overlay_menu = !!G.OVERLAY_MENU;
    a.dt = a.dt ?? 0;
    PLAY_SOUND(a);
  }
}

export function modulate_sound(dt: number) {
  G.SPLASH_VOL = 2 * dt * (G.STATE === G.STATES.SPLASH ? 1 : 0) + (G.SPLASH_VOL ?? 1) * (1 - 2 * dt);
  const live = (o: any) => o && !o.REMOVED;
  const desired_track =
    G.video_soundtrack ??
    (G.STATE === G.STATES.SPLASH ? '' : null) ??
    (live(G.booster_pack_sparkles) ? 'music2' : null) ??
    (live(G.booster_pack_meteors) ? 'music3' : null) ??
    (live(G.booster_pack) ? 'music2' : null) ??
    (live(G.shop) ? 'music4' : null) ??
    (G.GAME?.blind && G.GAME.blind.boss ? 'music5' : null) ??
    'music1';

  G.PITCH_MOD = (G.PITCH_MOD ?? 1) * (1 - dt) + dt * ((!G.normal_music_speed && G.STATE === G.STATES.GAME_OVER) ? 0.5 : 1);

  G.SETTINGS.ambient_control = G.SETTINGS.ambient_control ?? {};
  G.ARGS.score_intensity = G.ARGS.score_intensity ?? {};
  const si = G.ARGS.score_intensity;
  const ch = G.GAME?.current_round?.current_hand;
  if (!ch || typeof ch.chips !== 'number' || typeof ch.mult !== 'number') si.earned_score = 0;
  else si.earned_score = ch.chips * ch.mult;
  si.required_score = G.GAME?.blind ? (G.GAME.blind.chips ?? 0) : 0;
  si.flames = Math.min(1, (G.STAGE === G.STAGES.RUN ? 1 : 0) *
    (G.ARGS.chip_flames ? G.ARGS.chip_flames.real_intensity + G.ARGS.chip_flames.change : 0) / 10);
  si.organ = G.video_organ ?? (si.required_score > 0
    ? Math.max(Math.min(0.4, 0.1 * Math.log(si.earned_score / (si.required_score + 1)) / Math.log(5)), 0)
    : 0);

  const AC = G.SETTINGS.ambient_control;
  G.ARGS.ambient_sounds = G.ARGS.ambient_sounds ?? {
    ambientFire2: { volfunc: (p: number, d: number) => p * (1 - d) + d * 0.9 * (G.ARGS.score_intensity.flames > 0.3 ? 1 : G.ARGS.score_intensity.flames / 0.3) },
    ambientFire1: { volfunc: (p: number, d: number) => p * (1 - d) + d * 0.8 * (G.ARGS.score_intensity.flames > 0.3 ? (G.ARGS.score_intensity.flames - 0.3) / 0.7 : 0) },
    ambientFire3: { volfunc: (p: number, d: number) => p * (1 - d) + d * 0.4 * ((G.ARGS.chip_flames ? G.ARGS.chip_flames.change : 0) + (G.ARGS.mult_flames ? G.ARGS.mult_flames.change : 0)) },
    ambientOrgan1: { volfunc: (p: number, d: number) => p * (1 - d) + d * 0.6 * (G.SETTINGS.SOUND.music_volume + 100) / 200 * G.ARGS.score_intensity.organ },
  };
  for (const k of Object.keys(G.ARGS.ambient_sounds)) {
    const v = G.ARGS.ambient_sounds[k];
    AC[k] = AC[k] ?? {};
    AC[k].per = k === 'ambientOrgan1' ? 0.7 : k === 'ambientFire1' ? 1.1 : k === 'ambientFire2' ? 1.05 : 1;
    AC[k].vol = (!G.video_organ && G.STATE === G.STATES.SPLASH) ? 0 : (AC[k].vol !== undefined ? v.volfunc(AC[k].vol, dt) : 0);
  }

  G.ARGS.push = G.ARGS.push ?? {};
  const p = G.ARGS.push;
  p.type = 'modulate';
  p.pitch_mod = G.PITCH_MOD;
  p.state = G.STATE;
  p.time = G.TIMERS.REAL;
  p.dt = dt;
  p.desired_track = desired_track;
  p.sound_settings = G.SETTINGS.SOUND;
  p.splash_vol = G.SPLASH_VOL;
  p.overlay_menu = !!G.OVERLAY_MENU;
  p.ambient_control = G.SETTINGS.ambient_control;
  MODULATE(p);
  if (p.ambient_control) AMBIENT(p);
}
