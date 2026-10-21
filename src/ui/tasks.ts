import Sortable from 'sortablejs';
import { activeBlocks, groupTasks, isOverdue } from '../domain/tasks';
import type { Task } from '../domain/types';
import type { Ctx } from './context';
import { h } from './dom';
import { formatDuration, taskMeta } from './format';
import { ask, toast } from './sheet';
import { openTaskForm } from './taskForm';

/** "Del opgaven op": samme tid for begge dele, eller ret tiden for hver del. */
async function openSplit(ctx: Ctx, t: Task): Promise<void> {
  const mode = await ask('Del opgaven op', h('p', {}, `Tager hver del lige så lang tid (${formatDuration(t.durationMin)})?`), [
    { label: `Ja, ${formatDuration(t.durationMin)} hver`, value: 'same' as const, kind: 'primary' },
    { label: 'Ret tiden', value: 'edit' as const },
  ]);
  if (mode === 'same') {
    await ctx.guard(() => ctx.actions.split(t.id, t.durationMin, t.durationMin));
    return;
  }
  if (mode !== 'edit') return;
  const half = Math.max(5, Math.round(t.durationMin / 2 / 5) * 5);
  const first = h('input', { type: 'number', min: 5, step: 5, value: half });
  const second = h('input', { type: 'number', min: 5, step: 5, value: half });
  const body = h('div', { class: 'form' }, h('label', {}, `${t.title} (minutter)`, first), h('label', {}, `${t.title} (2) (minutter)`, second));
  const ok = await ask('Ret tiden', body, [
    { label: 'Del op', value: true, kind: 'primary' },
    { label: 'Annuller', value: false },
  ]);
  if (!ok) return;
  const a = Number(first.value);
  const b = Number(second.value);
  if (!(a > 0) || !(b > 0)) {
    toast('Begge dele skal have en varighed');
    return;
  }
  await ctx.guard(() => ctx.actions.split(t.id, a, b));
}

export async function openTaskActions(ctx: Ctx, t: Task): Promise<void> {
  type A = 'edit' | 'split' | 'done' | 'finish' | 'restore' | 'delete';
  const options: { label: string; value: A; kind?: 'primary' | 'danger' }[] = [];
  if (!t.completedAt && t.kind !== 'project') options.push({ label: 'Færdig', value: 'done', kind: 'primary' });
  if (!t.completedAt && t.kind === 'project') options.push({ label: 'Afslut projekt', value: 'finish', kind: 'primary' });
  if (!t.completedAt) options.push({ label: 'Rediger', value: 'edit' });
  if (!t.completedAt) options.push({ label: 'Del opgaven op', value: 'split' });
  if (t.completedAt) options.push({ label: 'Genopret', value: 'restore', kind: 'primary' });
  options.push({ label: 'Slet', value: 'delete', kind: 'danger' });

  const choice = await ask(t.title, h('p', { class: 'muted' }, taskMeta(t, ctx.today())), options);
  if (choice === 'done') await ctx.guard(() => ctx.actions.markDone(t.id));
  if (choice === 'finish') await ctx.guard(() => ctx.actions.finishProject(t.id));
  if (choice === 'restore') await ctx.guard(() => ctx.actions.restoreTask(t.id));
  if (choice === 'edit') await openTaskForm(ctx, t);
  if (choice === 'split') await openSplit(ctx, t);
  if (choice === 'delete') {
    let deleteEvents = false;
    if (activeBlocks(t).length > 0) {
      const r = await ask('Opgaven ligger i kalenderen', h('p', {}, 'Skal kalenderbegivenhederne også slettes?'), [
        { label: 'Ja, slet dem', value: true, kind: 'danger' },
        { label: 'Nej, behold dem', value: false },
      ]);
      if (r === null) return;
      deleteEvents = r;
    }
    await ctx.guard(() => ctx.actions.deleteTask(t.id, deleteEvents));
  }
}

export function taskItem(ctx: Ctx, t: Task, opts: { sortable?: boolean } = {}): HTMLElement {
  const handle = opts.sortable
    ? h('span', { class: 'drag-handle', 'aria-label': 'Træk for at ændre rækkefølge', onclick: (e: Event) => e.stopPropagation() }, '≡')
    : null;
  return h(
    'div',
    {
      class: `task-item${isOverdue(t, ctx.today()) ? ' overdue' : ''}`,
      'data-task-id': t.id,
      'data-title': t.title,
      'data-duration': t.durationMin,
      onclick: () => openTaskActions(ctx, t),
    },
    h(
      'div',
      { class: 'task-text' },
      h('div', { class: 'task-title' }, t.kind === 'project' ? `🔨 ${t.title}` : t.title),
      h('div', { class: 'task-meta' }, taskMeta(t, ctx.today())),
    ),
    handle,
  );
}

export function mountTasks(ctx: Ctx, root: HTMLElement): () => void {
  const list = h('div', { class: 'task-list' });
  const fab = h('button', { class: 'fab', 'aria-label': 'Ny opgave', onclick: () => openTaskForm(ctx) }, '+');
  root.append(list, fab);

  let sortables: Sortable[] = [];

  /** En gruppe hvor rækkefølgen kan ændres ved at trække i grebet ≡. */
  const sortableSection = (title: string, tasks: Task[]): HTMLElement | null => {
    if (tasks.length === 0) return null;
    const items = h('div', { class: 'sortable' }, ...tasks.map((t) => taskItem(ctx, t, { sortable: tasks.length > 1 })));
    if (tasks.length > 1) {
      sortables.push(
        Sortable.create(items, {
          handle: '.drag-handle',
          animation: 150,
          ghostClass: 'sort-ghost',
          forceFallback: true, // samme træk med mus og finger
          onEnd: (e) => {
            if (e.oldIndex === e.newIndex) return;
            const ids = [...items.children].map((el) => (el as HTMLElement).dataset.taskId!);
            ctx.guard(() => ctx.actions.reorder(ids)).then(render); // render igen, hvis gem fejlede
          },
        }),
      );
    }
    return h('section', {}, h('h2', {}, title), items);
  };

  const section = (title: string, tasks: Task[], collapsed = false): HTMLElement | null => {
    if (tasks.length === 0) return null;
    const items = tasks.map((t) => taskItem(ctx, t));
    if (!collapsed) return h('section', {}, h('h2', {}, title), ...items);
    return h('details', {}, h('summary', {}, `${title} (${tasks.length})`), ...items);
  };

  const destroySortables = () => {
    sortables.forEach((s) => s.destroy());
    sortables = [];
  };

  const render = () => {
    destroySortables();
    const g = groupTasks(ctx.store.data.tasks, ctx.store.data.settings.surfaceDaysBefore, ctx.today());
    const sections = [
      sortableSection('Forfalder snart', g.dueSoon),
      sortableSection('Klar', g.ready),
      section('Planlagt', g.scheduled),
      sortableSection('Store opgaver', g.projects),
      section('Hviler', g.resting, true),
      section('Historik', g.history, true),
    ].filter((s): s is HTMLElement => s !== null);
    list.replaceChildren(...(sections.length ? sections : [h('p', { class: 'empty' }, 'Ingen opgaver endnu. Tryk + for at oprette en.')]));
  };
  render();
  const unsubscribe = ctx.store.subscribe(render);
  return () => {
    unsubscribe();
    destroySortables();
  };
}
