// The notifications' texts: English, and Russian when the game is in Russian.
import { G } from '@/shared/lib/engine';

const EN = {
  title: 'Notifications',
  empty: 'Nothing new',
  open: 'Notifications',
  request: '{name} wants to be your friend',
  accept: 'Accept',
  decline: 'Decline',
  message: '{name}: {text}',
  messages: '{n} new in {title}',
  read: 'Read',
  invite_pvp: '{name} invites you to a PvP match',
  invite_coop: '{name} invites you to play coop',
  join: 'Join',
  offline: 'Notifications are off: the social service can\'t be reached',
  error: 'That didn\'t work: {msg}',
};

const RU: typeof EN = {
  title: 'Уведомления',
  empty: 'Ничего нового',
  open: 'Уведомления',
  request: '{name} хочет добавить вас в друзья',
  accept: 'Принять',
  decline: 'Отклонить',
  message: '{name}: {text}',
  messages: '{n} новых в «{title}»',
  read: 'Читать',
  invite_pvp: '{name} зовёт вас в PvP-матч',
  invite_coop: '{name} зовёт вас играть вместе',
  join: 'Войти',
  offline: 'Уведомления недоступны: социальный сервис не отвечает',
  error: 'Не получилось: {msg}',
};

export function tn(key: keyof typeof EN, vars: Record<string, string | number> = {}): string {
  const table = String(G.SETTINGS?.language ?? 'en-us').startsWith('ru') ? RU : EN;
  return table[key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
