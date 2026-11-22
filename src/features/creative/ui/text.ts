// Creative mode's texts (the game's localization has none): English, and
// Russian when the game is in Russian.
import { G } from '@/shared/lib/engine';

const EN = {
  creative: 'CREATIVE',
  title: 'Creative mode',
  note: 'Change anything: the game goes on by its own rules from there.',
  money: 'Money',
  hands: 'Hands',
  discards: 'Discards',
  hand_size: 'Hand size',
  joker_slots: 'Joker slots',
  consumable_slots: 'Consumable slots',
  ante: 'Ante',
  hand_level: 'Hand level',
  level: 'Lv. {n}',
  add_cards: 'Add cards',
  win: 'Win the round',
  boss: 'Choose the boss',
  selected: 'Selected: {name}',
  select_hint: 'Select a joker, a consumable or a card in hand to change it.',
  edition: 'Edition',
  seal: 'Seal',
  enhancement: 'Enhancement',
  none: 'None',
  remove: 'Remove',
  eternal: 'Eternal',
  close: 'Close',
  back: 'Back',
  playing_cards: 'Playing card',
  tags: 'Tags',
  to_hand: 'Add to hand',
  to_deck: 'Add to deck',
  rank: 'Rank',
  suit: 'Suit',
  click_to_add: 'Click a card to add it to the run.',
  added: 'Added: {name}',
  failed: 'Not now: {why}',
  boss_only: 'Choose the boss at the blind select.',
  win_only: 'Win while playing a round.',
};

const RU: typeof EN = {
  creative: 'ТВОРЧЕСТВО',
  title: 'Творческий режим',
  note: 'Меняйте что угодно: дальше игра идёт по своим правилам.',
  money: 'Деньги',
  hands: 'Руки',
  discards: 'Сбросы',
  hand_size: 'Размер руки',
  joker_slots: 'Ячейки джокеров',
  consumable_slots: 'Ячейки расходников',
  ante: 'Анте',
  hand_level: 'Уровень комбинации',
  level: 'Ур. {n}',
  add_cards: 'Добавить карты',
  win: 'Выиграть раунд',
  boss: 'Выбрать босса',
  selected: 'Выбрано: {name}',
  select_hint: 'Выберите джокера, расходник или карту в руке, чтобы её изменить.',
  edition: 'Издание',
  seal: 'Печать',
  enhancement: 'Улучшение',
  none: 'Нет',
  remove: 'Убрать',
  eternal: 'Вечный',
  close: 'Закрыть',
  back: 'Назад',
  playing_cards: 'Игральная карта',
  tags: 'Метки',
  to_hand: 'В руку',
  to_deck: 'В колоду',
  rank: 'Ранг',
  suit: 'Масть',
  click_to_add: 'Нажмите на карту, чтобы добавить её в забег.',
  added: 'Добавлено: {name}',
  failed: 'Не сейчас: {why}',
  boss_only: 'Босса выбирают при выборе блайнда.',
  win_only: 'Выиграть можно во время раунда.',
};

export type TextKey = keyof typeof EN;

export function tr(key: TextKey, vars: Record<string, string | number> = {}): string {
  const lang = String(G.SETTINGS?.language ?? 'en-us');
  const table = lang.startsWith('ru') ? RU : EN;
  return table[key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
