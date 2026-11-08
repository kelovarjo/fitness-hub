import Dexie, { type EntityTable } from 'dexie';
import type { BodyMetric, Equipment, ExerciseMeta, Phase, Session, SetRecord, SettingRow } from './types';
import { DEFAULT_EQUIPMENT } from './data/equipment';
import { DEFAULT_PHASES } from './data/templates';

// All data lives in IndexedDB on this device. Nothing is sent anywhere.
export class FitnessDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  sets!: EntityTable<SetRecord, 'id'>;
  bodyMetrics!: EntityTable<BodyMetric, 'id'>;
  equipment!: EntityTable<Equipment, 'id'>;
  phases!: EntityTable<Phase, 'id'>;
  exerciseMeta!: EntityTable<ExerciseMeta, 'exerciseId'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name = 'fitness-hub') {
    super(name);
    this.version(1).stores({
      sessions: 'id, status, startedAt, templateId',
      sets: 'id, sessionId, slotId, exerciseId, completedAt',
      bodyMetrics: 'id, metric, measuredAt',
      equipment: 'id',
      phases: 'id, start',
      exerciseMeta: 'exerciseId',
      settings: 'key',
    });
  }
}

export const db = new FitnessDB();

/** Seed reference data on first run and add any equipment introduced by app updates. */
export async function ensureSeeded(database: FitnessDB = db): Promise<void> {
  const now = Date.now();
  await database.transaction('rw', database.equipment, database.phases, async () => {
    const existing = new Set((await database.equipment.toArray()).map((e) => e.id));
    const missing = DEFAULT_EQUIPMENT.filter((e) => !existing.has(e.id)).map((e) => ({ ...e, updatedAt: now }));
    if (missing.length) await database.equipment.bulkAdd(missing);
    if ((await database.phases.count()) === 0) {
      await database.phases.bulkAdd(DEFAULT_PHASES.map((p) => ({ ...p, updatedAt: now })));
    }
  });
}

export async function getSetting<T>(key: string, fallback: T, database: FitnessDB = db): Promise<T> {
  const row = await database.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown, database: FitnessDB = db): Promise<void> {
  await database.settings.put({ key, value });
}

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
