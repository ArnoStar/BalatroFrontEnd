// Game:set_language (game.lua): the game's languages and fonts. English is in
// game.json; the other languages' text (public/localization) and their fonts'
// full glyph sets (public/fonts, scripts/copy-assets.mjs) are fetched when the
// player picks one. Until then each font has a small dump with its language's
// name, for the language menu. The first language is the browser's, when the
// game has it (the game asks Steam for the system's).
import { G } from '@/shared/lib/engine';
import { loadFont } from '@/shared/lib/love';
import { init_localization } from '@/shared/lib/localization';

const FONTS_BASE = `${import.meta.env.BASE_URL}fonts`;
const TEXT_BASE = `${import.meta.env.BASE_URL}localization`;

// G.FONTS, without FONT (`name`: its dump in public/fonts; `label`: it has a language-name dump)
const FONT_DEFS = [
  { name: 'm6x11plus', file: 'resources/fonts/m6x11plus.ttf', render_scale: 10, TEXT_HEIGHT_SCALE: 0.83, TEXT_OFFSET: { x: 10, y: -20 }, FONTSCALE: 0.1, squish: 1, DESCSCALE: 1 },
  { name: 'NotoSansSC-Bold', label: true, file: 'resources/fonts/NotoSansSC-Bold.ttf', render_scale: 7, TEXT_HEIGHT_SCALE: 0.7, TEXT_OFFSET: { x: 0, y: -35 }, FONTSCALE: 0.12, squish: 1, DESCSCALE: 1.1 },
  { name: 'NotoSansTC-Bold', label: true, file: 'resources/fonts/NotoSansTC-Bold.ttf', render_scale: 7, TEXT_HEIGHT_SCALE: 0.7, TEXT_OFFSET: { x: 0, y: -35 }, FONTSCALE: 0.12, squish: 1, DESCSCALE: 1.1 },
  { name: 'NotoSansKR-Bold', label: true, file: 'resources/fonts/NotoSansKR-Bold.ttf', render_scale: 7, TEXT_HEIGHT_SCALE: 0.8, TEXT_OFFSET: { x: 0, y: -20 }, FONTSCALE: 0.12, squish: 1, DESCSCALE: 1 },
  { name: 'NotoSansJP-Bold', label: true, file: 'resources/fonts/NotoSansJP-Bold.ttf', render_scale: 7, TEXT_HEIGHT_SCALE: 0.8, TEXT_OFFSET: { x: 0, y: -20 }, FONTSCALE: 0.12, squish: 1, DESCSCALE: 1 },
  { name: 'NotoSans-Bold', label: true, file: 'resources/fonts/NotoSans-Bold.ttf', render_scale: 7, TEXT_HEIGHT_SCALE: 0.65, TEXT_OFFSET: { x: 0, y: -40 }, FONTSCALE: 0.12, squish: 1, DESCSCALE: 1 },
  { name: 'm6x11plus', file: 'resources/fonts/m6x11plus.ttf', render_scale: 10, TEXT_HEIGHT_SCALE: 0.9, TEXT_OFFSET: { x: 10, y: 15 }, FONTSCALE: 0.1, squish: 1, DESCSCALE: 1 },
];

