import { db, getSetting, setSetting, uid, type FitnessDB } from './db';
import { EXERCISES, EXERCISE_BY_ID, getExercise } from './data/exercises';
import { TEMPLATE_BY_ID } from './data/templates';
import type { Equipment, EquipmentId, Exercise, Session, SessionSlot, SetRecord } from './types';
import { applyPhase, isoDate, phaseForDate, toSessionBlocks } from './logic/plan';
import { restAfter } from './logic/session';
import { detectPrs, estimateStartWeight, type PrType, type SetLike } from './logic/strength';
import { suggest, type Suggestion } from './logic/progression';
import { rankSubstitutes, station, type Ranked } from './logic/substitution';

const now = () => Date.now();

// ---------- Queries ----------

export async function getActiveSession(database: FitnessDB = db): Promise<Session | undefined> {
  return database.sessions.where('status').equals('active').first();
}

export async function equipmentMap(database: FitnessDB = db): Promise<Map<EquipmentId, Equipment>> {
  return new Map((await database.equipment.toArray()).map((e) => [e.id, e]));
}

export function stepFor(ex: Exercise, eq: Map<EquipmentId, Equipment>): number {
  if (ex.loadType === 'timed') return 0;
  const e = ex.load ? eq.get(ex.load) : undefined;
  return e?.increment && e.increment > 0 ? e.increment : 2.5;
}

/** Working sets of the most recent completed sessions for an exercise, newest session first. */
export async function exerciseHistory(exerciseId: string, opts: { excludeSessionId?: string; limit?: number } = {}, database: FitnessDB = db): Promise<SetLike[][]> {
  const sets = await database.sets.where('exerciseId').equals(exerciseId).toArray();
  const completed = new Set((await database.sessions.where('status').equals('completed').toArray()).map((s) => s.id));
  const bySession = new Map<string, SetRecord[]>();
  for (const s of sets) {
    if (s.sessionId === opts.excludeSessionId || !completed.has(s.sessionId)) continue;
    const arr = bySession.get(s.sessionId) ?? [];
    arr.push(s);
    bySession.set(s.sessionId, arr);
  }
  return [...bySession.values()]
    .map((arr) => arr.sort((a, b) => a.setIndex - b.setIndex || a.completedAt - b.completedAt))
    .sort((a, b) => b[0].completedAt - a[0].completedAt)
    .slice(0, opts.limit ?? 4)
    .map((arr) => arr.map(({ weightKg, reps, rir }) => ({ weightKg, reps, rir })));
}

export async function suggestionFor(slot: SessionSlot, sessionId: string, database: FitnessDB = db): Promise<Suggestion> {
  const ex = getExercise(slot.exerciseId);
  const eq = await equipmentMap(database);
  const history = await exerciseHistory(slot.exerciseId, { excludeSessionId: sessionId }, database);
  const loadEq = ex.load ? eq.get(ex.load) : undefined;
  return suggest({
    loadType: ex.loadType,
    repMin: slot.repMin,
    repMax: slot.repMax,
    rirMin: slot.rirMin,
    sets: slot.sets,
    finisher: slot.finisher,
    step: stepFor(ex, eq),
    maxKg: loadEq?.maxKg,
    history,
  });
}

export async function recentlyDoneIds(days = 90, database: FitnessDB = db): Promise<Set<string>> {
  const since = now() - days * 86400000;
  const sets = await database.sets.where('completedAt').above(since).toArray();
  return new Set(sets.map((s) => s.exerciseId));
}

export async function excludedIds(database: FitnessDB = db): Promise<Set<string>> {
  return new Set((await database.exerciseMeta.toArray()).filter((m) => m.excluded).map((m) => m.exerciseId));
}

export interface SwapOption extends Ranked {
  startWeight: number | null;
  startNote: string;
}

