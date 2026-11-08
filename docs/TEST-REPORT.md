# Test report: Phase 1a (8 Nov 2026, updated after first use)

Update: focus-mode workout screen (one exercise at a time, full-screen rest, Easy / Good / Max effort) and the tappable body map. 62 tests passing; focus flow and body map checked at iPhone size with no errors.

## Automated tests: 61 passing (`npm test`)

| Area | What is checked |
| --- | --- |
| Data integrity | Unique ids, valid equipment references, every template exercise doable with the default gym, at least 3 ranked substitutes for each, approved set counts (20, 31, 29, 21) |
| Strength maths | Rounding to equipment steps, RIR-adjusted e1RM and its 12-rep limit, weight, rep and e1RM records, assisted inversion, calibration estimate |
| Progression | No history, increase, top reached below target RIR, +1 rep, hold, reduce after 3 sessions, streak broken by a weight change, dumbbell cap, off-grid weights, assisted, finishers |
| Substitution | Incline press alternatives ranked above flat press and flies, busy equipment removed and restored on expiry, exclusions, history and same-station bonuses, dumbbell penalty for heavy squats |
| Dictation parser | 12 phrasings incl. number words, halves, pounds, RIR forms; rejects text without reps |
| Phases | Phase lookup by date, race prep, taper, recovery modifiers, rotation and taper skip |
| Session flow | Block order, superset alternation, rest only after a round, skipped slots, paused time, volume and muscle sets |
| IndexedDB (fake-indexeddb) | One active session, data survives reopening the database, history only from completed sessions, records against earlier sessions only, swaps, busy equipment, set delete and renumber, discard, backup round trip without duplicates, rejection of invalid files, delete all |

## End-to-end check in a mobile browser

Production build served locally, Chromium with the iPhone 13 viewport (Playwright). Passed with no console errors:

1. Today shows phase, race countdown and next session; Start Upper A.
2. First set requires a weight; logging starts a 150 s rest; Skip works; next set prefilled.
3. Superset: no rest between the two exercises, rest after the round.
4. Quick entry "32 kilograms for 18 reps RIR 2" fills the controls.
5. Swap: marking the lat pulldown busy removes pulldown options; swap recorded against the original.
6. **Offline:** network disabled, page reloaded, app loads from cache, session intact, set logged.
7. Finish shows duration, sets, reps, volume, muscles and next-time weight changes.
8. Next Upper A suggests +2.5 kg from the previous session.
9. Body entry saved; backup export produces a valid JSON file.

## Not tested yet (needs you, on your iPhone)

| Item | Why it matters |
| --- | --- |
| Safari on iOS itself | Tests used Chromium. iOS Safari differs in storage, wake lock and audio |
| Add to Home Screen and offline launch from the icon | Main way you will use the app |
| Screen stays awake during a session | Relies on the Screen Wake Lock API in Safari |
| Rest-timer sound and vibration | Needs the phone unmuted; iPhones do not vibrate from web apps; no alert when the phone is locked |
| Keyboard dictation into the quick-entry box | Depends on iOS dictation output |
| Backup via the share sheet to Files or iCloud Drive, then restore | iOS share sheet behaviour |
| A full 45-minute session in the gym | Timing of Upper B and C, one-handed use, real network drops |
| Equipment list and weight steps at your gym | Default profile is an assumption |

## Known limitations

- Data lives on one phone until a sync backend is added. Weekly export is the only protection against loss.
- No rest alert when the phone is locked (web apps cannot do this without push notifications).
- Exercise cues are AI drafts until you mark them reviewed.
- Body map is a simplified drawing; regions are approximate, not medical anatomy.
