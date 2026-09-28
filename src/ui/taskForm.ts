import type { Interval, Task, TaskInput, TaskKind } from '../domain/types';
import type { Ctx } from './context';
import { h } from './dom';
import { ask, toast } from './sheet';

const PRESETS = [15, 30, 45, 60, 90, 120, 180];

/** Åbner formularen. Uden `existing` oprettes en ny opgave. */
export async function openTaskForm(ctx: Ctx, existing?: Task): Promise<void> {
  const title = h('input', { type: 'text', placeholder: 'F.eks. Vask bil', value: existing?.title ?? '' });
  const duration = h('input', { type: 'number', min: 5, step: 5, value: existing?.durationMin ?? 60 });
  const presets = h(
    'div',
    { class: 'chips' },
    ...PRESETS.map((m) =>
      h('button', { type: 'button', class: 'chip', onclick: () => { duration.value = String(m); } }, m < 60 ? `${m} min` : `${m / 60} t`),
    ),
  );
  const kind = h(
    'select',
    { disabled: !!existing },
    h('option', { value: 'once' }, 'Engang'),
    h('option', { value: 'recurring' }, 'Tilbagevendende'),
    h('option', { value: 'project' }, 'Stor opgave'),
  );
  kind.value = existing?.kind ?? 'once';
  const count = h('input', { type: 'number', min: 1, value: existing?.interval?.count ?? 3 });
  const unit = h(
    'select',
    {},
    h('option', { value: 'day' }, 'dage'),
    h('option', { value: 'week' }, 'uger'),
    h('option', { value: 'month' }, 'måneder'),
  );
  unit.value = existing?.interval?.unit ?? 'week';
  const intervalRow = h('label', {}, 'Gentag', h('div', { class: 'row' }, count, unit), h('small', {}, 'efter opgaven er løst'));
  const note = h('textarea', { rows: 2, placeholder: 'Note (valgfri)' }, existing?.note ?? '');
  const syncInterval = () => { intervalRow.hidden = kind.value !== 'recurring'; };
  kind.addEventListener('change', syncInterval);
  syncInterval();

  const body = h(
    'div',
    { class: 'form' },
    h('label', {}, 'Navn', title),
    h('label', {}, 'Ca. varighed (minutter)', duration, presets),
    h('label', {}, 'Type', kind),
    intervalRow,
    h('label', {}, 'Note', note),
  );

  const choice = await ask(existing ? 'Rediger opgave' : 'Ny opgave', body, [
    { label: 'Gem', value: 'save' as const, kind: 'primary' },
    { label: 'Annuller', value: 'cancel' as const },
  ]);
  if (choice !== 'save') return;

  const minutes = Number(duration.value);
  if (!title.value.trim() || !(minutes > 0)) {
    toast('Opgaven skal have et navn og en varighed');
    return;
  }
  const input: TaskInput = {
    title: title.value,
    durationMin: minutes,
    kind: kind.value as TaskKind,
    note: note.value,
    interval: kind.value === 'recurring' ? ({ count: Math.max(1, Number(count.value)), unit: unit.value } as Interval) : undefined,
  };
  await ctx.guard(() => (existing ? ctx.actions.editTask(existing.id, input) : ctx.actions.createTask(input)));
}
