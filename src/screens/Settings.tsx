import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db, getSetting } from '../db';
import type { Equipment, Phase } from '../types';
import * as store from '../store';
import { PROGRESSION_RULES_VERSION } from '../logic/progression';
import { Badge, Button, Card, Header, confirmAction, fmtDate, useToast } from '../ui';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

async function shareOrDownload(json: string, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([json], filename, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

function EquipmentRow({ e }: { e: Equipment }) {
  const busy = !!e.occupiedUntil && e.occupiedUntil > Date.now();
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-h-11 flex-1 items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[#ff7a1a]" checked={e.available}
            onChange={(ev) => store.updateEquipment(e.id, { available: ev.target.checked })} />
          <span>{e.name} {e.verify && <Badge tone="warn">verify</Badge>} {busy && <Badge tone="warn">busy</Badge>}</span>
        </label>
        {busy && <button className="min-h-10 text-sm text-accent" onClick={() => store.clearOccupied(e.id)}>Free</button>}
      </div>
      {e.available && e.increment > 0 && (
        <div className="mt-1 flex items-center gap-3 pl-9 text-sm text-mute">
          <label className="flex items-center gap-1">Step
            <select value={e.increment} onChange={(ev) => store.updateEquipment(e.id, { increment: Number(ev.target.value) })}
              className="min-h-10 rounded-lg border border-line bg-panel2 px-2 text-ink">
              {[1, 1.25, 2, 2.25, 2.5, 4.5, 5, 10].map((v) => <option key={v} value={v}>{v} kg</option>)}
            </select>
          </label>
          {e.id === 'dumbbells' && (
            <label className="flex items-center gap-1">Max
              <input type="number" inputMode="decimal" value={e.maxKg ?? ''} className="min-h-10 w-20 rounded-lg border border-line bg-panel2 px-2 text-ink"
                onChange={(ev) => store.updateEquipment(e.id, { maxKg: ev.target.value ? Number(ev.target.value) : undefined })} /> kg
            </label>
          )}
        </div>
      )}
    </li>
  );
}

function PhaseRow({ p }: { p: Phase }) {
  const upd = (patch: Partial<Phase>) => db.phases.update(p.id, { ...patch, updatedAt: Date.now() });
  return (
    <li className="py-3">
      <div className="font-semibold">{p.name}</div>
      <div className="text-xs text-mute">{p.note}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <label className="text-mute">From<input type="date" value={p.start} onChange={(e) => e.target.value && upd({ start: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-panel2 px-2 text-ink" /></label>
        <label className="text-mute">To<input type="date" value={p.end} onChange={(e) => e.target.value && upd({ end: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-panel2 px-2 text-ink" /></label>
      </div>
    </li>
  );
}

export default function Settings() {
  const toast = useToast();
  const equipment = useLiveQuery(() => db.equipment.toArray(), []);
  const phases = useLiveQuery(async () => (await db.phases.toArray()).sort((a, b) => a.start.localeCompare(b.start)), []);
  const lastBackup = useLiveQuery(() => getSetting<number | null>('lastBackupAt', null), []);
  const counts = useLiveQuery(async () => ({ sessions: await db.sessions.count(), sets: await db.sets.count(), body: await db.bodyMetrics.count() }), []);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showEquip, setShowEquip] = useState(false);

  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)); }, []);

  const doExport = async () => {
    const data = await store.exportAll();
    const name = `fitness-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      const how = await shareOrDownload(JSON.stringify(data), name);
      await store.markBackedUp();
      toast({ text: how === 'shared' ? 'Backup shared. Save it to Files or iCloud Drive.' : 'Backup downloaded.', tone: 'good' });
    } catch {
      toast({ text: 'Export cancelled.' });
    }
  };

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      store.validateImport(data);
      if (!confirmAction(`Replace all data on this phone with the backup from ${data.exportedAt.slice(0, 10)}? Current data will be overwritten.`)) return;
      await store.importAll(data);
      toast({ text: 'Backup restored.', tone: 'good' });
    } catch (e) {
      toast({ text: (e as Error).message || 'Could not read that file.' });
    }
  };

  const doDelete = async () => {
    const answer = window.prompt('This deletes every workout, set and measurement on this phone. Type DELETE to confirm.');
    if (answer !== 'DELETE') return;
    await store.deleteAll();
    location.reload();
  };

  const sortedEquip = [...(equipment ?? [])].sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name));

  return (
    <>
      <Header title="Settings" />
      <div className="space-y-4 p-4">
        <Card>
          <h2 className="mb-1 font-semibold">Backup</h2>
          <p className="text-sm text-mute">
            Data lives only on this phone. {lastBackup ? `Last backup ${fmtDate(lastBackup)}.` : 'No backup yet.'} {counts && `${plural(counts.sessions, 'session')}, ${plural(counts.sets, 'set')}, ${plural(counts.body, 'measurement')}.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={doExport}>Export backup</Button>
            <Button onClick={() => fileRef.current?.click()}>Restore backup</Button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
          <p className="mt-2 text-xs text-mute">
            Storage protection: {persisted === true ? 'on' : persisted === false ? 'not granted (add the app to your Home Screen)' : 'unknown'}.
          </p>
        </Card>

        <Card>
          <button className="flex w-full items-center justify-between" onClick={() => setShowEquip(!showEquip)} aria-expanded={showEquip}>
            <h2 className="font-semibold">Gym equipment</h2><span className="text-mute">{showEquip ? '▴' : '▾'}</span>
          </button>
          <p className="mt-1 text-sm text-mute">Default profile for a standard gym. Untick anything your gym does not have and set weight steps. Items marked verify are guesses.</p>
          {showEquip && <ul className="mt-2 divide-y divide-line">{sortedEquip.map((e) => <EquipmentRow key={e.id} e={e} />)}</ul>}
        </Card>

        <Card>
          <h2 className="font-semibold">Program phases</h2>
          <ul className="divide-y divide-line">{phases?.map((p) => <PhaseRow key={p.id} p={p} />)}</ul>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Delete all data</h2>
          <p className="mb-3 text-sm text-mute">Removes everything from this phone. Export a backup first.</p>
          <Button variant="danger" className="w-full" onClick={doDelete}>Delete all data</Button>
        </Card>

        <p className="text-center text-xs text-mute">Fitness Hub {__APP_VERSION__} · progression rules v{PROGRESSION_RULES_VERSION} · data stays on this device</p>
      </div>
    </>
  );
}
