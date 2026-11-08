import type { LoadType } from '../types';
import { clean, roundToStep, type SetLike } from './strength';

export const PROGRESSION_RULES_VERSION = 1;

export interface ProgressionInput {
  loadType: LoadType;
  repMin: number;
  repMax: number;
  rirMin: number;
  sets: number;
  finisher?: boolean;
  /** Smallest load step for the equipment, kg. */
  step: number;
  maxKg?: number;
  /** Working sets of earlier sessions, most recent session first. */
  history: SetLike[][];
}

export type SuggestionKind = 'increase' | 'hold' | 'reduce' | 'reps' | 'repeat' | 'none';

export interface Target {
  weightKg: number;
  reps: number;
}

export interface Suggestion {
  kind: SuggestionKind;
  targets: Target[] | null;
  reason: string;
}

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2).replace(/0$/, ''));

function topWeight(sets: SetLike[], loadType: LoadType): number {
  const ws = sets.map((s) => s.weightKg);
  return loadType === 'assisted' ? Math.min(...ws) : Math.max(...ws);
}

const fill = (n: number, weightKg: number, reps: (i: number) => number): Target[] =>
  Array.from({ length: n }, (_, i) => ({ weightKg, reps: reps(i) }));

/**
 * Deterministic double progression with reps in reserve.
 * - No history: no suggestion (the user sets the first weight).
 * - Finisher: repeat last weight, reps shown as a guide only.
 * - Every set at the top of the range at or above target RIR: one weight step up, reps back to the bottom.
 * - Within range: same weight, one more rep per set up to the top.
 * - Below range 1 or 2 sessions running: hold. 3 sessions running at the same weight: about 5% less.
 * Never adds weight on a schedule; only performance moves it.
 */
export function suggest(input: ProgressionInput): Suggestion {
  const { loadType, repMin, repMax, rirMin, sets, step: rawStep, maxKg, history } = input;
  const step = rawStep > 0 ? rawStep : 2.5;
  const last = history[0];
  if (!last || last.length === 0) {
    return { kind: 'none', targets: null, reason: 'First time: pick a weight you can do for the top of the range with good form' };
  }
  const w = topWeight(last, loadType);
  const lastReps = (i: number) => (last[i] ?? last[last.length - 1]).reps;

  if (input.finisher) {
    return { kind: 'repeat', targets: fill(sets, w, lastReps), reason: `Max minus 1. Last time: ${last.map((s) => s.reps).join(', ')}` };
  }

  if (loadType === 'timed') {
    const allTop = last.every((s) => s.reps >= repMax);
    return {
      kind: allTop ? 'increase' : 'reps',
      targets: fill(sets, 0, (i) => Math.min(repMax + 15, lastReps(i) + 5)),
      reason: 'Add 5 seconds per set',
    };
  }

  const allTop = last.every((s) => s.reps >= repMax && s.rir >= rirMin);
  const below = last.some((s) => s.reps < repMin);
  const repsList = last.map((s) => s.reps).join(', ');

  if (allTop) {
    // Move to the next weight on the equipment's grid, so an off-grid entry like 32 kg
    // with 2.5 kg dumbbells goes to 32.5, not 34.5.
    let next: number;
    if (loadType === 'assisted') next = Math.max(0, clean(roundToStep(w - 0.001, step, 'up') - step));
    else next = clean(roundToStep(w + 0.001, step, 'down') + step);
    if (loadType === 'assisted' && w === 0) {
      return { kind: 'hold', targets: fill(sets, 0, () => repMax), reason: 'No assistance left: switch to pull-ups' };
    }
    if (maxKg !== undefined && loadType === 'dumbbell' && next > maxKg) {
      return { kind: 'hold', targets: fill(sets, w, () => repMax), reason: `At the heaviest dumbbell (${fmt(w)} kg): slow the tempo or swap` };
    }
    const delta = loadType === 'assisted' ? `-${fmt(step)} kg assistance` : `+${fmt(step)} kg`;
    return { kind: 'increase', targets: fill(sets, next, () => repMin), reason: `Hit ${repsList} at the top of the range: ${delta}` };
  }

  if (below) {
    let streak = 0;
    for (const sess of history) {
      if (!sess.length) break;
      if (topWeight(sess, loadType) !== w) break;
      if (!sess.some((s) => s.reps < repMin)) break;
      streak += 1;
    }
    if (streak >= 3 && loadType !== 'bodyweight') {
      let next = loadType === 'assisted' ? roundToStep(w * 1.05 + 0.001, step, 'up') : roundToStep(w * 0.95, step, 'down');
      if (next === w) next = loadType === 'assisted' ? clean(w + step) : clean(w - step);
      if (next < 0) next = 0;
      return { kind: 'reduce', targets: fill(sets, next, () => repMin), reason: `Below ${repMin} reps three sessions running: about 5% less` };
    }
    const note = streak === 2 ? 'Below range twice: hold the weight' : `Got ${repsList}: same weight, aim for ${repMin}+`;
    return { kind: 'hold', targets: fill(sets, w, (i) => Math.max(repMin, Math.min(repMax, lastReps(i)))), reason: note };
  }

  return {
    kind: 'reps',
    targets: fill(sets, w, (i) => Math.min(repMax, lastReps(i) + 1)),
    reason: `Got ${repsList}: same weight, one more rep per set`,
  };
}
