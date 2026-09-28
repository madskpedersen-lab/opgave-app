import { createActions } from '../actions';
import { APP_URL, CLIENT_ID } from '../config';
import { toDateStr } from '../domain/dates';
import { hasValidToken, initAuth, signIn, signOut, wasSignedIn } from '../google/auth';
import { createCalendarApi } from '../google/calendar';
import { createDrive } from '../google/drive';
import { AuthError, OfflineError } from '../google/http';
import { Store } from '../store';
import type { Ctx } from './context';
import { h } from './dom';
import { mountPlan } from './plan';
import { runQuestions } from './prompts';
import { mountSettings } from './settings';
import { toast } from './sheet';
import { mountTasks } from './tasks';

type Tab = 'plan' | 'tasks' | 'settings';

export async function startApp(root: HTMLElement): Promise<void> {
  if (!CLIENT_ID) {
    root.replaceChildren(h('p', { class: 'empty' }, 'VITE_GOOGLE_CLIENT_ID mangler. Se docs/opsaetning.md.'));
    return;
  }
  await initAuth();

  const store = new Store(createDrive(), localStorage);
  const actions = createActions({
    store,
    calendar: createCalendarApi(),
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    appUrl: APP_URL,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isOnline: () => navigator.onLine,
  });

  const banner = h('div', { class: 'banner', hidden: true });
  const main = h('main', {});
  const nav = h('nav', {});
  let currentTab: Tab = 'plan';
  let unmount: () => void = () => {};

  const showBanner = (text: string, button?: { label: string; onClick: () => void }) => {
    const children = [h('span', {}, text), button ? h('button', { class: 'btn small', onclick: button.onClick }, button.label) : null].filter(
      (c): c is HTMLElement => c !== null,
    );
    banner.replaceChildren(...children);
    banner.hidden = false;
  };
  const hideBanner = () => { banner.hidden = true; };

  const guard: Ctx['guard'] = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof AuthError) showBanner('Du skal logge ind igen.', { label: 'Log ind', onClick: login });
      else if (e instanceof OfflineError) showBanner('Ingen forbindelse – du kan se dine opgaver, men ikke ændre dem.');
      else {
        console.error(e);
        toast(`Noget gik galt: ${(e as Error).message}`);
      }
      return undefined;
    }
  };

  const ctx: Ctx = {
    store,
    actions,
    guard,
    today: () => toDateStr(new Date()),
    signOut: () => {
      signOut();
      store.clearLocal();
      location.reload();
    },
  };

  const show = (tab: Tab) => {
    currentTab = tab;
    unmount();
    main.replaceChildren();
    main.className = `screen-${tab}`;
    unmount = tab === 'plan' ? mountPlan(ctx, main) : tab === 'tasks' ? mountTasks(ctx, main) : mountSettings(ctx, main);
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  };

  const tabButton = (tab: Tab, label: string) => h('button', { 'data-tab': tab, onclick: () => show(tab) }, label);
  nav.append(tabButton('plan', '📅 Planlæg'), tabButton('tasks', '✅ Opgaver'), tabButton('settings', '⚙️ Indstillinger'));

  let syncing = false;
  async function syncAll() {
    if (syncing || !hasValidToken()) return;
    syncing = true;
    const ok = await guard(async () => {
      await store.sync();
      await actions.ensureSetup();
      return actions.reconcile();
    });
    syncing = false;
    if (ok) {
      hideBanner();
      show(currentTab); // genindlæs kalenderen efter sync
      await runQuestions(ctx, ok);
    }
  }

  async function login() {
    try {
      await signIn();
      await syncAll();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const bootShell = () => {
    root.replaceChildren(banner, main, nav);
    show('plan');
    if (!hasValidToken()) showBanner('Du skal logge ind igen.', { label: 'Log ind', onClick: login });
    else void syncAll();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncAll();
  });
  window.addEventListener('offline', () => showBanner('Ingen forbindelse – du kan se dine opgaver, men ikke ændre dem.'));
  window.addEventListener('online', () => void syncAll());

  if (wasSignedIn()) {
    bootShell();
    return;
  }
  root.replaceChildren(
    h(
      'div',
      { class: 'login' },
      h('h1', {}, 'Opgaver'),
      h('p', {}, 'Hold styr på dine opgaver og træk dem ind i din Google-kalender.'),
      h('button', {
        class: 'btn primary',
        onclick: async () => {
          try {
            await signIn();
            bootShell();
          } catch (e) {
            toast((e as Error).message);
          }
        },
      }, 'Log ind med Google'),
    ),
  );
}
