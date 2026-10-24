// The game's global `G` (globals.lua / Game:set_globals): timers, settings,
// render scale, states, instance lists and colours. Higher layers attach
// their own objects to it at run time (card areas, HUD, the run state...),
// exactly as the game does, so the engine never imports them.
import { HEX, copy_table } from './colour';

export type Colour = number[];

export interface GameGlobals {
  [key: string]: any;
  VERSION: string;
  TIMERS: { TOTAL: number; REAL: number; REAL_SHADER: number; UPTIME: number; BACKGROUND: number };
  FRAMES: { DRAW: number; MOVE: number };
  exp_times: { xy: number; scale: number; r: number; max_vel?: number };
  SETTINGS: any;
  TILESIZE: number;
  TILESCALE: number;
  TILE_W: number;
  TILE_H: number;
  CARD_W: number;
  CARD_H: number;
  STATES: Record<string, number>;
  STAGES: Record<string, number>;
  UIT: Record<string, number>;
  I: { NODE: any[]; MOVEABLE: any[]; SPRITE: any[]; UIBOX: any[]; POPUP: any[]; CARD: any[]; CARDAREA: any[]; ALERT: any[] };
  C: any;
  FUNCS: Record<string, (...args: any[]) => any>;
  ARGS: any;
}

export const G = {} as GameGlobals;

