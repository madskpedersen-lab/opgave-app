export type SwipeDirection = 'left' | 'right';

const MIN_DISTANCE = 60; // px
const MAX_DURATION = 600; // ms – længere er et træk, ikke et swipe

/** Afgør om en berøring var et vandret swipe. dx/dy i px, ms = varighed. */
export function detectSwipe(dx: number, dy: number, ms: number): SwipeDirection | null {
  if (ms > MAX_DURATION || Math.abs(dx) < MIN_DISTANCE || Math.abs(dy) > Math.abs(dx) / 2) return null;
  return dx < 0 ? 'left' : 'right';
}

/** Kalder onSwipe ved vandrette swipes på el, undtagen når isBlocked() er sand (fx under træk). */
export function attachSwipe(el: HTMLElement, onSwipe: (dir: SwipeDirection) => void, isBlocked: () => boolean): () => void {
  let start: { x: number; y: number; t: number } | null = null;
  const onStart = (e: TouchEvent) => {
    start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
  };
  const onEnd = (e: TouchEvent) => {
    if (!start || isBlocked()) {
      start = null;
      return;
    }
    const touch = e.changedTouches[0];
    const dir = detectSwipe(touch.clientX - start.x, touch.clientY - start.y, Date.now() - start.t);
    start = null;
    if (dir) onSwipe(dir);
  };
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchend', onEnd, { passive: true });
  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchend', onEnd);
  };
}
