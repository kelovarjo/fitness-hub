import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_BY_ID, getExercise } from '../data/exercises';
import { DEFAULT_EQUIPMENT } from '../data/equipment';
import { DEFAULT_PHASES, TEMPLATES } from '../data/templates';
import type { Equipment, EquipmentId, Phase, Session } from '../types';
import { detectPrs, e1rm, estimateStartWeight, roundToStep } from './strength';
import { suggest } from './progression';
import { canDo, muscleScore, rankSubstitutes } from './substitution';
import { parseSetEntry, wordsToDigits } from './parser';
import { applyPhase, nextTemplate, phaseForDate, toSessionBlocks } from './plan';
import { feelToRir } from './effort';
import { activeDurationMs, nextSet, restAfter, summarize } from './session';

const equipMap = (overrides: Partial<Record<EquipmentId, Partial<Equipment>>> = {}) =>
  new Map<EquipmentId, Equipment>(
    DEFAULT_EQUIPMENT.map((e) => [e.id, { ...e, updatedAt: 0, ...(overrides[e.id] ?? {}) }]),
  );
const phases: Phase[] = DEFAULT_PHASES.map((p) => ({ ...p, updatedAt: 0 }));
let n = 0;
const id = () => `id${++n}`;

describe('data integrity', () => {
  it('has unique exercise ids and valid equipment references', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    const ids = new Set(DEFAULT_EQUIPMENT.map((e) => e.id));
    for (const ex of EXERCISES) {
      for (const req of ex.equipment) (Array.isArray(req) ? req : [req]).forEach((r) => expect(ids.has(r), `${ex.id}:${r}`).toBe(true));
      if (ex.load) expect(ids.has(ex.load), ex.id).toBe(true);
      expect(ex.repMin).toBeLessThanOrEqual(ex.repMax);
      expect(ex.cues.length).toBeGreaterThan(0);
    }
  });

  it('every template exercise exists and is doable with the default gym profile', () => {
    const eq = equipMap();
    for (const t of TEMPLATES)
      for (const b of t.blocks)
        for (const s of b.slots) {
          const ex = getExercise(s.exerciseId);
          expect(canDo(ex, eq, 0), `${t.id}:${ex.id}`).toBe(true);
          expect(s.repMin).toBeLessThanOrEqual(s.repMax);
        }
  });

  it('every template exercise has at least three ranked substitutes', () => {
    const eq = equipMap();
    for (const t of TEMPLATES)
      for (const b of t.blocks)
        for (const s of b.slots) {
          const ranked = rankSubstitutes({
            original: getExercise(s.exerciseId), candidates: EXERCISES, equipment: eq, now: 0,
            recentlyDone: new Set(), excluded: new Set(), inSession: new Set(), blockStations: [],
          });
          expect(ranked.length, s.exerciseId).toBeGreaterThanOrEqual(3);
        }
  });

  it('templates hold the approved set counts', () => {
    const total = (tid: string) => TEMPLATES.find((t) => t.id === tid)!.blocks.flatMap((b) => b.slots).reduce((a, s) => a + s.sets, 0);
    expect(total('upper_a')).toBe(20);
    expect(total('upper_b')).toBe(31);
    expect(total('upper_c')).toBe(29);
    expect(total('lower')).toBe(21);
  });
});

