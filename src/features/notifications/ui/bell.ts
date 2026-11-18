// The notification bell (top right, over the game) with what waits for the
// player, and a pop-up for each new thing: a friend request (accept it here),
// a message (read it in the portal's chat), an invite to a friend's match
// (join it here). Only for a signed-in player.
import { G } from '@/shared/lib/engine';
import { input_state } from '@/shared/lib/input';
import { portal_base, social_api, type ConversationView, type FriendRequestView, type InviteView } from '@/shared/api';
import { count, forget, inbox, on_inbox, on_new, type NewThing } from '../model/inbox';
import { tn } from './text';

const CSS = `
@font-face { font-family: 'm6x11'; src: url('${import.meta.env.BASE_URL}resources/fonts/m6x11plus.ttf'); }
.nt-bell { position: fixed; top: 8px; right: 8px; z-index: 44; width: 40px; height: 40px; border: 3px solid #1e2b2d;
  border-radius: 50%; background: #3a5055; color: #fff; cursor: pointer; display: grid; place-items: center; padding: 0;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45); }
.nt-bell svg { width: 20px; height: 20px; fill: currentColor; }
.nt-bell:focus-visible, .nt-btn:focus-visible { outline: 3px solid #eac058; outline-offset: 2px; }
.nt-badge { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 4px; box-sizing: border-box;
  border-radius: 10px; background: #fe5f55; color: #fff; font: 15px/20px m6x11, system-ui, sans-serif; text-align: center; }
.nt-badge:empty { display: none; }
.nt-panel, .nt-toasts { position: fixed; right: 8px; z-index: 44; width: min(340px, calc(100vw - 16px)); box-sizing: border-box;
  font: 18px/1.2 m6x11, 'Trebuchet MS', system-ui, sans-serif; color: #fff; }
.nt-panel { top: 56px; display: grid; gap: 6px; max-height: min(70vh, 520px); overflow-y: auto; padding: 10px; border-radius: 12px;
  background: rgba(30, 43, 45, 0.96); border: 3px solid #1e2b2d; box-shadow: 0 6px 0 rgba(0, 0, 0, 0.45); }
.nt-panel h2 { margin: 0 0 2px; font-size: 24px; font-weight: normal; }
.nt-toasts { top: 56px; display: grid; gap: 8px; pointer-events: none; }
.nt-item { display: grid; gap: 6px; padding: 8px 10px; border-radius: 10px; background: #3a5055; pointer-events: auto; }
.nt-toasts .nt-item { border: 3px solid #1e2b2d; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.45); animation: nt-in 0.25s ease; }
.nt-item--invite { background: #7a3a37; }
.nt-item--request { background: #2f5b6e; }
@keyframes nt-in { from { transform: translateX(30px); opacity: 0; } }
.nt-text { overflow-wrap: anywhere; }
.nt-dim { color: #b7c3c5; font-size: 16px; }
.nt-row { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
.nt-btn { padding: 3px 12px; border: 0; border-radius: 8px; color: #fff; font: inherit; cursor: pointer; background: #5f7377; }
.nt-btn--go { background: #4bc292; } .nt-btn--red { background: #fe5f55; } .nt-btn--blue { background: #009dff; }
`;

let bell: HTMLButtonElement | null = null;
let badge: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let toasts: HTMLElement | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(label: string, cls: string, onclick: () => void): HTMLButtonElement {
  const b = el('button', `nt-btn ${cls}`, label);
  b.type = 'button';
  b.onclick = (e) => { e.stopPropagation(); onclick(); };
  return b;
}

async function attempt(item: HTMLElement, fn: () => Promise<unknown>) {
  for (const b of item.querySelectorAll('button')) b.disabled = true;
  try {
    await fn();
    item.remove();
  } catch (err) {
    item.append(el('div', 'nt-dim', tn('error', { msg: String((err as Error)?.message ?? err) })));
    for (const b of item.querySelectorAll('button')) b.disabled = false;
  }
}

function request_item(r: FriendRequestView): HTMLElement {
  const item = el('div', 'nt-item nt-item--request');
  item.append(el('div', 'nt-text', tn('request', { name: r.sender.name ?? '?' })));
  const row = el('div', 'nt-row');
  row.append(
    btn(tn('decline'), '', () => attempt(item, async () => { await social_api.answer_request(r.id, false); forget('request', r.id); })),
    btn(tn('accept'), 'nt-btn--go', () => attempt(item, async () => { await social_api.answer_request(r.id, true); forget('request', r.id); })),
  );
  item.append(row);
  return item;
}

