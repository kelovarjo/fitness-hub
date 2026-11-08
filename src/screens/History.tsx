import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getExercise } from '../data/exercises';
import { summarize } from '../logic/session';
import * as store from '../store';
import { Button, Card, Header, confirmAction, fmtDate, fmtKg, go } from '../ui';
import type { SetRecord } from '../types';

export default function History() {
  const rows = useLiveQuery(async () => {
    const sessions = (await db.sessions.where('status').equals('completed').toArray()).sort((a, b) => b.startedAt - a.startedAt);
    return Promise.all(sessions.map(async (s) => ({ s, sum: summarize(s, await db.sets.where('sessionId').equals(s.id).toArray()) })));
  }, []);
  return (
    <>
      <Header title="History" back="#/train" />
      <div className="space-y-2 p-4">
        {rows?.length === 0 && <p className="text-mute">No completed sessions yet.</p>}
        {rows?.map(({ s, sum }) => (
          <a key={s.id} href={`#/history/${s.id}`} className="block rounded-2xl border border-line bg-panel p-4">
            <div className="flex justify-between"><span className="font-semibold">{s.templateName}</span><span className="text-sm text-mute">{fmtDate(s.startedAt)}</span></div>
            <div className="text-sm text-mute tabular">{sum.durationMin} min · {sum.setCount} sets · {sum.totalReps} reps</div>
          </a>
        ))}
      </div>
    </>
  );
}

export function SessionDetail({ id }: { id: string }) {
  const data = useLiveQuery(async () => {
    const s = await db.sessions.get(id);
    if (!s) return null;
    const sets = (await db.sets.where('sessionId').equals(id).toArray()).sort((a, b) => a.completedAt - b.completedAt);
    return { s, sets };
  }, [id]);
  if (data === undefined) return null;
  if (data === null) return (<><Header title="Session" back="#/history" /><p className="p-4 text-mute">Not found.</p></>);
  const { s, sets } = data;
  const groups = new Map<string, SetRecord[]>();
  sets.forEach((x) => groups.set(x.exerciseId, [...(groups.get(x.exerciseId) ?? []), x]));
  const sum = summarize(s, sets);
  return (
    <>
      <Header title={s.templateName} back="#/history" />
      <div className="space-y-3 p-4">
        <p className="text-sm text-mute">{fmtDate(s.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {sum.durationMin} min · {sum.setCount} sets</p>
        {[...groups.entries()].map(([exId, list]) => (
          <Card key={exId}>
            <a href={`#/library/${exId}`} className="font-semibold">{getExercise(exId).name} ›</a>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {list.map((x, i) => (
                <span key={x.id} className="rounded-lg bg-panel2 px-2.5 py-1 text-sm tabular"><span className="text-mute">{i + 1}.</span> {fmtKg(x.weightKg)}×{x.reps} <span className="text-mute">@{x.rir}</span></span>
              ))}
            </div>
          </Card>
        ))}
        {s.notes && <Card><div className="text-sm">{s.notes}</div></Card>}
        <Button variant="danger" className="w-full" onClick={async () => {
          if (!confirmAction('Delete this session and its sets? This cannot be undone.')) return;
          await store.deleteSession(id);
          go('/history');
        }}>Delete session</Button>
      </div>
    </>
  );
}
