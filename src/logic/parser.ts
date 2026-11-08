// Deterministic parser for dictated or typed set entries, e.g.
// "32 kilograms for 10 reps", "32 by 10", "32 10 RIR 2", "bodyweight for 12", "70 pounds x 8".

export interface ParsedSet {
  weightKg: number | null;
  reps: number;
  rir: number | null;
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** Replace spelled-out numbers (up to 199, with "and a half" / "point five") by digits. */
export function wordsToDigits(text: string): string {
  const tokens = text.split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let value: number | null = null;
    let j = i;
    if (t === 'hundred' || t === 'a' && tokens[i + 1] === 'hundred') {
      value = 100;
      j = t === 'a' ? i + 1 : i;
    } else if (t in TENS) {
      value = TENS[t];
      const u = tokens[i + 1]?.replace('-', '');
      if (u && u in UNITS && UNITS[u] > 0 && UNITS[u] < 10) {
        value += UNITS[u];
        j = i + 1;
      }
    } else if (/^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-\w+$/.test(t)) {
      const [a, b] = t.split('-');
      if (b in UNITS) value = TENS[a] + UNITS[b];
    } else if (t in UNITS) {
      value = UNITS[t];
    }
    if (value === null) {
      out.push(t);
      continue;
    }
    if (tokens[j + 1] === 'and' && tokens[j + 2] === 'a' && tokens[j + 3] === 'half') {
      value += 0.5;
      j += 3;
    } else if (tokens[j + 1] === 'point' && tokens[j + 2] && tokens[j + 2] in UNITS) {
      value = Number(`${value}.${UNITS[tokens[j + 2]]}`);
      j += 2;
    }
    out.push(String(value));
    i = j;
  }
  return out.join(' ');
}

export function parseSetEntry(input: string): ParsedSet | null {
  let t = ` ${input.toLowerCase().replace(/,/g, ' ').replace(/[.](?!\d)/g, ' ')} `;
  t = t.replace(/(\d)\s*[x×]\s*(\d)/g, '$1 by $2');
  t = ` ${wordsToDigits(t.trim())} `;

  let rir: number | null = null;
  const rirPatterns = [
    /\br\s*i\s*r\s*(?:of\s*)?(\d)/,
    /\b(\d)\s*(?:reps?\s*)?(?:in\s*(?:the\s*)?(?:tank|reserve)|left)/,
    /\breserve\s*(?:of\s*)?(\d)/,
  ];
  for (const p of rirPatterns) {
    const m = t.match(p);
    if (m) {
      rir = Number(m[1]);
      t = t.replace(m[0], ' ');
      break;
    }
  }

  const bodyweight = /\b(body\s*weight|bw)\b/.test(t);
  const isPounds = /\b(lb|lbs|pounds?)\b/.test(t);
  const toKg = (n: number) => (isPounds ? Math.round(n * 0.45359237 * 2) / 2 : n);

  const repsMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:reps?|repetitions?|times)\b/);
  const weightMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?|lb|lbs|pounds?)\b/);
  const nums = [...t.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

  let weight: number | null = null;
  let reps: number | null = null;
  if (repsMatch) reps = Number(repsMatch[1]);
  if (weightMatch) weight = toKg(Number(weightMatch[1]));
  if (bodyweight) weight = 0;

  if (reps === null || weight === null) {
    const used = new Set<number>();
    if (reps !== null) used.add(nums.indexOf(reps));
    if (weight !== null && weightMatch) used.add(nums.indexOf(Number(weightMatch[1])));
    const rest = nums.filter((_, i) => !used.has(i));
    const atFirst = /\b(\d+)\s*(?:reps?\s*)?at\b/.test(t) && !/\bfor\b/.test(t);
    if (weight === null && reps === null) {
      if (rest.length >= 2) {
        if (atFirst) {
          reps = rest[0];
          weight = toKg(rest[1]);
        } else {
          weight = toKg(rest[0]);
          reps = rest[1];
        }
      } else if (rest.length === 1 && bodyweight) {
        reps = rest[0];
      }
    } else if (reps === null && rest.length) {
      reps = rest[0];
    } else if (weight === null && rest.length) {
      weight = toKg(rest[0]);
    }
  }

  if (reps === null || !Number.isFinite(reps) || reps <= 0 || reps > 200 || !Number.isInteger(reps)) return null;
  if (weight !== null && (weight < 0 || weight > 500)) return null;
  return { weightKg: weight, reps, rir };
}
