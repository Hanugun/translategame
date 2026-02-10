# Decisions And Difficulties

## Key decisions

1. Chose `Vite + Vanilla JS` for fastest iteration and easy static hosting.
2. Built mobile-first, vertical UI for direct phone screen recording.
3. Kept game voice-only to match challenge format and reduce UI clutter.
4. Used camera as full-screen background with transparent game HUD to create social-native look.
5. Added event-driven animations (hit/miss flashes, chip pulses, urgency timer) to improve viewer retention in short videos.
6. Persisted settings and leaderboard in `localStorage` for zero-backend MVP.
7. Added post-run video actions (`Save`/`Share`) using browser capture + `MediaRecorder`.

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
5. Sharing limitations of social platforms from browser.
   - Implemented native share-sheet file sharing when available.
   - Kept reliable fallback: save file locally, then upload in app.
6. Inconsistent tab-audio capture in browser recording.
   - Added internal recording audio mix (game SFX + best-effort mic) to avoid silent clips.
7. Mobile selfie camera looked too zoomed on some devices.
   - Added dynamic framing strategy (`cover` vs `contain`) based on actual track aspect ratio.
   - Applied device capability-based zoom-out when supported (`track.applyConstraints` with `zoom`).
8. Recording bootstrap could delay first round start.
   - Removed blocking await from run start path.
   - Recording now starts in background while gameplay begins instantly.
9. Voice loop responsiveness on mobile.
   - Reduced mic warmup delay and auto-retry delay to shorten dead time between user speech and capture restart.
10. Added social-style camera filters without native app SDKs.
   - Implemented on-device face tracking with MediaPipe Face Landmarker (lazy-loaded).
   - Added lightweight canvas effect (`Big Eyes + Giant Mouth`) with throttled detection loop to keep mobile FPS acceptable.

## Trend heuristics used

1. Front-load a clear challenge hook in first seconds.
   - Implemented explicit target-score hook on home + ready overlay.
2. Keep motion/feedback high-frequency during gameplay.
   - Added combo bursts, streak milestones, urgency audio ticks, stronger fail/recover beats.
3. Make end-state shareable and competitive.
   - Finish screen now emphasizes challenge outcome and immediate save/share actions.

## Remaining known constraints

- Speech quality depends on microphone quality and environment noise.
- Safari/WebKit support may differ by OS version; Chrome/Edge remains recommended for demos.
