export type Span = { start: Date; end: Date };

export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/** En opgave må ligge hvor som helst, bare den ikke overlapper optaget tid. */
export function isValidPlacement(block: Span, busy: Span[]): boolean {
  return !busy.some((b) => overlaps(b, block));
}
