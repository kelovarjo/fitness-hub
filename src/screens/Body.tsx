import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import type { BodyMetric, BodyMetricId } from '../types';
import * as store from '../store';
import { Button, Card, Header, Stepper, confirmAction, cx, fmtDate, fmtKg, useToast } from '../ui';

// Neutral starting values for the stepper only. Personal data is never stored in code.
export const METRICS: { id: BodyMetricId; label: string; unit: string; step: number; start: number; guide: string }[] = [
  { id: 'weight', label: 'Weight', unit: 'kg', step: 0.1, start: 80, guide: 'Morning, after the toilet, before food or drink. Same scale, same spot on the floor.' },
  { id: 'waist', label: 'Waist', unit: 'cm', step: 0.5, start: 90, guide: 'At the navel, standing relaxed, after a normal breath out. Tape level and snug, not pressing in. Do not suck in.' },
  { id: 'chest', label: 'Chest', unit: 'cm', step: 0.5, start: 100, guide: 'Around the nipple line, arms relaxed at your sides, after a normal breath out. Tape level across the back.' },
  { id: 'shoulders', label: 'Shoulders', unit: 'cm', step: 0.5, start: 115, guide: 'Around the widest point of the deltoids, arms relaxed at your sides, tape level. Easier with a helper or a mirror.' },
  { id: 'arm_flexed', label: 'Arm flexed', unit: 'cm', step: 0.5, start: 35, guide: 'Right arm, elbow at 90 degrees, biceps fully flexed. Widest point.' },
  { id: 'arm_relaxed', label: 'Arm relaxed', unit: 'cm', step: 0.5, start: 32, guide: 'Right arm hanging relaxed, midway between shoulder and elbow.' },
  { id: 'thigh', label: 'Thigh', unit: 'cm', step: 0.5, start: 55, guide: 'Right leg, midway between hip crease and knee, standing with weight on both legs.' },
  { id: 'calf', label: 'Calf', unit: 'cm', step: 0.5, start: 38, guide: 'Right leg, widest point, standing.' },
  { id: 'body_fat', label: 'Body fat', unit: '%', step: 0.1, start: 20, guide: 'Smart scale estimates are approximate and move with hydration. Use only as a rough trend; waist and weight drive decisions.' },
];

const RANGES = [{ d: 30, l: '30d' }, { d: 90, l: '90d' }, { d: 180, l: '180d' }, { d: 365, l: '1y' }, { d: 0, l: 'All' }];

function toLocalInput(ts: number) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

/** 7-day trailing average for each point (by date, not by count). */
export function trailingAverage(points: { t: number; v: number }[], days = 7) {
  return points.map((p) => {
    const win = points.filter((q) => q.t <= p.t && q.t > p.t - days * 86400000);
    return { t: p.t, v: win.reduce((a, q) => a + q.v, 0) / win.length };
  });
}

function TrendChart({ rows, unit, smooth }: { rows: BodyMetric[]; unit: string; smooth: boolean }) {
  if (rows.length < 2) return <p className="py-6 text-center text-sm text-mute">Add at least two entries to see a trend.</p>;
  const pts = rows.map((r) => ({ t: r.measuredAt, v: r.value })).sort((a, b) => a.t - b.t);
  const avg = smooth ? trailingAverage(pts) : null;
  const W = 340, H = 180, L = 40, R = 10, T = 10, B = 24;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = Math.max(0.5, (hi - lo) * 0.15);
  lo -= pad; hi += pad;
  const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const line = (arr: { t: number; v: number }[]) => arr.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Trend from ${fmtKg(pts[0].v)} to ${fmtKg(pts[pts.length - 1].v)} ${unit}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#2a313a" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#9aa4b2">{v.toFixed(1)}</text>
        </g>
      ))}
      <text x={L} y={H - 6} fontSize="10" fill="#9aa4b2">{fmtDate(t0, { day: 'numeric', month: 'short' })}</text>
      <text x={W - R} y={H - 6} fontSize="10" fill="#9aa4b2" textAnchor="end">{fmtDate(t1, { day: 'numeric', month: 'short' })}</text>
      {!avg && <path d={line(pts)} fill="none" stroke="#ff7a1a" strokeWidth="2" />}
      {avg && <path d={line(avg)} fill="none" stroke="#ff7a1a" strokeWidth="2.5" />}
      {pts.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r={avg ? 2.5 : 3} fill={avg ? '#9aa4b2' : '#ff7a1a'} />)}
    </svg>
  );
}

