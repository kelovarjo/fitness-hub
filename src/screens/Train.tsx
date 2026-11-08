import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import { TEMPLATES } from '../data/templates';
import { getExercise } from '../data/exercises';
import { applyPhase, isSkippedInPhase, isoDate, phaseForDate } from '../logic/plan';
import { startEmptySession, startSession } from '../store';
import { Badge, Button, Card, Header , go } from '../ui';

export function blockKind(n: number) {
  return n >= 3 ? 'Giant set' : n === 2 ? 'Superset' : null;
}

export default function Train() {
  const phases = useLiveQuery(() => db.phases.toArray(), []);
  const active = useLiveQuery(() => db.sessions.where('status').equals('active').first(), []);
  const [open, setOpen] = useState<string | null>(null);
  if (!phases) return null;
  const phase = phaseForDate(phases, isoDate());

  const start = async (id: string) => {
    if (active) return go('/session');
    await startSession(id);
    go('/session');
  };

  return (
    <>
      <Header title="Train" />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <a href="#/history" className="rounded-2xl border border-line bg-panel p-4 font-semibold">History ›</a>
          <a href="#/library" className="rounded-2xl border border-line bg-panel p-4 font-semibold">Exercises by muscle ›</a>
        </div>
        {phase && <p className="text-sm text-mute">Templates below are adjusted for <b className="text-ink">{phase.name}</b>.</p>}
        {TEMPLATES.map((t) => {
          const blocks = applyPhase(t, phase);
          const skipped = isSkippedInPhase(t, phase);
          const sets = blocks.flatMap((b) => b.slots).reduce((a, s) => a + s.sets, 0);
          return (
            <Card key={t.id}>
              <button className="w-full text-left" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">{t.name}</div>
                    <div className="text-sm text-mute">{t.focus} · {sets} sets</div>
                  </div>
                  {skipped ? <Badge tone="warn">Skipped this phase</Badge> : <span className="text-mute">{open === t.id ? '▴' : '▾'}</span>}
                </div>
              </button>
              {open === t.id && (
                <div className="mt-3 space-y-2">
                  {blocks.map((b) => (
                    <div key={b.label} className="rounded-xl bg-panel2 p-3 text-sm">
                      <div className="mb-1 flex gap-2 text-xs uppercase tracking-wide text-mute">
                        <span>{b.label}</span>{blockKind(b.slots.length) && <span>· {blockKind(b.slots.length)}</span>}<span>· rest {b.restSec}s</span>
                      </div>
                      {b.slots.map((s) => (
                        <div key={s.exerciseId} className="flex justify-between gap-2">
                          <span>{getExercise(s.exerciseId).name}</span>
                          <span className="shrink-0 text-mute tabular">{s.sets} × {s.finisher ? 'max−1' : `${s.repMin}–${s.repMax}`}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <Button variant={skipped ? 'secondary' : 'primary'} className="mt-3 w-full" onClick={() => start(t.id)}>
                {active ? 'Resume current session' : `Start ${t.name}`}
              </Button>
            </Card>
          );
        })}
        <Button className="w-full" onClick={async () => { await startEmptySession(); go('/session'); }} disabled={!!active}>
          Start an empty session
        </Button>
      </div>
    </>
  );
}
