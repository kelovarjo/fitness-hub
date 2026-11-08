import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export const fmtKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

export function Button({
  children, onClick, variant = 'secondary', className, disabled, type = 'button', ariaLabel,
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string;
  disabled?: boolean; type?: 'button' | 'submit'; ariaLabel?: string;
}) {
  const styles = {
    primary: 'bg-accent text-black font-semibold active:brightness-90',
    secondary: 'bg-panel2 text-ink border border-line active:bg-line',
    ghost: 'text-mute active:text-ink',
    danger: 'bg-bad/15 text-bad border border-bad/40 active:bg-bad/25',
  }[variant];
  return (
    <button type={type} aria-label={ariaLabel} disabled={disabled} onClick={onClick}
      className={cx('min-h-12 rounded-xl px-4 text-base transition disabled:opacity-40', styles, className)}>
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl bg-panel border border-line p-4', className)}>{children}</section>;
}

export function Badge({ children, tone = 'mute' }: { children: ReactNode; tone?: 'mute' | 'accent' | 'good' | 'warn' | 'bad' }) {
  const t = { mute: 'bg-line text-mute', accent: 'bg-accent/20 text-accent', good: 'bg-good/15 text-good', warn: 'bg-warn/15 text-warn', bad: 'bg-bad/15 text-bad' }[tone];
  return <span className={cx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', t)}>{children}</span>;
}

/** Large numeric stepper with tap-to-type. */
export function Stepper({
  label, value, onChange, step, min = 0, max = 999, unit, decimals = 1, testId,
}: {
  label: string; value: number | null; onChange: (v: number) => void; step: number; min?: number; max?: number;
  unit?: string; decimals?: number; testId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  const display = value === null ? null : Number.isInteger(value) ? String(value) : value.toFixed(decimals === 2 ? 2 : 1).replace(/\.0$/, '');
  return (
    <div className="flex-1 min-w-0" data-testid={testId}>
      <div className="mb-1 text-center text-xs uppercase tracking-wide text-mute">{label}</div>
      <div className="flex items-stretch rounded-2xl border border-line bg-panel2">
        <button aria-label={`Decrease ${label}`} className="w-14 shrink-0 text-3xl text-mute active:text-ink"
          onClick={() => onChange(clamp((value ?? 0) - step))}>−</button>
        {editing ? (
          <input autoFocus inputMode="decimal" value={draft} aria-label={label}
            className="w-full min-w-0 bg-transparent text-center text-3xl font-semibold tabular outline-none"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { const v = parseFloat(draft.replace(',', '.')); if (!Number.isNaN(v)) onChange(clamp(v)); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        ) : (
          <button aria-label={`Edit ${label}`} className="w-full min-w-0 py-3 text-center text-3xl font-semibold tabular"
            onClick={() => { setDraft(value === null ? '' : String(value)); setEditing(true); }}>
            {display === null ? <span className="text-base font-normal text-accent">Tap to set</span> : display}{unit && value !== null ? <span className="ml-1 text-base font-normal text-mute">{unit}</span> : null}
          </button>
        )}
        <button aria-label={`Increase ${label}`} className="w-14 shrink-0 text-3xl text-mute active:text-ink"
          onClick={() => onChange(clamp((value ?? 0) + step))}>+</button>
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-line bg-panel p-4 safe-bottom">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="min-h-12 px-3 text-mute" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- Toasts ----

interface ToastItem { id: number; text: string; action?: { label: string; run: () => void }; tone?: 'good' | 'accent' }
const ToastCtx = createContext<(t: Omit<ToastItem, 'id'>, ms?: number) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const push = useCallback((t: Omit<ToastItem, 'id'>, ms = 4000) => {
    const id = ++counter.current;
    setItems([{ ...t, id }]); // one toast at a time so nothing stacks over the workout
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), ms);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} role="status"
            className={cx('pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl border px-4 py-2 shadow-lg',
              t.tone === 'good' ? 'border-good/50 bg-[#10291f]' : t.tone === 'accent' ? 'border-accent/60 bg-[#2a1a0c]' : 'border-line bg-panel2')}>
            <span className="text-sm">{t.text}</span>
            {t.action && (
              <button className="min-h-10 px-2 font-semibold text-accent"
                onClick={() => { t.action!.run(); setItems((x) => x.filter((i) => i.id !== t.id)); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Re-render on an interval, for timers. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function fmtDate(ts: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(ts).toLocaleDateString('en-SG', opts);
}

export function Header({ title, right, back }: { title: string; right?: ReactNode; back?: string }) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-line bg-bg/95 px-4 backdrop-blur safe-top">
      {back && <a href={back} className="-ml-2 flex min-h-12 items-center px-2 text-accent" aria-label="Back">‹ Back</a>}
      <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
      {right}
    </header>
  );
}

export function confirmAction(message: string) {
  return window.confirm(message);
}

export const go = (path: string) => {
  window.location.hash = path;
};
