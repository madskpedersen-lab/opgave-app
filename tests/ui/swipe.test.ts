import { expect, test } from 'vitest';
import { detectSwipe } from '../../src/ui/swipe';

test('hurtigt vandret swipe mod venstre og højre', () => {
  expect(detectSwipe(-120, 10, 250)).toBe('left');
  expect(detectSwipe(120, -15, 250)).toBe('right');
});

test('for kort bevægelse er ikke et swipe', () => {
  expect(detectSwipe(-40, 0, 150)).toBeNull();
});

test('lodret scroll er ikke et swipe', () => {
  expect(detectSwipe(-80, 120, 250)).toBeNull();
  expect(detectSwipe(-100, 60, 250)).toBeNull();
});

test('langsom bevægelse (fx træk efter langt tryk) er ikke et swipe', () => {
  expect(detectSwipe(-150, 0, 900)).toBeNull();
});
