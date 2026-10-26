// "Report a bug", over the game: from the Options menu, with F8, or from the
// note shown when something goes wrong. The game gets no input while it is
// open (shared/lib/input); what is sent is taken when it opens.
import { reports } from '@/shared/api';
import { input_state } from '@/shared/lib/input';
import { finish_draft, start_draft, type Draft } from '../model/collect';
import { add_style, el } from './style';

let open_dialog: HTMLElement | null = null;

function describe_error(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

function minutes(seconds: number) {
  return seconds < 90 ? `${Math.max(1, Math.round(seconds))} seconds` : `${Math.round(seconds / 60)} minutes`;
}

function what_is_sent(d: Draft) {
  const events = d.recording.events;
  const span = events.length ? d.recording.t - events[0].t : 0;
  const errors = d.recording.errors.length;
  const run = d.game ? `your run and all its moves (version ${d.game.version})` : 'no run (you were not in one)';
  return `Sent with it: ${run}, the last ${minutes(span)} of the game (${events.length} events${errors ? `, ${errors} error${errors > 1 ? 's' : ''}` : ''}), your browser and screen size.`;
}

export function open_report_dialog(screenshot: string | null) {
  if (open_dialog) return;
  add_style();
  const draft = start_draft(screenshot);
  input_state.blocked = true;

  const root = el('div', 'br-root');
  const form = el('form', 'br-panel');
  form.setAttribute('role', 'dialog');
  form.setAttribute('aria-modal', 'true');
  form.setAttribute('aria-labelledby', 'br-title');
  const title = el('h2', undefined, 'Report a bug');
  title.id = 'br-title';
  const label = el('label', undefined, 'What went wrong?');
  label.htmlFor = 'br-text';
  const text = el('textarea');
  text.id = 'br-text';
  text.maxLength = 5000;
  text.required = true;
  text.placeholder = 'What did you do, what did you expect, what happened instead?';
  form.append(title, label, text);

  const check = el('input');
  check.type = 'checkbox';
  check.checked = !!screenshot;
  if (screenshot) {
    const row = el('label', 'br-check');
    row.append(check, document.createTextNode('Include this screenshot'));
    const img = el('img', 'br-shot');
    img.src = screenshot;
    img.alt = 'the screen when you asked to report';
    check.onchange = () => { img.style.opacity = check.checked ? '1' : '0.3'; };
    form.append(row, img);
  }
  form.append(el('p', 'br-what', what_is_sent(draft)));
  const status = el('p', 'br-status');
  status.setAttribute('role', 'status');
  const cancel = el('button', 'br-btn br-btn--grey', 'Cancel');
  cancel.type = 'button';
  const send = el('button', 'br-btn br-btn--red', 'Send');
  send.type = 'submit';
  const buttons = el('div', 'br-buttons');
  buttons.append(cancel, send);
  form.append(status, buttons);
  root.append(form);

  const close = () => {
    root.remove();
    open_dialog = null;
    input_state.blocked = false;
    document.getElementById('screen')?.focus();
  };
  cancel.onclick = close;
  root.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
  });
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!text.value.trim()) {
      status.className = 'br-status br-status--error';
      status.textContent = 'Say a few words about what went wrong.';
      text.focus();
      return;
    }
    send.disabled = cancel.disabled = true;
    status.className = 'br-status';
    status.textContent = 'Sending…';
    try {
      const sent = await reports.submit(await finish_draft(draft, text.value.trim(), check.checked));
      status.className = 'br-status br-status--ok';
      status.textContent = `Thank you! Report ${sent.id.slice(0, 8)} is with the developers.`;
      send.textContent = 'Sent';
      cancel.textContent = 'Close';
      cancel.disabled = false;
      setTimeout(() => open_dialog === root && close(), 2500);
    } catch (err) {
      status.className = 'br-status br-status--error';
      status.textContent = `It wasn't sent: ${describe_error(err)}`;
      send.disabled = cancel.disabled = false;
    }
  };
  document.body.append(root);
  open_dialog = root;
  text.focus();
}

let toast: HTMLElement | null = null;
let last_toast = -Infinity;
let dismissed = false;
const offered = new Set<string>();

/**
 * After an error: a note offering to report it. Once per error (the same
 * error again, every frame, doesn't ask again), at most once a minute, and
 * not again after Dismiss (F8 still reports).
 */
export function offer_report(take_screenshot: () => Promise<string | null>, message = '') {
  const now = performance.now();
  if (dismissed || open_dialog || toast || now - last_toast < 60_000 || offered.has(message)) return;
  offered.add(message);
  last_toast = now;
  add_style();
  toast = el('div', 'br-toast');
  toast.setAttribute('role', 'status');
  toast.append(el('span', undefined, 'Something went wrong in the game.'));
  const report = el('button', 'br-btn br-btn--red', 'Report it (F8)');
  report.type = 'button';
  const dismiss = el('button', 'br-btn br-btn--grey', 'Dismiss');
  dismiss.type = 'button';
  const hide = () => { toast?.remove(); toast = null; };
  report.onclick = async () => { hide(); open_report_dialog(await take_screenshot()); };
  dismiss.onclick = () => { dismissed = true; hide(); };
  toast.append(report, dismiss);
  document.body.append(toast);
  setTimeout(hide, 15_000);
}
