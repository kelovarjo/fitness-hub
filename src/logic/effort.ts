import type { SessionSlot } from '../types';

// Plain-language effort instead of "reps in reserve" (RIR). Stored as RIR so the
// progression rules are unchanged.
export type Feel = 'easy' | 'good' | 'max';

export const FEELS: { id: Feel; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: '3+ reps left' },
  { id: 'good', label: 'Good', hint: '1–2 left' },
  { id: 'max', label: 'Max', hint: 'nothing left' },
];

export function feelToRir(feel: Feel, slot: Pick<SessionSlot, 'rirMax'>): number {
  if (feel === 'max') return 0;
  if (feel === 'easy') return Math.min(4, Math.max(3, slot.rirMax + 1));
  return Math.max(1, slot.rirMax);
}
