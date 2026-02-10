# Word Rush Voice MVP

Mobile-first vocabulary game for TikTok/Reels style recordings.

## What it does

- Full-screen camera gameplay with transparent HUD on top.
- Voice-only answers (Web Speech API).
- Voice command to skip word: say `skip`, `dalshe`, or `dalee`.
- Optional face filter (camera overlay): one fun mode with `Big Eyes + Giant Mouth`, toggled on Home screen.
- Local leaderboard (stored in `localStorage`).
- Optional in-app run recording (tab capture) with `Save Video` on finish screen.
- `Share Video` via native share sheet when browser/device supports file sharing.
- Trend-focused challenge loop: target score, combo burst moments, urgency cues, strong finish CTA.
- Mobile camera framing mitigation: portrait-first camera constraints plus zoom-out when device supports it.

## Flow

1. `Home`: description, challenge target, filter toggle, local leaderboard.
2. `Settings`: language direction, answer time, words per run.
3. `Game`: camera background, tap-anywhere start, voice translation rounds.
4. `Finish`: score/streak/accuracy + save/share actions.

## Tech stack

- `Vite`
- Vanilla JS (`src/main.js`)
- CSS (`src/style.css`)

## Run locally

```bash
npm install
npm run dev -- --host
```

Open:

- `http://localhost:5173`
- `http://<your-pc-ip>:5173` on phone in the same LAN

## Build / preview

```bash
npm run build
npm run preview -- --host
```

## Browser requirements

- Camera and microphone permissions are required.
- Best support: Chrome / Edge on mobile.
- If speech recognition is unsupported, start button is disabled.
- Face filters use MediaPipe Face Landmarker loaded from CDN on demand, so network access is required on first filter use.

## Recording notes

- In-app recording asks for screen/tab capture on run start.
- Choose the current tab to capture gameplay + overlays.
- Recording uses an internal audio mix track (game SFX + best-effort mic), so clips can still include sound when tab audio is unavailable.
- Direct posting to TikTok/Instagram from browser is not guaranteed; reliable flow is:
  `Save Video` -> upload in TikTok/Instagram app.

## Trend intent

- Fast hook in first seconds (`Challenge: beat X pts`).
- Mid-run pattern changes (combo bursts, timer pressure, fail/recovery moments).
- End-screen CTA optimized for replay/share challenge behavior.

## Project structure

- `index.html` - app shell
- `src/main.js` - screens, game loop, speech/camera logic, recording, scoring, leaderboard
- `src/style.css` - visuals, mobile layout, motion system
- `src/wordDeck.js` - language decks and words
- `docs/VIDEO_DEMO_CHECKLIST.md` - recording checklist
- `docs/DECISIONS_AND_DIFFICULTIES.md` - engineering decisions and tradeoffs
- `docs/TREND_RESEARCH.md` - trend references and applied heuristics
- `docs/DEPLOY_RENDER.md` - Render static-site deployment settings

## Tuning

- Add/edit words: `src/wordDeck.js`
- Round options: `WORD_COUNT_OPTIONS`, `ROUND_SECONDS_OPTIONS` in `src/main.js`
- Scoring formula: `resolveRound()` in `src/main.js`
- Leaderboard size: `MAX_LEADERBOARD_ITEMS` in `src/main.js`
