import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db';
import { EXERCISES, MUSCLE_LABEL, getExercise } from '../data/exercises';
import type { EquipmentId, Session, SessionBlock, SessionSlot, SetRecord } from '../types';
import { activeDurationMs, activeSlots, countBySlot, nextSet, summarize } from '../logic/session';
import { parseSetEntry } from '../logic/parser';
import { detectPrs, e1rm, type PrType } from '../logic/strength';
import type { Suggestion } from '../logic/progression';
import * as store from '../store';
import { Badge, Button, Header, Sheet, Stepper, confirmAction, cx, fmtDuration, fmtKg, go, useNow, useToast } from '../ui';
import { blockKind } from './Train';

const PR_LABEL: Record<PrType, string> = { weight: 'weight PR', reps: 'rep PR', e1rm: 'estimated 1RM PR' };

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
  if (session === 'loading' || (session && sets === undefined)) return <Header title="Session" back="#/today" />;
  if (!session || !sets) {
    return (
      <>
        <Header title="Session" back="#/today" />
        <div className="p-4 text-mute">No session in progress.
          <div className="mt-4"><Button variant="primary" onClick={() => go('/train')}>Choose a session</Button></div>
        </div>
      </>
    );
  }
  return <ActiveSession session={session} sets={sets} onFinished={setSummaryId} />;
}