describe('strength maths', () => {
  it('rounds to equipment steps without float noise', () => {
    expect(roundToStep(32.4, 2.5)).toBe(32.5);
    expect(roundToStep(31.2, 2.5, 'down')).toBe(30);
    expect(roundToStep(0.1 + 0.2, 0)).toBe(0.3);
  });

  it('computes RIR-adjusted Epley e1RM only within 12 effective reps', () => {
    expect(e1rm(100, 5, 1)).toBe(120);
    expect(e1rm(100, 10, 2)).toBe(140);
    expect(e1rm(100, 11, 2)).toBeNull();
    expect(e1rm(20, 20, 1)).toBeNull();
    expect(e1rm(10, 8, 0, 'bodyweight')).toBeNull();
  });

  it('detects weight, rep and e1RM records, with no record on the first log', () => {
    expect(detectPrs([], { weightKg: 50, reps: 8, rir: 1 }, 'barbell')).toEqual([]);
    const prev = [{ weightKg: 50, reps: 8, rir: 1 }, { weightKg: 52.5, reps: 6, rir: 1 }];
    expect(detectPrs(prev, { weightKg: 55, reps: 5, rir: 1 }, 'barbell')).toEqual(expect.arrayContaining(['weight']));
    expect(detectPrs(prev, { weightKg: 50, reps: 9, rir: 1 }, 'barbell')).toEqual(['reps', 'e1rm']);
    expect(detectPrs(prev, { weightKg: 50, reps: 8, rir: 1 }, 'barbell')).toEqual([]);
  });

  it('inverts comparisons for assisted pull-ups', () => {
    const prev = [{ weightKg: 30, reps: 8, rir: 1 }];
    expect(detectPrs(prev, { weightKg: 25, reps: 8, rir: 1 }, 'assisted')).toEqual(['weight']);
    expect(detectPrs(prev, { weightKg: 35, reps: 8, rir: 1 }, 'assisted')).toEqual([]);
  });

  it('estimates a calibration weight between load types', () => {
    expect(estimateStartWeight({ weightKg: 30, reps: 10, loadType: 'dumbbell' }, { loadType: 'dumbbell', reps: 10, step: 2.5 })).toBe(30);
    expect(estimateStartWeight({ weightKg: 30, reps: 10, loadType: 'dumbbell' }, { loadType: 'barbell', reps: 10, step: 2.5 })).toBe(75);
    expect(estimateStartWeight({ weightKg: 30, reps: 10, loadType: 'dumbbell' }, { loadType: 'bodyweight', reps: 10, step: 2.5 })).toBeNull();
  });
});

describe('progression rules', () => {
  const base = { loadType: 'dumbbell' as const, repMin: 15, repMax: 20, rirMin: 1, sets: 3, step: 2.5 };
  const sess = (w: number, reps: number[], rir = 1) => reps.map((r) => ({ weightKg: w, reps: r, rir }));

  it('gives no suggestion without history', () => {
    expect(suggest({ ...base, history: [] }).kind).toBe('none');
  });

  it('adds one step when every set reaches the top of the range at target RIR', () => {
    const s = suggest({ ...base, history: [sess(30, [20, 20, 20])] });
    expect(s.kind).toBe('increase');
    expect(s.targets).toEqual([{ weightKg: 32.5, reps: 15 }, { weightKg: 32.5, reps: 15 }, { weightKg: 32.5, reps: 15 }]);
  });

  it('moves an off-grid weight to the next real step', () => {
    expect(suggest({ ...base, history: [sess(32, [20, 20, 20])] }).targets![0].weightKg).toBe(32.5);
    expect(suggest({ ...base, loadType: 'assisted', step: 5, history: [sess(27, [20, 20, 20])] }).targets![0].weightKg).toBe(25);
  });

  it('does not add weight when the top was reached below target RIR', () => {
    expect(suggest({ ...base, history: [sess(30, [20, 20, 20], 0)] }).kind).toBe('reps');
  });

  it('adds a rep per set within the range', () => {
    const s = suggest({ ...base, history: [sess(30, [18, 17, 20])] });
    expect(s.kind).toBe('reps');
    expect(s.targets!.map((t) => t.reps)).toEqual([19, 18, 20]);
    expect(s.targets!.every((t) => t.weightKg === 30)).toBe(true);
  });

  it('holds below range, then reduces about 5% after three sessions at the same weight', () => {
    expect(suggest({ ...base, history: [sess(30, [16, 14, 12])] }).kind).toBe('hold');
    const twice = suggest({ ...base, history: [sess(30, [14, 14, 12]), sess(30, [15, 13, 12])] });
    expect(twice.kind).toBe('hold');
    expect(twice.reason).toMatch(/twice/);
    const three = suggest({ ...base, history: [sess(30, [14, 13, 12]), sess(30, [15, 13, 12]), sess(30, [14, 14, 13])] });
    expect(three.kind).toBe('reduce');
    expect(three.targets![0].weightKg).toBe(27.5);
  });

  it('does not count a different weight toward the reduce streak', () => {
    const s = suggest({ ...base, history: [sess(30, [14, 13, 12]), sess(30, [15, 13, 12]), sess(27.5, [14, 14, 13])] });
    expect(s.kind).toBe('hold');
  });

  it('caps dumbbells at the heaviest pair', () => {
    const s = suggest({ ...base, maxKg: 40, history: [sess(40, [20, 20, 20])] });
    expect(s.kind).toBe('hold');
    expect(s.targets![0].weightKg).toBe(40);
  });

  it('reduces assistance for assisted pull-ups', () => {
    const s = suggest({ ...base, loadType: 'assisted', repMin: 6, repMax: 12, step: 5, history: [sess(30, [12, 12, 12])] });
    expect(s.targets![0].weightKg).toBe(25);
  });

  it('repeats weight for finishers with no rep target change', () => {
    const s = suggest({ ...base, finisher: true, loadType: 'bodyweight', history: [sess(0, [25, 18])], sets: 2 });
    expect(s.kind).toBe('repeat');
    expect(s.targets!.map((t) => t.reps)).toEqual([25, 18]);
  });
});

