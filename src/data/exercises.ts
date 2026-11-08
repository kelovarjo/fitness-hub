import type { Exercise } from '../types';

// Curated library. Muscles, patterns, equipment and profiles follow the reviewed plan.
// Cues are AI-drafted and shown as "Draft" in the app until marked reviewed.

export const EXERCISES: Exercise[] = [
  // ---- Horizontal press ----
  { id: 'bench_press', name: 'Barbell bench press', pattern: 'horizontal_press', primary: ['chest_mid'], secondary: ['delt_front', 'triceps'], equipment: ['barbell', 'rack', 'bench'], load: 'barbell', loadType: 'barbell', profile: 'M', repMin: 5, repMax: 8, stability: 3, cues: ['Shoulder blades pinned back and down', 'Bar to lower chest, forearms vertical'] },
  { id: 'db_flat_press', name: 'Flat dumbbell press', pattern: 'horizontal_press', primary: ['chest_mid'], secondary: ['delt_front', 'triceps'], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'L', repMin: 8, repMax: 12, stability: 2, cues: ['Lower until a deep chest stretch', 'Press up and slightly in, no clanking'] },
  { id: 'machine_chest_press', name: 'Machine chest press', pattern: 'horizontal_press', primary: ['chest_mid'], secondary: ['delt_front', 'triceps'], equipment: ['chest_press'], load: 'chest_press', loadType: 'machine', profile: 'M', repMin: 8, repMax: 12, stability: 1, cues: ['Handles at mid-chest height', 'Control the return, do not let the stack touch'] },
  { id: 'smith_flat_press', name: 'Smith flat press', pattern: 'horizontal_press', primary: ['chest_mid'], secondary: ['delt_front', 'triceps'], equipment: ['smith', 'bench'], load: 'smith', loadType: 'smith', profile: 'M', repMin: 6, repMax: 10, stability: 1, cues: ['Bench placed so the bar meets lower chest', 'Elbows about 45 degrees from torso'] },
  { id: 'push_up', name: 'Push-up', pattern: 'horizontal_press', primary: ['chest_mid'], secondary: ['delt_front', 'triceps', 'abs'], equipment: [], load: null, loadType: 'bodyweight', profile: 'M', repMin: 10, repMax: 20, stability: 3, cues: ['Body in one straight line', 'Chest to fist height from the floor'] },
  { id: 'chest_dip', name: 'Dip', pattern: 'horizontal_press', primary: ['chest_lower'], secondary: ['triceps', 'delt_front'], equipment: [['dip_station', 'assisted_pullup']], load: 'dip_station', loadType: 'bodyweight', profile: 'L', repMin: 6, repMax: 12, stability: 3, cues: ['Slight forward lean for chest', 'Stop at a comfortable shoulder stretch'] },

  // ---- Incline press ----
  { id: 'incline_bb_press', name: 'Incline barbell press', pattern: 'incline_press', primary: ['chest_upper'], secondary: ['delt_front', 'triceps'], equipment: ['barbell', 'rack', 'bench'], load: 'barbell', loadType: 'barbell', profile: 'M', repMin: 6, repMax: 8, stability: 3, cues: ['Bench at 30 degrees', 'Bar touches just below the collarbone'] },
  { id: 'incline_db_press', name: 'Incline dumbbell press', pattern: 'incline_press', primary: ['chest_upper'], secondary: ['delt_front', 'triceps'], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'L', repMin: 8, repMax: 12, stability: 2, cues: ['Bench at 30 degrees', 'Deep stretch at the bottom, wrists over elbows'] },
  { id: 'incline_machine_press', name: 'Incline machine press', pattern: 'incline_press', primary: ['chest_upper'], secondary: ['delt_front', 'triceps'], equipment: [['incline_press_machine', 'chest_press']], load: 'incline_press_machine', loadType: 'machine', profile: 'M', repMin: 8, repMax: 12, stability: 1, cues: ['Seat low so handles start at upper chest', 'Drive up and in'] },
  { id: 'smith_incline_press', name: 'Smith incline press', pattern: 'incline_press', primary: ['chest_upper'], secondary: ['delt_front', 'triceps'], equipment: ['smith', 'bench'], load: 'smith', loadType: 'smith', profile: 'M', repMin: 6, repMax: 10, stability: 1, cues: ['Bench at 30 degrees under the bar path', 'Bar to upper chest, elbows slightly tucked'] },
  { id: 'cable_incline_press', name: 'Cable incline press', pattern: 'incline_press', primary: ['chest_upper'], secondary: ['delt_front', 'triceps'], equipment: ['cable', 'bench'], load: 'cable', loadType: 'cable', profile: 'M', repMin: 10, repMax: 12, stability: 2, cues: ['Pulleys low, bench at 30 degrees between them', 'Press up and together'] },

  // ---- Chest fly ----
  { id: 'pec_deck', name: 'Pec deck', pattern: 'chest_fly', primary: ['chest_mid'], secondary: ['delt_front'], equipment: ['pec_deck'], load: 'pec_deck', loadType: 'machine', profile: 'S', repMin: 12, repMax: 15, stability: 1, cues: ['Handles at chest height', 'Squeeze one second at the middle'] },
  { id: 'cable_fly_mid', name: 'Cable fly, mid height', pattern: 'chest_fly', primary: ['chest_mid'], secondary: ['delt_front'], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'M', repMin: 12, repMax: 15, stability: 2, cues: ['Soft bend in the elbows, fixed', 'Hands meet in front of the sternum'] },
  { id: 'cable_fly_low_high', name: 'Low-to-high cable fly', pattern: 'chest_fly', primary: ['chest_upper'], secondary: ['delt_front'], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'S', repMin: 15, repMax: 25, stability: 2, cues: ['Pulleys at the bottom', 'Scoop up to chin height, squeeze'] },
  { id: 'cable_fly_high_low', name: 'High-to-low cable fly', pattern: 'chest_fly', primary: ['chest_lower'], secondary: ['delt_front'], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'S', repMin: 15, repMax: 25, stability: 2, cues: ['Pulleys above head height', 'Bring hands down to the hips and cross slightly'] },
  { id: 'incline_db_fly', name: 'Incline dumbbell fly', pattern: 'chest_fly', primary: ['chest_upper'], secondary: ['delt_front'], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'L', repMin: 10, repMax: 15, stability: 2, cues: ['Bench at 30 degrees', 'Wide arc, stop at a stretch, not pain'] },

  // ---- Vertical press ----
  { id: 'seated_db_press', name: 'Seated dumbbell shoulder press', pattern: 'vertical_press', primary: ['delt_front'], secondary: ['delt_side', 'triceps'], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'M', repMin: 6, repMax: 10, stability: 2, cues: ['Bench almost upright, back supported', 'Lower to ear level, press without locking hard'] },
  { id: 'machine_shoulder_press', name: 'Machine shoulder press', pattern: 'vertical_press', primary: ['delt_front'], secondary: ['delt_side', 'triceps'], equipment: ['shoulder_press'], load: 'shoulder_press', loadType: 'machine', profile: 'M', repMin: 8, repMax: 12, stability: 1, cues: ['Handles start at shoulder height', 'Steady tempo, no bouncing'] },
  { id: 'standing_ohp', name: 'Standing barbell overhead press', pattern: 'vertical_press', primary: ['delt_front'], secondary: ['delt_side', 'triceps', 'abs'], equipment: ['barbell', 'rack'], load: 'barbell', loadType: 'barbell', profile: 'M', repMin: 5, repMax: 8, stability: 3, cues: ['Glutes and abs braced', 'Head through once the bar passes the forehead'] },
  { id: 'smith_seated_press', name: 'Smith seated shoulder press', pattern: 'vertical_press', primary: ['delt_front'], secondary: ['delt_side', 'triceps'], equipment: ['smith', 'bench'], load: 'smith', loadType: 'smith', profile: 'M', repMin: 6, repMax: 10, stability: 1, cues: ['Bench placed so the bar clears the nose', 'Lower to chin height'] },
  { id: 'landmine_press', name: 'Landmine press', pattern: 'vertical_press', primary: ['delt_front'], secondary: ['chest_upper', 'triceps'], equipment: ['barbell', 'landmine'], load: 'barbell', loadType: 'barbell', profile: 'M', repMin: 8, repMax: 12, stability: 2, unilateral: true, cues: ['Staggered stance, ribs down', 'Press up and slightly across'] },
  { id: 'arnold_press', name: 'Arnold press', pattern: 'vertical_press', primary: ['delt_front'], secondary: ['delt_side', 'triceps'], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'M', repMin: 12, repMax: 25, stability: 2, cues: ['Start palms facing you', 'Rotate out as you press'] },

  // ---- Lateral raise / upright row ----
  { id: 'db_lateral', name: 'Dumbbell lateral raise', pattern: 'lateral_raise', primary: ['delt_side'], secondary: ['traps'], equipment: ['dumbbells'], load: 'dumbbells', loadType: 'dumbbell', profile: 'S', repMin: 12, repMax: 20, stability: 2, cues: ['Lead with the elbows, slight forward lean', 'Stop at shoulder height'] },
  { id: 'cable_lateral', name: 'Cable lateral raise', pattern: 'lateral_raise', primary: ['delt_side'], secondary: ['traps'], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'L', repMin: 12, repMax: 15, stability: 2, unilateral: true, cues: ['Pulley at the bottom, cable behind the body', 'Raise out, not up, to shoulder height'] },
  { id: 'machine_lateral', name: 'Machine lateral raise', pattern: 'lateral_raise', primary: ['delt_side'], secondary: ['traps'], equipment: ['lateral_raise_machine'], load: 'lateral_raise_machine', loadType: 'machine', profile: 'M', repMin: 12, repMax: 15, stability: 1, cues: ['Pivot in line with the shoulder', 'Pause briefly at the top'] },
  { id: 'leanaway_lateral', name: 'Lean-away dumbbell lateral raise', pattern: 'lateral_raise', primary: ['delt_side'], secondary: ['traps'], equipment: ['dumbbells'], load: 'dumbbells', loadType: 'dumbbell', profile: 'L', repMin: 12, repMax: 15, stability: 2, unilateral: true, cues: ['Hold an upright post and lean away', 'Raise to shoulder height, slow down'] },
  { id: 'ez_upright_row', name: 'EZ-bar upright row, wide grip', pattern: 'upright_row', primary: ['delt_side'], secondary: ['traps'], equipment: ['ez_bar'], load: 'ez_bar', loadType: 'barbell', profile: 'S', repMin: 12, repMax: 20, stability: 2, cues: ['Grip wider than shoulders', 'Elbows lead, stop at chest height'] },

  // ---- Rear delt ----
  { id: 'reverse_pec_deck', name: 'Reverse pec deck', pattern: 'rear_delt', primary: ['delt_rear'], secondary: ['upper_back'], equipment: ['pec_deck'], load: 'pec_deck', loadType: 'machine', profile: 'S', repMin: 12, repMax: 15, stability: 1, cues: ['Chest on the pad, arms nearly straight', 'Sweep wide, do not squeeze the shoulder blades hard'] },
  { id: 'face_pull', name: 'Face pull', pattern: 'rear_delt', primary: ['delt_rear'], secondary: ['upper_back', 'traps'], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'S', repMin: 12, repMax: 15, stability: 2, cues: ['Rope at face height, thumbs back', 'Pull to the ears and rotate out'] },
  { id: 'cable_rear_fly', name: 'Cable rear delt fly', pattern: 'rear_delt', primary: ['delt_rear'], secondary: ['upper_back'], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'M', repMin: 12, repMax: 15, stability: 2, cues: ['Cross the cables at shoulder height', 'Pull wide with straight arms'] },
  { id: 'db_rear_raise', name: 'Bent-over dumbbell rear delt raise', pattern: 'rear_delt', primary: ['delt_rear'], secondary: ['upper_back'], equipment: ['dumbbells'], load: 'dumbbells', loadType: 'dumbbell', profile: 'S', repMin: 12, repMax: 20, stability: 2, cues: ['Hinge until the torso is near flat', 'Raise out to the sides, pinkies high'] },

  // ---- Vertical pull ----
  { id: 'lat_pulldown_wide', name: 'Lat pulldown, wide grip', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'delt_rear'], equipment: ['lat_pulldown'], load: 'lat_pulldown', loadType: 'machine', profile: 'M', repMin: 8, repMax: 12, stability: 1, cues: ['Slight lean back, chest up', 'Pull the bar to the upper chest'] },
  { id: 'lat_pulldown_neutral', name: 'Neutral-grip lat pulldown', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps'], equipment: ['lat_pulldown'], load: 'lat_pulldown', loadType: 'machine', profile: 'L', repMin: 8, repMax: 12, stability: 1, cues: ['Full stretch at the top', 'Drive the elbows to the hips'] },
  { id: 'pull_up', name: 'Pull-up', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: ['pullup_bar'], load: null, loadType: 'bodyweight', profile: 'M', repMin: 6, repMax: 12, stability: 3, cues: ['Start from a dead hang', 'Chin over the bar, no kipping'] },
  { id: 'assisted_pull_up', name: 'Assisted pull-up', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: ['assisted_pullup'], load: 'assisted_pullup', loadType: 'assisted', profile: 'M', repMin: 6, repMax: 12, stability: 1, cues: ['Weight entered is assistance: less is harder', 'Full hang to chin over the bar'] },
  { id: 'single_arm_pulldown', name: 'Single-arm cable pulldown', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps'], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'L', repMin: 10, repMax: 15, stability: 2, unilateral: true, cues: ['Kneel or sit under a high pulley', 'Pull the elbow to the hip'] },

  // ---- Horizontal pull ----
  { id: 'chest_supported_row', name: 'Chest-supported machine row', pattern: 'horizontal_pull', primary: ['upper_back'], secondary: ['lats', 'delt_rear', 'biceps'], equipment: ['row_machine'], load: 'row_machine', loadType: 'machine', profile: 'S', repMin: 6, repMax: 10, stability: 1, cues: ['Chest stays on the pad', 'Squeeze shoulder blades at the end'] },
  { id: 'seated_cable_row', name: 'Seated cable row', pattern: 'horizontal_pull', primary: ['upper_back'], secondary: ['lats', 'biceps'], equipment: ['seated_row'], load: 'seated_row', loadType: 'machine', profile: 'M', repMin: 10, repMax: 12, stability: 1, cues: ['Tall torso, no rocking', 'Handle to the lower ribs'] },
  { id: 'one_arm_db_row', name: 'One-arm dumbbell row', pattern: 'horizontal_pull', primary: ['lats'], secondary: ['upper_back', 'biceps'], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'M', repMin: 8, repMax: 12, stability: 2, unilateral: true, cues: ['Hand and knee on the bench, flat back', 'Row the dumbbell to the hip'] },
  { id: 'barbell_row', name: 'Barbell row', pattern: 'horizontal_pull', primary: ['upper_back'], secondary: ['lats', 'delt_rear', 'lower_back'], equipment: ['barbell'], load: 'barbell', loadType: 'barbell', profile: 'M', repMin: 6, repMax: 10, stability: 3, cues: ['Hinge to about 45 degrees, neutral spine', 'Bar to the lower ribs'] },
  { id: 'tbar_row', name: 'T-bar row', pattern: 'horizontal_pull', primary: ['upper_back'], secondary: ['lats', 'biceps'], equipment: ['barbell', 'landmine'], load: 'barbell', loadType: 'barbell', profile: 'M', repMin: 6, repMax: 10, stability: 2, cues: ['Chest up, hips back', 'Pull handle to the sternum'] },
  { id: 'cs_db_row', name: 'Chest-supported dumbbell row', pattern: 'horizontal_pull', primary: ['upper_back'], secondary: ['delt_rear', 'biceps'], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'S', repMin: 8, repMax: 12, stability: 2, cues: ['Chest on an incline bench', 'Row with elbows out about 45 degrees'] },

  // ---- Shrug ----
  { id: 'db_shrug', name: 'Dumbbell shrug', pattern: 'shrug', primary: ['traps'], secondary: ['forearms'], equipment: ['dumbbells'], load: 'dumbbells', loadType: 'dumbbell', profile: 'S', repMin: 10, repMax: 15, stability: 2, cues: ['Shrug straight up, no rolling', 'Pause one second at the top'] },

  // ---- Elbow flexion ----
  { id: 'ez_curl', name: 'EZ-bar curl', pattern: 'elbow_flexion', primary: ['biceps'], secondary: ['forearms'], equipment: ['ez_bar'], load: 'ez_bar', loadType: 'barbell', profile: 'M', repMin: 8, repMax: 12, stability: 2, cues: ['Elbows pinned at the sides', 'Lower under control, full extension'] },
  { id: 'db_curl', name: 'Dumbbell curl', pattern: 'elbow_flexion', primary: ['biceps'], secondary: ['forearms'], equipment: ['dumbbells'], load: 'dumbbells', loadType: 'dumbbell', profile: 'M', repMin: 8, repMax: 12, stability: 2, cues: ['Supinate as you curl', 'No swinging'] },
  { id: 'incline_db_curl', name: 'Incline dumbbell curl', pattern: 'elbow_flexion', primary: ['biceps'], secondary: ['forearms'], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'L', repMin: 10, repMax: 12, stability: 2, cues: ['Bench at 45 to 60 degrees, arms hanging back', 'Keep elbows behind the torso'] },
  { id: 'hammer_curl', name: 'Hammer curl', pattern: 'elbow_flexion', primary: ['biceps', 'forearms'], secondary: [], equipment: ['dumbbells'], load: 'dumbbells', loadType: 'dumbbell', profile: 'M', repMin: 10, repMax: 12, stability: 2, cues: ['Neutral grip, thumbs up', 'Curl toward the front shoulder'] },
  { id: 'cable_curl', name: 'Cable curl', pattern: 'elbow_flexion', primary: ['biceps'], secondary: ['forearms'], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'M', repMin: 10, repMax: 15, stability: 2, cues: ['Low pulley, straight or EZ handle', 'Elbows still, squeeze at the top'] },
  { id: 'preacher_curl', name: 'Preacher curl', pattern: 'elbow_flexion', primary: ['biceps'], secondary: ['forearms'], equipment: ['preacher', 'ez_bar'], load: 'ez_bar', loadType: 'barbell', profile: 'L', repMin: 8, repMax: 12, stability: 1, cues: ['Armpits tight to the pad', 'Stop just short of lockout at the bottom'] },
  { id: 'reverse_ez_curl', name: 'Reverse EZ-bar curl', pattern: 'elbow_flexion', primary: ['forearms'], secondary: ['biceps'], equipment: ['ez_bar'], load: 'ez_bar', loadType: 'barbell', profile: 'M', repMin: 10, repMax: 15, stability: 2, cues: ['Overhand grip', 'Wrists straight throughout'] },
  { id: 'cable_hammer_curl', name: 'Cable rope hammer curl', pattern: 'elbow_flexion', primary: ['biceps', 'forearms'], secondary: [], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'M', repMin: 15, repMax: 25, stability: 2, cues: ['Rope on a low pulley, thumbs up', 'Elbows fixed at the sides'] },

  // ---- Elbow extension ----
  { id: 'rope_pushdown', name: 'Triceps rope pushdown', pattern: 'elbow_extension', primary: ['triceps'], secondary: [], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'S', repMin: 10, repMax: 15, stability: 2, cues: ['Elbows tucked and still', 'Spread the rope at the bottom'] },
  { id: 'overhead_cable_ext', name: 'Overhead cable triceps extension', pattern: 'elbow_extension', primary: ['triceps'], secondary: [], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'L', repMin: 10, repMax: 12, stability: 2, cues: ['Face away from the pulley, rope behind the head', 'Elbows point forward, extend fully'] },
  { id: 'ez_overhead_ext', name: 'EZ-bar overhead triceps extension', pattern: 'elbow_extension', primary: ['triceps'], secondary: [], equipment: ['ez_bar'], load: 'ez_bar', loadType: 'barbell', profile: 'L', repMin: 12, repMax: 20, stability: 2, cues: ['Elbows narrow, pointing up', 'Lower behind the head to a deep stretch'] },
  { id: 'ez_skullcrusher', name: 'EZ-bar skull crusher', pattern: 'elbow_extension', primary: ['triceps'], secondary: [], equipment: ['ez_bar', 'bench'], load: 'ez_bar', loadType: 'barbell', profile: 'L', repMin: 8, repMax: 12, stability: 2, cues: ['Lower the bar behind the head, not to the nose', 'Upper arms angled slightly back'] },
  { id: 'db_overhead_ext', name: 'Overhead dumbbell triceps extension', pattern: 'elbow_extension', primary: ['triceps'], secondary: [], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'L', repMin: 10, repMax: 12, stability: 2, cues: ['Hold one dumbbell with both hands', 'Elbows stay narrow'] },
  { id: 'close_grip_bench', name: 'Close-grip bench press', pattern: 'elbow_extension', primary: ['triceps'], secondary: ['chest_mid', 'delt_front'], equipment: ['barbell', 'rack', 'bench'], load: 'barbell', loadType: 'barbell', profile: 'M', repMin: 6, repMax: 10, stability: 3, cues: ['Hands shoulder width', 'Elbows tucked, bar to lower chest'] },
  { id: 'machine_dip', name: 'Machine dip', pattern: 'elbow_extension', primary: ['triceps'], secondary: ['chest_lower'], equipment: ['dip_machine'], load: 'dip_machine', loadType: 'machine', profile: 'M', repMin: 8, repMax: 12, stability: 1, cues: ['Upright torso for triceps', 'Lock out at the bottom'] },

  // ---- Squat / knee extension ----
  { id: 'back_squat', name: 'Back squat', pattern: 'squat', primary: ['quads'], secondary: ['glutes', 'adductors', 'lower_back'], equipment: ['barbell', 'rack'], load: 'barbell', loadType: 'barbell', profile: 'M', repMin: 6, repMax: 10, stability: 3, cues: ['Brace before each rep', 'Knees track over toes, hips below knees if comfortable'] },
  { id: 'hack_squat', name: 'Hack squat', pattern: 'squat', primary: ['quads'], secondary: ['glutes'], equipment: ['hack_squat'], load: 'hack_squat', loadType: 'machine', profile: 'L', repMin: 6, repMax: 10, stability: 1, cues: ['Feet mid-platform, shoulder width', 'Go deep with control'] },
  { id: 'leg_press', name: 'Leg press', pattern: 'squat', primary: ['quads'], secondary: ['glutes'], equipment: ['leg_press'], load: 'leg_press', loadType: 'machine', profile: 'M', repMin: 10, repMax: 12, stability: 1, cues: ['Lower back stays on the pad', 'Do not lock the knees at the top'] },
  { id: 'smith_squat', name: 'Smith squat', pattern: 'squat', primary: ['quads'], secondary: ['glutes'], equipment: ['smith'], load: 'smith', loadType: 'smith', profile: 'M', repMin: 6, repMax: 10, stability: 1, cues: ['Feet slightly forward of the bar', 'Sit straight down'] },
  { id: 'goblet_squat', name: 'Goblet squat', pattern: 'squat', primary: ['quads'], secondary: ['glutes', 'abs'], equipment: ['dumbbells'], load: 'dumbbells', loadType: 'dumbbell', profile: 'M', repMin: 8, repMax: 15, stability: 2, cues: ['Dumbbell held at the chest', 'Elbows inside the knees at the bottom'] },
  { id: 'bulgarian_split', name: 'Bulgarian split squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['adductors'], equipment: ['dumbbells', 'bench'], load: 'dumbbells', loadType: 'dumbbell', profile: 'L', repMin: 8, repMax: 12, stability: 2, unilateral: true, cues: ['Rear foot on the bench, laces down', 'Drop the back knee straight down'] },
  { id: 'leg_extension', name: 'Leg extension', pattern: 'knee_extension', primary: ['quads'], secondary: [], equipment: ['leg_extension'], load: 'leg_extension', loadType: 'machine', profile: 'S', repMin: 10, repMax: 15, stability: 1, cues: ['Knee in line with the machine pivot', 'Pause at the top'] },

  // ---- Hinge / knee flexion ----
  { id: 'rdl', name: 'Romanian deadlift', pattern: 'hinge', primary: ['hamstrings'], secondary: ['glutes', 'lower_back'], equipment: ['barbell'], load: 'barbell', loadType: 'barbell', profile: 'L', repMin: 6, repMax: 10, stability: 3, cues: ['Soft knees, push the hips back', 'Bar close to the legs, stop at a hamstring stretch'] },
  { id: 'db_rdl', name: 'Dumbbell Romanian deadlift', pattern: 'hinge', primary: ['hamstrings'], secondary: ['glutes', 'lower_back'], equipment: ['dumbbells'], load: 'dumbbells', loadType: 'dumbbell', profile: 'L', repMin: 8, repMax: 12, stability: 2, cues: ['Dumbbells slide down the thighs', 'Neutral spine throughout'] },
  { id: 'hip_thrust', name: 'Hip thrust', pattern: 'hinge', primary: ['glutes'], secondary: ['hamstrings'], equipment: [['hip_thrust_machine', 'barbell']], load: 'barbell', loadType: 'barbell', profile: 'S', repMin: 8, repMax: 12, stability: 2, cues: ['Upper back on a bench, chin tucked', 'Squeeze glutes hard at the top'] },
  { id: 'back_extension', name: '45-degree back extension', pattern: 'hinge', primary: ['glutes', 'hamstrings'], secondary: ['lower_back'], equipment: ['back_extension'], load: 'dumbbells', loadType: 'dumbbell', profile: 'M', repMin: 10, repMax: 15, stability: 2, cues: ['Pad just below the hip crease', 'Round slightly to bias glutes'] },
  { id: 'seated_leg_curl', name: 'Seated leg curl', pattern: 'knee_flexion', primary: ['hamstrings'], secondary: ['calves'], equipment: ['leg_curl_seated'], load: 'leg_curl_seated', loadType: 'machine', profile: 'L', repMin: 10, repMax: 12, stability: 1, cues: ['Lean forward slightly for more stretch', 'Control the return'] },
  { id: 'lying_leg_curl', name: 'Lying leg curl', pattern: 'knee_flexion', primary: ['hamstrings'], secondary: ['calves'], equipment: ['leg_curl_lying'], load: 'leg_curl_lying', loadType: 'machine', profile: 'M', repMin: 10, repMax: 12, stability: 1, cues: ['Hips pressed into the pad', 'Full range, no hip lift'] },

  // ---- Calves ----
  { id: 'standing_calf', name: 'Standing calf raise', pattern: 'calf_raise', primary: ['calves'], secondary: [], equipment: [['calf_standing', 'smith']], load: 'calf_standing', loadType: 'machine', profile: 'L', repMin: 8, repMax: 12, stability: 1, cues: ['Pause one second at the bottom stretch', 'Rise onto the big toe'] },
  { id: 'seated_calf', name: 'Seated calf raise', pattern: 'calf_raise', primary: ['calves'], secondary: [], equipment: ['calf_seated'], load: 'calf_seated', loadType: 'machine', profile: 'M', repMin: 12, repMax: 15, stability: 1, cues: ['Pad on the lower thigh', 'Full stretch, full squeeze'] },
  { id: 'smith_calf', name: 'Smith machine calf raise', pattern: 'calf_raise', primary: ['calves'], secondary: [], equipment: ['smith'], load: 'smith', loadType: 'smith', profile: 'L', repMin: 10, repMax: 20, stability: 1, cues: ['Balls of the feet on a plate or step', 'Pause at the bottom stretch'] },
  { id: 'db_single_calf', name: 'Single-leg dumbbell calf raise', pattern: 'calf_raise', primary: ['calves'], secondary: [], equipment: ['dumbbells'], load: 'dumbbells', loadType: 'dumbbell', profile: 'L', repMin: 10, repMax: 20, stability: 2, unilateral: true, cues: ['Stand on a step, hold support with the free hand', 'Full stretch, full rise'] },
  { id: 'leg_press_calf', name: 'Leg press calf raise', pattern: 'calf_raise', primary: ['calves'], secondary: [], equipment: ['leg_press'], load: 'leg_press', loadType: 'machine', profile: 'L', repMin: 10, repMax: 15, stability: 1, cues: ['Balls of the feet on the platform edge', 'Knees straight but not locked'] },

  // ---- Core ----
  { id: 'cable_crunch', name: 'Cable crunch', pattern: 'spinal_flexion', primary: ['abs'], secondary: [], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'M', repMin: 10, repMax: 15, stability: 2, cues: ['Kneel, rope beside the head', 'Curl the ribs to the pelvis, hips still'] },
  { id: 'hanging_knee_raise', name: 'Hanging knee raise', pattern: 'spinal_flexion', primary: ['abs'], secondary: [], equipment: [['pullup_bar', 'captains_chair']], load: null, loadType: 'bodyweight', profile: 'M', repMin: 10, repMax: 15, stability: 3, cues: ['Curl the pelvis up, not just the knees', 'No swinging'] },
  { id: 'crunch', name: 'Crunch (floor, optional plate)', pattern: 'spinal_flexion', primary: ['abs'], secondary: [], equipment: [], load: null, loadType: 'bodyweight', profile: 'M', repMin: 15, repMax: 25, stability: 3, cues: ['Lower back stays down, curl the ribs up', 'Weight entered is the plate held, 0 if none'] },
  { id: 'pallof_press', name: 'Pallof press', pattern: 'anti_rotation', primary: ['obliques'], secondary: ['abs'], equipment: ['cable'], load: 'cable', loadType: 'cable', profile: 'M', repMin: 10, repMax: 12, stability: 2, unilateral: true, cues: ['Stand side-on to the pulley', 'Press out and resist the twist'] },
  { id: 'plank', name: 'Plank', pattern: 'anti_extension', primary: ['abs'], secondary: ['obliques'], equipment: [], load: null, loadType: 'timed', profile: 'M', repMin: 30, repMax: 60, stability: 3, cues: ['Reps field = seconds held', 'Squeeze glutes, ribs down'] },
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
);

export function getExercise(id: string): Exercise {
  const ex = EXERCISE_BY_ID[id];
  if (!ex) throw new Error(`Unknown exercise: ${id}`);
  return ex;
}

export const PATTERN_LABEL: Record<string, string> = {
  horizontal_press: 'Flat press',
  incline_press: 'Incline press',
  chest_fly: 'Chest fly',
  vertical_press: 'Shoulder press',
  lateral_raise: 'Lateral raise',
  upright_row: 'Upright row',
  rear_delt: 'Rear delt',
  vertical_pull: 'Vertical pull',
  horizontal_pull: 'Row',
  shrug: 'Shrug',
  elbow_flexion: 'Curl',
  elbow_extension: 'Triceps',
  squat: 'Squat',
  knee_extension: 'Knee extension',
  hinge: 'Hinge',
  knee_flexion: 'Leg curl',
  calf_raise: 'Calves',
  spinal_flexion: 'Abs',
  anti_rotation: 'Anti-rotation',
  anti_extension: 'Anti-extension',
};

export const MUSCLE_LABEL: Record<string, string> = {
  chest_upper: 'Upper chest',
  chest_mid: 'Mid chest',
  chest_lower: 'Lower chest',
  delt_front: 'Front delts',
  delt_side: 'Lateral delts',
  delt_rear: 'Rear delts',
  traps: 'Traps',
  lats: 'Lats',
  upper_back: 'Mid and upper back',
  lower_back: 'Lower back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  calves: 'Calves',
};
