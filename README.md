# Word Rush Voice MVP

Mobile-first vocabulary game for TikTok/Reels style recordings.

## What it does

- Full-screen camera gameplay with transparent HUD on top.
- Voice-only answers (Web Speech API).
- Voice command to skip word: say `skip`, `dalshe` (`дальше`), or `dalee` (`далее`).
- Local leaderboard (stored in `localStorage`).
- Optional in-app run recording (tab capture) with `Save Video` on finish screen.
- `Share Video` via native share sheet when browser/device supports file sharing.
- 3-screen flow:
1. `Home` (description + leaderboard + start + settings)
2. `Settings` (language, answer time, words per run)
3. `Game` (tap anywhere to start, then live run)
- Finish overlay with score, best streak, accuracy.

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

- Camera and microphone need permission.
- Best support: Chrome / Edge on mobile.
- If speech recognition is unsupported, start button is disabled.

## Recording notes

- In-app recording asks for screen/tab capture on run start.
- Choose the current tab to capture gameplay + overlays.
- Recording now uses an internal audio mix track (game SFX + best-effort mic), so clips still have sound when tab-audio is unavailable.
- Direct posting to TikTok/Instagram from browser is not guaranteed; standard flow is:
  `Save Video` -> upload in TikTok/Instagram app.

## Project structure

- `index.html` - app shell
- `src/main.js` - screens, run loop, speech/camera, scoring, leaderboard
- `src/style.css` - all visuals, mobile layout, animations
- `src/wordDeck.js` - language decks and words
- `docs/VIDEO_DEMO_CHECKLIST.md` - how to record promo demo
- `docs/DECISIONS_AND_DIFFICULTIES.md` - engineering decisions and tradeoffs

## Tuning

- Add/edit words: `src/wordDeck.js`
- Round options: `WORD_COUNT_OPTIONS`, `ROUND_SECONDS_OPTIONS` in `src/main.js`
- Scoring formula: `resolveRound()` in `src/main.js`
- Leaderboard size: `MAX_LEADERBOARD_ITEMS` in `src/main.js`