/** Game:set_globals */
export function set_globals() {
  G.VERSION = '1.0.1o-FULL';

  G.F_QUIT_BUTTON = true;
  G.F_SKIP_TUTORIAL = true;
  G.F_BASIC_CREDITS = false;
  G.F_EXTERNAL_LINKS = true;
  G.F_ENABLE_PERF_OVERLAY = false;
  G.F_NO_SAVING = true;
  G.F_MUTE = false;
  G.F_SOUND_THREAD = false;
  G.F_VIDEO_SETTINGS = false;
  G.F_CTA = false;
  G.F_VERBOSE = false;
  G.F_HTTP_SCORES = false;
  G.F_RUMBLE = null;
  G.F_CRASH_REPORTS = false;
  G.F_NO_ERROR_HAND = false;
  G.F_SWAP_AB_PIPS = false;
  G.F_SWAP_AB_BUTTONS = false;
  G.F_SWAP_XY_BUTTONS = false;
  G.F_NO_ACHIEVEMENTS = true;
  G.F_DISP_USERNAME = null;
  G.F_ENGLISH_ONLY = null;
  G.F_GUIDE = false;
  G.F_JAN_CTA = false;
  G.F_HIDE_BG = false;
  G.F_TROPHIES = false;
  G.F_PS4_PLAYSTATION_GLYPHS = false;
  G.F_LOCAL_CLIPBOARD = false;
  G.F_SAVE_TIMER = 30;
  G.F_MOBILE_UI = false;
  G.F_HIDE_BETA_LANGS = null;

  G.SEED = Date.now() / 1000;
  G.TIMERS = { TOTAL: 0, REAL: 0, REAL_SHADER: 0, UPTIME: 0, BACKGROUND: 0 };
  G.FRAMES = { DRAW: 0, MOVE: 0 };
  G.exp_times = { xy: 0, scale: 0, r: 0 };

  G.SETTINGS = {
    COMP: { name: '', prev_name: '', submission_name: null, score: 0 },
    DEMO: { total_uptime: 0, timed_CTA_shown: true, win_CTA_shown: true, quit_CTA_shown: true },
    ACHIEVEMENTS_EARNED: {},
    crashreports: false,
    colourblind_option: false,
    language: 'en-us',
    screenshake: true,
    run_stake_stickers: false,
    rumble: G.F_RUMBLE,
    play_button_pos: 2,
    GAMESPEED: 1,
    paused: false,
    SOUND: { volume: 50, music_volume: 100, game_sounds_volume: 100 },
    WINDOW: {
      screenmode: 'Borderless', vsync: 1, selected_display: 1, display_names: ['[NONE]'],
      DISPLAYS: [{ name: '[NONE]', screen_res: { w: 1000, h: 650 } }],
    },
    CUSTOM_DECK: { Collabs: { Spades: 'default', Hearts: 'default', Clubs: 'default', Diamonds: 'default' } },
    GRAPHICS: { texture_scaling: 2, shadows: 'On', crt: 70, bloom: 1 },
    tutorial_complete: true,
    tutorial_progress: null,
    profile: 1,
  };

  G.COLLABS = {
    pos: { Jack: { x: 0, y: 0 }, Queen: { x: 1, y: 0 }, King: { x: 2, y: 0 } },
    options: {
      Spades: ['default', 'collab_TW', 'collab_CYP', 'collab_SK', 'collab_DS', 'collab_AC', 'collab_STP'],
      Hearts: ['default', 'collab_AU', 'collab_TBoI', 'collab_CL', 'collab_D2', 'collab_CR', 'collab_BUG'],
      Clubs: ['default', 'collab_VS', 'collab_STS', 'collab_PC', 'collab_WF', 'collab_FO', 'collab_DBD'],
      Diamonds: ['default', 'collab_DTD', 'collab_SV', 'collab_EG', 'collab_XR', 'collab_C7', 'collab_R'],
    },
  };

  G.PROFILES = [{}, {}, {}];

  G.TILESIZE = 20;
  G.TILESCALE = 3.65;
  G.TILE_W = 20;
  G.TILE_H = 11.5;
  G.DRAW_HASH_BUFF = 2;
  G.CARD_W = 2.4 * 35 / 41;
  G.CARD_H = 2.4 * 47 / 41;
  G.HIGHLIGHT_H = 0.2 * G.CARD_H;
  G.COLLISION_BUFFER = 0.05;

  G.PITCH_MOD = 1;

  G.STATES = {
    SELECTING_HAND: 1, HAND_PLAYED: 2, DRAW_TO_HAND: 3, GAME_OVER: 4, SHOP: 5, PLAY_TAROT: 6,
    BLIND_SELECT: 7, ROUND_EVAL: 8, TAROT_PACK: 9, PLANET_PACK: 10, MENU: 11, TUTORIAL: 12,
    SPLASH: 13, SANDBOX: 14, SPECTRAL_PACK: 15, DEMO_CTA: 16, STANDARD_PACK: 17, BUFFOON_PACK: 18,
    NEW_ROUND: 19,
  };
  G.STAGES = { MAIN_MENU: 1, RUN: 2, SANDBOX: 3 };
  G.STAGE_OBJECTS = [[], [], [], []];
  G.STAGE = G.STAGES.MAIN_MENU;
  G.STATE = G.STATES.SPLASH;
  G.TAROT_INTERRUPT = null;
  G.STATE_COMPLETE = false;

  G.ARGS = {};
  G.FUNCS = {};
  G.I = { NODE: [], MOVEABLE: [], SPRITE: [], UIBOX: [], POPUP: [], CARD: [], CARDAREA: [], ALERT: [] };
  G.ANIMATION_ATLAS = {};
  G.ASSET_ATLAS = {};
  G.MOVEABLES = [];
  G.ANIMATIONS = [];
  G.DRAW_HASH = [];

  G.MIN_CLICK_DIST = 0.9;
  G.MIN_HOVER_TIME = 0.1;
  G.DEBUG = false;
  G.ANIMATION_FPS = 10;
  G.VIBRATION = 0;
  G.CHALLENGE_WINS = 5;

  G.C = {
    MULT: HEX('FE5F55'),
    CHIPS: HEX('009dff'),
    MONEY: HEX('f3b958'),
    XMULT: HEX('FE5F55'),
    FILTER: HEX('ff9a00'),
    BLUE: HEX('009dff'),
    RED: HEX('FE5F55'),
    GREEN: HEX('4BC292'),
    PALE_GREEN: HEX('56a887'),
    ORANGE: HEX('fda200'),
    IMPORTANT: HEX('ff9a00'),
    GOLD: HEX('eac058'),
    YELLOW: [1, 1, 0, 1],
    CLEAR: [0, 0, 0, 0],
    WHITE: [1, 1, 1, 1],
    PURPLE: HEX('8867a5'),
    BLACK: HEX('374244'),
    L_BLACK: HEX('4f6367'),
    GREY: HEX('5f7377'),
    CHANCE: HEX('4BC292'),
    JOKER_GREY: HEX('bfc7d5'),
    VOUCHER: HEX('cb724c'),
    BOOSTER: HEX('646eb7'),
    EDITION: [1, 1, 1, 1],
    DARK_EDITION: [0, 0, 0, 1],
    ETERNAL: HEX('c75985'),
    PERISHABLE: HEX('4f5da1'),
    RENTAL: HEX('b18f43'),
    DYN_UI: {
      MAIN: HEX('374244'), DARK: HEX('374244'), BOSS_MAIN: HEX('374244'), BOSS_DARK: HEX('374244'), BOSS_PALE: HEX('374244'),
    },
    SO_1: { Hearts: HEX('f03464'), Diamonds: HEX('f06b3f'), Spades: HEX('403995'), Clubs: HEX('235955') },
    SO_2: { Hearts: HEX('f83b2f'), Diamonds: HEX('e29000'), Spades: HEX('4f31b9'), Clubs: HEX('008ee6') },
    SUITS: { Hearts: HEX('FE5F55'), Diamonds: HEX('FE5F55'), Spades: HEX('374649'), Clubs: HEX('424e54') },
    UI: {
      TEXT_LIGHT: [1, 1, 1, 1],
      TEXT_DARK: HEX('4F6367'),
      TEXT_INACTIVE: HEX('88888899'),
      BACKGROUND_LIGHT: HEX('B8D8D8'),
      BACKGROUND_WHITE: [1, 1, 1, 1],
      BACKGROUND_DARK: HEX('7A9E9F'),
      BACKGROUND_INACTIVE: HEX('666666FF'),
      OUTLINE_LIGHT: HEX('D8D8D8'),
      OUTLINE_LIGHT_TRANS: HEX('D8D8D866'),
      OUTLINE_DARK: HEX('7A9E9F'),
      TRANSPARENT_LIGHT: HEX('eeeeee22'),
      TRANSPARENT_DARK: HEX('22222222'),
      HOVER: HEX('00000055'),
    },
    SET: {
      Default: HEX('cdd9dc'), Enhanced: HEX('cdd9dc'), Joker: HEX('424e54'), Tarot: HEX('424e54'),
      Planet: HEX('424e54'), Spectral: HEX('424e54'), Voucher: HEX('424e54'),
    },
    SECONDARY_SET: {
      Default: HEX('9bb6bdFF'), Enhanced: HEX('8389DDFF'), Joker: HEX('708b91'), Tarot: HEX('a782d1'),
      Planet: HEX('13afce'), Spectral: HEX('4584fa'), Voucher: HEX('fd682b'), Edition: HEX('4ca893'),
    },
    // 1-based in the game; index 0 unused
    RARITY: [null, HEX('009dff'), HEX('4BC292'), HEX('fe5f55'), HEX('b26cbb')],
    BLIND: { Small: HEX('50846e'), Big: HEX('50846e'), Boss: HEX('b44430'), won: HEX('4f6367') },
    // indexed by level; [0] is the game's G.C.HAND_LEVELS[0]
    HAND_LEVELS: [null, HEX('efefef'), HEX('95acff'), HEX('65efaf'), HEX('fae37e'), HEX('ffc052'), HEX('f87d75'), HEX('caa0ef')],
    BACKGROUND: { L: [1, 1, 0, 1], D: HEX('374244'), C: HEX('374244'), contrast: 1 },
  };
  G.C.HAND_LEVELS[0] = G.C.RED;
  G.C.UI_CHIPS = copy_table(G.C.BLUE);
  G.C.UI_MULT = copy_table(G.C.RED);

  G.UIT = { T: 1, B: 2, C: 3, R: 4, O: 5, ROOT: 7, S: 8, I: 9, padding: 0 };
  G.handlist = [
    'Flush Five', 'Flush House', 'Five of a Kind', 'Straight Flush', 'Four of a Kind', 'Full House',
    'Flush', 'Straight', 'Three of a Kind', 'Two Pair', 'Pair', 'High Card',
  ];
  G.button_mapping = {};
  G.keybind_mapping = [{}];
}
