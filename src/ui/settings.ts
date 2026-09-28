import type { Settings, Weekday } from '../domain/types';
import type { Ctx } from './context';
import { h } from './dom';
import { toast } from './sheet';

const DAYS: [Weekday, string][] = [[1, 'Mandag'], [2, 'Tirsdag'], [3, 'Onsdag'], [4, 'Torsdag'], [5, 'Fredag'], [6, 'Lørdag'], [0, 'Søndag']];

export function mountSettings(ctx: Ctx, root: HTMLElement): () => void {
  const s = ctx.store.data.settings;
  const rows = DAYS.map(([d, name]) => {
    const w = s.windows[d];
    const on = h('input', { type: 'checkbox', checked: !!w });
    const from = h('input', { type: 'time', value: w?.start ?? '09:00' });
    const to = h('input', { type: 'time', value: w?.end ?? '18:00' });
    const sync = () => { from.disabled = to.disabled = !on.checked; };
    on.addEventListener('change', sync);
    sync();
    return { d, on, from, to, el: h('div', { class: 'day-row' }, h('label', { class: 'check' }, on, name), from, '–', to) };
  });
  const reminder = h('input', { type: 'time', value: s.sundayReminderTime });
  const surface = h('input', { type: 'number', min: 0, max: 60, value: s.surfaceDaysBefore });

  const save = async () => {
    const windows = { ...s.windows };
    for (const r of rows) {
      if (r.on.checked && r.from.value >= r.to.value) {
        toast('Sluttid skal være efter starttid');
        return;
      }
      windows[r.d] = r.on.checked ? { start: r.from.value, end: r.to.value } : null;
    }
    const patch: Partial<Settings> = { windows, sundayReminderTime: reminder.value, surfaceDaysBefore: Math.max(0, Number(surface.value)) };
    const ok = await ctx.guard(async () => { await ctx.actions.updateSettings(patch); return true; });
    if (ok) toast('Gemt');
  };

  root.append(
    h(
      'div',
      { class: 'settings' },
      h('h2', {}, 'Ledige tidsrum'),
      h('p', { class: 'muted' }, 'Opgaver kan kun lægges inden for disse tidsrum.'),
      ...rows.map((r) => r.el),
      h('h2', {}, 'Søndagspåmindelse'),
      h('label', {}, 'Tidspunkt', reminder),
      h('h2', {}, 'Tilbagevendende opgaver'),
      h('label', {}, 'Vis dem på listen så mange dage før forfald', surface),
      h('button', { class: 'btn primary', onclick: save }, 'Gem indstillinger'),
      h('button', { class: 'btn danger', onclick: () => ctx.signOut() }, 'Log ud'),
    ),
  );
  return () => {};
}
