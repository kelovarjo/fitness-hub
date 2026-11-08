import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../db';
import { TEMPLATES } from '../data/templates';
import { isoDate, nextTemplate, phaseForDate } from '../logic/plan';
import { startSession } from '../store';
import { Badge, Button, Card, Header, fmtDate, fmtKg , go } from '../ui';
import type { BodyMetric } from '../types';

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x.getTime();
}

function latestWithChange(rows: BodyMetric[]) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => b.measuredAt - a.measuredAt);
  const latest = sorted[0];
  const ref = sorted.find((r) => r.measuredAt <= latest.measuredAt - 6.5 * 86400000);
  return { latest, change: ref ? latest.value - ref.value : null, refDate: ref?.measuredAt };
}

export default function Today() {
  const data = useLiveQuery(async () => {
    const phases = await db.phases.toArray();
    const completed = await db.sessions.where('status').equals('completed').toArray();
    const weights = await db.bodyMetrics.where('metric').equals('weight').toArray();
    const waists = await db.bodyMetrics.where('metric').equals('waist').toArray();
    const lastBackup = await getSetting<number | null>('lastBackupAt', null);
    const setCount = await db.sets.count();
    return { phases, completed, weights, waists, lastBackup, setCount };
  }, []);
  if (!data) return null;

  const today = isoDate();
  const phase = phaseForDate(data.phases, today);
  const next = nextTemplate(TEMPLATES, data.completed, phase);
  const weekStart = startOfWeek();
  const thisWeek = data.completed.filter((s) => s.startedAt >= weekStart);
  // Race day = last day of the taper phase (editable in Settings).
  const taper = data.phases.find((p) => p.id === 'taper');
  const daysToRace = taper ? Math.round((Date.parse(taper.end) - Date.parse(today)) / 86400000) : 0;
  const w = latestWithChange(data.weights);
  const waist = latestWithChange(data.waists);
  const backupAgeDays = data.lastBackup ? Math.floor((Date.now() - data.lastBackup) / 86400000) : null;
  const needsBackup = (data.setCount > 0 || data.weights.length > 0) && (backupAgeDays === null || backupAgeDays >= 7);

  const start = async (templateId: string) => {
    await startSession(templateId);
    go('/session');
  };

  return (
    <>
      <Header title="Today" right={<span className="text-sm text-mute">{fmtDate(Date.now())}</span>} />
      <div className="space-y-4 p-4">
        {needsBackup && (
          <a href="#/settings" className="block rounded-2xl border border-warn/50 bg-warn/10 p-4 text-sm">
            <b className="text-warn">Back up your data.</b>{' '}
            {backupAgeDays === null ? 'No backup yet.' : `Last backup ${backupAgeDays} days ago.`} Data lives only on this phone. Tap to export.
          </a>
        )}

        <Card>
          <div className="mb-1 flex items-center gap-2">
            <Badge tone="accent">{phase?.name ?? 'No phase'}</Badge>
            {daysToRace > 0 && <span className="text-sm text-mute">Race in {daysToRace} days</span>}
          </div>
          {phase?.note && <p className="text-sm text-mute">{phase.note}</p>}
          {next ? (
            <div className="mt-4">
              <div className="text-sm text-mute">Next session</div>
              <div className="text-2xl font-semibold">{next.name}</div>
              <div className="mb-4 text-mute">{next.focus}</div>
              <Button variant="primary" className="w-full text-lg" onClick={() => start(next.id)}>Start {next.name}</Button>
              <a href="#/train" className="mt-3 block text-center text-sm text-accent">Choose another session</a>
            </div>
          ) : (
            <p className="mt-3 text-mute">No session scheduled in this phase.</p>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">This week</h2>
            <span className="text-sm text-mute tabular">{thisWeek.length} of 4 sessions</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {TEMPLATES.map((t) => {
              const done = thisWeek.some((s) => s.templateId === t.id);
              return (
                <div key={t.id} className={`rounded-xl border p-2 text-center text-sm ${done ? 'border-good/50 bg-good/10 text-good' : 'border-line text-mute'}`}>
                  {t.name}
                  <div className="text-xs">{done ? 'Done' : '–'}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Body</h2>
            <a href="#/body" className="text-sm text-accent">Log ›</a>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[{ label: 'Weight', unit: 'kg', d: w }, { label: 'Waist', unit: 'cm', d: waist }].map(({ label, unit, d }) => (
              <div key={label} className="rounded-xl bg-panel2 p-3">
                <div className="text-xs uppercase tracking-wide text-mute">{label}</div>
                {d ? (
                  <>
                    <div className="text-2xl font-semibold tabular">{fmtKg(d.latest.value)} <span className="text-sm font-normal text-mute">{unit}</span></div>
                    <div className="text-xs text-mute">
                      {d.change !== null ? `${d.change > 0 ? '+' : ''}${d.change.toFixed(1)} ${unit} in 7+ days` : 'Need a week of entries for a trend'}
                    </div>
                    <div className="text-xs text-mute">Manual, {fmtDate(d.latest.measuredAt, { day: 'numeric', month: 'short' })}</div>
                  </>
                ) : (
                  <div className="text-sm text-mute">No entries yet</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