function ActiveSession({ session, sets, onFinished }: { session: Session; sets: SetRecord[]; onFinished: (id: string) => void }) {
  const toast = useToast();
  const now = useNow(500);
  const cursor = nextSet(session, sets);
  const [focus, setFocus] = useState<string | null>(null);
  const [swapSlot, setSwapSlot] = useState<string | null>(null);
  const [menuSlot, setMenuSlot] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const beepedFor = useRef<number | undefined>(undefined);

  const focusedSlotId = focus && session.blocks.some((b) => b.slots.some((s) => s.id === focus && !s.skipped)) ? focus : cursor?.slotId ?? null;
  const done = countBySlot(sets);
  const paused = !!session.pauseStartedAt;
  const elapsed = activeDurationMs(session, now);
  const restLeft = session.restEndsAt ? session.restEndsAt - now : 0;
  const longOpen = now - session.startedAt > 4 * 3600000;

  useEffect(() => {
    if (session.restEndsAt && restLeft <= 0 && beepedFor.current !== session.restEndsAt && document.visibilityState === 'visible') {
      beepedFor.current = session.restEndsAt;
      beep();
    }
  }, [restLeft, session.restEndsAt]);

  const onLogged = useCallback((r: store.LogResult) => {
    setFocus(null);
    toast({ text: `Logged ${fmtKg(r.set.weightKg)} kg × ${r.set.reps}`, action: { label: 'Undo', run: () => void store.deleteSet(r.set.id) } }, 5000);
    if (r.prs.length) toast({ text: `New ${r.prs.map((p) => PR_LABEL[p]).join(', ')}`, tone: 'good' }, 5000);
  }, [toast]);

  const finish = async () => {
    const remaining = cursor ? 'Some sets are not logged. Finish anyway?' : 'Finish this session?';
    if (!confirmAction(remaining)) return;
    await store.finishSession(session.id);
    onFinished(session.id);
  };

  const discard = async () => {
    if (!confirmAction('Discard this session and all its sets? This cannot be undone.')) return;
    await store.discardSession(session.id);
    go('/today');
  };

  return (
    <>
      <Header
        title={session.templateName}
        back="#/today"
        right={<>
          <span className={cx('tabular text-sm', paused ? 'text-warn' : 'text-mute')} aria-label="Session time">{paused ? 'Paused ' : ''}{fmtDuration(elapsed)}</span>
          <button className="min-h-12 px-2 text-accent" onClick={() => setMenuOpen(true)} aria-label="Session menu">⋯</button>
        </>}
      />

      {restLeft > 0 && !paused && (
        <div className="sticky top-14 z-20 border-b border-accent/40 bg-[#2a1a0c] px-4 py-3" role="timer" aria-live="off">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-accent">Rest</div>
              <div className="text-4xl font-bold tabular">{fmtDuration(restLeft)}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => store.extendRest(session.id, 15)}>+15s</Button>
              <Button onClick={() => store.clearRest(session.id)}>Skip</Button>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-black/40">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, (restLeft / ((session.restTotalSec ?? 1) * 1000)) * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-3 p-4">
        {paused && (
          <div className="rounded-2xl border border-warn/50 bg-warn/10 p-4">
            <div className="mb-2 font-semibold text-warn">Paused</div>
            <Button variant="primary" className="w-full" onClick={() => store.resumeSession(session.id)}>Resume</Button>
          </div>
        )}
        {longOpen && (
          <div className="rounded-2xl border border-warn/50 bg-warn/10 p-4 text-sm">
            This session started over 4 hours ago. Finish it or discard it.
            <div className="mt-2 flex gap-2"><Button onClick={finish}>Finish</Button><Button variant="danger" onClick={discard}>Discard</Button></div>
          </div>
        )}

        {session.blocks.map((block, bi) => (
          <BlockCard
            key={block.id}
            session={session}
            block={block}
            index={bi}
            sets={sets}
            done={done}
            focusedSlotId={focusedSlotId}
            cursorSlotId={cursor?.slotId ?? null}
            onFocus={setFocus}
            onSwap={setSwapSlot}
            onMenu={setMenuSlot}
            onLogged={onLogged}
          />
        ))}

        {!cursor && session.blocks.length > 0 && (
          <div className="rounded-2xl border border-good/50 bg-good/10 p-4 text-center">
            <div className="mb-2 font-semibold text-good">All planned sets logged</div>
            <Button variant="primary" className="w-full" onClick={finish}>Finish session</Button>
          </div>
        )}

        <Button className="w-full" onClick={() => setAdding(true)}>+ Add exercise</Button>
        <Button variant="primary" className="w-full" onClick={finish}>Finish session</Button>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Session">
        <div className="space-y-2">
          {paused
            ? <Button className="w-full" onClick={() => { void store.resumeSession(session.id); setMenuOpen(false); }}>Resume</Button>
            : <Button className="w-full" onClick={() => { void store.pauseSession(session.id); setMenuOpen(false); }}>Pause</Button>}
          <Button className="w-full" onClick={() => { setMenuOpen(false); setAdding(true); }}>Add exercise</Button>
          <Button variant="primary" className="w-full" onClick={() => { setMenuOpen(false); void finish(); }}>Finish session</Button>
          <Button variant="danger" className="w-full" onClick={() => { setMenuOpen(false); void discard(); }}>Discard session</Button>
        </div>
      </Sheet>

      {swapSlot && <SwapSheet session={session} slotId={swapSlot} onClose={() => setSwapSlot(null)} />}
      {menuSlot && <SlotMenu session={session} slotId={menuSlot} onClose={() => setMenuSlot(null)} onSwap={() => { setSwapSlot(menuSlot); setMenuSlot(null); }} />}
      <AddExerciseSheet open={adding} onClose={() => setAdding(false)} onPick={async (id) => { await store.addExercise(session.id, id); setAdding(false); }} />
    </>
  );
}

// ---------- Block ----------

function BlockCard(props: {
  session: Session; block: SessionBlock; index: number; sets: SetRecord[]; done: Map<string, number>;
  focusedSlotId: string | null; cursorSlotId: string | null;
  onFocus: (id: string) => void; onSwap: (id: string) => void; onMenu: (id: string) => void; onLogged: (r: store.LogResult) => void;
}) {
  const { session, block, index, sets, done, focusedSlotId, cursorSlotId } = props;
  const live = activeSlots(block);
  const complete = live.every((s) => (done.get(s.id) ?? 0) >= s.sets);
  const kind = blockKind(live.length);
  const isLast = index === session.blocks.length - 1;
  return (
    <section className={cx('rounded-2xl border bg-panel', complete ? 'border-line opacity-70' : block.slots.some((s) => s.id === cursorSlotId) ? 'border-accent/60' : 'border-line')}
      aria-label={`Block ${block.label}`}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs uppercase tracking-wide text-mute">
        <span className="font-semibold text-ink">{block.label}</span>
        {kind && <Badge tone="accent">{kind}</Badge>}
        <span>rest {block.restSec}s</span>
        {complete && <span className="text-good">✓ done</span>}
        <span className="flex-1" />
        <button aria-label="Move block up" disabled={index === 0} className="min-h-10 min-w-10 text-base disabled:opacity-20" onClick={() => store.moveBlock(session.id, block.id, -1)}>↑</button>
        <button aria-label="Move block down" disabled={isLast} className="min-h-10 min-w-10 text-base disabled:opacity-20" onClick={() => store.moveBlock(session.id, block.id, 1)}>↓</button>
      </div>
      {block.slots.map((slot) => (
        <SlotRow key={slot.id} {...props} slot={slot} slotSets={sets.filter((s) => s.slotId === slot.id)} focused={slot.id === focusedSlotId} />
      ))}
    </section>
  );
}

function SlotRow(props: {
  session: Session; slot: SessionSlot; slotSets: SetRecord[]; focused: boolean;
  onFocus: (id: string) => void; onSwap: (id: string) => void; onMenu: (id: string) => void; onLogged: (r: store.LogResult) => void;
}) {
  const { session, slot, slotSets, focused } = props;
  const ex = getExercise(slot.exerciseId);
  const doneCount = slotSets.length;
  const totalReps = slotSets.reduce((a, s) => a + s.reps, 0);
  const target = slot.finisher ? 'max−1' : `${slot.repMin}–${slot.repMax}`;
  const showTotal = slot.repMax >= 20 && !slot.finisher;
  return (
    <div className={cx('border-b border-line/60 px-4 py-3 last:border-b-0', slot.skipped && 'opacity-40')}>
      <div className="flex items-start gap-2">
        <button className="flex-1 text-left" onClick={() => !slot.skipped && props.onFocus(slot.id)}>
          <div className="font-semibold leading-tight">{ex.name}</div>
          <div className="text-sm text-mute tabular">
            {doneCount}/{slot.sets} sets · {target} reps · RIR {slot.rirMin === slot.rirMax ? slot.rirMin : `${slot.rirMin}–${slot.rirMax}`}
            {showTotal && <> · {totalReps}/{slot.sets * slot.repMax} reps</>}
          </div>
          {slot.originalExerciseId && <div className="text-xs text-warn">Swapped from {getExercise(slot.originalExerciseId).name}</div>}
          {slot.skipped && <div className="text-xs text-warn">Skipped</div>}
        </button>
        <button className="min-h-12 rounded-lg px-3 text-sm text-accent" onClick={() => props.onSwap(slot.id)} disabled={slot.skipped}>Swap</button>
        <button className="min-h-12 min-w-10 text-lg text-mute" onClick={() => props.onMenu(slot.id)} aria-label={`Options for ${ex.name}`}>⋯</button>
      </div>
      {slotSets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {slotSets.map((s, i) => <LoggedChip key={s.id} set={s} index={i} unit={ex.loadType === 'timed' ? 's' : ''} />)}
        </div>
      )}
      {focused && !slot.skipped && doneCount < slot.sets && <SetEntry session={session} slot={slot} slotSets={slotSets} onLogged={props.onLogged} />}
      {focused && !slot.skipped && doneCount >= slot.sets && (
        <button className="mt-2 min-h-12 w-full rounded-xl border border-dashed border-line text-sm text-mute" onClick={() => store.changeSetCount(session.id, slot.id, 1)}>+ Add another set</button>
      )}
    </div>
  );
}

