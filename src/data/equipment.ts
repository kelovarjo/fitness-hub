import type { Equipment, EquipmentId } from '../types';

// Default profile for a standard commercial gym.
// Assumption, not verified: `verify: true` items are the least certain. Edit in Settings.
type Seed = Omit<Equipment, 'updatedAt'>;

export const DEFAULT_EQUIPMENT: Seed[] = [
  { id: 'barbell', name: 'Barbell and plates', available: true, increment: 2.5 },
  { id: 'rack', name: 'Power or squat rack', available: true, increment: 0 },
  { id: 'bench', name: 'Adjustable bench', available: true, increment: 0 },
  { id: 'dumbbells', name: 'Dumbbells', available: true, increment: 2.5, maxKg: 40 },
  { id: 'ez_bar', name: 'EZ bar', available: true, increment: 2.5 },
  { id: 'smith', name: 'Smith machine', available: true, increment: 2.5 },
  { id: 'cable', name: 'Dual adjustable cable station', available: true, increment: 5 },
  { id: 'lat_pulldown', name: 'Lat pulldown', available: true, increment: 5 },
  { id: 'seated_row', name: 'Seated cable row', available: true, increment: 5 },
  { id: 'row_machine', name: 'Chest-supported row machine', available: true, increment: 5, verify: true },
  { id: 'chest_press', name: 'Chest press machine', available: true, increment: 5 },
  { id: 'incline_press_machine', name: 'Incline press machine', available: false, increment: 5, verify: true },
  { id: 'shoulder_press', name: 'Shoulder press machine', available: true, increment: 5 },
  { id: 'pec_deck', name: 'Pec deck / rear delt machine', available: true, increment: 5 },
  { id: 'lateral_raise_machine', name: 'Lateral raise machine', available: false, increment: 5, verify: true },
  { id: 'assisted_pullup', name: 'Assisted pull-up and dip machine', available: true, increment: 5, verify: true },
  { id: 'dip_station', name: 'Dip station', available: true, increment: 2.5 },
  { id: 'dip_machine', name: 'Seated dip machine', available: false, increment: 5, verify: true },
  { id: 'pullup_bar', name: 'Pull-up bar', available: true, increment: 2.5 },
  { id: 'captains_chair', name: "Captain's chair", available: true, increment: 0 },
  { id: 'preacher', name: 'Preacher bench', available: true, increment: 0, verify: true },
  { id: 'landmine', name: 'Landmine or T-bar', available: false, increment: 0, verify: true },
  { id: 'leg_press', name: 'Leg press', available: true, increment: 5 },
  { id: 'hack_squat', name: 'Hack squat', available: false, increment: 5, verify: true },
  { id: 'leg_extension', name: 'Leg extension', available: true, increment: 5 },
  { id: 'leg_curl_seated', name: 'Seated leg curl', available: true, increment: 5 },
  { id: 'leg_curl_lying', name: 'Lying leg curl', available: false, increment: 5, verify: true },
  { id: 'hip_thrust_machine', name: 'Hip thrust machine', available: false, increment: 5, verify: true },
  { id: 'back_extension', name: '45-degree back extension bench', available: true, increment: 0 },
  { id: 'calf_standing', name: 'Standing calf machine', available: true, increment: 5, verify: true },
  { id: 'calf_seated', name: 'Seated calf machine', available: false, increment: 5, verify: true },
];

export const EQUIPMENT_IDS = DEFAULT_EQUIPMENT.map((e) => e.id) as EquipmentId[];
