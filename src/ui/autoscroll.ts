const ZONE = 80; // px fra kanten hvor der scrolles
const MAX_SPEED = 900; // px/s helt ude ved kanten

/** Scroll-hastighed (px/s, negativ = op) for en finger i højden y i et område fra top til bottom. */
export function edgeSpeed(y: number, top: number, bottom: number): number {
  const fromTop = y - top;
  const fromBottom = bottom - y;
  if (fromTop < ZONE) return -MAX_SPEED * Math.min(1, (ZONE - fromTop) / ZONE);
  if (fromBottom < ZONE) return MAX_SPEED * Math.min(1, (ZONE - fromBottom) / ZONE);
  return 0;
}

/**
 * Scroller `scroller` mens der trækkes, når fingeren/musen nærmer sig toppen eller bunden.
 * Der scrolles kun i en retning, fingeren faktisk har bevæget sig i, så et træk der starter
 * nederst på skærmen ikke straks scroller ned. Returnerer en stop-funktion.
 */
export function startAutoScroll(scroller: HTMLElement, startY: number): () => void {
  let y = startY;
  let minY = startY;
  let maxY = startY;
  let last = performance.now();
  let carry = 0;
  let raf = 0;

  const onMove = (e: TouchEvent | MouseEvent) => {
    y = 'touches' in e ? (e.touches[0]?.clientY ?? y) : e.clientY;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  const tick = (now: number) => {
    const r = scroller.getBoundingClientRect();
    const v = edgeSpeed(y, r.top, r.bottom);
    const allowed = (v < 0 && startY - minY > 10) || (v > 0 && maxY - startY > 10);
    if (allowed) {
      carry += (v * (now - last)) / 1000;
      const whole = Math.trunc(carry);
      if (whole) {
        scroller.scrollTop += whole;
        carry -= whole;
      }
    }
    last = now;
    raf = requestAnimationFrame(tick);
  };

  document.addEventListener('touchmove', onMove, { capture: true, passive: true });
  document.addEventListener('mousemove', onMove, { capture: true, passive: true });
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('touchmove', onMove, { capture: true });
    document.removeEventListener('mousemove', onMove, { capture: true });
  };
}
