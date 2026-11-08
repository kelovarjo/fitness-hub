import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db } from '../db';
import { EXERCISES, MUSCLE_LABEL, getExercise } from '../data/exercises';
import type { EquipmentId, Session, SessionBlock, SessionSlot, SetRecord } from '../types';
import { activeDurationMs, activeSlots, countBySlot, nextSet, restAfter, summarize } from '../logic/session';
import { parseSetEntry } from '../logic/parser';
import { FEELS, feelToRir, type Feel } from '../logic/effort';
import { detectPrs, type PrType } from '../logic/strength';
import type { Suggestion } from '../logic/progression';
import * as store from '../store';
import { Button, Sheet, confirmAction, cx, fmtDuration, fmtKg, go, useNow, useToast } from '../ui';

const PR_LABEL: Record<PrType, string> = { weight: 'weight PR', reps: 'rep PR', e1rm: 'strength PR' };

// ---------- Effort: plain words instead of "reps in reserve" ----------

// ---------- Device helpers ----------

let audioCtx: AudioContext | null = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch { /* audio unavailable */ }
}
function beep() {
  try {
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.25, audioCtx!.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + t + 0.2);
      o.connect(g).connect(audioCtx!.destination);
      o.start(audioCtx!.currentTime + t);
      o.stop(audioCtx!.currentTime + t + 0.2);
    });
  } catch { /* ignore */ }
  navigator.vibrate?.([200, 100, 200]);
}

function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try { lock = await navigator.wakeLock.request('screen'); } catch { /* not allowed */ }
    };
    const onVis = () => document.visibilityState === 'visible' && request();
    void request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}

const findSlot = (s: Session, id: string | null) => {
  for (const b of s.blocks) for (const slot of b.slots) if (slot.id === id) return { block: b, slot };
  return null;
};

// ---------- Screen ----------

export default function SessionScreen() {
  const session = useLiveQuery(async () => (await db.sessions.where('status').equals('active').first()) ?? null, [], 'loading' as const);
  const sessionId = session && session !== 'loading' ? session.id : null;
  const sets = useLiveQuery(
    async () => (sessionId ? (await db.sets.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.completedAt - b.completedAt) : []),
    [sessionId],
  );
  const [summaryId, setSummaryId] = useState<string | null>(null);
  useWakeLock(!!sessionId && session !== 'loading' && !!session && !session.pauseStartedAt);

  if (summaryId) return <SummaryView sessionId={summaryId} onClose={() => { setSummaryId(null); go('/today'); }} />;
  if (session === 'loading' || (session && sets === undefined)) return null;
  if (!session || !sets) {
    return (
      <div className="p-6 text-mute safe-top">
        <p className="mt-10 text-center">No workout in progress.</p>
        <Button variant="primary" className="mt-6 w-full" onClick={() => go('/train')}>Choose a workout</Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => go('/today')}>Back to Today</Button>
      </div>
    );
  }
  return <ActiveSession session={session} sets={sets} onFinished={setSummaryId} />;
}