describe('substitution ranking', () => {
  const rank = (orig: string, eq = equipMap(), extra: Partial<Parameters<typeof rankSubstitutes>[0]> = {}) =>
    rankSubstitutes({
      original: getExercise(orig), candidates: EXERCISES, equipment: eq, now: 1000,
      recentlyDone: new Set(), excluded: new Set(), inSession: new Set(), blockStations: [], ...extra,
    });

  it('ranks incline presses above flies and flat presses for incline dumbbell press', () => {
    const ranked = rank('incline_db_press');
    const top4 = ranked.slice(0, 4).map((r) => r.exercise.pattern);
    expect(top4.every((p) => p === 'incline_press')).toBe(true);
    const flyIdx = ranked.findIndex((r) => r.exercise.pattern === 'chest_fly');
    const flatIdx = ranked.findIndex((r) => r.exercise.pattern === 'horizontal_press');
    expect(flatIdx).toBeGreaterThan(3);
    if (flyIdx >= 0) expect(flyIdx).toBeGreaterThan(flatIdx);
  });

  it('removes options whose equipment is marked occupied', () => {
    const eq = equipMap({ smith: { occupiedUntil: 5000 } });
    expect(rank('incline_db_press', eq).some((r) => r.exercise.id === 'smith_incline_press')).toBe(false);
    const expired = equipMap({ smith: { occupiedUntil: 500 } });
    expect(rank('incline_db_press', expired).some((r) => r.exercise.id === 'smith_incline_press')).toBe(true);
  });

  it('respects exclusions and exercises already in the session', () => {
    const ranked = rank('incline_db_press', equipMap(), { excluded: new Set(['incline_bb_press']), inSession: new Set(['smith_incline_press']) });
    expect(ranked.some((r) => ['incline_bb_press', 'smith_incline_press'].includes(r.exercise.id))).toBe(false);
  });

  it('uses history and same-station bonuses as tie-breakers', () => {
    const plain = rank('face_pull');
    const withHistory = rank('face_pull', equipMap(), { recentlyDone: new Set(['db_rear_raise']) });
    const a = plain.find((r) => r.exercise.id === 'db_rear_raise')!.score;
    const b = withHistory.find((r) => r.exercise.id === 'db_rear_raise')!.score;
    expect(b - a).toBe(10);
    const station = rank('face_pull', equipMap(), { blockStations: ['cable'] });
    expect(station.find((r) => r.exercise.id === 'cable_rear_fly')!.sameStation).toBe(true);
  });

  it('ranks barbell or machine squats above dumbbell squats for a heavy back squat', () => {
    const ranked = rank('back_squat').map((r) => r.exercise.id);
    expect(ranked.indexOf('leg_press')).toBeLessThan(ranked.indexOf('goblet_squat'));
    expect(ranked.indexOf('smith_squat')).toBeLessThan(ranked.indexOf('goblet_squat'));
  });

  it('scores identical muscle sets as full overlap', () => {
    expect(muscleScore(getExercise('incline_db_press'), getExercise('smith_incline_press'))).toBe(1);
  });
});

