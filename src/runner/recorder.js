// Captures real browser frames and announces them only after they are stored.
import { appendEvent, saveFrame } from '../store/run-store.js';

export function makeRecorder(runId) {
  return {
    event(type, phase, actor, payload) {
      return appendEvent(runId, { type, phase, actor, payload });
    },
    async frame(page, { phase, actor, caption, viewport }) {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 70 });
      const evidenceId = saveFrame(runId, buffer, { url: page.url(), caption, viewport });
      appendEvent(runId, {
        type: 'frame.captured',
        phase,
        actor,
        payload: { evidenceId, url: page.url(), caption, viewport },
      });
      return { evidenceId, buffer };
    },
  };
}
