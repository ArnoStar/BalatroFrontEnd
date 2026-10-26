// Bug reports from inside the game: Options > "Report a bug", F8, or the note
// after an error; and /play/?report=<id> to see a report's bug again.
import { G } from '@/shared/lib/engine';
import { recorder } from '@/shared/lib/recorder';
import { offer_report, open_report_dialog } from './ui/dialog';

export { make_plan, start_replay_if_asked, type Plan } from './model/replay';

/** the game as it was when the Options menu opened (the report button is in it) */
let shot_before_menu: Promise<string | null> | null = null;

export function register_bug_report_funcs() {
  const options = G.FUNCS.options;
  G.FUNCS.options = (...args: any[]) => {
    const result = options(...args);
    // the frame being drawn already has the menu: hide it for that one frame
    const menu = G.OVERLAY_MENU;
    if (menu?.states) menu.states.visible = false;
    shot_before_menu = recorder.screenshot().finally(() => {
      if (menu?.states && G.OVERLAY_MENU === menu) menu.states.visible = true;
    });
    return result;
  };
  G.FUNCS.report_bug = async () => {
    const shot = shot_before_menu ? await shot_before_menu : await recorder.screenshot();
    open_report_dialog(shot);
  };
  window.addEventListener('keydown', async (e) => {
    if (e.key !== 'F8' || e.repeat) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open_report_dialog(await recorder.screenshot());
  }, { capture: true });
  recorder.on((e) => {
    if (e.k === 'error') offer_report(() => recorder.screenshot(), String(e.message ?? ''));
  });
}