export default function Body() {
  const toast = useToast();
  const [metric, setMetric] = useState<BodyMetricId>('weight');
  const [range, setRange] = useState(90);
  const def = METRICS.find((m) => m.id === metric)!;
  const all = useLiveQuery(() => db.bodyMetrics.where('metric').equals(metric).toArray(), [metric]);
  const sorted = [...(all ?? [])].sort((a, b) => b.measuredAt - a.measuredAt);
  const [value, setValue] = useState<number | null>(null);
  const [when, setWhen] = useState(() => toLocalInput(Date.now()));
  const [showGuide, setShowGuide] = useState(false);
  const shown = range ? sorted.filter((r) => r.measuredAt >= Date.now() - range * 86400000) : sorted;
  const current = value ?? sorted[0]?.value ?? def.start;

  const save = async () => {
    const ts = new Date(when).getTime();
    if (Number.isNaN(ts)) return;
    await store.addBodyMetric(metric, current, ts);
    setValue(null);
    setWhen(toLocalInput(Date.now()));
    toast({ text: `Saved ${def.label.toLowerCase()} ${fmtKg(current)} ${def.unit}`, tone: 'good' });
  };

  return (
    <>
      <Header title="Measurements" />
      <div className="space-y-4 p-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
          {METRICS.map((m) => (
            <button key={m.id} role="tab" aria-selected={metric === m.id} onClick={() => { setMetric(m.id); setValue(null); }}
              className={cx('min-h-11 shrink-0 rounded-full border px-4 text-sm', metric === m.id ? 'border-accent bg-accent text-black font-semibold' : 'border-line text-mute')}>
              {m.label}
            </button>
          ))}
        </div>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Log {def.label.toLowerCase()}</h2>
            <button className="min-h-10 text-sm text-accent" onClick={() => setShowGuide(!showGuide)}>{showGuide ? 'Hide' : 'How to measure'}</button>
          </div>
          {showGuide && <p className="mb-3 rounded-xl bg-panel2 p-3 text-sm text-mute">{def.guide}</p>}
          <Stepper label={def.unit} value={current} onChange={setValue} step={def.step} max={400} decimals={1} />
          <label className="mt-3 block text-sm text-mute">When
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-line bg-panel2 px-3 text-ink" />
          </label>
          <Button variant="primary" className="mt-3 w-full" onClick={save}>Save</Button>
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{def.label} trend</h2>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button key={r.l} onClick={() => setRange(r.d)} className={cx('min-h-9 rounded-lg px-2 text-xs', range === r.d ? 'bg-panel2 text-ink' : 'text-mute')}>{r.l}</button>
              ))}
            </div>
          </div>
          <TrendChart rows={shown} unit={def.unit} smooth={metric === 'weight' && shown.length >= 5} />
          {metric === 'weight' && shown.length >= 5 && <p className="text-xs text-mute">Line = 7-day average. Dots = individual weigh-ins.</p>}
          {metric === 'body_fat' && <p className="text-xs text-warn">Approximate: smart scale estimate.</p>}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Entries</h2>
          {!sorted.length && <p className="text-sm text-mute">None yet. Source for all entries: manual.</p>}
          <ul className="divide-y divide-line">
            {sorted.slice(0, 30).map((r) => (
              <li key={r.id} className="flex min-h-12 items-center justify-between gap-2">
                <span className="text-sm text-mute">{fmtDate(r.measuredAt, { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}</span>
                <span className="tabular">{fmtKg(r.value)} {def.unit}</span>
                <button className="min-h-10 px-2 text-sm text-mute" aria-label="Delete entry"
                  onClick={async () => { if (confirmAction('Delete this entry?')) await store.deleteBodyMetric(r.id); }}>✕</button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