export async function swapOptions(session: Session, slotId: string, database: FitnessDB = db): Promise<SwapOption[]> {
  const block = session.blocks.find((b) => b.slots.some((s) => s.id === slotId))!;
  const slot = block.slots.find((s) => s.id === slotId)!;
  const original = getExercise(slot.exerciseId);
  const eq = await equipmentMap(database);
  const inSession = new Set(session.blocks.flatMap((b) => b.slots.filter((s) => s.id !== slotId && !s.skipped).map((s) => s.exerciseId)));
  const blockStations = block.slots
    .filter((s) => s.id !== slotId)
    .map((s) => station(getExercise(s.exerciseId)))
    .filter((x): x is EquipmentId => !!x);
  const ranked = rankSubstitutes({
    original,
    candidates: EXERCISES,
    equipment: eq,
    now: now(),
    recentlyDone: await recentlyDoneIds(90, database),
    excluded: await excludedIds(database),
    inSession,
    blockStations,
  }).slice(0, 8);

  // Reference set for estimates: today's logged sets of the original, else its last session.
  const todays = await database.sets.where('slotId').equals(slotId).toArray();
  const ref = todays.at(-1) ?? (await exerciseHistory(original.id, { excludeSessionId: session.id, limit: 1 }, database))[0]?.[0];
  const targetReps = Math.round((slot.repMin + slot.repMax) / 2);

  const out: SwapOption[] = [];
  for (const r of ranked) {
    const hist = await exerciseHistory(r.exercise.id, { excludeSessionId: session.id, limit: 1 }, database);
    if (hist[0]?.length) {
      out.push({ ...r, startWeight: hist[0][0].weightKg, startNote: 'Your last weight' });
      continue;
    }
    const sameFamily = r.exercise.pattern === original.pattern;
    const est = ref && sameFamily
      ? estimateStartWeight({ weightKg: ref.weightKg, reps: ref.reps, loadType: original.loadType }, { loadType: r.exercise.loadType, reps: targetReps, step: stepFor(r.exercise, eq) })
      : null;
    out.push({ ...r, startWeight: est, startNote: est !== null ? 'Rough estimate: first set is a calibration set' : 'New exercise: choose a starting weight' });
  }
  return out;
}

// ---------- Session actions ----------

export async function startSession(templateId: string, database: FitnessDB = db): Promise<string> {
  const active = await getActiveSession(database);
  if (active) return active.id;
  const template = TEMPLATE_BY_ID[templateId];
  const phase = phaseForDate(await database.phases.toArray(), isoDate());
  const session: Session = {
    id: uid(),
    templateId,
    templateName: template.name,
    phaseId: phase?.id ?? null,
    startedAt: now(),
    status: 'active',
    pausedMs: 0,
    blocks: toSessionBlocks(applyPhase(template, phase), uid),
    updatedAt: now(),
  };
  await database.sessions.add(session);
  return session.id;
}

export async function startEmptySession(database: FitnessDB = db): Promise<string> {
  const active = await getActiveSession(database);
  if (active) return active.id;
  const session: Session = {
    id: uid(), templateId: null, templateName: 'Custom session', phaseId: null,
    startedAt: now(), status: 'active', pausedMs: 0, blocks: [], updatedAt: now(),
  };
  await database.sessions.add(session);
  return session.id;
}

async function patchSession(id: string, fn: (s: Session) => void, database: FitnessDB = db): Promise<Session> {
  return database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(id);
    if (!s) throw new Error('Session not found');
    fn(s);
    s.updatedAt = now();
    await database.sessions.put(s);
    return s;
  });
}

export interface LogResult {
  set: SetRecord;
  prs: PrType[];
  restSec: number;
}

export async function logSet(
  sessionId: string,
  slotId: string,
  values: { weightKg: number; reps: number; rir: number; note?: string },
  database: FitnessDB = db,
): Promise<LogResult> {
  return database.transaction('rw', database.sessions, database.sets, async () => {
    const session = await database.sessions.get(sessionId);
    if (!session || session.status !== 'active') throw new Error('No active session');
    const slot = session.blocks.flatMap((b) => b.slots).find((s) => s.id === slotId);
    if (!slot) throw new Error('Slot not found');
    const ex = getExercise(slot.exerciseId);
    const before = await database.sets.where('sessionId').equals(sessionId).toArray();
    // Records compare against earlier sessions only, not against sets from today.
    const prev = (await database.sets.where('exerciseId').equals(slot.exerciseId).toArray()).filter((s) => s.sessionId !== sessionId);
    const set: SetRecord = {
      id: uid(),
      sessionId,
      slotId,
      exerciseId: slot.exerciseId,
      setIndex: before.filter((s) => s.slotId === slotId).length,
      weightKg: values.weightKg,
      reps: values.reps,
      rir: values.rir,
      finisher: slot.finisher,
      completedAt: now(),
      note: values.note,
      updatedAt: now(),
    };
    await database.sets.add(set);
    const prs = detectPrs(prev, set, ex.loadType);
    const restSec = restAfter(session, slotId, [...before, set]);
    session.restEndsAt = restSec > 0 ? now() + restSec * 1000 : undefined;
    session.restTotalSec = restSec || undefined;
    if (session.pauseStartedAt) {
      session.pausedMs += now() - session.pauseStartedAt;
      session.pauseStartedAt = undefined;
    }
    session.updatedAt = now();
    await database.sessions.put(session);
    return { set, prs, restSec };
  });
}

