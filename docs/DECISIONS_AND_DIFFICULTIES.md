# Decisions And Difficulties

## Key decisions

1. Chose `Vite + Vanilla JS` for fastest iteration and easy static hosting.
2. Built mobile-first, vertical UI for direct phone screen recording.
3. Kept game voice-only to match challenge format and reduce UI clutter.
4. Used camera as full-screen background with transparent game HUD to create social-native look.
5. Added event-driven animations (hit/miss flashes, chip pulses, urgency timer) to improve viewer retention in short videos.
6. Persisted settings and leaderboard in `localStorage` for zero-backend MVP.

## Main difficulties and fixes

1. `SpeechRecognition` is unstable across browsers.
   - Added support checks and clear UX if unsupported.
   - Added auto-retry logic in-round for `no-speech` and temporary speech glitches.
2. Voice transcripts are noisy (wrong chars, mixed alphabets, spacing issues).
   - Added text normalization and fuzzy matching (Levenshtein).
   - Added lookalike conversion between Latin/Cyrillic chars.
   - Added compact matching to handle broken spacing.
3. Gameplay readability over camera feed.
   - Strengthened contrast with vignette, HUD glass layers, bigger stats.
   - Moved prompt to bottom-middle and enlarged score/streak/lives.
4. "Viral" feel requirements for promo recording.
   - Added responsive pacing (road speed by streak), SFX, vibration, and concise on-screen status.

## Remaining known constraints

- Speech quality depends on microphone quality and environment noise.
- Safari/WebKit support may differ by OS version; Chrome/Edge remains recommended for demos.
