import type { LoadType } from '../types';

/** Round to 2 decimals to avoid floating point noise like 32.499999. */
export const clean = (n: number): number => Math.round(n * 100) / 100;

export function roundToStep(weight: number, step: number, mode: 'nearest' | 'down' | 'up' = 'nearest'): number {
  if (!step || step <= 0) return clean(weight);
  const f = mode === 'down' ? Math.floor : mode === 'up' ? Math.ceil : Math.round;
  return clean(f(clean(weight / step)) * step);
}

/**
 * Estimated one-rep max, Epley adjusted for reps in reserve:
 * weight × (1 + (reps + RIR) / 30). Only valid when reps + RIR <= 12,
 * otherwise the estimate is too unreliable and null is returned.
 */
export function e1rm(weightKg: number, reps: number, rir: number, loadType?: LoadType): number | null {
  if (loadType === 'bodyweight' || loadType === 'assisted' || loadType === 'timed') return null;
  if (weightKg <= 0 || reps <= 0) return null;
  const effective = reps + Math.max(0, rir);
  if (effective > 12) return null;
  return clean(weightKg * (1 + effective / 30));
}

export interface SetLike {
  weightKg: number;
  reps: number;
  rir: number;
}

export type PrType = 'weight' | 'reps' | 'e1rm';

/**
 * Personal records for a new set compared with all earlier sets of the same exercise.
 * The first time an exercise is logged sets a baseline, not a record.
 * For assisted exercises less counterweight is harder, so comparisons invert.
 */
export function detectPrs(prev: SetLike[], set: SetLike, loadType: LoadType): PrType[] {
  if (prev.length === 0) return [];
  const prs: PrType[] = [];
  const harder = (a: number, b: number) => (loadType === 'assisted' ? a < b : a > b);
  const atLeastAsHard = (a: number, b: number) => (loadType === 'assisted' ? a <= b : a >= b);

  if (loadType !== 'timed') {
    const best = prev.reduce((m, s) => (harder(s.weightKg, m) ? s.weightKg : m), prev[0].weightKg);
    const weightCounts = loadType !== 'bodyweight' || set.weightKg > 0;
    if (weightCounts && harder(set.weightKg, best)) prs.push('weight');
  }

  const comparable = prev.filter((s) => atLeastAsHard(s.weightKg, set.weightKg));
  const bestReps = comparable.length ? Math.max(...comparable.map((s) => s.reps)) : 0;
  if (set.reps > bestReps && !prs.includes('weight')) prs.push('reps');

  const est = e1rm(set.weightKg, set.reps, set.rir, loadType);
  if (est !== null) {
    const prevBest = Math.max(0, ...prev.map((s) => e1rm(s.weightKg, s.reps, s.rir, loadType) ?? 0));
    if (prevBest > 0 && est > prevBest) prs.push('e1rm');
  }
  return prs;
}

/** Relative load factors used only for a rough first-time estimate when swapping. */
const LOAD_FACTOR: Partial<Record<LoadType, number>> = {
  barbell: 1,
  smith: 0.9,
  machine: 1,
  dumbbell: 0.4,
  cable: 0.5,
};

/**
 * Rough starting weight for an exercise never done before, from a related exercise's
 * last working set. Epley ratio adjusts for different rep targets. Returns null when
 * load types cannot be compared. Always shown to the user as a calibration estimate.
 */
export function estimateStartWeight(
  src: { weightKg: number; reps: number; loadType: LoadType },
  tgt: { loadType: LoadType; reps: number; step: number },
): number | null {
  const fs = LOAD_FACTOR[src.loadType];
  const ft = LOAD_FACTOR[tgt.loadType];
  if (!fs || !ft || src.weightKg <= 0) return null;
  const ratio = src.loadType === tgt.loadType ? 1 : ft / fs;
  const epley = (1 + src.reps / 30) / (1 + tgt.reps / 30);
  const est = src.weightKg * ratio * epley;
  const rounded = roundToStep(est, tgt.step || 2.5, 'down');
  return rounded > 0 ? rounded : null;
}
