import type { MuscleId } from '../types';
import { MUSCLE_LABEL } from '../data/exercises';

// Original, simplified anatomy drawn for this app (no third-party artwork).
// Each region is drawn once for the right side of the figure and mirrored.

type Region = { id: MuscleId; d: string; mirror?: boolean };

const FRONT: Region[] = [
  { id: 'traps', d: 'M108 57 Q121 61 134 68 L118 73 L110 66 Z', mirror: true },
  { id: 'delt_front', d: 'M118 74 Q131 67 144 75 Q148 85 145 98 Q135 94 128 88 Q121 82 118 74 Z', mirror: true },
  { id: 'delt_side', d: 'M145 75 Q157 83 157 101 L151 107 Q148 101 146 98 Q149 86 145 75 Z', mirror: true },
  { id: 'chest_upper', d: 'M102 77 L118 76 Q126 85 132 93 L102 95 Z', mirror: true },
  { id: 'chest_mid', d: 'M102 97 L132 95 Q138 102 136 111 L102 113 Z', mirror: true },
  { id: 'chest_lower', d: 'M102 115 L136 113 Q132 123 121 127 L102 127 Z', mirror: true },
  { id: 'biceps', d: 'M140 104 Q150 101 154 113 Q157 129 152 143 Q144 147 140 141 Q137 122 140 104 Z', mirror: true },
  { id: 'forearms', d: 'M142 149 Q152 146 157 151 Q163 173 161 199 L152 201 Q146 177 142 149 Z', mirror: true },
  { id: 'abs', d: 'M102 131 L118 131 L118 198 Q110 206 102 208 Z', mirror: true },
  { id: 'obliques', d: 'M120 130 L135 121 Q141 151 135 192 L120 199 Z', mirror: true },
  { id: 'quads', d: 'M104 222 Q122 214 138 226 Q142 262 136 302 Q124 310 114 304 Q104 268 104 222 Z', mirror: true },
  { id: 'calves', d: 'M116 330 Q130 326 136 340 Q136 372 128 400 L120 400 Q112 368 116 330 Z', mirror: true },
];

const BACK: Region[] = [
  { id: 'traps', d: 'M100 52 L108 52 Q114 63 138 71 L121 80 L107 108 L100 110 Z', mirror: true },
  { id: 'delt_rear', d: 'M122 81 L139 72 Q152 73 156 88 L150 99 Q137 92 122 81 Z', mirror: true },
  { id: 'delt_side', d: 'M156 89 Q160 97 157 106 L151 100 Z', mirror: true },
  { id: 'upper_back', d: 'M108 110 L121 83 Q133 90 138 101 L136 118 Q121 121 108 124 Z', mirror: true },
  { id: 'triceps', d: 'M140 104 Q150 101 155 113 Q157 129 152 143 Q144 147 140 139 Q138 121 140 104 Z', mirror: true },
  { id: 'lats', d: 'M106 127 Q122 123 137 121 Q141 141 134 161 Q120 176 106 182 Z', mirror: true },
  { id: 'lower_back', d: 'M101 186 L110 184 Q122 180 128 187 L124 210 L101 212 Z', mirror: true },
  { id: 'forearms', d: 'M142 149 Q152 146 157 151 Q163 173 161 199 L152 201 Q146 177 142 149 Z', mirror: true },
  { id: 'glutes', d: 'M101 216 Q124 210 138 222 Q142 244 132 256 Q114 262 101 256 Z', mirror: true },
  { id: 'hamstrings', d: 'M103 262 Q120 266 136 260 Q140 284 134 306 Q122 312 114 306 Q104 284 103 262 Z', mirror: true },
  { id: 'calves', d: 'M114 322 Q132 316 138 334 Q138 362 128 384 L118 384 Q108 356 114 322 Z', mirror: true },
];

// Body outline (right half, mirrored): head, neck, torso, arm, leg.
const OUTLINE_HALF =
  'M100 52 L108 52 L110 58 Q130 62 146 72 Q160 82 159 104 L158 142 Q166 170 163 202 L160 216 Q156 222 151 218 L148 204 Q140 178 140 150 L139 124 ' +
  'Q141 160 136 196 Q141 212 141 232 Q144 270 137 306 Q133 318 137 330 Q141 362 134 400 L138 414 Q130 422 118 418 L118 402 Q110 366 112 330 ' +
  'Q114 318 110 306 Q104 270 102 236 L100 236 Z';

const MIRROR = 'translate(200,0) scale(-1,1)';

export const MAP_MUSCLES: MuscleId[] = [
  'chest_upper', 'chest_mid', 'chest_lower', 'delt_front', 'delt_side', 'delt_rear', 'traps', 'lats', 'upper_back', 'lower_back',
  'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'quads', 'hamstrings', 'glutes', 'calves',
];

export default function BodyMap({ view, selected, onSelect, worked = {} }: {
  view: 'front' | 'back';
  selected: MuscleId | null;
  onSelect: (m: MuscleId) => void;
  /** Optional 0..1 intensity per muscle for shading. */
  worked?: Partial<Record<MuscleId, number>>;
}) {
  const regions = view === 'front' ? FRONT : BACK;
  const fill = (id: MuscleId) => {
    if (id === selected) return '#ff7a1a';
    const w = worked[id] ?? 0;
    return w > 0 ? `rgba(255,122,26,${0.15 + 0.45 * Math.min(1, w)})` : '#2f3742';
  };
  return (
    <svg viewBox="0 0 200 430" className="mx-auto h-[420px] max-h-[50vh] w-auto touch-manipulation" role="group" aria-label={`Muscle map, ${view} view`}>
      <g fill="#1a1f26" stroke="#3a434f" strokeWidth="1" pointerEvents="none">
        <ellipse cx="100" cy="30" rx="16" ry="20" />
        <path d={OUTLINE_HALF} />
        <path d={OUTLINE_HALF} transform={MIRROR} />
      </g>
      {regions.map((r) => (
        <g key={r.id + r.d.slice(0, 8)} role="button" tabIndex={0} aria-label={MUSCLE_LABEL[r.id]} aria-pressed={selected === r.id}
          onClick={() => onSelect(r.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.id)}
          className="cursor-pointer outline-none" data-muscle={r.id}>
          <path d={r.d} fill={fill(r.id)} stroke="#0b0d10" strokeWidth="1.2" />
          {r.mirror && <path d={r.d} transform={MIRROR} fill={fill(r.id)} stroke="#0b0d10" strokeWidth="1.2" />}
        </g>
      ))}
    </svg>
  );
}
