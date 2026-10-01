import { Calendar, type EventApi, type EventInput } from '@fullcalendar/core';
import type { PointerDragEvent } from '@fullcalendar/core/internal';
import daLocale from '@fullcalendar/core/locales/da';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { isValidPlacement, type Span } from '../domain/availability';
import { activeBlocks, groupTasks } from '../domain/tasks';
import type { CalEvent, Color, ExternalEvent } from '../google/calendar';
import type { Ctx } from './context';
import { h } from './dom';
import { ask, toast } from './sheet';
import { startAutoScroll } from './autoscroll';
import { attachSwipe, type SwipeDirection } from './swipe';
import { openTaskForm } from './taskForm';
import { taskItem } from './tasks';

const hourTime = (h: number) => `${String(h).padStart(2, '0')}:00:00`;

export function mountPlan(ctx: Ctx, root: HTMLElement): () => void {
  const calEl = h('div', { class: 'cal' });
  const drawerList = h('div', { class: 'drawer-list' });
  const drawer = h(
    'div',
    { class: 'drawer' },
    h('button', { class: 'drawer-handle', onclick: () => drawer.classList.toggle('open') }, 'Opgaver – hold og træk op i kalenderen'),
    drawerList,
  );
  root.append(calEl, drawer);

  let external: ExternalEvent[] = [];
  let busy: Span[] = [];
  let taskEvents: CalEvent[] = [];
  let taskColor: Color | undefined;
  let dragging = false;
  let lastDragEnd = 0;
  let stopScroll: (() => void) | null = null;
  const beginAutoScroll = (clientY: number) => {
    stopScroll?.();
    const scroller = calEl.querySelector('.fc-timegrid-body')?.closest<HTMLElement>('.fc-scroller');
    stopScroll = scroller ? startAutoScroll(scroller, clientY) : null;
  };
  const endAutoScroll = () => {
    stopScroll?.();
    stopScroll = null;
  };
  const pointerY = (e: MouseEvent | TouchEvent) => ('touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY);
  let destroyed = false;
  const settings = () => ctx.store.data.settings;
  const findTask = (id: string) => ctx.store.data.tasks.find((t) => t.id === id);

  const occupied = (exceptEventId?: string): Span[] => [
    ...busy,
    ...taskEvents.filter((e) => e.id !== exceptEventId).map((e) => ({ start: new Date(e.start), end: new Date(e.end) })),
  ];
  const allowed = (start: Date, end: Date, exceptEventId?: string) =>
    isValidPlacement({ start, end }, occupied(exceptEventId));

  const toEvents = (): EventInput[] => {
    const active = new Set(ctx.store.data.tasks.flatMap(activeBlocks).map((b) => b.eventId));
    return [
      ...external.filter((e) => !e.allDay).map((e) => ({
        id: `ext:${e.calendarId}:${e.id}`,
        title: e.title,
        start: e.start,
        end: e.end,
        editable: false,
        backgroundColor: e.color.bg,
        borderColor: e.color.bg,
        textColor: e.color.fg,
        classNames: ['external'],
        extendedProps: { external: true },
      })),
      ...taskEvents.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        editable: active.has(e.id),
        backgroundColor: taskColor?.bg,
        borderColor: taskColor?.bg,
        textColor: taskColor?.fg,
        classNames: active.has(e.id) ? ['task-block'] : ['task-block', 'done'],
        extendedProps: { taskId: e.taskId, active: active.has(e.id) },
      })),
    ];
  };

  const calendar = new Calendar(calEl, {
    plugins: [timeGridPlugin, interactionPlugin],
    locale: daLocale,
    initialView: 'timeGridWeek',
    views: { timeGrid3: { type: 'timeGrid', duration: { days: 3 }, buttonText: '3 dage' } },
    headerToolbar: { left: 'prev,next', center: 'title', right: 'today timeGrid3,timeGridWeek' },
    titleFormat: { day: 'numeric', month: 'short' },
    firstDay: 1,
    slotMinTime: hourTime(settings().visibleHours.start),
    slotMaxTime: hourTime(settings().visibleHours.end),
    slotDuration: '00:30:00',
    snapDuration: '00:15:00',
    allDaySlot: false,
    height: '100%',
    nowIndicator: true,
    longPressDelay: 300,
    eventLongPressDelay: 300,
    editable: true,
    droppable: true,
    eventAllow: (span, moving) => allowed(span.start, span.end, moving?.id || undefined),
    // Eksterne træk fra skuffen (Draggable med create:false) valideres af FullCalendar via
    // selectAllow, ikke eventAllow – se @fullcalendar/core/index.js buildViewUiProps: uden
    // dragMeta.create bruges selectionConfig (selectAllow) i stedet for eventUiBases (eventAllow).
    selectAllow: (span) => allowed(span.start, span.end),
    events: (info, success) => {
      if (!ctx.store.data.settings.tasksCalendarId) {
        success([]);
        return;
      }
      ctx
        .guard(async () => {
          const r = await ctx.actions.loadRange(info.start, info.end);
          external = r.external;
          busy = r.busy;
          taskEvents = r.taskEvents;
          taskColor = r.taskColor;
          return true;
        })
        .then(() => {
          if (destroyed) return;
          success(toEvents());
        });
    },
    drop: (info) => {
      const t = findTask(info.draggedEl.dataset.taskId ?? '');
      if (!t) return;
      const end = new Date(info.date.getTime() + t.durationMin * 60000);
      if (!allowed(info.date, end)) {
        toast('Der er ikke plads her');
        return;
      }
      ctx.guard(() => ctx.actions.schedule(t.id, info.date, end)).then(() => {
        if (!destroyed) calendar.refetchEvents();
      });
    },
    eventDragStart: (info) => { dragging = true; beginAutoScroll(pointerY(info.jsEvent)); },
    eventDragStop: () => { dragging = false; lastDragEnd = Date.now(); endAutoScroll(); },
    eventResizeStart: (info) => { dragging = true; beginAutoScroll(pointerY(info.jsEvent)); },
    eventResizeStop: () => { dragging = false; lastDragEnd = Date.now(); endAutoScroll(); },
    eventDrop: (info) => onChanged(info.event, info.revert),
    eventResize: (info) => onChanged(info.event, info.revert),
    eventClick: (info) => openBlock(info.event),
  });

  function onChanged(ev: EventApi, revert: () => void) {
    const taskId = ev.extendedProps.taskId as string;
    ctx.guard(async () => {
      await ctx.actions.move(taskId, ev.id, ev.start!, ev.end!);
      return true;
    }).then((ok) => {
      if (destroyed) return;
      if (!ok) revert();
      calendar.refetchEvents();
    });
  }

  async function openBlock(ev: EventApi) {
    if (ev.extendedProps.external) return;
    const t = findTask(ev.extendedProps.taskId as string);
    if (!t) return;
    if (!ev.extendedProps.active) {
      toast('Denne blok er afsluttet');
      return;
    }
    const choice = await ask(t.title, null, [
      { label: t.kind === 'project' ? 'Færdig med denne blok' : 'Færdig', value: 'done' as const, kind: 'primary' },
      { label: 'Fjern fra kalender', value: 'remove' as const, kind: 'danger' },
      { label: 'Rediger opgave', value: 'edit' as const },
    ]);
    if (choice === 'done') {
      await ctx.guard(() => (t.kind === 'project' ? ctx.actions.markSessionDone(t.id, ev.id) : ctx.actions.markDone(t.id)));
    }
    if (choice === 'remove') await ctx.guard(() => ctx.actions.unschedule(t.id, ev.id));
    if (choice === 'edit') await openTaskForm(ctx, t);
    if (!destroyed) calendar.refetchEvents();
  }

  const renderDrawer = () => {
    const g = groupTasks(ctx.store.data.tasks, settings().surfaceDaysBefore, ctx.today());
    const items = [...g.dueSoon, ...g.ready, ...g.projects].map((t) => taskItem(ctx, t));
    drawerList.replaceChildren(...(items.length ? items : [h('p', { class: 'empty' }, 'Ingen opgaver venter.')]));
  };

  const draggable = new Draggable(drawerList, {
    itemSelector: '.task-item',
    longPressDelay: 250,
    eventData: (el) => ({
      title: (el as HTMLElement).dataset.title,
      duration: { minutes: Number((el as HTMLElement).dataset.duration) },
      create: false,
    }),
  });

  const slide = (dir: SwipeDirection) => {
    if (dir === 'left') calendar.next();
    else calendar.prev();
    const harness = calEl.querySelector<HTMLElement>('.fc-view-harness');
    if (!harness) return;
    harness.classList.remove('slide-from-left', 'slide-from-right');
    void harness.offsetWidth; // genstart animationen
    harness.classList.add(dir === 'left' ? 'slide-from-right' : 'slide-from-left');
  };
  // Et træk kan slutte lige før touchend når frem, så bloker også lige efter et træk.
  const detachSwipe = attachSwipe(calEl, slide, () => dragging || Date.now() - lastDragEnd < 700);

  // Mens en opgave trækkes fra skuffen, skjules skuffe, værktøjslinje og navigation,
  // så kalenderen får hele skærmen. FullCalendar måler kalenderens felter ved pointerdown,
  // så efter layoutskiftet udløses pointerdown igen, så felterne måles på ny.
  const dragEmitter = draggable.dragging.emitter;
  // FullCalendars egen auto-scroll måler før layoutskiftet og scroller for langsomt; vi bruger vores egen.
  draggable.dragging.autoScroller.isEnabled = false;
  const startPlacing = (ev: PointerDragEvent) => {
    document.body.classList.add('placing');
    calendar.updateSize();
    dragEmitter.trigger('pointerdown', ev);
    beginAutoScroll(ev.pageY - window.scrollY);
  };
  const stopPlacing = () => {
    endAutoScroll();
    document.body.classList.remove('placing');
    if (!destroyed) calendar.updateSize();
  };
  dragEmitter.on('dragstart', startPlacing);
  dragEmitter.on('dragend', stopPlacing);

  const onSynced = () => {
    if (!destroyed) calendar.refetchEvents();
  };
  window.addEventListener('opgave:synced', onSynced);

  let shownHours = { ...settings().visibleHours };
  renderDrawer();
  calendar.render();
  const unsubscribe = ctx.store.subscribe(() => {
    renderDrawer();
    const { start, end } = settings().visibleHours;
    if (start !== shownHours.start || end !== shownHours.end) {
      shownHours = { start, end };
      calendar.setOption('slotMinTime', hourTime(start));
      calendar.setOption('slotMaxTime', hourTime(end));
    }
  });

  return () => {
    destroyed = true;
    detachSwipe();
    stopPlacing();
    window.removeEventListener('opgave:synced', onSynced);
    unsubscribe();
    draggable.destroy();
    calendar.destroy();
  };
}
