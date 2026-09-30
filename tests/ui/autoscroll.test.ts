import { expect, test } from 'vitest';
import { edgeSpeed } from '../../src/ui/autoscroll';

// Scroll-området går fra y=100 til y=700; kantzonen er 80 px, maks. 900 px/s.
const speed = (y: number) => edgeSpeed(y, 100, 700);

test('ingen scroll midt i skemaet', () => {
  expect(speed(400)).toBe(0);
  expect(speed(180)).toBe(0);
  expect(speed(620)).toBe(0);
});

test('scroller op nær toppen og ned nær bunden, hurtigere jo tættere på kanten', () => {
  expect(speed(140)).toBeLessThan(0);
  expect(speed(660)).toBeGreaterThan(0);
  expect(speed(110)).toBeLessThan(speed(170));
  expect(speed(690)).toBeGreaterThan(speed(630));
});

test('fuld fart ved og uden for kanten', () => {
  expect(speed(100)).toBe(-900);
  expect(speed(40)).toBe(-900);
  expect(speed(700)).toBe(900);
  expect(speed(790)).toBe(900);
});
