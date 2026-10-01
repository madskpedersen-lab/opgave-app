import { activeBlocks, groupTasks, isOverdue } from '../domain/tasks';
import type { Task } from '../domain/types';
import type { Ctx } from './context';
import { h } from './dom';
import { taskMeta } from './format';
import { ask } from './sheet';
import { openTaskForm } from './taskForm';

export async function openTaskActions(ctx: Ctx, t: Task): Promise<void> {
  type A = 'edit' | 'done' | 'finish' | 'restore' | 'delete';
  const options: { label: string; value: A; kind?: 'primary' | 'danger' }[] = [];
  if (!t.completedAt && t.kind !== 'project') options.push({ label: 'Færdig', value: 'done', kind: 'primary' });
  if (!t.completedAt && t.kind === 'project') options.push({ label: 'Afslut projekt', value: 'finish', kind: 'primary' });
  if (!t.completedAt) options.push({ label: 'Rediger', value: 'edit' });
  if (t.completedAt) options.push({ label: 'Genopret', value: 'restore', kind: 'primary' });
  options.push({ label: 'Slet', value: 'delete', kind: 'danger' });

  const choice = await ask(t.title, h('p', { class: 'muted' }, taskMeta(t, ctx.today())), options);
  if (choice === 'done') await ctx.guard(() => ctx.actions.markDone(t.id));
  if (choice === 'finish') await ctx.guard(() => ctx.actions.finishProject(t.id));
  if (choice === 'restore') await ctx.guard(() => ctx.actions.restoreTask(t.id));
  if (choice === 'edit') await openTaskForm(ctx, t);
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

export function taskItem(ctx: Ctx, t: Task): HTMLElement {
  return h(
    'div',
    {
      class: `task-item${isOverdue(t, ctx.today()) ? ' overdue' : ''}`,
      'data-task-id': t.id,
      'data-title': t.title,
      'data-duration': t.durationMin,
      onclick: () => openTaskActions(ctx, t),
    },
    h('div', { class: 'task-title' }, t.kind === 'project' ? `🔨 ${t.title}` : t.title),
    h('div', { class: 'task-meta' }, taskMeta(t, ctx.today())),
  );
}

export function mountTasks(ctx: Ctx, root: HTMLElement): () => void {
  const list = h('div', { class: 'task-list' });
  const fab = h('button', { class: 'fab', 'aria-label': 'Ny opgave', onclick: () => openTaskForm(ctx) }, '+');
  root.append(list, fab);

  const section = (title: string, tasks: Task[], collapsed = false): HTMLElement | null => {
    if (tasks.length === 0) return null;
    const items = tasks.map((t) => taskItem(ctx, t));
    if (!collapsed) return h('section', {}, h('h2', {}, title), ...items);
    return h('details', {}, h('summary', {}, `${title} (${tasks.length})`), ...items);
  };

  const render = () => {
    const g = groupTasks(ctx.store.data.tasks, ctx.store.data.settings.surfaceDaysBefore, ctx.today());
    const sections = [
      section('Forfalder snart', g.dueSoon),
      section('Klar', g.ready),
      section('Planlagt', g.scheduled),
      section('Store opgaver', g.projects),
      section('Hviler', g.resting, true),
      section('Historik', g.history, true),
    ].filter((s): s is HTMLElement => s !== null);
    list.replaceChildren(...(sections.length ? sections : [h('p', { class: 'empty' }, 'Ingen opgaver endnu. Tryk + for at oprette en.')]));
  };
  render();
  return ctx.store.subscribe(render);
}
