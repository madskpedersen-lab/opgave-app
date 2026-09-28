import { h } from './dom';

export type SheetOption<T> = { label: string; value: T; kind?: 'primary' | 'danger' };

/** Viser et bundark. Resolver med den valgte værdi, eller null hvis brugeren trykker udenfor. */
export function ask<T>(title: string, body: Node | null, options: SheetOption<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    const close = (v: T | null) => {
      overlay.remove();
      resolve(v);
    };
    const overlay = h(
      'div',
      { class: 'overlay', onclick: (e: Event) => { if (e.target === overlay) close(null); } },
      h(
        'div',
        { class: 'sheet' },
        h('h3', {}, title),
        body,
        h('div', { class: 'sheet-buttons' }, ...options.map((o) => h('button', { class: `btn ${o.kind ?? ''}`, onclick: () => close(o.value) }, o.label))),
      ),
    );
    document.body.append(overlay);
  });
}

export function toast(message: string): void {
  const el = h('div', { class: 'toast' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}
