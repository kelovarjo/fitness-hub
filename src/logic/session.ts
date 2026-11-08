import type { MuscleId, Session, SessionBlock, SessionSlot, SetRecord } from '../types';
import { EXERCISE_BY_ID } from '../data/exercises';

export interface Cursor {
  blockId: string;
  slotId: string;
  setIndex: number;
}

export function countBySlot(sets: Pick<SetRecord, 'slotId'>[]): Map<string, number> {
  const m = new Map<string, number>();
  sets.forEach((s) => m.set(s.slotId, (m.get(s.slotId) ?? 0) + 1));
  return m;
}

export const activeSlots = (b: SessionBlock): SessionSlot[] => b.slots.filter((s) => !s.skipped);

/**
 * The set to do next. Blocks run in order; inside a superset or giant set the slots
 * alternate round by round (the slot with the fewest sets done goes next).
 */
export function nextSet(session: Pick<Session, 'blocks'>, sets: Pick<SetRecord, 'slotId'>[]): Cursor | null {
  const done = countBySlot(sets);
  for (const b of session.blocks) {
    const open = activeSlots(b).filter((s) => (done.get(s.id) ?? 0) < s.sets);
    if (!open.length) continue;
    const pick = open.reduce((best, s) => ((done.get(s.id) ?? 0) < (done.get(best.id) ?? 0) ? s : best), open[0]);
    return { blockId: b.id, slotId: pick.id, setIndex: done.get(pick.id) ?? 0 };
  }
  return null;
}

/**
 * Rest after logging a set. No rest while moving to the next exercise of the same
 * superset round; the block's rest after the round or when the block ends.
 */
export function restAfter(session: Pick<Session, 'blocks'>, loggedSlotId: string, setsAfter: Pick<SetRecord, 'slotId'>[]): number {
  const block = session.blocks.find((b) => b.slots.some((s) => s.id === loggedSlotId));
  if (!block) return 0;
  const next = nextSet(session, setsAfter);
  if (!next) return 0;
  const done = countBySlot(setsAfter);
  const loggedRound = (done.get(loggedSlotId) ?? 1) - 1;
  if (next.blockId === block.id && next.slotId !== loggedSlotId && next.setIndex === loggedRound) return 0;
  return block.restSec;
}

export function isComplete(session: Pick<Session, 'blocks'>, sets: Pick<SetRecord, 'slotId'>[]): boolean {
  return nextSet(session, sets) === null;
}

export interface SessionSummary {
  durationMin: number;
  setCount: number;
  volumeKg: number;
  totalReps: number;
  setsByMuscle: Partial<Record<MuscleId, number>>;
}

export function activeDurationMs(s: Pick<Session, 'startedAt' | 'endedAt' | 'pausedMs' | 'pauseStartedAt'>, now = Date.now()): number {
  const end = s.endedAt ?? now;
  const pausedNow = s.pauseStartedAt ? end - s.pauseStartedAt : 0;
  return Math.max(0, end - s.startedAt - s.pausedMs - pausedNow);
}

export function summarize(session: Session, sets: SetRecord[], now = Date.now()): SessionSummary {
  const setsByMuscle: Partial<Record<MuscleId, number>> = {};
  let volumeKg = 0;
  let totalReps = 0;
  for (const s of sets) {
    const ex = EXERCISE_BY_ID[s.exerciseId];
    totalReps += s.reps;
    if (ex && ex.loadType !== 'assisted' && ex.loadType !== 'timed') volumeKg += s.weightKg * s.reps;
    ex?.primary.forEach((m) => (setsByMuscle[m] = (setsByMuscle[m] ?? 0) + 1));
  }
  return {
    durationMin: Math.round(activeDurationMs(session, now) / 60000),
    setCount: sets.length,
    volumeKg: Math.round(volumeKg),
    totalReps,
    setsByMuscle,
  };
}
