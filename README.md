# Fitness Hub

A private, offline-first workout logger for iPhone and desktop. Phase 1a of the Personal Fitness Hub plan.

- Four-day program (Upper A, B, C, Lower) with race prep, taper, recovery and recomp phases
- One heavy anchor lift per session, then 15 to 25 rep supersets and giant sets
- One-tap set logging with prefilled weight and reps, automatic rest timer
- Progression suggestions from your own history (deterministic rules, no AI)
- Equipment-aware swaps when a machine is busy
- 81-exercise library, personal records, history, weight and tape measurements
- Works with no signal; data stays on the device; JSON backup and restore

All data is stored in the browser's IndexedDB on your phone. Nothing is sent to any server. The code repository can be public: it contains no personal data.

## Using the app

| Task | Where |
| --- | --- |
| Start the suggested session | Today, **Start** |
| Log a set | Weight and reps are prefilled. Adjust if needed, tap **Done** |
| Effort | Easy / Good / Max under the numbers. Good is the default |
| Equipment busy | **Busy? Swap**, pick the first option |
| Edit or delete a logged set | Tap the ✓ chip under the numbers |
| Jump to or reorder exercises, skip | **Plan** at the top |
| Dictate a set, tips, more or fewer sets, pause, finish | **⋯** at the top |
| Find exercises by muscle | **Muscles** tab, tap the body |
| Back up | Settings, **Export backup**, save to Files or iCloud Drive |
| Gym equipment and weight steps | Settings, **Gym equipment** |
| Phase dates | Settings, **Program phases** |

## Deployment (GitHub Pages, free)

GitHub Pages on a free account needs a **public** repository. Your workout data is never in the repository.

One-time setup:

1. On github.com open the repository, **Settings → General → Danger Zone → Change visibility → Make public**.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or **Actions → Test and deploy → Run workflow**). The workflow runs the tests, builds, and publishes to `https://<your-username>.github.io/fitness-hub/`.

Install on iPhone:

1. Open the address above in **Safari**.
2. Tap **Share → Add to Home Screen**, then open the app from the Home Screen icon.
3. Open the app once with signal so it caches itself. After that it works offline.

Installing to the Home Screen matters: it lets Safari keep the app's data long-term. Still export a backup weekly; the app reminds you after 7 days.

Updates: every push to `main` redeploys. The app updates itself the next time it opens with signal. Data is kept across updates.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit and IndexedDB tests (Vitest)
npm run build      # type-check and production build into dist/
```

Stack: Vite, React 19, TypeScript, Tailwind CSS 4, Dexie (IndexedDB), vite-plugin-pwa (Workbox).

| Path | Contents |
| --- | --- |
| `src/data/` | Exercise library, equipment defaults, templates and phases |
| `src/logic/` | Pure, tested logic: progression, e1RM and PRs, substitution ranking, phases, session flow, dictation parser |
| `src/store.ts` | Database actions (sessions, sets, swaps, backup) |
| `src/screens/` | Today, Train, Session, History, Exercises, Body, Settings |
| `docs/` | Rules, test report |

Every stored record has a UUID and an `updatedAt` timestamp, so a sync backend can be added later without a data migration.

See [docs/RULES.md](docs/RULES.md) for the progression and substitution rules and [docs/TEST-REPORT.md](docs/TEST-REPORT.md) for what has and has not been tested.
