// Emotes: quick messages between the players of a match (the API keeps them a
// few seconds in the match's view). A button opens the eight of them; a sent
// or received one pops up at the top of the screen as a bubble, over the cards
// and menus, with the sender's name. (A box draws once a frame, the first time:
// with a `parent` the screen's own boxes, drawn before the cards, skip it, and
// G.I.POPUP, drawn last, draws it.)
import { G, UIBox, DynaText, play_sound } from '@/shared/lib/engine';
import { UIBox_button } from '@/shared/ui';
import { matches, type EmoteName, type MatchView } from '@/shared/api';
import { mp, on_match } from '../model/match';
import { tr, type TextKey } from './text';

export const EMOTES: EmoteName[] = ['good_luck', 'nice', 'wow', 'oops', 'hurry', 'thanks', 'gg', 'well_played'];
const BUBBLE_MS = 2800;

const seen: Record<string, number> = {}; // match id -> the last emote shown
let picker: any = null;
let bubbles: any[] = [];

const text_of = (e: EmoteName) => tr(`emote_${e}` as TextKey);

/** the button that opens the emotes (under a board, in an overlay) */
export function emote_button(minw = 1.1, scale = 0.26, minh = 0.36) {
  return UIBox_button({ button: 'mp_emotes', label: [tr('emote')], minw, minh, scale, colour: G.C.BLUE, col: true });
}

function picker_definition() {
  const rows: any[] = [];
  for (let i = 0; i < EMOTES.length; i += 2) {
    rows.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: EMOTES.slice(i, i + 2).map((e) => (
      UIBox_button({ button: 'mp_emote_send', ref_table: { emote: e }, label: [text_of(e)], minw: 1.9, minh: 0.4, scale: 0.28, colour: G.C.BLUE, col: true })
    )) });
  }
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.08, colour: G.C.L_BLACK, emboss: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm' }, nodes: rows },
    ] },
  ] };
}

function close_picker() {
  if (!picker) return;
  const i = G.I.POPUP.indexOf(picker);
  if (i >= 0) G.I.POPUP.splice(i, 1);
  picker.remove();
  picker = null;
}

/** a bubble at the top of the screen: "Ann: Nice!" */
export function show_emote(m: MatchView, seat: number, emote: EmoteName) {
  const name = m.players[seat]?.name ?? '?';
  const mine = seat === m.seat;
  const box = new UIBox({
    definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', r: 0.15, padding: 0.12, colour: mine ? G.C.BLUE : G.C.GREEN, emboss: 0.08, shadow: true }, nodes: [
        { n: G.UIT.T, config: { text: `${name}: `, scale: 0.4, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        { n: G.UIT.O, config: { object: new DynaText({ string: [text_of(emote)], colours: [G.C.WHITE], shadow: true, float: true, bump: true, scale: 0.5, pop_in: 0, pop_in_rate: 6, silent: true }) } },
      ] },
    ] },
    config: { major: G.ROOM_ATTACH, parent: G.ROOM_ATTACH, align: 'tm', offset: { x: 0, y: 0.35 + 0.75 * bubbles.length }, bond: 'Weak' },
  });
  G.I.POPUP.push(box);
  bubbles.push(box);
  play_sound(mine ? 'paper1' : 'highlight2', mine ? 1.1 : 0.9, 0.7);
  setTimeout(() => {
    const i = G.I.POPUP.indexOf(box);
    if (i >= 0) G.I.POPUP.splice(i, 1);
    box.remove();
    bubbles = bubbles.filter((b) => b !== box);
  }, BUBBLE_MS);
}

/** the other player's new emotes in the match's view (on first sight of a match: none, they are old) */
function receive(m: MatchView | null) {
  if (!m || !m.emotes) return;
  const last = Math.max(0, ...m.emotes.map((e) => e.seq));
  if (seen[m.id] === undefined) {
    seen[m.id] = last;
    return;
  }
  for (const e of m.emotes) {
    if (e.seq > seen[m.id] && e.seat !== m.seat) show_emote(m, e.seat, e.emote);
  }
  seen[m.id] = Math.max(seen[m.id], last);
}

export function register_emote_funcs() {
  on_match(receive);
  G.FUNCS.mp_emotes = (e: any) => {
    if (picker) return close_picker();
    const m = mp.match;
    if (!m || m.players.length < 2) return;
    picker = new UIBox({
      definition: picker_definition(),
      config: { major: e?.UIBox ?? G.ROOM_ATTACH, parent: e?.UIBox ?? G.ROOM_ATTACH, align: e?.UIBox ? 'cl' : 'cm', offset: { x: -0.1, y: 0 }, bond: 'Weak' },
    });
    G.I.POPUP.push(picker);
  };
  G.FUNCS.mp_emote_send = (e: any) => {
    const m = mp.match;
    const emote = e?.config?.ref_table?.emote as EmoteName | undefined;
    close_picker();
    if (!m || !emote) return;
    show_emote(m, m.seat, emote);
    void matches.emote(m.id, emote).catch(() => {});
  };
}

/** (leaving a screen: its picker goes too) */
export function close_emotes() {
  close_picker();
}
