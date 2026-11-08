import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import { EXERCISES, MUSCLE_LABEL, PATTERN_LABEL, getExercise } from '../data/exercises';
import { DEFAULT_EQUIPMENT } from '../data/equipment';
import { e1rm } from '../logic/strength';
import * as store from '../store';
import { Badge, Button, Card, Header, fmtDate, fmtKg } from '../ui';

const EQ_NAME = Object.fromEntries(DEFAULT_EQUIPMENT.map((e) => [e.id, e.name]));
const PROFILE = { L: 'Hardest when stretched', M: 'Hardest mid-range', S: 'Hardest when contracted' };

export default function Library() {
  const [q, setQ] = useState('');
  const meta = useLiveQuery(() => db.exerciseMeta.toArray(), []);
  const metaBy = new Map(meta?.map((m) => [m.exerciseId, m]));
  const filtered = EXERCISES.filter((e) =>
    !q || e.name.toLowerCase().includes(q.toLowerCase()) || [...e.primary, ...e.secondary].some((m) => MUSCLE_LABEL[m].toLowerCase().includes(q.toLowerCase())));
  const groups = new Map<string, typeof EXERCISES>();
  filtered.forEach((e) => groups.set(e.pattern, [...(groups.get(e.pattern) ?? []), e]));
  const reviewed = meta?.filter((m) => m.reviewed).length ?? 0;
  return (
    <>
      <Header title="Exercises" back="#/train" />
      <div className="p-4">
        <p className="mb-3 text-sm text-mute">{EXERCISES.length} exercises · {reviewed} reviewed. Cues are AI drafts until you mark them reviewed.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or muscle" aria-label="Search exercises"
          className="mb-4 min-h-12 w-full rounded-xl border border-line bg-panel px-3" />
        {[...groups.entries()].map(([pattern, list]) => (
          <div key={pattern} className="mb-4">
            <h2 className="mb-1 text-xs uppercase tracking-wide text-mute">{PATTERN_LABEL[pattern]}</h2>
            <div className="divide-y divide-line rounded-2xl border border-line bg-panel">
              {list.map((e) => {
                const m = metaBy.get(e.id);
                return (
                  <a key={e.id} href={`#/library/${e.id}`} className="flex min-h-14 items-center justify-between gap-2 px-4 py-2">
                    <span>
                      <span className="block">{e.name}</span>
                      <span className="text-xs text-mute">{e.primary.map((x) => MUSCLE_LABEL[x]).join(', ')}</span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {m?.excluded && <Badge tone="bad">Never suggest</Badge>}
                      {m?.reviewed ? <Badge tone="good">Reviewed</Badge> : <Badge>Draft</Badge>}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
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