export async function updateSet(id: string, values: Partial<Pick<SetRecord, 'weightKg' | 'reps' | 'rir' | 'note'>>, database: FitnessDB = db) {
  await database.sets.update(id, { ...values, updatedAt: now() });
}

/** Delete a set and renumber the remaining sets of its slot. */
export async function deleteSet(id: string, database: FitnessDB = db) {
  await database.transaction('rw', database.sets, async () => {
    const set = await database.sets.get(id);
    if (!set) return;
    await database.sets.delete(id);
    const rest = (await database.sets.where('slotId').equals(set.slotId).toArray()).sort((a, b) => a.setIndex - b.setIndex);
    await Promise.all(rest.map((s, i) => (s.setIndex !== i ? database.sets.update(s.id, { setIndex: i, updatedAt: now() }) : null)));
  });
}

export const clearRest = (sessionId: string, database: FitnessDB = db) =>
  patchSession(sessionId, (s) => { s.restEndsAt = undefined; s.restTotalSec = undefined; }, database);

export const extendRest = (sessionId: string, sec: number, database: FitnessDB = db) =>
  patchSession(sessionId, (s) => {
    if (s.restEndsAt) {
      s.restEndsAt += sec * 1000;
      s.restTotalSec = (s.restTotalSec ?? 0) + sec;
    }
  }, database);

export const pauseSession = (id: string, database: FitnessDB = db) =>
  patchSession(id, (s) => { if (!s.pauseStartedAt) s.pauseStartedAt = now(); s.restEndsAt = undefined; }, database);

export const resumeSession = (id: string, database: FitnessDB = db) =>
  patchSession(id, (s) => {
    if (s.pauseStartedAt) {
      s.pausedMs += now() - s.pauseStartedAt;
      s.pauseStartedAt = undefined;
    }
  }, database);

export const finishSession = (id: string, notes?: string, database: FitnessDB = db) =>
  patchSession(id, (s) => {
    if (s.pauseStartedAt) {
      s.pausedMs += now() - s.pauseStartedAt;
      s.pauseStartedAt = undefined;
    }
    s.status = 'completed';
    s.endedAt = now();
    s.restEndsAt = undefined;
    if (notes !== undefined) s.notes = notes;
  }, database);

export async function discardSession(id: string, database: FitnessDB = db) {
  await database.transaction('rw', database.sessions, database.sets, async () => {
    await database.sets.where('sessionId').equals(id).delete();
    await database.sessions.delete(id);
  });
}

export const deleteSession = discardSession;

export const swapExercise = (sessionId: string, slotId: string, exerciseId: string, database: FitnessDB = db) =>
  patchSession(sessionId, (s) => {
    for (const b of s.blocks)
      for (const slot of b.slots)
        if (slot.id === slotId) {
          if (!slot.originalExerciseId) slot.originalExerciseId = slot.exerciseId;
          if (slot.originalExerciseId === exerciseId) slot.originalExerciseId = undefined;
          slot.exerciseId = exerciseId;
        }
  }, database);

export const setSkipped = (sessionId: string, slotId: string, skipped: boolean, database: FitnessDB = db) =>
  patchSession(sessionId, (s) => {
    s.blocks.forEach((b) => b.slots.forEach((slot) => { if (slot.id === slotId) slot.skipped = skipped; }));
  }, database);

