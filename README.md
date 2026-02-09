# Word Rush Camera Mode (MVP)

Voice vocabulary game for TikTok/Reels style recording.

## Current flow

1. Lobby screen:
   - game description
   - local leaderboard (stored in localStorage)
   - actions: `Start Challenge` and `Settings`
2. Settings screen:
   - language direction with flags
   - answer time
   - number of words
   - save/back to lobby
3. Game screen:
   - full-screen camera background
   - transparent HUD and road layer over camera
   - full-screen dimmed ready overlay: `Tap anywhere to start`
   - voice-only answer mode
   - skip voice command: say `skip` or `дальше`
4. Finish overlay:
   - final score
   - max streak
   - `Try Again` and `Exit`

## Features

- Two language decks:
  - `🇺🇸 English -> 🇷🇺 Russian`
  - `🇷🇺 Russian -> 🇺🇸 English`
- Settings before run:
  - answer time: `4/6/8/10` sec
  - word count: `5/10/15/20`
- Voice recognition with typed fallback.
- Fuzzy answer matching (including mixed Cyrillic/Latin lookalike fixes, e.g. `дom` -> `дом`).
- Local leaderboard with run metadata.
- Camera controls:
  - fullscreen camera background
  - pip camera card
  - camera flip button

## Run locally

```bash
npm install
npm run dev -- --host
```

Open:

- local: `http://localhost:5173`
- phone in same LAN: `http://<your-pc-ip>:5173`

## Build

```bash
npm run build
npm run preview -- --host
```

## Important browser notes

- Camera and microphone are usually allowed only on `https` or `localhost`.
- Best voice compatibility is Chrome/Edge.
- If voice is blocked, use typed fallback input.

## Project structure

- `src/main.js` - app screens, game loop, speech/camera logic, leaderboard
- `src/style.css` - full UI style (lobby + camera gameplay + overlays)
- `src/wordDeck.js` - language decks and word lists
- `docs/VIDEO_DEMO_CHECKLIST.md` - short recording checklist
- `docs/DECISIONS_AND_DIFFICULTIES.md` - design/implementation notes

## Tuning

- Add/edit words in `src/wordDeck.js`.
- Change options in `WORD_COUNT_OPTIONS` and `ROUND_SECONDS_OPTIONS` in `src/main.js`.
- Adjust scoring in `resolveRound()` in `src/main.js`.
- Adjust leaderboard size via `MAX_LEADERBOARD_ITEMS` in `src/main.js`.
