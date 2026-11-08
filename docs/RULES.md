# Training rules (v1)

All suggestions are deterministic code in `src/logic/`. No AI is involved. Unit tests cover every rule below.

## Progression (`progression.ts`)

Applies per exercise slot, using your completed sessions only (newest first).

| Situation in the last session | Next suggestion |
| --- | --- |
| No history | No suggestion. You choose the first weight. |
| Finisher (max minus 1) | Same weight; last reps shown as a guide |
| Every set reached the top of the rep range at or above target RIR | Next weight step on the equipment grid; reps back to the bottom of the range |
| Every set within the range | Same weight; one more rep per set, capped at the top |
| A set below the range, 1 or 2 sessions running | Hold the weight |
| A set below the range 3 sessions running at the same weight | About 5% less, rounded down to the equipment step |
| Heaviest dumbbell reached | Hold; slow the tempo or swap |
| Assisted pull-up | Same rules with less assistance meaning harder |

Weight steps come from Settings, Gym equipment. Weight never increases on a schedule; only performance moves it.

## Estimated 1RM and records (`strength.ts`)

- e1RM = weight × (1 + (reps + RIR) / 30), Epley adjusted for reps in reserve. Only computed when reps + RIR is 12 or less; high-rep sets get no e1RM.
- Records compare a new set with all sets from earlier sessions: heaviest weight, most reps at a given weight or heavier, best e1RM. The first time an exercise is logged sets a baseline, not a record.

## Substitution ranking (`substitution.ts`)

Filter: all required equipment available and not marked busy; not excluded by you; not already in today's session.

| Factor | Points | Scoring |
| --- | --- | --- |
| Movement pattern | 35 | Same 35; related (e.g. incline and flat press) 17.5; different 0 |
| Muscles | 30 | Weighted overlap, primary 1.0, secondary 0.5 |
| Resistance profile | 15 | Same 15; adjacent 7.5 |
| Your history | 10 | Done in the last 90 days |
| Stability | 10 | Similar stability demand |
| Same station as the superset | +5 | Keeps a superset on one station |
| Dumbbell option for a heavy squat or hinge | −8 | Dumbbells cap the load |

Options under 30 points, or with neither the same pattern nor at least half muscle overlap, are not shown. Starting weight for a never-done exercise is a rough estimate from the original exercise (same pattern only) and is labelled as a calibration set.

## Session flow (`session.ts`)

- Blocks run in order. Inside a superset or giant set, exercises alternate set by set.
- Rest starts after each full round, or when a block ends. No rest between exercises of the same round.
- The rest timer is stored as an end time, so it stays correct if the phone locks.
- Paused time is excluded from session duration.

## Phases (`plan.ts`, editable dates in Settings)

| Phase | Default dates | Change |
| --- | --- | --- |
| Race prep | to 28 Nov 2026 | Lower: anchor and RDL 2 sets, block C dropped |
| Taper and race | 29 Nov to 5 Dec | Upper: one set fewer, no finishers. Lower skipped |
| Recovery | 6 to 20 Dec | Lower: RIR 3 or more, block C dropped |
| Recomp | from 21 Dec | Full templates |

The suggested next session is the template done longest ago that the phase does not skip.
