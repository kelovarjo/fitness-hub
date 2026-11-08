import type { Phase, Template, TemplateSlot } from '../types';

// Program approved 8 Nov 2026: one heavy anchor per session, then Ritchson-style
// 15 to 25 rep supersets and giant sets, bodyweight finishers.

const s = (
  exerciseId: string,
  sets: number,
  repMin: number,
  repMax: number,
  rirMin = 1,
  rirMax = rirMin,
  finisher = false,
): TemplateSlot => ({ exerciseId, sets, repMin, repMax, rirMin, rirMax, finisher });

export const TEMPLATES: Template[] = [
  {
    id: 'upper_a',
    name: 'Upper A',
    short: 'A',
    focus: 'Chest priority and back',
    kind: 'upper',
    blocks: [
      { label: 'Anchor', anchor: true, restSec: 150, slots: [s('incline_bb_press', 3, 6, 10, 1, 2)] },
      { label: 'B', restSec: 75, slots: [s('db_flat_press', 3, 15, 20, 1, 2), s('one_arm_db_row', 3, 15, 20, 1, 2)] },
      { label: 'C', restSec: 60, slots: [s('lat_pulldown_wide', 3, 15, 20)] },
      { label: 'D', restSec: 60, slots: [s('cable_fly_low_high', 3, 15, 25), s('cable_fly_high_low', 3, 15, 25)] },
      { label: 'Finisher', restSec: 60, slots: [s('push_up', 2, 10, 40, 1, 1, true)] },
    ],
  },
  {
    id: 'upper_b',
    name: 'Upper B',
    short: 'B',
    focus: 'Shoulders and arms',
    kind: 'upper',
    blocks: [
      { label: 'Anchor', anchor: true, restSec: 150, slots: [s('seated_db_press', 3, 6, 10, 1, 2)] },
      { label: 'B', restSec: 60, slots: [s('cable_lateral', 4, 15, 25, 0, 1), s('face_pull', 4, 15, 25)] },
      { label: 'C', restSec: 90, slots: [s('ez_curl', 4, 12, 20), s('ez_overhead_ext', 4, 12, 20), s('ez_upright_row', 4, 12, 20)] },
      { label: 'D', restSec: 60, slots: [s('rope_pushdown', 3, 15, 25), s('cable_hammer_curl', 3, 15, 25)] },
      { label: 'Finisher', restSec: 60, slots: [s('chest_dip', 2, 6, 30, 1, 1, true)] },
    ],
  },
  {
    id: 'upper_c',
    name: 'Upper C',
    short: 'C',
    focus: '100-rep upper and back',
    kind: 'upper',
    blocks: [
      { label: 'Anchor', anchor: true, restSec: 120, slots: [s('pull_up', 4, 6, 12)] },
      { label: 'B', restSec: 75, slots: [s('incline_db_press', 4, 15, 25), s('cs_db_row', 4, 15, 20)] },
      { label: 'C', restSec: 75, slots: [s('machine_shoulder_press', 4, 20, 25), s('seated_cable_row', 4, 20, 25)] },
      { label: 'D', restSec: 60, slots: [s('db_lateral', 3, 15, 25, 0, 1), s('db_rear_raise', 3, 15, 25, 0, 1)] },
      { label: 'E', restSec: 45, slots: [s('cable_crunch', 3, 15, 25)] },
    ],
  },
  {
    id: 'lower',
    name: 'Lower',
    short: 'L',
    focus: 'Full lower body',
    kind: 'lower',
    blocks: [
      { label: 'Anchor', anchor: true, restSec: 180, slots: [s('back_squat', 3, 6, 10, 2, 2)] },
      { label: 'B', restSec: 120, slots: [s('rdl', 3, 8, 12, 2, 2)] },
      { label: 'C', restSec: 75, slots: [s('leg_press', 3, 15, 25, 1, 2), s('leg_extension', 3, 15, 25)] },
      { label: 'D', restSec: 60, slots: [s('seated_leg_curl', 3, 15, 20), s('standing_calf', 4, 15, 25)] },
      { label: 'E', restSec: 45, slots: [s('hanging_knee_raise', 2, 15, 20)] },
    ],
  },
];

export const TEMPLATE_BY_ID: Record<string, Template> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export const DEFAULT_PHASES: Omit<Phase, 'updatedAt'>[] = [
  {
    id: 'race_prep',
    name: 'Race prep',
    start: '2026-11-01',
    end: '2026-11-28',
    note: 'Lower 48 h or more away from your long run',
    modifiers: [{ kind: 'lower', setsByBlock: { Anchor: 2, B: 2 }, dropBlocks: ['C'] }],
  },
  {
    id: 'taper',
    name: 'Taper and race',
    start: '2026-11-29',
    end: '2026-12-05',
    note: 'Race week. Set the end date to race day.',
    modifiers: [
      { kind: 'upper', setDelta: -1, dropFinishers: true },
      { kind: 'lower', skip: true },
    ],
  },
  {
    id: 'recovery',
    name: 'Recovery',
    start: '2026-12-06',
    end: '2026-12-20',
    note: 'Lower stays light',
    modifiers: [{ kind: 'lower', minRir: 3, dropBlocks: ['C'] }],
  },
  {
    id: 'recomp',
    name: 'Recomp',
    start: '2026-12-21',
    end: '2099-12-31',
    note: 'Full templates',
    modifiers: [],
  },
];