// G.LANGUAGES (font: G.FONTS's 1-based index, as in the game)
const LANGUAGE_DEFS: Record<string, { font: number; label: string; beta?: boolean; button: string; warning: string[] }> = {
  'en-us': { font: 1, label: 'English', button: 'Language Feedback', warning: ['This language is still in Beta. To help us', 'improve it, please click on the feedback button.', 'Click again to confirm'] },
  de: { font: 1, label: 'Deutsch', button: 'Feedback zur Übersetzung', warning: ['Diese Übersetzung ist noch im Beta-Stadium. Willst du uns helfen,', 'sie zu verbessern? Dann klicke bitte auf die Feedback-Taste.', 'Zum Bestätigen erneut klicken'] },
  es_419: { font: 1, label: 'Español (México)', button: 'Sugerencias de idioma', warning: ['Este idioma todavía está en Beta. Pulsa el botón', 'de sugerencias para ayudarnos a mejorarlo.', 'Haz clic de nuevo para confirmar'] },
  es_ES: { font: 1, label: 'Español (España)', button: 'Sugerencias de idioma', warning: ['Este idioma todavía está en Beta. Pulsa el botón', 'de sugerencias para ayudarnos a mejorarlo.', 'Haz clic de nuevo para confirmar'] },
  fr: { font: 1, label: 'Français', button: 'Partager votre avis', warning: ['La traduction française est encore en version bêta. ', 'Veuillez cliquer sur le bouton pour nous donner votre avis.', 'Cliquez à nouveau pour confirmer'] },
  id: { font: 1, label: 'Bahasa Indonesia', beta: true, button: 'Umpan Balik Bahasa', warning: ['Bahasa ini masih dalam tahap Beta. Untuk membantu', 'kami meningkatkannya, silakan klik tombol umpan balik.', 'Klik lagi untuk mengonfirmasi'] },
  it: { font: 1, label: 'Italiano', button: 'Feedback traduzione', warning: ['Questa traduzione è ancora in Beta. Per', 'aiutarci a migliorarla, clicca il tasto feedback', 'Fai clic di nuovo per confermare'] },
  ja: { font: 5, label: '日本語', button: '提案する', warning: ['この翻訳は現在ベータ版です。提案があった場合、', 'ボタンをクリックしてください。', 'もう一度クリックして確認'] },
  ko: { font: 4, label: '한국어', button: '번역 피드백', warning: ['이 언어는 아직 베타 단계에 있습니다. ', '번역을 도와주시려면 피드백 버튼을 눌러주세요.', '다시 클릭해서 확인하세요'] },
  nl: { font: 1, label: 'Nederlands', button: 'Taal suggesties', warning: ['Deze taal is nog in de Beta fase. Help ons het te ', 'verbeteren door op de suggestie knop te klikken.', 'Klik opnieuw om te bevestigen'] },
  pl: { font: 1, label: 'Polski', button: 'Wyślij uwagi do tłumaczenia', warning: ['Polska wersja językowa jest w fazie Beta. By pomóc nam poprawić', ' jakość tłumaczenia, kliknij przycisk i podziel się swoją opinią i uwagami.', 'Kliknij ponownie, aby potwierdzić'] },
  pt_BR: { font: 1, label: 'Português', button: 'Feedback de Tradução', warning: ['Esta tradução ainda está em Beta. Se quiser nos ajudar', 'a melhorá-la, clique no botão de feedback por favor', 'Clique novamente para confirmar'] },
  ru: { font: 6, label: 'Русский', beta: true, button: 'Отзыв о языке', warning: ['Этот язык все еще находится в Бета-версии. Чтобы помочь', 'нам его улучшить, пожалуйста, нажмите на кнопку обратной связи.', 'Щелкните снова, чтобы подтвердить'] },
  zh_CN: { font: 2, label: '简体中文', button: '意见反馈', warning: ['这个语言目前尚为Beta版本。 请帮助我们改善翻译品质，', '点击”意见反馈” 来提供你的意见。', '再次点击确认'] },
  zh_TW: { font: 3, label: '繁體中文', button: '意見回饋', warning: ['這個語言目前尚為Beta版本。請幫助我們改善翻譯品質，', '點擊”意見回饋” 來提供你的意見。', '再按一下即可確認'] },
};

/** the game's language for the browser's (navigator.languages), or English */
export function browser_language(): string {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const [lang, region = ''] = String(tag).split('-');
    const l = lang.toLowerCase(), r = region.toUpperCase();
    if (l === 'es') return r === 'ES' ? 'es_ES' : 'es_419';
    if (l === 'pt') return 'pt_BR';
    if (l === 'zh') return ['TW', 'HK', 'MO', 'HANT'].includes(r) ? 'zh_TW' : 'zh_CN';
    if (l === 'en') return 'en-us';
    if (LANGUAGE_DEFS[l]) return l;
  }
  return 'en-us';
}

const english = { text: null as any };
const full = new Set<any>(); // fonts whose whole dump is loaded

async function load_full_font(font: any) {
  if (full.has(font)) return;
  font.FONT = await loadFont(FONTS_BASE, font.name);
  full.add(font);
  // (G.FONTS[7] is the same font file as G.FONTS[1])
  for (const f of G.FONTS) if (f !== font && f.name === font.name) { f.FONT = font.FONT; full.add(f); }
}

async function load_text(key: string): Promise<any> {
  if (key === 'en-us') return english.text;
  const r = await fetch(`${TEXT_BASE}/${key}.json`);
  if (!r.ok) throw new Error(`${TEXT_BASE}/${key}.json: ${r.status}`);
  return r.json();
}

/** Game:set_language at start-up: G.FONTS, G.LANGUAGES, G.LANG and its text (G.localization holds English) */
export async function init_languages() {
  english.text = G.localization;
  G.FONTS = FONT_DEFS.map((f) => ({ ...f, render_scale: G.TILESIZE * f.render_scale }));
  G.LANGUAGES = {};
  for (const [key, v] of Object.entries(LANGUAGE_DEFS)) G.LANGUAGES[key] = { ...v, key, font: G.FONTS[v.font - 1] };
  await load_full_font(G.FONTS[0]);
  await Promise.all(G.FONTS.filter((f: any) => f.label).map(async (f: any) => {
    if (!full.has(f)) f.FONT = await loadFont(FONTS_BASE, `${f.name}.label`);
  }));
  if (!G.LANGUAGES[G.SETTINGS.language]) G.SETTINGS.language = 'en-us';
  try {
    await use_language(G.SETTINGS.language);
  } catch (err) {
    console.warn('[language]', err);
    G.SETTINGS.language = 'en-us';
    await use_language('en-us');
  }
}

/** loads a language's text and font, then makes it the game's (G.LANG, G.localization) */
export async function use_language(key: string) {
  const lang = G.LANGUAGES[key] ?? G.LANGUAGES['en-us'];
  const [text] = await Promise.all([load_text(lang.key), load_full_font(lang.font)]);
  G.SETTINGS.language = lang.key;
  G.LANG = lang;
  G.localization = text;
  init_localization();
}
