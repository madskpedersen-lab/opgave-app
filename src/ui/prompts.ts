import type { Question } from '../domain/reconcile';
import type { Ctx } from './context';
import { h } from './dom';
import { formatDateTime } from './format';
import { ask } from './sheet';

export async function runQuestions(ctx: Ctx, questions: Question[]): Promise<void> {
  for (const q of questions) {
    const text = q.kind === 'session'
      ? `Fik du arbejdet på «${q.title}» ${formatDateTime(q.start)}?`
      : `«${q.title}» var planlagt ${formatDateTime(q.start)}. Blev den gjort?`;
    const yes = await ask('Hvordan gik det?', h('p', {}, text), [
      { label: 'Ja', value: true, kind: 'primary' },
      { label: 'Nej', value: false },
    ]);
    if (yes === null) continue; // spørges igen næste gang
    await ctx.guard(() => ctx.actions.answer(q, yes));
  }
}