describe('dictation parser', () => {
  const cases: [string, { weightKg: number | null; reps: number; rir: number | null }][] = [
    ['32 kilograms for 10 reps', { weightKg: 32, reps: 10, rir: null }],
    ['32 kg x 10', { weightKg: 32, reps: 10, rir: null }],
    ['32 by 10', { weightKg: 32, reps: 10, rir: null }],
    ['32 10 RIR 2', { weightKg: 32, reps: 10, rir: 2 }],
    ['32.5 for 8 at RIR 1', { weightKg: 32.5, reps: 8, rir: 1 }],
    ['10 reps at 32', { weightKg: 32, reps: 10, rir: null }],
    ['bodyweight for 12', { weightKg: 0, reps: 12, rir: null }],
    ['thirty two kilograms for ten reps', { weightKg: 32, reps: 10, rir: null }],
    ['twenty two and a half kilos for twelve', { weightKg: 22.5, reps: 12, rir: null }],
    ['70 pounds for 8', { weightKg: 32, reps: 8, rir: null }],
    ['40 for 15, 2 in reserve', { weightKg: 40, reps: 15, rir: 2 }],
    ['20 reps', { weightKg: null, reps: 20, rir: null }],
  ];
  it.each(cases)('parses "%s"', (input, expected) => {
    expect(parseSetEntry(input)).toEqual(expected);
  });

  it('rejects text without reps', () => {
    expect(parseSetEntry('hello')).toBeNull();
    expect(parseSetEntry('32 kilograms')).toBeNull();
  });

  it('converts number words', () => {
    expect(wordsToDigits('twenty five')).toBe('25');
    expect(wordsToDigits('forty-two point five')).toBe('42.5');
  });
});

describe('phases and plan', () => {
  it('finds the phase for a date', () => {
    expect(phaseForDate(phases, '2026-11-15')!.id).toBe('race_prep');
    expect(phaseForDate(phases, '2026-12-05')!.id).toBe('taper');
    expect(phaseForDate(phases, '2026-12-06')!.id).toBe('recovery');
    expect(phaseForDate(phases, '2027-03-01')!.id).toBe('recomp');
  });

  it('applies race prep to the lower session only', () => {
    const lower = TEMPLATES.find((t) => t.id === 'lower')!;
    const blocks = applyPhase(lower, phases[0]);
    expect(blocks.map((b) => b.label)).toEqual(['Anchor', 'B', 'D', 'E']);
    expect(blocks[0].slots[0].sets).toBe(2);
    expect(blocks[1].slots[0].sets).toBe(2);
    const upperA = TEMPLATES[0];
    expect(applyPhase(upperA, phases[0])).toEqual(upperA.blocks);
  });

  it('taper cuts a set per exercise and drops finishers', () => {
    const blocks = applyPhase(TEMPLATES[0], phases[1]);
    expect(blocks.some((b) => b.label === 'Finisher')).toBe(false);
    expect(blocks[0].slots[0].sets).toBe(2);
  });

  it('recovery lifts lower-body RIR to at least 3', () => {
    const blocks = applyPhase(TEMPLATES[3], phases[2]);
    expect(blocks.flatMap((b) => b.slots).every((s) => s.rirMin >= 3 && s.rirMax >= s.rirMin)).toBe(true);
  });

  it('rotates to the template done longest ago and skips Lower in taper', () => {
    const done = [
      { templateId: 'upper_a', startedAt: 4 },
      { templateId: 'upper_b', startedAt: 3 },
      { templateId: 'lower', startedAt: 2 },
    ];
    expect(nextTemplate(TEMPLATES, done, null)!.id).toBe('upper_c');
    expect(nextTemplate(TEMPLATES, [...done, { templateId: 'upper_c', startedAt: 5 }], null)!.id).toBe('lower');
    expect(nextTemplate(TEMPLATES, [...done, { templateId: 'upper_c', startedAt: 5 }], phases[1])!.id).toBe('upper_b');
  });
});

