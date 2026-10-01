import type { Settings } from '../domain/types';
import type { Ctx } from './context';
import { h } from './dom';
import { toast } from './sheet';

const hourSelect = (from: number, to: number, value: number) => {
  const el = h('select', {}, ...Array.from({ length: to - from + 1 }, (_, i) => {
    const hour = from + i;
    return h('option', { value: hour }, `${String(hour).padStart(2, '0')}:00`);
  }));
  el.value = String(value);
  return el;
};

export function mountSettings(ctx: Ctx, root: HTMLElement): () => void {
  const s = ctx.store.data.settings;
  const from = hourSelect(0, 23, s.visibleHours.start);
  const to = hourSelect(1, 24, s.visibleHours.end);
  const reminder = h('input', { type: 'time', value: s.sundayReminderTime });
  const surface = h('input', { type: 'number', min: 0, max: 60, value: s.surfaceDaysBefore });

  const save = async () => {
    const start = Number(from.value);
    const end = Number(to.value);
    if (end <= start) {
      toast('Sluttid skal være efter starttid');
      return;
    }
    if (!reminder.value) {
      toast('Vælg et tidspunkt for søndagspåmindelsen');
      return;
    }
    const surfaceDays = Number(surface.value);
    if (!Number.isFinite(surfaceDays) || surfaceDays < 0) {
      toast('Antal dage skal være et tal på 0 eller derover');
      return;
    }
    const patch: Partial<Settings> = {
      visibleHours: { start, end },
      sundayReminderTime: reminder.value,
      surfaceDaysBefore: surfaceDays,
    };
    const ok = await ctx.guard(async () => { await ctx.actions.updateSettings(patch); return true; });
    if (ok) toast('Gemt');
  };

  root.append(
    h(
      'div',
      { class: 'settings' },
      h('h2', {}, 'Vist tidsrum'),
      h('p', { class: 'muted' }, 'De timer kalenderen viser – ens for alle ugens dage.'),
      h('div', { class: 'hours-row' }, h('label', {}, 'Fra', from), h('label', {}, 'Til', to)),
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
