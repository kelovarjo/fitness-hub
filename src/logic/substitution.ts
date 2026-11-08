import type { Equipment, EquipmentId, Exercise, MuscleId, Pattern, Profile } from '../types';

/** Scoring weights, out of 100. Starting assumptions from the plan; adjustable. */
export const WEIGHTS = { pattern: 35, muscles: 30, profile: 15, history: 10, stability: 10 } as const;
export const STATION_BONUS = 5;
export const MIN_SCORE = 30;
export const LIGHT_LOAD_PENALTY = 8;

const RELATED: Partial<Record<Pattern, Pattern[]>> = {
  horizontal_press: ['incline_press'],
  incline_press: ['horizontal_press'],
  lateral_raise: ['upright_row'],
  upright_row: ['lateral_raise'],
  vertical_pull: ['horizontal_pull'],
  horizontal_pull: ['vertical_pull', 'rear_delt'],
  rear_delt: ['horizontal_pull'],
  squat: ['knee_extension'],
  knee_extension: ['squat'],
  hinge: ['knee_flexion'],
  knee_flexion: ['hinge'],
  spinal_flexion: ['anti_extension'],
  anti_extension: ['spinal_flexion', 'anti_rotation'],
  anti_rotation: ['anti_extension'],
};

export function patternScore(a: Pattern, b: Pattern): number {
  if (a === b) return 1;
  return RELATED[a]?.includes(b) ? 0.5 : 0;
}

/** Weighted overlap (primary 1.0, secondary 0.5) of two exercises' muscles, 0 to 1. */
export function muscleScore(a: Exercise, b: Exercise): number {
  const vec = (e: Exercise) => {
    const m = new Map<MuscleId, number>();
    e.secondary.forEach((x) => m.set(x, 0.5));
    e.primary.forEach((x) => m.set(x, 1));
    return m;
  };
  const va = vec(a);
  const vb = vec(b);
  let inter = 0;
  let union = 0;
  new Set([...va.keys(), ...vb.keys()]).forEach((k) => {
    const x = va.get(k) ?? 0;
    const y = vb.get(k) ?? 0;
    inter += Math.min(x, y);
    union += Math.max(x, y);
  });
  return union === 0 ? 0 : inter / union;
}

export function profileScore(a: Profile, b: Profile): number {
  if (a === b) return 1;
  if (a === 'M' || b === 'M') return 0.5;
  return 0;
}

export const stabilityScore = (a: number, b: number): number => 1 - Math.abs(a - b) / 2;

export function isEquipmentFree(e: Equipment | undefined, now: number): boolean {
  return !!e && e.available && !(e.occupiedUntil && e.occupiedUntil > now);
}

/** True when every equipment requirement has at least one free option. */
export function canDo(ex: Exercise, equipment: Map<EquipmentId, Equipment>, now: number): boolean {
  return ex.equipment.every((req) =>
    Array.isArray(req) ? req.some((id) => isEquipmentFree(equipment.get(id), now)) : isEquipmentFree(equipment.get(req), now),
  );
}

/** Main station of an exercise: the first required equipment item that is not a bench or rack. */
export function station(ex: Exercise): EquipmentId | null {
  for (const req of ex.equipment) {
    const id = Array.isArray(req) ? req[0] : req;
    if (id !== 'bench' && id !== 'rack') return id;
  }
  return null;
}

export interface RankInput {
  original: Exercise;
  candidates: Exercise[];
  equipment: Map<EquipmentId, Equipment>;
  now: number;
  /** Exercises performed in the last 90 days. */
  recentlyDone: Set<string>;
  excluded: Set<string>;
  /** Exercises already in today's session, other than the original. */
  inSession: Set<string>;
  /** Stations used by the other exercises in the same superset. */
  blockStations: EquipmentId[];
}

export interface Ranked {
  exercise: Exercise;
  score: number;
  sameStation: boolean;
  parts: { pattern: number; muscles: number; profile: number; history: number; stability: number };
}

export function rankSubstitutes(input: RankInput): Ranked[] {
  const { original, candidates, equipment, now, recentlyDone, excluded, inSession, blockStations } = input;
  const out: Ranked[] = [];
  for (const ex of candidates) {
    if (ex.id === original.id || excluded.has(ex.id) || inSession.has(ex.id)) continue;
    if (!canDo(ex, equipment, now)) continue;
    const parts = {
      pattern: WEIGHTS.pattern * patternScore(original.pattern, ex.pattern),
      muscles: WEIGHTS.muscles * muscleScore(original, ex),
      profile: WEIGHTS.profile * profileScore(original.profile, ex.profile),
      history: recentlyDone.has(ex.id) ? WEIGHTS.history : 0,
      stability: WEIGHTS.stability * stabilityScore(original.stability, ex.stability),
    };
    // An exercise with neither the same pattern nor real muscle overlap is not a substitute.
    if (parts.pattern === 0 && parts.muscles < WEIGHTS.muscles * 0.5) continue;
    const st = station(ex);
    const sameStation = !!st && blockStations.includes(st);
    // Dumbbells cap the load on heavy leg patterns, so they rank below barbell or machine options.
    const heavyLeg = (original.pattern === 'squat' || original.pattern === 'hinge') && ['barbell', 'smith', 'machine'].includes(original.loadType);
    const penalty = heavyLeg && ex.loadType === 'dumbbell' ? LIGHT_LOAD_PENALTY : 0;
    const base = Object.values(parts).reduce((a, b) => a + b, 0) - penalty;
    const score = Math.round(base + (sameStation ? STATION_BONUS : 0));
    if (base < MIN_SCORE) continue;
    out.push({ exercise: ex, score, sameStation, parts });
  }
  return out.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
}
