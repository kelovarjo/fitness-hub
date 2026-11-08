import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB, ensureSeeded } from './db';
import * as store from './store';

let db: FitnessDB;
let i = 0;
beforeEach(async () => {
  db = new FitnessDB(`test-${++i}`);
  await ensureSeeded(db);
});

describe('session lifecycle in IndexedDB', () => {
  it('starts one active session only and resumes it', async () => {
    const a = await store.startSession('upper_a', db);
    const b = await store.startSession('upper_b', db);
    expect(b).toBe(a);
    expect(await db.sessions.count()).toBe(1);
  });

  it('logs sets, rests after superset rounds, and survives a re-opened database', async () => {
    const id = await store.startSession('upper_a', db);
    let s = (await db.sessions.get(id))!;
    const anchor = s.blocks[0].slots[0];
    const r1 = await store.logSet(id, anchor.id, { weightKg: 60, reps: 8, rir: 2 }, db);
    expect(r1.restSec).toBe(150);
    expect(r1.prs).toEqual([]);
    s = (await db.sessions.get(id))!;
    expect(s.restEndsAt).toBeGreaterThan(Date.now());
    await store.logSet(id, anchor.id, { weightKg: 60, reps: 8, rir: 2 }, db);
    await store.logSet(id, anchor.id, { weightKg: 60, reps: 7, rir: 1 }, db);

    const [b1, b2] = s.blocks[1].slots;
    const r2 = await store.logSet(id, b1.id, { weightKg: 30, reps: 18, rir: 1 }, db);
    expect(r2.restSec).toBe(0);
    const r3 = await store.logSet(id, b2.id, { weightKg: 30, reps: 16, rir: 1 }, db);
    expect(r3.restSec).toBe(75);

    // Simulate the app being killed and reopened.
    const reopened = new FitnessDB(db.name);
    expect(await reopened.sets.where('sessionId').equals(id).count()).toBe(5);
    expect((await store.getActiveSession(reopened))!.id).toBe(id);
  });

  it('suggests from completed history only and progresses after a top-of-range session', async () => {
    const id = await store.startSession('upper_a', db);
    const s = (await db.sessions.get(id))!;
    const slot = s.blocks[1].slots[0]; // flat dumbbell press 15 to 20
    for (let k = 0; k < 3; k++) await store.logSet(id, slot.id, { weightKg: 30, reps: 20, rir: 1 }, db);
    // Not completed yet, so no history.
    expect((await store.suggestionFor(slot, 'other', db)).kind).toBe('none');
    await store.finishSession(id, undefined, db);
    const sug = await store.suggestionFor(slot, 'other', db);
    expect(sug.kind).toBe('increase');
    expect(sug.targets![0].weightKg).toBe(32.5);
  });

  it('detects a PR against earlier sessions', async () => {
    const id = await store.startSession('upper_a', db);
    const slot = (await db.sessions.get(id))!.blocks[0].slots[0];
    await store.logSet(id, slot.id, { weightKg: 60, reps: 8, rir: 2 }, db);
    await store.finishSession(id, undefined, db);
    const id2 = await store.startSession('upper_a', db);
    const slot2 = (await db.sessions.get(id2))!.blocks[0].slots[0];
    const r = await store.logSet(id2, slot2.id, { weightKg: 62.5, reps: 8, rir: 2 }, db);
    expect(r.prs).toContain('weight');
    // A heavier set later in the same session is not a record against today's sets.
    const r2 = await store.logSet(id2, slot2.id, { weightKg: 60, reps: 8, rir: 2 }, db);
    expect(r2.prs).toEqual([]);
  });

  it('does not report records inside the first-ever session', async () => {
    const id = await store.startSession('upper_a', db);
    const slot = (await db.sessions.get(id))!.blocks[0].slots[0];
    await store.logSet(id, slot.id, { weightKg: 60, reps: 8, rir: 2 }, db);
    const r = await store.logSet(id, slot.id, { weightKg: 65, reps: 8, rir: 2 }, db);
    expect(r.prs).toEqual([]);
  });

  it('swaps an exercise and keeps the original for history', async () => {
    const id = await store.startSession('upper_a', db);
    const slot = (await db.sessions.get(id))!.blocks[1].slots[0];
    await store.swapExercise(id, slot.id, 'machine_chest_press', db);
    const after = (await db.sessions.get(id))!.blocks[1].slots[0];
    expect(after.exerciseId).toBe('machine_chest_press');
    expect(after.originalExerciseId).toBe('db_flat_press');
    const opts = await store.swapOptions((await db.sessions.get(id))!, slot.id, db);
    expect(opts.length).toBeGreaterThan(0);
  });

  it('removes occupied equipment from swap options until it expires', async () => {
    const id = await store.startSession('upper_c', db);
    const s = (await db.sessions.get(id))!;
    const slot = s.blocks[1].slots[0]; // incline dumbbell press
    await store.markOccupied('smith', 20, db);
    let opts = await store.swapOptions(s, slot.id, db);
    expect(opts.some((o) => o.exercise.id === 'smith_incline_press')).toBe(false);
    await store.clearOccupied('smith', db);
    opts = await store.swapOptions(s, slot.id, db);
    expect(opts.some((o) => o.exercise.id === 'smith_incline_press')).toBe(true);
  });

  it('deletes a set and renumbers the remaining ones', async () => {
    const id = await store.startSession('upper_a', db);
    const slot = (await db.sessions.get(id))!.blocks[0].slots[0];
    const a = await store.logSet(id, slot.id, { weightKg: 60, reps: 8, rir: 2 }, db);
    await store.logSet(id, slot.id, { weightKg: 60, reps: 7, rir: 1 }, db);
    await store.deleteSet(a.set.id, db);
    const rest = await db.sets.where('slotId').equals(slot.id).toArray();
    expect(rest.map((x) => x.setIndex)).toEqual([0]);
  });

  it('excludes paused time when finishing', async () => {
    const id = await store.startSession('lower', db);
    await store.pauseSession(id, db);
    await new Promise((r) => setTimeout(r, 30));
    await store.resumeSession(id, db);
    const s = (await db.sessions.get(id))!;
    expect(s.pausedMs).toBeGreaterThanOrEqual(25);
  });

  it('discards a session with its sets', async () => {
    const id = await store.startSession('upper_a', db);
    const slot = (await db.sessions.get(id))!.blocks[0].slots[0];
    await store.logSet(id, slot.id, { weightKg: 60, reps: 8, rir: 2 }, db);
    await store.discardSession(id, db);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
  });
});

describe('backup', () => {
  it('round-trips export and import without duplicates', async () => {
    const id = await store.startSession('upper_a', db);
    const slot = (await db.sessions.get(id))!.blocks[0].slots[0];
    await store.logSet(id, slot.id, { weightKg: 60, reps: 8, rir: 2 }, db);
    await store.addBodyMetric('weight', 97, Date.now(), db);
    const file = JSON.parse(JSON.stringify(await store.exportAll(db)));

    const other = new FitnessDB(`import-${i}`);
    await ensureSeeded(other);
    await store.importAll(file, other);
    await store.importAll(file, other); // importing twice must not duplicate
    expect(await other.sets.count()).toBe(1);
    expect(await other.bodyMetrics.count()).toBe(1);
    expect(await other.equipment.count()).toBe(await db.equipment.count());
  });

  it('rejects files that are not backups', async () => {
    await expect(store.importAll({ hello: 1 }, db)).rejects.toThrow(/not a Fitness Hub backup/);
    expect(await db.equipment.count()).toBeGreaterThan(0);
  });

  it('deletes everything', async () => {
    await store.addBodyMetric('waist', 100, Date.now(), db);
    await store.deleteAll(db);
    expect(await db.bodyMetrics.count()).toBe(0);
  });
});