describe('session flow', () => {
  const session = { blocks: toSessionBlocks(TEMPLATES[0].blocks, id) };
  const [anchor, b] = session.blocks;
  const log = (slotId: string) => ({ slotId });

  it('runs blocks in order and alternates inside a superset', () => {
    let sets = [anchor, anchor, anchor].map((x) => log(x.slots[0].id));
    let c = nextSet(session, sets)!;
    expect(c.slotId).toBe(b.slots[0].id);
    sets = [...sets, log(b.slots[0].id)];
    c = nextSet(session, sets)!;
    expect(c.slotId).toBe(b.slots[1].id);
    expect(c.setIndex).toBe(0);
  });

  it('rests only after a full superset round', () => {
    const anchorDone = [anchor, anchor, anchor].map((x) => log(x.slots[0].id));
    expect(restAfter(session, anchor.slots[0].id, anchorDone)).toBe(150);
    const afterB1 = [...anchorDone, log(b.slots[0].id)];
    expect(restAfter(session, b.slots[0].id, afterB1)).toBe(0);
    const afterB2 = [...afterB1, log(b.slots[1].id)];
    expect(restAfter(session, b.slots[1].id, afterB2)).toBe(75);
  });

  it('skips skipped slots and reports completion', () => {
    const skipped = { blocks: session.blocks.map((blk) => ({ ...blk, slots: blk.slots.map((s) => ({ ...s, skipped: true })) })) };
    expect(nextSet(skipped, [])).toBeNull();
  });

  it('excludes paused time from duration and sums volume and muscle sets', () => {
    const s = { startedAt: 0, endedAt: 60 * 60000, pausedMs: 15 * 60000 } as Session;
    expect(activeDurationMs(s)).toBe(45 * 60000);
    const sum = summarize({ ...s, blocks: [] } as unknown as Session, [
      { id: '1', sessionId: 'x', slotId: 'a', exerciseId: 'db_flat_press', setIndex: 0, weightKg: 30, reps: 15, rir: 1, completedAt: 0, updatedAt: 0 },
      { id: '2', sessionId: 'x', slotId: 'b', exerciseId: 'push_up', setIndex: 0, weightKg: 0, reps: 25, rir: 1, completedAt: 0, updatedAt: 0 },
    ]);
    expect(sum.volumeKg).toBe(450);
    expect(sum.totalReps).toBe(40);
    expect(sum.setsByMuscle.chest_mid).toBe(2);
    expect(EXERCISE_BY_ID.push_up.loadType).toBe('bodyweight');
  });
});

describe('effort words', () => {
  it('maps Easy, Good and Max to reps in reserve that drive progression correctly', () => {
    expect(feelToRir('max', { rirMax: 2 })).toBe(0);
    expect(feelToRir('good', { rirMax: 2 })).toBe(2);
    expect(feelToRir('good', { rirMax: 1 })).toBe(1);
    expect(feelToRir('easy', { rirMax: 1 })).toBe(3);
    // "Good" at the top of the range allows a weight increase; "Max" does not when target RIR is 1+.
    const base = { loadType: 'dumbbell' as const, repMin: 15, repMax: 20, rirMin: 1, sets: 2, step: 2.5 };
    const at = (rir: number) => [[{ weightKg: 30, reps: 20, rir }, { weightKg: 30, reps: 20, rir }]];
    expect(suggest({ ...base, history: at(feelToRir('good', { rirMax: 1 })) }).kind).toBe('increase');
    expect(suggest({ ...base, history: at(feelToRir('max', { rirMax: 1 })) }).kind).toBe('reps');
  });
});
