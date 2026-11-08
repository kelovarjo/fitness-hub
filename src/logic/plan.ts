import type { Phase, PhaseModifier, Session, SessionBlock, Template, TemplateBlock } from '../types';

export const isoDate = (d: Date | number = new Date()): string => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function phaseForDate(phases: Phase[], date: string): Phase | null {
  return phases.filter((p) => p.start <= date && date <= p.end).sort((a, b) => b.start.localeCompare(a.start))[0] ?? null;
}

export function modifierFor(template: Template, phase: Phase | null): PhaseModifier | null {
  return phase?.modifiers.find((m) => m.kind === template.kind) ?? null;
}

export function isSkippedInPhase(template: Template, phase: Phase | null): boolean {
  return !!modifierFor(template, phase)?.skip;
}

/** Template blocks after phase adjustments (sets, dropped blocks, finishers, minimum RIR). */
export function applyPhase(template: Template, phase: Phase | null): TemplateBlock[] {
  const mod = modifierFor(template, phase);
  if (!mod) return template.blocks.map((b) => ({ ...b, slots: b.slots.map((s) => ({ ...s })) }));
  return template.blocks
    .filter((b) => !mod.dropBlocks?.includes(b.label))
    .filter((b) => !(mod.dropFinishers && b.slots.every((s) => s.finisher)))
    .map((b) => ({
      ...b,
      slots: b.slots.map((s) => {
        let sets = mod.setsByBlock?.[b.label] ?? s.sets;
        if (mod.setDelta) sets = Math.max(1, sets + mod.setDelta);
        const rirMin = mod.minRir !== undefined ? Math.max(s.rirMin, mod.minRir) : s.rirMin;
        const rirMax = Math.max(rirMin, s.rirMax);
        return { ...s, sets, rirMin, rirMax };
      }),
    }));
}

export function toSessionBlocks(blocks: TemplateBlock[], makeId: () => string): SessionBlock[] {
  return blocks.map((b) => ({
    id: makeId(),
    label: b.label,
    restSec: b.restSec,
    anchor: b.anchor,
    slots: b.slots.map((s) => ({ ...s, id: makeId() })),
  }));
}

/**
 * Next template in the rotation: among templates not skipped in the current phase,
 * the one completed longest ago (never done first, in template order).
 */
export function nextTemplate(templates: Template[], completed: Pick<Session, 'templateId' | 'startedAt'>[], phase: Phase | null): Template | null {
  const lastDone = new Map<string, number>();
  for (const s of completed) {
    if (!s.templateId) continue;
    lastDone.set(s.templateId, Math.max(lastDone.get(s.templateId) ?? 0, s.startedAt));
  }
  const options = templates.filter((t) => !isSkippedInPhase(t, phase));
  if (!options.length) return null;
  return options.reduce((best, t) => ((lastDone.get(t.id) ?? -1) < (lastDone.get(best.id) ?? -1) ? t : best), options[0]);
}