function LoggedChip({ set, index, unit }: { set: SetRecord; index: number; unit: string }) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(set.weightKg);
  const [r, setR] = useState(set.reps);
  const [rir, setRir] = useState(set.rir);
  return (
    <>
      <button className="rounded-lg bg-panel2 px-2.5 py-1.5 text-sm tabular" onClick={() => { setW(set.weightKg); setR(set.reps); setRir(set.rir); setOpen(true); }}
        aria-label={`Set ${index + 1}: ${set.weightKg} kg for ${set.reps}, tap to edit`}>
        <span className="text-mute">{index + 1}.</span> {fmtKg(set.weightKg)}×{set.reps}{unit} <span className="text-mute">@{set.rir}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Edit set ${index + 1}`}>
        <div className="flex gap-3">
          <Stepper label="kg" value={w} onChange={setW} step={2.5} max={500} />
          <Stepper label="reps" value={r} onChange={setR} step={1} min={1} max={300} />
        </div>
        <RirPicker value={rir} onChange={setRir} />
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={async () => { await store.deleteSet(set.id); setOpen(false); }}>Delete</Button>
          <Button variant="primary" className="flex-1" onClick={async () => { await store.updateSet(set.id, { weightKg: w, reps: r, rir }); setOpen(false); }}>Save</Button>
        </div>
      </Sheet>
    </>
  );
}

function RirPicker({ value, onChange, target }: { value: number; onChange: (v: number) => void; target?: [number, number] }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs uppercase tracking-wide text-mute">Reps in reserve</div>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Reps in reserve">
        {[0, 1, 2, 3, 4].map((n) => (
          <button key={n} role="radio" aria-checked={value === n} onClick={() => onChange(n)}
            className={cx('min-h-12 rounded-xl border text-lg tabular',
              value === n ? 'border-accent bg-accent text-black font-semibold' : target && n >= target[0] && n <= target[1] ? 'border-accent/50 text-ink' : 'border-line text-mute')}>
            {n}{n === 4 ? '+' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Set entry ----------

function SetEntry({ session, slot, slotSets, onLogged }: { session: Session; slot: SessionSlot; slotSets: SetRecord[]; onLogged: (r: store.LogResult) => void }) {
  const ex = getExercise(slot.exerciseId);
  const equipment = useLiveQuery(() => store.equipmentMap(), []);
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [lastTime, setLastTime] = useState<string | null>(null);
  const setIndex = slotSets.length;
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number>(slot.repMin);
  const [rir, setRir] = useState<number>(slot.rirMin);
  const [busy, setBusy] = useState(false);
  const [quick, setQuick] = useState('');
  const [quickMsg, setQuickMsg] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Bring the next set into view after logging, so it is always under the thumb.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 120 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [slot.id, setIndex]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await store.suggestionFor(slot, session.id);
      const hist = await store.exerciseHistory(slot.exerciseId, { excludeSessionId: session.id, limit: 1 });
      if (cancelled) return;
      setSug(s);
      setLastTime(hist[0]?.length ? hist[0].map((x) => `${fmtKg(x.weightKg)}×${x.reps}`).join(', ') : null);
    })();
    return () => { cancelled = true; };
  }, [slot.exerciseId, slot.repMin, slot.repMax, slot.rirMin, slot.sets, slot.finisher, session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill: previous set today, else today's suggestion, else blanks.
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
    setRir(slot.rirMin);
  }, [sug?.reason, sug?.kind, setIndex, slot.exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = equipment ? store.stepFor(ex, equipment) : 2.5;
  const weightLabel = ex.loadType === 'assisted' ? 'assist kg' : ex.loadType === 'bodyweight' ? '+kg' : ex.loadType === 'dumbbell' ? 'kg each' : 'kg';
  const est = weight !== null ? e1rm(weight, reps, rir, ex.loadType) : null;

  const log = async () => {
    if (weight === null || busy) return;
    unlockAudio();
    setBusy(true);
    try {
      onLogged(await store.logSet(session.id, slot.id, { weightKg: weight, reps, rir }));
    } finally {
      setBusy(false);
    }
  };

  const applyQuick = () => {
    const p = parseSetEntry(quick);
    if (!p) { setQuickMsg('Could not read that. Try "32 for 10" or "32 kg 10 reps RIR 2".'); return; }
    if (p.weightKg !== null) setWeight(p.weightKg);
    setReps(p.reps);
    if (p.rir !== null) setRir(Math.min(4, p.rir));
    setQuickMsg(`Filled ${p.weightKg !== null ? `${fmtKg(p.weightKg)} kg, ` : ''}${p.reps} reps${p.rir !== null ? `, RIR ${p.rir}` : ''}. Check, then tap Log set.`);
    setQuick('');
  };

  return (
    <div ref={boxRef} className="mt-3 scroll-mt-40 rounded-2xl bg-panel2/60 p-3" data-testid="set-entry">
      <div className="mb-2 text-sm">
        <div className="flex justify-between gap-2"><span className="font-semibold">Set {setIndex + 1} of {slot.sets}</span>
          {sug && sug.kind !== 'none' && <Badge tone={sug.kind === 'increase' ? 'good' : sug.kind === 'reduce' ? 'warn' : 'mute'}>{sug.kind === 'increase' ? 'Go up' : sug.kind === 'reduce' ? 'Ease off' : sug.kind === 'repeat' ? 'Finisher' : 'Same weight'}</Badge>}
        </div>
        {lastTime && <div className="text-mute">Last time: {lastTime}</div>}
        {sug && <div className="text-mute">{sug.reason}</div>}
      </div>
      <div className="flex gap-2">
        <Stepper label={weightLabel} value={weight} onChange={setWeight} step={step} max={500} testId="weight" />
        <Stepper label={ex.loadType === 'timed' ? 'seconds' : slot.finisher ? 'reps (max−1)' : 'reps'} value={reps} onChange={(v) => setReps(Math.round(v))} step={1} min={1} max={300} testId="reps" />
      </div>
      <RirPicker value={rir} onChange={setRir} target={[slot.rirMin, slot.rirMax]} />
      <Button variant="primary" className="mt-3 min-h-16 w-full text-xl" onClick={log} disabled={weight === null || busy}>
        {weight === null ? 'Set a weight first' : `Log set  ${fmtKg(weight)} × ${reps}`}
      </Button>
      <div className="mt-2 flex justify-between text-xs text-mute">
        <span>{est ? `e1RM estimate ${fmtKg(Math.round(est * 2) / 2)} kg` : ''}</span>
        {ex.cues.length > 0 && <span className="truncate pl-2">{ex.cues[0]}</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyQuick()}
          placeholder="Type or dictate: 32 for 10" aria-label="Quick entry"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-ink placeholder:text-mute" />
        <Button onClick={applyQuick} disabled={!quick.trim()}>Fill</Button>
      </div>
      {quickMsg && <div className="mt-1 text-xs text-mute">{quickMsg}</div>}
    </div>
  );
}

// ---------- Sheets ----------

function SlotMenu({ session, slotId, onClose, onSwap }: { session: Session; slotId: string; onClose: () => void; onSwap: () => void }) {
  const slot = session.blocks.flatMap((b) => b.slots).find((s) => s.id === slotId);
  if (!slot) return null;
  const ex = getExercise(slot.exerciseId);
  return (
    <Sheet open onClose={onClose} title={ex.name}>
      <div className="mb-3 text-sm text-mute">
        {ex.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}
        <ul className="mt-2 list-disc pl-5 text-ink">{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>
        <div className="mt-1 text-xs">Cues are AI drafts until you mark the exercise reviewed in Exercises.</div>
      </div>
      <div className="space-y-2">
        <Button className="w-full" onClick={onSwap}>Swap exercise</Button>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => store.changeSetCount(session.id, slot.id, -1)}>− Set ({slot.sets})</Button>
          <Button className="flex-1" onClick={() => store.changeSetCount(session.id, slot.id, 1)}>+ Set</Button>
        </div>
        <Button className="w-full" onClick={async () => { await store.setSkipped(session.id, slot.id, !slot.skipped); onClose(); }}>
          {slot.skipped ? 'Un-skip' : 'Skip this exercise'}
        </Button>
        {slot.originalExerciseId && (
          <Button className="w-full" onClick={async () => { await store.swapExercise(session.id, slot.id, slot.originalExerciseId!); onClose(); }}>
            Back to {getExercise(slot.originalExerciseId).name}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function SwapSheet({ session, slotId, onClose }: { session: Session; slotId: string; onClose: () => void }) {
  const slot = session.blocks.flatMap((b) => b.slots).find((s) => s.id === slotId)!;
  const ex = getExercise(slot.exerciseId);
  const equipment = useLiveQuery(() => db.equipment.toArray(), []);
  const [options, setOptions] = useState<store.SwapOption[] | null>(null);
  const occupiedKey = equipment?.map((e) => `${e.id}:${e.occupiedUntil ?? 0}`).join('|');
  useEffect(() => {
    let cancelled = false;
    store.swapOptions(session, slotId).then((o) => !cancelled && setOptions(o));
    return () => { cancelled = true; };
  }, [session, slotId, occupiedKey]);

  const exEquip = useMemo(() => {
    const ids = ex.equipment.flatMap((r) => (Array.isArray(r) ? r : [r])).filter((id) => id !== 'bench' && id !== 'rack');
    return [...new Set(ids)] as EquipmentId[];
  }, [ex]);
  const now = Date.now();

  return (
    <Sheet open onClose={onClose} title={`Swap ${ex.name}`}>
      {exEquip.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-mute">Mark busy for 20 min</div>
          <div className="flex flex-wrap gap-2">
            {exEquip.map((id) => {
              const e = equipment?.find((x) => x.id === id);
              const busy = !!e?.occupiedUntil && e.occupiedUntil > now;
              return (
                <button key={id} onClick={() => (busy ? store.clearOccupied(id) : store.markOccupied(id))}
                  className={cx('min-h-11 rounded-xl border px-3 text-sm', busy ? 'border-warn bg-warn/15 text-warn' : 'border-line text-ink')}>
                  {busy ? '● Busy: ' : ''}{e?.name ?? id}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="mb-1 text-xs uppercase tracking-wide text-mute">Best matches with free equipment</div>
      {!options ? <div className="text-mute">Ranking…</div> : options.length === 0 ? (
        <div className="text-mute">No suitable alternative with the equipment marked free.</div>
      ) : (
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o.exercise.id}>
              <button className="w-full rounded-xl border border-line bg-panel2 p-3 text-left active:border-accent"
                onClick={async () => { await store.swapExercise(session.id, slotId, o.exercise.id); onClose(); }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{o.exercise.name}</span>
                  <span className="tabular text-sm text-mute">{o.score}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {o.parts.pattern === 35 && <Badge tone="good">Same movement</Badge>}
                  {o.parts.profile === 15 && <Badge>Same loading</Badge>}
                  {o.parts.history > 0 && <Badge>Done recently</Badge>}
                  {o.sameStation && <Badge tone="accent">Same station as superset</Badge>}
                </div>
                <div className="mt-1 text-xs text-mute">
                  {o.startWeight !== null ? `Start at ${fmtKg(o.startWeight)} kg. ` : ''}{o.startNote}
                </div>
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
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or muscle" aria-label="Search exercises"
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
    const prs: { name: string; label: string }[] = [];
    for (const s of sets) {
      const prev = (await db.sets.where('exerciseId').equals(s.exerciseId).toArray()).filter((x) => x.completedAt < s.completedAt && x.sessionId !== sessionId);
      const found = detectPrs(prev, s, getExercise(s.exerciseId).loadType);
      if (found.length) prs.push({ name: `${getExercise(s.exerciseId).name} ${fmtKg(s.weightKg)}×${s.reps}`, label: found.map((p) => PR_LABEL[p]).join(', ') });
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
    return { session, sets, prs, changes, summary: summarize(session, sets) };
  }, [sessionId]);
  if (!data) return null;
  const { summary, prs, changes, session } = data;
  const muscles = Object.entries(summary.setsByMuscle).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return (
    <>
      <Header title="Session complete" />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Minutes', summary.durationMin], ['Sets', summary.setCount], ['Reps', summary.totalReps]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-panel p-3"><div className="text-2xl font-semibold tabular">{v}</div><div className="text-xs text-mute">{k}</div></div>
          ))}
        </div>
        <div className="rounded-2xl bg-panel p-4 text-sm">
          <div className="mb-1 font-semibold">{session.templateName}</div>
          <div className="text-mute">Load volume {summary.volumeKg.toLocaleString()} kg (dumbbells counted per dumbbell)</div>
        </div>
        {prs.length > 0 && (
          <div className="rounded-2xl border border-good/50 bg-good/10 p-4 text-sm">
            <div className="mb-1 font-semibold text-good">Records</div>
            {prs.map((p, i) => <div key={i}>{p.name}: {p.label}</div>)}
          </div>
        )}
        {changes.length > 0 && (
          <div className="rounded-2xl bg-panel p-4 text-sm">
            <div className="mb-1 font-semibold">Weight changes for next time</div>
            {changes.map((c) => <div key={c}>{c}</div>)}
          </div>
        )}
        <div className="rounded-2xl bg-panel p-4 text-sm">
          <div className="mb-1 font-semibold">Sets per muscle (primary)</div>
          {muscles.map(([m, n]) => <div key={m} className="flex justify-between"><span>{MUSCLE_LABEL[m]}</span><span className="tabular">{n}</span></div>)}
        </div>
        <Button variant="primary" className="w-full" onClick={onClose}>Done</Button>
      </div>
    </>
  );
}