function chat_url(c: ConversationView) {
  return `${portal_base()}/chat/${encodeURIComponent(c.id)}`;
}

function conversation_item(c: ConversationView, text?: string, from?: string): HTMLElement {
  const item = el('div', 'nt-item');
  const name = from ?? c.last_message?.sender?.name ?? c.title ?? '?';
  const last = text ?? c.last_message?.text ?? '';
  item.append(el('div', 'nt-text', c.unread > 1 && !text
    ? tn('messages', { n: c.unread, title: c.title ?? name })
    : tn('message', { name, text: last.length > 120 ? last.slice(0, 117) + '…' : last })));
  const row = el('div', 'nt-row');
  row.append(btn(tn('read'), 'nt-btn--blue', () => { window.open(chat_url(c), '_blank', 'noopener'); item.remove(); }));
  item.append(row);
  return item;
}

function invite_item(i: InviteView): HTMLElement {
  const item = el('div', 'nt-item nt-item--invite');
  item.append(el('div', 'nt-text', tn(i.mode === 'coop' ? 'invite_coop' : 'invite_pvp', { name: i.sender.name ?? '?' })));
  const row = el('div', 'nt-row');
  row.append(
    btn(tn('decline'), '', () => attempt(item, async () => { await social_api.answer_invite(i.id, false); forget('invite', i.id); })),
    btn(tn('join'), 'nt-btn--red', () => attempt(item, async () => {
      await social_api.answer_invite(i.id, true).catch(() => undefined); // (expired: joining says so)
      forget('invite', i.id);
      close_panel();
      G.FUNCS.multiplayer_join?.(i.code);
    })),
  );
  item.append(row);
  return item;
}

function render_badge() {
  if (!badge || !bell) return;
  const n = count();
  badge.textContent = n ? String(n > 99 ? '99+' : n) : '';
  bell.setAttribute('aria-label', n ? `${tn('open')} (${n})` : tn('open'));
  if (panel) fill_panel();
}

function fill_panel() {
  if (!panel) return;
  const now = Date.now();
  const items: HTMLElement[] = [
    ...inbox.invites.filter((i) => Date.parse(i.expires_at) > now).map(invite_item),
    ...inbox.requests.map(request_item),
    ...inbox.conversations.filter((c) => c.unread > 0 && !c.muted).map((c) => conversation_item(c)),
  ];
  panel.replaceChildren(el('h2', undefined, tn('title')), ...(items.length ? items : [el('div', 'nt-dim', tn('empty'))]));
}

function close_panel() {
  panel?.remove();
  panel = null;
  bell?.setAttribute('aria-expanded', 'false');
}

function toggle_panel() {
  if (panel) {
    close_panel();
    return;
  }
  panel = el('div', 'nt-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', tn('title'));
  // (the game doesn't take the keys typed in it)
  panel.addEventListener('focusin', () => { input_state.blocked = true; });
  panel.addEventListener('focusout', () => { input_state.blocked = false; });
  fill_panel();
  document.body.append(panel);
  bell?.setAttribute('aria-expanded', 'true');
}

function pop(n: NewThing) {
  if (!toasts) return;
  close_panel();
  const item = n.kind === 'request' ? request_item(n.request)
    : n.kind === 'invite' ? invite_item(n.invite)
      : conversation_item(n.conversation, n.text, n.from);
  toasts.prepend(item);
  while (toasts.children.length > 3) toasts.lastElementChild?.remove();
  setTimeout(() => item.remove(), n.kind === 'invite' ? 30_000 : 9_000);
}

export function show_bell() {
  if (bell) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  bell = el('button', 'nt-bell');
  bell.type = 'button';
  bell.setAttribute('aria-haspopup', 'dialog');
  bell.setAttribute('aria-expanded', 'false');
  bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>';
  badge = el('span', 'nt-badge');
  bell.append(badge);
  bell.onclick = () => toggle_panel();
  toasts = el('div', 'nt-toasts');
  toasts.setAttribute('aria-live', 'polite');
  document.body.append(bell, toasts);
  document.addEventListener('pointerdown', (e) => {
    if (panel && !panel.contains(e.target as Node) && !bell?.contains(e.target as Node)) close_panel();
  });
  on_inbox(render_badge);
  on_new(pop);
  render_badge();
}