function ActiveSession({ session, sets, onFinished }: { session: Session; sets: SetRecord[]; onFinished: (id: string) => void }) {
  const toast = useToast();
  const now = useNow(500);
  const cursor = nextSet(session, sets);
  const [focus, setFocus] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'menu' | 'plan' | 'swap' | 'add' | 'tips' | 'type'>(null);
  const beepedFor = useRef<number | undefined>(undefined);

  const focusValid = focus && findSlot(session, focus) && !findSlot(session, focus)!.slot.skipped
    && (countBySlot(sets).get(focus) ?? 0) < findSlot(session, focus)!.slot.sets;
  const currentId = focusValid ? focus : cursor?.slotId ?? null;
  const current = findSlot(session, currentId);
  const paused = !!session.pauseStartedAt;
  const restLeft = session.restEndsAt ? session.restEndsAt - now : 0;
  const resting = restLeft > 0 && !paused;
  const totalSets = session.blocks.flatMap(activeSlots).reduce((a, s) => a + s.sets, 0);
  const doneSets = sets.length;

  useEffect(() => {
    if (session.restEndsAt && restLeft <= 0 && beepedFor.current !== session.restEndsAt && document.visibilityState === 'visible') {
      beepedFor.current = session.restEndsAt;
      beep();
    }
  }, [restLeft, session.restEndsAt]);

  const finish = async () => {
    if (!confirmAction(cursor ? 'Some sets are not logged. Finish anyway?' : 'Finish this workout?')) return;
    await store.finishSession(session.id);
    onFinished(session.id);
  };
  const discard = async () => {
    if (!confirmAction('Discard this workout and all its sets?')) return;
    await store.discardSession(session.id);
    go('/today');
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* Top bar: minimal */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur safe-top">
        <div className="flex min-h-14 items-center gap-1 px-2">
          <a href="#/today" className="flex min-h-12 min-w-12 items-center justify-center text-2xl text-mute" aria-label="Leave workout screen">‹</a>
          <div className="flex-1 text-center">
            <div className="text-sm font-semibold">{session.templateName}</div>
            <div className={cx('text-xs tabular', paused ? 'text-warn' : 'text-mute')}>{paused ? 'Paused · ' : ''}{fmtDuration(activeDurationMs(session, now))}</div>
          </div>
          <button className="min-h-12 min-w-12 text-sm text-mute" onClick={() => setSheet('plan')} aria-label="Workout plan">Plan</button>
          <button className="min-h-12 min-w-12 text-2xl text-mute" onClick={() => setSheet('menu')} aria-label="More options">⋯</button>
        </div>
        <div className="h-1 bg-panel2"><div className="h-full bg-accent transition-all" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} /></div>
      </header>

      {paused ? (
        <CenterCard title="Paused">
          <Button variant="primary" className="h-16 w-full text-lg" onClick={() => store.resumeSession(session.id)}>Resume</Button>
        </CenterCard>
      ) : resting ? (
        <RestView session={session} sets={sets} restLeft={restLeft} />
      ) : current ? (
        <FocusCard
          key={current.slot.id}
          session={session}
          block={current.block}
          slot={current.slot}
          sets={sets}
          onSwap={() => setSheet('swap')}
          onLogged={(r) => {
            setFocus(null);
            unlockAudio();
            if (r.prs.length) toast({ text: `New ${r.prs.map((p) => PR_LABEL[p]).join(' and ')}`, tone: 'good' }, 3000);
          }}
          toastUndo={(set) => toast({ text: `Logged ${fmtKg(set.weightKg)} × ${set.reps}`, action: { label: 'Undo', run: () => void store.deleteSet(set.id) } }, 4000)}
        />
      ) : (
        <CenterCard title="All sets done">
          <p className="mb-6 text-center text-mute">{doneSets} sets in {Math.round(activeDurationMs(session, now) / 60000)} minutes.</p>
          <Button variant="primary" className="h-16 w-full text-lg" onClick={finish}>Finish workout</Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setSheet('add')}>Add an exercise</Button>
        </CenterCard>
      )}

      {/* Sheets */}
      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Options">
        <div className="grid gap-2">
          {current && <Button className="w-full" onClick={() => setSheet('swap')}>Swap exercise</Button>}
          {current && <Button className="w-full" onClick={async () => { await store.setSkipped(session.id, current.slot.id, true); setSheet(null); }}>Skip this exercise</Button>}
          {current && (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => store.changeSetCount(session.id, current.slot.id, -1)}>One set fewer</Button>
              <Button onClick={() => store.changeSetCount(session.id, current.slot.id, 1)}>One more set</Button>
            </div>
          )}
          {current && <Button className="w-full" onClick={() => setSheet('tips')}>How to do it</Button>}
          {current && <Button className="w-full" onClick={() => setSheet('type')}>Type or dictate a set</Button>}
          <Button className="w-full" onClick={() => setSheet('add')}>Add an exercise</Button>
          <Button className="w-full" onClick={async () => { await (paused ? store.resumeSession(session.id) : store.pauseSession(session.id)); setSheet(null); }}>{paused ? 'Resume' : 'Pause'}</Button>
          <Button variant="primary" className="w-full" onClick={() => { setSheet(null); void finish(); }}>Finish workout</Button>
          <Button variant="danger" className="w-full" onClick={() => { setSheet(null); void discard(); }}>Discard workout</Button>
        </div>
      </Sheet>

      {sheet === 'plan' && (
        <PlanSheet session={session} sets={sets} currentId={currentId} onClose={() => setSheet(null)}
          onJump={(id) => { setFocus(id); void store.clearRest(session.id); setSheet(null); }} onAdd={() => setSheet('add')} />
      )}
      {sheet === 'swap' && current && <SwapSheet session={session} slotId={current.slot.id} onClose={() => setSheet(null)} />}
      {sheet === 'tips' && current && <TipsSheet exerciseId={current.slot.exerciseId} onClose={() => setSheet(null)} />}
      {sheet === 'type' && current && <TypeSheet session={session} slot={current.slot} onClose={() => setSheet(null)} />}
      <AddExerciseSheet open={sheet === 'add'} onClose={() => setSheet(null)} onPick={async (id) => { await store.addExercise(session.id, id); setSheet(null); }} />
    </div>
  );
}

function CenterCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col justify-center px-6 pb-24">
      <h2 className="mb-6 text-center text-3xl font-bold">{title}</h2>
      {children}
    </main>
  );
}

// ---------- Rest: full screen, shows what is next ----------

function RestView({ session, sets, restLeft }: { session: Session; sets: SetRecord[]; restLeft: number }) {
  const next = nextSet(session, sets);
  const nextSlot = findSlot(session, next?.slotId ?? null);
  const pct = Math.min(100, (restLeft / ((session.restTotalSec ?? 1) * 1000)) * 100);
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 pb-10" role="timer" aria-label="Rest timer">
      <div className="text-sm uppercase tracking-widest text-accent">Rest</div>
      <div className="my-2 text-8xl font-bold tabular">{fmtDuration(restLeft)}</div>
      <div className="mb-8 h-2 w-full max-w-xs overflow-hidden rounded-full bg-panel2"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
      {nextSlot && (
        <div className="mb-8 text-center">
          <div className="text-sm text-mute">Next</div>
          <div className="text-xl font-semibold">{getExercise(nextSlot.slot.exerciseId).name}</div>
          <div className="text-sm text-mute">Set {(next?.setIndex ?? 0) + 1} of {nextSlot.slot.sets}</div>
        </div>
      )}
      <div className="grid w-full max-w-xs grid-cols-2 gap-3">
        <Button className="h-14" onClick={() => store.extendRest(session.id, 30)}>+30 s</Button>
        <Button variant="primary" className="h-14" onClick={() => store.clearRest(session.id)}>Start set</Button>
      </div>
    </main>
  );
}

// ---------- The one exercise on screen ----------