export const changeSetCount = (sessionId: string, slotId: string, delta: number, database: FitnessDB = db) =>
  patchSession(sessionId, (s) => {
    s.blocks.forEach((b) => b.slots.forEach((slot) => { if (slot.id === slotId) slot.sets = Math.max(1, Math.min(10, slot.sets + delta)); }));
  }, database);

export const moveBlock = (sessionId: string, blockId: string, dir: -1 | 1, database: FitnessDB = db) =>
  patchSession(sessionId, (s) => {
    const i = s.blocks.findIndex((b) => b.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.blocks.length) return;
    [s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]];
  }, database);

export const addExercise = (sessionId: string, exerciseId: string, database: FitnessDB = db) =>
  patchSession(sessionId, (s) => {
    const ex = getExercise(exerciseId);
    s.blocks.push({
      id: uid(),
      label: 'Added',
      restSec: ex.repMax <= 10 ? 120 : 75,
      slots: [{ id: uid(), exerciseId, sets: 3, repMin: ex.repMin, repMax: ex.repMax, rirMin: 1, rirMax: 2 }],
    });
  }, database);

// ---------- Equipment ----------

export async function markOccupied(id: EquipmentId, minutes = 20, database: FitnessDB = db) {
  await database.equipment.update(id, { occupiedUntil: now() + minutes * 60000, updatedAt: now() });
}

export async function clearOccupied(id: EquipmentId, database: FitnessDB = db) {
  await database.equipment.update(id, { occupiedUntil: undefined, updatedAt: now() });
}

export async function updateEquipment(id: EquipmentId, patch: Partial<Equipment>, database: FitnessDB = db) {
  await database.equipment.update(id, { ...patch, updatedAt: now() });
}

// ---------- Exercise meta ----------

export async function setExerciseMeta(exerciseId: string, patch: { reviewed?: boolean; excluded?: boolean }, database: FitnessDB = db) {
  const cur = await database.exerciseMeta.get(exerciseId);
  await database.exerciseMeta.put({ exerciseId, ...cur, ...patch, updatedAt: now() });
}

// ---------- Body ----------

export async function addBodyMetric(metric: import('./types').BodyMetricId, value: number, measuredAt: number, database: FitnessDB = db) {
  await database.bodyMetrics.add({ id: uid(), metric, value, measuredAt, source: 'manual', updatedAt: now() });
}

export async function deleteBodyMetric(id: string, database: FitnessDB = db) {
  await database.bodyMetrics.delete(id);
}

// ---------- Backup ----------

export const EXPORT_VERSION = 1;

export interface ExportFile {
  app: 'fitness-hub';
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

const TABLES = ['sessions', 'sets', 'bodyMetrics', 'equipment', 'phases', 'exerciseMeta', 'settings'] as const;

export async function exportAll(database: FitnessDB = db): Promise<ExportFile> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await database.table(t).toArray();
  return { app: 'fitness-hub', version: EXPORT_VERSION, exportedAt: new Date().toISOString(), tables };
}

export async function markBackedUp(database: FitnessDB = db) {
  await setSetting('lastBackupAt', now(), database);
}

export const lastBackupAt = (database: FitnessDB = db) => getSetting<number | null>('lastBackupAt', null, database);

export function validateImport(data: unknown): asserts data is ExportFile {
  const d = data as ExportFile;
  if (!d || d.app !== 'fitness-hub') throw new Error('This is not a Fitness Hub backup file.');
  if (typeof d.version !== 'number' || d.version > EXPORT_VERSION) throw new Error('Backup is from a newer app version.');
  for (const t of TABLES) if (!Array.isArray(d.tables?.[t])) throw new Error(`Backup is missing ${t}.`);
  for (const s of d.tables.sets as SetRecord[]) {
    if (typeof s.id !== 'string' || typeof s.weightKg !== 'number' || typeof s.reps !== 'number') throw new Error('Backup contains an invalid set.');
  }
}

/** Replace all data with the backup contents. */
export async function importAll(data: unknown, database: FitnessDB = db) {
  validateImport(data);
  await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
    for (const t of TABLES) {
      await database.table(t).clear();
      await database.table(t).bulkAdd(data.tables[t]);
    }
  });
}

export async function deleteAll(database: FitnessDB = db) {
  await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
    for (const t of TABLES) await database.table(t).clear();
  });
}

export { EXERCISE_BY_ID };
