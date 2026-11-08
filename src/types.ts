// Shared domain types. Every stored record has a string UUID `id` and `updatedAt`
// so a sync backend can be added later without migrating data.

export type MuscleId =
  | 'chest_upper' | 'chest_mid' | 'chest_lower'
  | 'delt_front' | 'delt_side' | 'delt_rear'
  | 'traps' | 'lats' | 'upper_back' | 'lower_back'
  | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques'
  | 'quads' | 'hamstrings' | 'glutes' | 'adductors' | 'calves';

export type Pattern =
  | 'horizontal_press' | 'incline_press' | 'chest_fly' | 'vertical_press'
  | 'lateral_raise' | 'upright_row' | 'rear_delt'
  | 'vertical_pull' | 'horizontal_pull' | 'shrug'
  | 'elbow_flexion' | 'elbow_extension'
  | 'squat' | 'knee_extension' | 'hinge' | 'knee_flexion' | 'calf_raise'
  | 'spinal_flexion' | 'anti_rotation' | 'anti_extension';

export type EquipmentId =
  | 'barbell' | 'rack' | 'bench' | 'dumbbells' | 'ez_bar' | 'smith'
  | 'cable' | 'lat_pulldown' | 'seated_row' | 'row_machine'
  | 'chest_press' | 'incline_press_machine' | 'shoulder_press' | 'pec_deck'
  | 'lateral_raise_machine' | 'assisted_pullup' | 'dip_station' | 'dip_machine'
  | 'pullup_bar' | 'captains_chair' | 'preacher' | 'landmine'
  | 'leg_press' | 'hack_squat' | 'leg_extension' | 'leg_curl_seated' | 'leg_curl_lying'
  | 'hip_thrust_machine' | 'back_extension' | 'calf_standing' | 'calf_seated';

/** Where on the strength curve the exercise is hardest. */
export type Profile = 'L' | 'M' | 'S';

/** How load is expressed. bodyweight = added kg; assisted = counterweight kg (less is harder); timed = reps hold seconds. */
export type LoadType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'smith' | 'bodyweight' | 'assisted' | 'timed';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  primary: MuscleId[];
  secondary: MuscleId[];
  /** Every entry is required. An inner array means "any one of these". */
  equipment: (EquipmentId | EquipmentId[])[];
  /** Equipment whose weight step applies to this exercise. */
  load: EquipmentId | null;
  loadType: LoadType;
  profile: Profile;
  repMin: number;
  repMax: number;
  /** 1 = fully guided machine, 2 = cable or dumbbell, 3 = free barbell or bodyweight. */
  stability: 1 | 2 | 3;
  unilateral?: boolean;
  /** AI-drafted cues. Shown as Draft until the user marks the exercise reviewed. */
  cues: string[];
}

export interface Equipment {
  id: EquipmentId;
  name: string;
  available: boolean;
  /** Smallest load step in kg. */
  increment: number;
  maxKg?: number;
  /** Epoch ms. Equipment counts as occupied until this time. */
  occupiedUntil?: number;
  verify?: boolean;
  updatedAt: number;
}

export interface TemplateSlot {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  /** Finisher: sets stopped one rep short of failure, no rep target. */
  finisher?: boolean;
}

export interface TemplateBlock {
  label: string; // "Anchor", "B", "Finisher" ...
  restSec: number;
  anchor?: boolean;
  slots: TemplateSlot[];
}

export interface Template {
  id: string;
  name: string;
  short: string;
  focus: string;
  kind: 'upper' | 'lower';
  blocks: TemplateBlock[];
}

export interface PhaseModifier {
  kind: 'upper' | 'lower';
  skip?: boolean;
  dropBlocks?: string[];
  /** Set count override per block label. */
  setsByBlock?: Record<string, number>;
  setDelta?: number;
  dropFinishers?: boolean;
  minRir?: number;
}

export interface Phase {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
  note: string;
  modifiers: PhaseModifier[];
  updatedAt: number;
}

// ---- Session records ----

export interface SessionSlot extends TemplateSlot {
  id: string;
  /** Exercise originally planned in this slot, when swapped. */
  originalExerciseId?: string;
  skipped?: boolean;
}

export interface SessionBlock {
  id: string;
  label: string;
  restSec: number;
  anchor?: boolean;
  slots: SessionSlot[];
}

export type SessionStatus = 'active' | 'completed' | 'discarded';

export interface Session {
  id: string;
  templateId: string | null;
  templateName: string;
  phaseId: string | null;
  startedAt: number;
  endedAt?: number;
  status: SessionStatus;
  pausedMs: number;
  pauseStartedAt?: number;
  restEndsAt?: number;
  restTotalSec?: number;
  blocks: SessionBlock[];
  notes?: string;
  updatedAt: number;
}

export interface SetRecord {
  id: string;
  sessionId: string;
  slotId: string;
  exerciseId: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  rir: number;
  finisher?: boolean;
  completedAt: number;
  note?: string;
  updatedAt: number;
}

export type BodyMetricId =
  | 'weight' | 'waist' | 'chest' | 'shoulders'
  | 'arm_flexed' | 'arm_relaxed' | 'thigh' | 'calf' | 'body_fat';

export interface BodyMetric {
  id: string;
  metric: BodyMetricId;
  value: number;
  measuredAt: number;
  source: 'manual';
  note?: string;
  updatedAt: number;
}

export interface ExerciseMeta {
  exerciseId: string;
  reviewed?: boolean;
  excluded?: boolean;
  updatedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}