function BigNumber({ label, value, onChange, step, max = 500, testId }: {
  label: string; value: number | null; onChange: (v: number) => void; step: number; max?: number; testId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const clamp = (v: number) => Math.min(max, Math.max(0, Math.round(v * 100) / 100));
  return (
    <div className="flex-1 rounded-3xl bg-panel p-3" data-testid={testId}>
      <div className="text-center text-xs uppercase tracking-widest text-mute">{label}</div>
      {editing ? (
        <input autoFocus inputMode="decimal" aria-label={label} value={draft}
          className="h-20 w-full bg-transparent text-center text-6xl font-bold tabular outline-none"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { const v = parseFloat(draft.replace(',', '.')); if (!Number.isNaN(v)) onChange(clamp(v)); setEditing(false); }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      ) : (
        <button aria-label={`Type ${label}`} className="h-20 w-full text-center text-6xl font-bold tabular"
          onClick={() => { setDraft(value === null ? '' : String(value)); setEditing(true); }}>
          {value === null ? <span className="text-2xl font-semibold text-accent">Enter</span> : fmtKg(value)}
        </button>
      )}
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button aria-label={`Less ${label}`} className="h-14 rounded-2xl bg-panel2 text-3xl active:bg-line" onClick={() => onChange(clamp((value ?? 0) - step))}>−</button>
        <button aria-label={`More ${label}`} className="h-14 rounded-2xl bg-panel2 text-3xl active:bg-line" onClick={() => onChange(clamp((value ?? 0) + step))}>+</button>
      </div>
    </div>
  );
}

function FocusCard({ session, block, slot, sets, onSwap, onLogged, toastUndo }: {
  session: Session; block: SessionBlock; slot: SessionSlot; sets: SetRecord[];
  onSwap: () => void; onLogged: (r: store.LogResult) => void; toastUndo: (s: SetRecord) => void;
}) {
  const ex = getExercise(slot.exerciseId);
  const equipment = useLiveQuery(() => store.equipmentMap(), []);
  const slotSets = sets.filter((s) => s.slotId === slot.id);
  const setIndex = slotSets.length;
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [lastTime, setLastTime] = useState<string | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number>(slot.repMax);
  const [feel, setFeel] = useState<Feel>('good');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<SetRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await store.suggestionFor(slot, session.id);
      const hist = await store.exerciseHistory(slot.exerciseId, { excludeSessionId: session.id, limit: 1 });
      if (cancelled) return;
      setSug(s);
      setLastTime(hist[0]?.length ? `${fmtKg(hist[0][0].weightKg)} kg × ${hist[0].map((x) => x.reps).join(', ')}` : null);
    })();
    return () => { cancelled = true; };
  }, [slot.exerciseId, slot.repMin, slot.repMax, slot.rirMin, slot.sets, slot.finisher, session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill: last set today, else today's suggestion, else blank weight.
  useEffect(() => {
    const prev = slotSets.at(-1);
    const t = sug?.targets?.[Math.min(setIndex, (sug.targets.length || 1) - 1)];
    const bodyweightLike = ex.loadType === 'bodyweight' || ex.loadType === 'timed';
    if (prev) {
      setWeight(prev.weightKg);
      setReps(t && t.weightKg === prev.weightKg && !slot.finisher ? t.reps : prev.reps);
    } else if (t) {
      setWeight(t.weightKg);
      setReps(t.reps);
    } else {
      setWeight(bodyweightLike ? 0 : null);
      setReps(slot.finisher ? slot.repMin : slot.repMax);
    }
    setFeel('good');
  }, [sug?.reason, sug?.kind, setIndex, slot.exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = equipment ? store.stepFor(ex, equipment) : 2.5;
  const live = activeSlots(block);
  const isSuperset = live.length > 1;
  const after = restAfter(session, slot.id, [...sets, { slotId: slot.id }]);
  const nextInRound = isSuperset && after === 0 ? findSlot(session, nextSet(session, [...sets, { slotId: slot.id } as SetRecord])?.slotId ?? null) : null;
  const weightLabel = ex.loadType === 'assisted' ? 'assist kg' : ex.loadType === 'bodyweight' ? 'added kg' : ex.loadType === 'dumbbell' ? 'kg each' : 'kg';
  const target = slot.finisher ? 'as many as you can, stop 1 short' : ex.loadType === 'timed' ? `${slot.repMin}–${slot.repMax} s` : `${slot.repMin}–${slot.repMax} reps`;
  const change = sug && (sug.kind === 'increase' || sug.kind === 'reduce') && setIndex === 0 ? sug : null;

  const log = async () => {
    if (weight === null || busy) return;
    setBusy(true);
    try {
      const r = await store.logSet(session.id, slot.id, { weightKg: weight, reps, rir: feelToRir(feel, slot) });
      toastUndo(r.set);
      onLogged(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <main className="flex-1 px-4 pb-36 pt-4">
        <div className="mb-1 flex items-center justify-between text-sm text-mute">
          <span>{isSuperset ? `Superset ${block.label} · ${live.findIndex((s) => s.id === slot.id) + 1} of ${live.length}` : block.anchor ? 'Main lift' : ' '}</span>
          <button onClick={onSwap} className="min-h-11 rounded-full border border-line px-4 text-sm font-medium text-ink active:bg-panel2">Busy? Swap</button>
        </div>
        <h1 className="text-3xl font-bold leading-tight">{ex.name}</h1>
        <div className="mt-1 text-lg">
          Set <b>{setIndex + 1}</b> of {slot.sets} <span className="text-mute">· {target}</span>
        </div>
        {lastTime && <div className="text-sm text-mute">Last time {lastTime}</div>}
        {change && (
          <div className={cx('mt-2 inline-block rounded-lg px-3 py-1 text-sm font-medium', change.kind === 'increase' ? 'bg-good/15 text-good' : 'bg-warn/15 text-warn')}>
            {change.kind === 'increase' ? 'Weight up today' : 'Weight down today'}: {fmtKg(change.targets![0].weightKg)} kg
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <BigNumber label={weightLabel} value={weight} onChange={setWeight} step={step} testId="weight" />
          <BigNumber label={ex.loadType === 'timed' ? 'seconds' : 'reps'} value={reps} onChange={(v) => setReps(Math.max(1, Math.round(v)))} step={1} max={300} testId="reps" />
        </div>

        {!slot.finisher && (
          <div className="mt-4">
            <div className="mb-1.5 text-center text-xs uppercase tracking-widest text-mute">How did it feel?</div>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How did it feel">
              {FEELS.map((f) => (
                <button key={f.id} role="radio" aria-checked={feel === f.id} onClick={() => setFeel(f.id)}
                  className={cx('rounded-2xl border py-2', feel === f.id ? 'border-accent bg-accent/15 text-ink' : 'border-line text-mute')}>
                  <div className="font-semibold">{f.label}</div>
                  <div className="text-xs">{f.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {slotSets.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {slotSets.map((s, i) => (
              <button key={s.id} onClick={() => setEditing(s)} className="rounded-full bg-panel px-3 py-1.5 text-sm tabular text-mute" aria-label={`Edit set ${i + 1}`}>
                ✓ {fmtKg(s.weightKg)}×{s.reps}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Thumb zone */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-bg via-bg to-bg/0 px-4 pt-6 safe-bottom">
        <div className="mx-auto max-w-lg pb-3">
          {nextInRound && <div className="mb-2 text-center text-sm text-mute">Then straight to {getExercise(nextInRound.slot.exerciseId).name}</div>}
          <Button variant="primary" className="h-20 w-full rounded-3xl text-2xl" onClick={log} disabled={weight === null || busy}>
            {weight === null ? 'Enter a weight' : 'Done'}
          </Button>
        </div>
      </div>

      {editing && <EditSetSheet set={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---------- Sheets ----------

function EditSetSheet({ set, onClose }: { set: SetRecord; onClose: () => void }) {
  const [w, setW] = useState(set.weightKg);
  const [r, setR] = useState(set.reps);
  return (
    <Sheet open onClose={onClose} title="Edit set">
      <div className="flex gap-3">
        <BigNumber label="kg" value={w} onChange={setW} step={2.5} testId="edit-weight" />
        <BigNumber label="reps" value={r} onChange={(v) => setR(Math.max(1, Math.round(v)))} step={1} max={300} testId="edit-reps" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="danger" onClick={async () => { await store.deleteSet(set.id); onClose(); }}>Delete set</Button>
        <Button variant="primary" onClick={async () => { await store.updateSet(set.id, { weightKg: w, reps: r }); onClose(); }}>Save</Button>
      </div>
    </Sheet>
  );
}

function PlanSheet({ session, sets, currentId, onClose, onJump, onAdd }: {
  session: Session; sets: SetRecord[]; currentId: string | null; onClose: () => void; onJump: (id: string) => void; onAdd: () => void;
}) {
  const done = countBySlot(sets);
  return (
    <Sheet open onClose={onClose} title="Workout plan">
      <p className="mb-3 text-sm text-mute">Tap an exercise to do it now. Arrows change the order.</p>
      <ol className="space-y-2">
        {session.blocks.map((b, i) => (
          <li key={b.id} className="rounded-2xl bg-panel2 p-2">
            <div className="flex items-center justify-between px-2 text-xs uppercase tracking-wide text-mute">
              <span>{b.anchor ? 'Main lift' : activeSlots(b).length > 1 ? `Superset ${b.label}` : b.label}</span>
              <span className="flex">
                <button aria-label="Move up" disabled={i === 0} className="min-h-10 min-w-10 text-base disabled:opacity-20" onClick={() => store.moveBlock(session.id, b.id, -1)}>↑</button>
                <button aria-label="Move down" disabled={i === session.blocks.length - 1} className="min-h-10 min-w-10 text-base disabled:opacity-20" onClick={() => store.moveBlock(session.id, b.id, 1)}>↓</button>
              </span>
            </div>
            {b.slots.map((s) => {
              const n = done.get(s.id) ?? 0;
              const complete = n >= s.sets;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <button disabled={s.skipped || complete} onClick={() => onJump(s.id)}
                    className={cx('flex min-h-12 flex-1 items-center justify-between rounded-xl px-2 text-left', s.id === currentId && 'bg-accent/15', (s.skipped || complete) && 'opacity-50')}>
                    <span>{complete ? '✓ ' : ''}{getExercise(s.exerciseId).name}</span>
                    <span className="tabular text-sm text-mute">{s.skipped ? 'skipped' : `${n}/${s.sets}`}</span>
                  </button>
                  {!complete && (
                    <button className="min-h-12 px-2 text-xs text-mute" onClick={() => store.setSkipped(session.id, s.id, !s.skipped)}>{s.skipped ? 'Undo' : 'Skip'}</button>
                  )}
                </div>
              );
            })}
          </li>
        ))}
      </ol>
      <Button className="mt-3 w-full" onClick={onAdd}>Add an exercise</Button>
    </Sheet>
  );
}

function TipsSheet({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const ex = getExercise(exerciseId);
  return (
    <Sheet open onClose={onClose} title={ex.name}>
      <div className="mb-2 text-sm text-mute">{ex.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</div>
      <ul className="list-disc space-y-1 pl-5">{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>
      <p className="mt-3 text-xs text-mute">Tips are AI drafts until you mark the exercise reviewed.</p>
    </Sheet>
  );
}

function TypeSheet({ session, slot, onClose }: { session: Session; slot: SessionSlot; onClose: () => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const parsed = text.trim() ? parseSetEntry(text) : null;
  return (
    <Sheet open onClose={onClose} title="Type or dictate a set">
      <p className="mb-2 text-sm text-mute">Tap the box, then the microphone on the keyboard. Say for example "32 kilograms for 10 reps".</p>
      <input autoFocus value={text} onChange={(e) => { setText(e.target.value); setMsg(null); }} aria-label="Set as text"
        className="min-h-14 w-full rounded-xl border border-line bg-panel2 px-3 text-lg" placeholder="32 for 10" />
      <div className="mt-2 min-h-6 text-sm">{text.trim() && (parsed ? `${parsed.weightKg !== null ? `${fmtKg(parsed.weightKg)} kg × ` : ''}${parsed.reps} reps` : 'Not understood yet')}</div>
      {msg && <div className="text-sm text-good">{msg}</div>}
      <Button variant="primary" className="mt-2 h-14 w-full" disabled={!parsed || parsed.weightKg === null} onClick={async () => {
        if (!parsed || parsed.weightKg === null) return;
        await store.logSet(session.id, slot.id, { weightKg: parsed.weightKg, reps: parsed.reps, rir: parsed.rir ?? feelToRir('good', slot) });
        onClose();
      }}>Log this set</Button>
    </Sheet>
  );
}

function SwapSheet({ session, slotId, onClose }: { session: Session; slotId: string; onClose: () => void }) {
  const slot = session.blocks.flatMap((b) => b.slots).find((s) => s.id === slotId)!;
  const ex = getExercise(slot.exerciseId);
  const equipment = useLiveQuery(() => db.equipment.toArray(), []);
  const [options, setOptions] = useState<store.SwapOption[] | null>(null);
  const occupiedKey = equipment?.map((e) => `${e.id}:${e.occupiedUntil ?? 0}`).join('|');
  const exId = slot.exerciseId;
  useEffect(() => {
    let cancelled = false;
    store.swapOptions(session, slotId).then((o) => !cancelled && setOptions(o.slice(0, 5)));
    return () => { cancelled = true; };
  }, [exId, slotId, occupiedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const exEquip = useMemo(() => {
    const ids = ex.equipment.flatMap((r) => (Array.isArray(r) ? r : [r])).filter((id) => id !== 'bench' && id !== 'rack');
    return [...new Set(ids)] as EquipmentId[];
  }, [ex]);
  const now = Date.now();

  return (
    <Sheet open onClose={onClose} title={`Instead of ${ex.name}`}>
      {exEquip.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {exEquip.map((id) => {
            const e = equipment?.find((x) => x.id === id);
            const busy = !!e?.occupiedUntil && e.occupiedUntil > now;
            return (
              <button key={id} onClick={() => (busy ? store.clearOccupied(id) : store.markOccupied(id))}
                className={cx('min-h-11 rounded-full border px-4 text-sm', busy ? 'border-warn bg-warn/15 text-warn' : 'border-line text-mute')}>
                {busy ? `${e?.name ?? id} is busy ✓` : `Mark ${e?.name ?? id} busy`}
              </button>
            );
          })}
        </div>
      )}
      {!options ? <div className="text-mute">Finding options…</div> : options.length === 0 ? (
        <div className="text-mute">No good alternative with free equipment.</div>
      ) : (
        <ul className="space-y-2">
          {options.map((o, i) => (
            <li key={o.exercise.id}>
              <button className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl bg-panel2 px-4 text-left active:bg-line"
                onClick={async () => { await store.swapExercise(session.id, slotId, o.exercise.id); onClose(); }}>
                <span>
                  <span className="block font-semibold">{o.exercise.name}{i === 0 && <span className="ml-2 text-xs font-medium text-good">Best match</span>}</span>
                  <span className="text-sm text-mute">{o.startWeight !== null ? `Start ${fmtKg(o.startWeight)} kg${o.startNote.startsWith('Rough') ? ' (estimate)' : ''}` : 'New: pick a weight'}</span>
                </span>
                <span className="text-xl text-mute">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function AddExerciseSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const list = EXERCISES.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) || e.primary.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(q.toLowerCase())));
  return (
    <Sheet open={open} onClose={onClose} title="Add an exercise">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or muscle" aria-label="Search exercises"
        className="mb-3 min-h-12 w-full rounded-xl border border-line bg-panel2 px-3" />
      <ul className="space-y-1">
        {list.map((e) => (
          <li key={e.id}>
            <button className="min-h-12 w-full rounded-lg px-2 text-left active:bg-panel2" onClick={() => onPick(e.id)}>
              {e.name} <span className="text-sm text-mute">· {e.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

// ---------- Summary ----------

export function SummaryView({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return null;
    const sets = (await db.sets.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.completedAt - b.completedAt);
    const prs: string[] = [];
    for (const s of sets) {
      const prev = (await db.sets.where('exerciseId').equals(s.exerciseId).toArray()).filter((x) => x.completedAt < s.completedAt && x.sessionId !== sessionId);
      const found = detectPrs(prev, s, getExercise(s.exerciseId).loadType);
      if (found.length) prs.push(`${getExercise(s.exerciseId).name} ${fmtKg(s.weightKg)} × ${s.reps}`);
    }
    const changes: string[] = [];
    for (const slot of session.blocks.flatMap((b) => b.slots)) {
      const mine = sets.filter((s) => s.slotId === slot.id);
      if (!mine.length) continue;
      const sug = await store.suggestionFor(slot, 'none');
      const today = Math.max(...mine.map((s) => s.weightKg));
      const nextW = sug.targets?.[0]?.weightKg;
      if (nextW !== undefined && nextW !== today) changes.push(`${getExercise(slot.exerciseId).name}: ${fmtKg(today)} → ${fmtKg(nextW)} kg`);
    }
    return { session, sets, prs: [...new Set(prs)], changes, summary: summarize(session, sets) };
  }, [sessionId]);
  if (!data) return null;
  const { summary, prs, changes } = data;
  return (
    <div className="px-4 pb-10 safe-top">
      <h1 className="mb-6 mt-10 text-center text-3xl font-bold">Workout done</h1>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['minutes', summary.durationMin], ['sets', summary.setCount], ['reps', summary.totalReps]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-panel p-4"><div className="text-3xl font-bold tabular">{v}</div><div className="text-sm text-mute">{k}</div></div>
        ))}
      </div>
      {prs.length > 0 && (
        <div className="mt-4 rounded-2xl border border-good/50 bg-good/10 p-4">
          <div className="mb-1 font-semibold text-good">New records</div>
          {prs.map((p) => <div key={p} className="text-sm">{p}</div>)}
        </div>
      )}
      {changes.length > 0 && (
        <div className="mt-4 rounded-2xl bg-panel p-4">
          <div className="mb-1 font-semibold">Next time</div>
          {changes.map((c) => <div key={c} className="text-sm">{c}</div>)}
        </div>
      )}
      <Button variant="primary" className="mt-8 h-16 w-full text-lg" onClick={onClose}>Done</Button>
    </div>
  );
}
