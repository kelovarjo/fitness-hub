import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db';
import { EXERCISES, EXERCISE_BY_ID, MUSCLE_LABEL, PATTERN_LABEL, getExercise } from '../data/exercises';
import BodyMap from '../components/BodyMap';
import type { MuscleId } from '../types';
import { DEFAULT_EQUIPMENT } from '../data/equipment';
import { e1rm } from '../logic/strength';
import * as store from '../store';
import { Badge, Button, Card, Header, cx, fmtDate, fmtKg } from '../ui';

const EQ_NAME = Object.fromEntries(DEFAULT_EQUIPMENT.map((e) => [e.id, e.name]));
const PROFILE = { L: 'Hardest when stretched', M: 'Hardest mid-range', S: 'Hardest when contracted' };

export default function Library() {
  const [mode, setMode] = useState<'map' | 'list'>(() => (sessionStorage.getItem('libMode') as 'map' | 'list') || 'map');
  const [view, setView] = useState<'front' | 'back'>(() => (sessionStorage.getItem('libView') as 'front' | 'back') || 'front');
  const [muscle, setMuscle] = useState<MuscleId | null>(() => (sessionStorage.getItem('libMuscle') as MuscleId) || null);
  const [q, setQ] = useState('');
  useEffect(() => {
    try {
      sessionStorage.setItem('libMode', mode);
      sessionStorage.setItem('libView', view);
      if (muscle) sessionStorage.setItem('libMuscle', muscle);
    } catch { /* ignore */ }
  }, [mode, view, muscle]);
  const meta = useLiveQuery(() => db.exerciseMeta.toArray(), []);
  const metaBy = new Map(meta?.map((m) => [m.exerciseId, m]));
  const worked = useLiveQuery(async () => {
    const sets = await db.sets.where('completedAt').above(Date.now() - 7 * 86400000).toArray();
    const out: Partial<Record<MuscleId, number>> = {};
    sets.forEach((s) => EXERCISE_BY_ID[s.exerciseId]?.primary.forEach((m) => (out[m] = (out[m] ?? 0) + 1)));
    return out;
  }, []);
  const intensity = Object.fromEntries(Object.entries(worked ?? {}).map(([k, v]) => [k, (v ?? 0) / 12]));

  const row = (e: (typeof EXERCISES)[number]) => {
    const m = metaBy.get(e.id);
    return (
      <a key={e.id} href={`#/library/${e.id}`} className="flex min-h-14 items-center justify-between gap-2 px-4 py-2">
        <span>
          <span className="block">{e.name}</span>
          <span className="text-xs text-mute">{e.primary.map((x) => MUSCLE_LABEL[x]).join(', ')}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-mute">
          {m?.excluded && <Badge tone="bad">Hidden</Badge>}›
        </span>
      </a>
    );
  };

  const primary = muscle ? EXERCISES.filter((e) => e.primary.includes(muscle)) : [];
  const secondary = muscle ? EXERCISES.filter((e) => !e.primary.includes(muscle) && e.secondary.includes(muscle)) : [];
  const filtered = EXERCISES.filter((e) =>
    !q || e.name.toLowerCase().includes(q.toLowerCase()) || [...e.primary, ...e.secondary].some((m) => MUSCLE_LABEL[m].toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <Header title="Muscles" right={
        <div className="flex rounded-full bg-panel2 p-1 text-sm">
          {(['map', 'list'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cx('min-h-9 rounded-full px-3', mode === m ? 'bg-ink text-bg font-semibold' : 'text-mute')}>{m === 'map' ? 'Body' : 'List'}</button>
          ))}
        </div>
      } />
      {mode === 'map' ? (
        <div className="p-4">
          <div className="mb-2 flex justify-center">
            <div className="flex rounded-full bg-panel2 p-1 text-sm">
              {(['front', 'back'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={cx('min-h-10 rounded-full px-5', view === v ? 'bg-ink text-bg font-semibold' : 'text-mute')}>{v === 'front' ? 'Front' : 'Back'}</button>
              ))}
            </div>
          </div>
          <BodyMap view={view} selected={muscle} onSelect={setMuscle} worked={intensity} />
          <p className="mt-1 text-center text-xs text-mute">Tap a muscle. Orange tint = sets in the last 7 days.</p>
          {muscle && (
            <div className="mt-4" id="muscle-exercises">
              <h2 className="mb-2 text-xl font-semibold">{MUSCLE_LABEL[muscle]} <span className="text-sm font-normal text-mute">· {worked?.[muscle] ?? 0} sets this week</span></h2>
              <div className="divide-y divide-line rounded-2xl border border-line bg-panel">{primary.map(row)}</div>
              {secondary.length > 0 && (
                <>
                  <h3 className="mb-1 mt-4 text-xs uppercase tracking-wide text-mute">Also works it</h3>
                  <div className="divide-y divide-line rounded-2xl border border-line bg-panel">{secondary.map(row)}</div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or muscle" aria-label="Search exercises"
            className="mb-4 min-h-12 w-full rounded-xl border border-line bg-panel px-3" />
          <div className="divide-y divide-line rounded-2xl border border-line bg-panel">{filtered.map(row)}</div>
        </div>
      )}
    </>
  );
}

export function ExerciseDetail({ id }: { id: string }) {
  const ex = getExercise(id);
  const meta = useLiveQuery(() => db.exerciseMeta.get(id), [id]);
  const sets = useLiveQuery(async () => {
    const all = await db.sets.where('exerciseId').equals(id).toArray();
    const done = new Set((await db.sessions.where('status').equals('completed').toArray()).map((s) => s.id));
    return all.filter((s) => done.has(s.sessionId)).sort((a, b) => b.completedAt - a.completedAt);
  }, [id]);
  const bySession = new Map<string, NonNullable<typeof sets>>();
  sets?.forEach((s) => bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]));
  const bestWeight = sets?.length ? (ex.loadType === 'assisted' ? Math.min(...sets.map((s) => s.weightKg)) : Math.max(...sets.map((s) => s.weightKg))) : null;
  const bestE1 = sets?.reduce((m, s) => Math.max(m, e1rm(s.weightKg, s.reps, s.rir, ex.loadType) ?? 0), 0) ?? 0;
  const bestReps = sets?.length ? Math.max(...sets.map((s) => s.reps)) : null;

  return (
    <>
      <Header title={ex.name} back="#/library" />
      <div className="space-y-3 p-4">
        <Card>
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-mute">Primary</dt><dd>{ex.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</dd>
            {ex.secondary.length > 0 && (<><dt className="text-mute">Secondary</dt><dd>{ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</dd></>)}
            <dt className="text-mute">Movement</dt><dd>{PATTERN_LABEL[ex.pattern]}</dd>
            <dt className="text-mute">Loading</dt><dd>{PROFILE[ex.profile]}</dd>
            <dt className="text-mute">Equipment</dt>
            <dd>{ex.equipment.length ? ex.equipment.map((r) => (Array.isArray(r) ? r.map((x) => EQ_NAME[x]).join(' or ') : EQ_NAME[r])).join(', ') : 'None'}</dd>
            <dt className="text-mute">Reps</dt><dd>{ex.repMin} to {ex.repMax}{ex.loadType === 'timed' ? ' seconds' : ''}</dd>
          </dl>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Cues</h2>
            {meta?.reviewed ? <Badge tone="good">Reviewed</Badge> : <Badge tone="warn">AI draft</Badge>}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm">{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => store.setExerciseMeta(id, { reviewed: !meta?.reviewed })}>{meta?.reviewed ? 'Mark as draft' : 'Mark reviewed'}</Button>
            <Button variant={meta?.excluded ? 'secondary' : 'danger'} onClick={() => store.setExerciseMeta(id, { excluded: !meta?.excluded })}>
              {meta?.excluded ? 'Allow in swaps' : 'Never suggest'}
            </Button>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Your history</h2>
          {!sets?.length ? <p className="text-sm text-mute">Not logged yet.</p> : (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-panel2 p-2"><div className="font-semibold tabular">{bestWeight !== null ? fmtKg(bestWeight) : '–'}</div><div className="text-xs text-mute">{ex.loadType === 'assisted' ? 'least assist' : 'best kg'}</div></div>
                <div className="rounded-xl bg-panel2 p-2"><div className="font-semibold tabular">{bestReps ?? '–'}</div><div className="text-xs text-mute">most reps</div></div>
                <div className="rounded-xl bg-panel2 p-2"><div className="font-semibold tabular">{bestE1 ? fmtKg(Math.round(bestE1 * 2) / 2) : '–'}</div><div className="text-xs text-mute">best e1RM est.</div></div>
              </div>
              <ul className="space-y-2 text-sm">
                {[...bySession.entries()].slice(0, 8).map(([sid, list]) => (
                  <li key={sid} className="flex justify-between gap-2">
                    <span className="text-mute">{fmtDate(list[0].completedAt, { day: 'numeric', month: 'short' })}</span>
                    <span className="tabular">{[...list].reverse().map((s) => `${fmtKg(s.weightKg)}×${s.reps}`).join(', ')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
