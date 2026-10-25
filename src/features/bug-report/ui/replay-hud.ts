// The bar over the game while a report is replayed.
import type { ReportView } from '@/shared/api';
import { add_style, el } from './style';

let root: HTMLElement | null = null;
const parts: Record<string, HTMLElement> = {};

export const hud = {
  show(id: string, controls: { pause: () => void; stop: () => void }) {
    add_style();
    root?.remove();
    root = el('div', 'br-hud');
    root.setAttribute('role', 'status');
    const top = el('div', 'br-hud__row');
    top.append(el('span', 'br-hud__title', `Report ${id.slice(0, 8)}`));
    parts.progress = el('span', undefined, '');
    top.append(parts.progress);
    const pause = el('button', 'br-btn br-btn--grey', 'Pause');
    pause.type = 'button';
    pause.onclick = () => {
      controls.pause();
      pause.textContent = pause.textContent === 'Pause' ? 'Resume' : 'Pause';
    };
    const stop = el('button', 'br-btn br-btn--red', 'Stop');
    stop.type = 'button';
    stop.onclick = () => controls.stop();
    const hide = el('button', 'br-btn br-btn--grey', 'Hide');
    hide.type = 'button';
    hide.onclick = () => root?.remove();
    top.append(pause, stop, hide);
    parts.pause = pause;
    parts.desc = el('div', 'br-hud__desc');
    parts.msg = el('div');
    parts.warn = el('div', 'br-hud__warn');
    root.append(top, parts.desc, parts.msg, parts.warn);
    document.body.append(root);
  },
  report(r: ReportView) {
    const who = r.reporter_name ?? 'a player';
    const errors = Array.isArray(r.recording.errors) ? r.recording.errors.length : 0;
    parts.desc.textContent = `${who}: "${r.description}"${errors ? ` (${errors} error${errors > 1 ? 's' : ''} recorded)` : ''}`;
  },
  message(text: string) {
    if (parts.msg) parts.msg.textContent = text;
  },
  progress(p: { inputs: number; total: number; actions: number; total_actions: number; paused: boolean; diverged: string | null;
    waiting_for_action: number | null; done: boolean }) {
    if (!parts.progress) return;
    parts.progress.textContent = `inputs ${p.inputs}/${p.total} · actions ${p.actions}/${p.total_actions}${p.paused ? ' · paused' : ''}`;
    if (p.done) {
      parts.msg.textContent = 'Replay finished: this is where the player reported the bug.';
      parts.pause.remove();
    } else if (p.waiting_for_action !== null) {
      parts.msg.textContent = `Waiting for action ${p.waiting_for_action} to finish…`;
    }
    parts.warn.textContent = p.diverged ? `The replay went another way at ${p.diverged}` : '';
  },
};
