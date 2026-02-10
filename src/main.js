import "./style.css";
import { DECKS, DEFAULT_DECK_ID, getDeckById } from "./wordDeck";

const LEADERBOARD_KEY = "word-rush-leaderboard-v3";
const SETTINGS_KEY = "word-rush-settings-v1";
const MAX_LEADERBOARD_ITEMS = 20;
const WORD_COUNT_OPTIONS = [5, 10, 15, 20];
const ROUND_SECONDS_OPTIONS = [4, 6, 8, 10];
const DEFAULT_LIVES = 3;
const ROUND_MIC_START_DELAY_MS = 90;
const MIC_AUTO_RETRY_DELAY_MS = 140;
const MIC_AUTO_RETRY_MIN = 4;
const ROUND_TIMER_INTERVAL_MS = 66;
const WARNING_TIMER_SECONDS = 2.2;
const GAME_FLASH_CLASSES = ["fx-hit", "fx-miss", "fx-skip"];
const SKIP_COMMANDS = ["skip", "дальше", "далее", "dalshe", "dalee"];
const CAMERA_MIN_PORTRAIT_RATIO = 0.48;
const CAMERA_MAX_PORTRAIT_RATIO = 0.72;
const CAMERA_WIDE_THRESHOLD = 0.82;
const RECORDING_CHUNK_MS = 250;
const RECORDING_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm"
];
const STREAK_MILESTONES = [3, 5, 8, 12];
const FACE_FX_DETECT_INTERVAL_MS = 85;
const FACE_FX_MAX_PIXELS = 1_050_000;
const MEDIAPIPE_VISION_BUNDLE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
const MEDIAPIPE_WASM_ROOT_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MEDIAPIPE_FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const FACE_LEFT_EYE_INDICES = [33, 133, 159, 145, 160, 144, 158, 153];
const FACE_RIGHT_EYE_INDICES = [362, 263, 386, 374, 385, 380, 387, 373];
const FACE_MOUTH_INDICES = [61, 291, 0, 13, 14, 17, 78, 308, 81, 311, 84, 314];
const FACE_NOSE_CENTER_INDEX = 1;

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
const MediaRecorderCtor = window.MediaRecorder;

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="app">
    <section id="homeScreen" class="screen screen-home">
      <div class="home-glow" aria-hidden="true"></div>

      <header class="home-hero">
        <p class="kicker">VOICE CAMERA CHALLENGE</p>
        <h1>Word Rush</h1>
        <p class="subtitle">
          Translate words out loud, build streak, record your reaction. Say "skip" or "дальше" to skip a word.
        </p>
        <p id="challengeLine" class="challenge-line">Today's challenge: beat the top score.</p>
      </header>

      <section class="home-actions">
        <button id="startFromHomeBtn" class="btn btn-start" type="button">Start Challenge</button>
        <button id="openSettingsBtn" class="btn btn-ghost" type="button">Settings</button>
      </section>
      <section class="home-filter-toggle">
        <label class="filter-toggle-card" for="faceFilterToggle">
          <span class="filter-toggle-copy">
            <strong>Fun Face Filter</strong>
            <small>Big eyes + giant mouth</small>
          </span>
          <span class="filter-toggle-switch">
            <input id="faceFilterToggle" type="checkbox" />
            <span class="filter-toggle-slider"></span>
          </span>
        </label>
      </section>

      <section class="leaderboard-panel">
        <div class="leaderboard-head">
          <h2>Local Leaderboard</h2>
          <button id="clearLeaderboardBtn" type="button" class="btn btn-text">Clear</button>
        </div>
        <ol id="leaderboardList" class="leaderboard-list"></ol>
      </section>
    </section>

    <section id="settingsScreen" class="screen screen-settings hidden">
      <header class="settings-header">
        <button id="settingsBackBtn" class="btn btn-text" type="button">Back</button>
        <h2>Settings</h2>
        <button id="settingsDoneBtn" class="btn btn-text" type="button">Done</button>
      </header>

      <section class="settings-card">
        <p class="settings-title">Language Direction</p>
        <div id="deckOptions" class="deck-options" role="radiogroup" aria-label="Language mode"></div>

        <div class="settings-grid">
          <label class="field">
            <span>Answer time</span>
            <select id="roundSecondsSelect"></select>
          </label>

          <label class="field">
            <span>Words per run</span>
            <select id="wordCountSelect"></select>
          </label>
        </div>

        <p class="settings-note">Settings are applied immediately and used on next run.</p>
      </section>
    </section>

    <section
      id="gameScreen"
      class="screen screen-game hidden"
      data-speed="0"
      data-facing="user"
      data-camera-fit="cover"
    >
      <video id="cameraVideo" class="camera-video" autoplay muted playsinline></video>
      <canvas id="faceFxCanvas" class="face-fx-canvas hidden" aria-hidden="true"></canvas>
      <div class="camera-vignette" aria-hidden="true"></div>

      <div class="road-plane" aria-hidden="true"></div>

      <div class="game-ui">
        <header class="top-float">
          <button id="exitToHomeBtn" type="button" class="icon-btn">Exit</button>
          <p id="modeChip" class="mode-chip">🇺🇸 -> 🇷🇺</p>
          <button id="switchCameraBtn" type="button" class="icon-btn">Flip</button>
        </header>

        <section class="score-ribbon" aria-label="Game stats">
          <span id="scoreChip" class="score-item score-item-score">Score <strong id="scoreValue">0</strong></span>
          <span id="streakChip" class="score-item score-item-streak">Streak <strong id="streakValue">0</strong></span>
          <span id="livesChip" class="score-item score-item-lives">Lives <strong id="livesValue"></strong></span>
          <span id="wordChip" class="score-item score-item-word">Word Left <strong id="wordProgressValue">0</strong></span>
        </section>

        <section class="prompt-stack">
          <p id="comboBurst" class="combo-burst hidden" aria-live="polite"></p>
          <p id="promptWord" class="prompt-word">tap to start</p>
          <p id="promptMeta" class="prompt-meta">🇺🇸 English -> 🇷🇺 Russian</p>
          <p class="heard-line">You said: <span id="heardText">-</span></p>
          <p class="answer-line hidden" id="answerLine">Expected: <span id="correctAnswer">-</span></p>
          <p id="feedbackBadge" class="feedback-badge">READY</p>
        </section>

        <section class="bottom-dock">
          <div class="timer-track">
            <span id="timerFill"></span>
          </div>
          <p class="voice-tip">Voice only mode: say "skip" or "дальше" to skip.</p>
          <p id="statusText" class="status-line">Tap Start Challenge from Home.</p>
        </section>
      </div>

      <section id="readyOverlay" class="overlay ready-overlay" tabindex="0" aria-label="Tap to start">
        <div class="overlay-copy">
          <small id="readyHook">Beat the top score.</small>
          <p>Tap anywhere to start</p>
          <small id="readyDetails">Your run starts immediately.</small>
        </div>
      </section>

      <section id="finishOverlay" class="overlay finish-overlay hidden">
        <div class="finish-card">
          <p class="finish-kicker">Run complete</p>
          <h2 id="finishTitle">Great run</h2>
          <p id="finishStats">Score: 0 | Best streak: 0 | Accuracy: 0%</p>
          <div class="finish-actions">
            <button id="tryAgainBtn" type="button" class="btn btn-start">Try Again</button>
            <button id="finishExitBtn" type="button" class="btn btn-ghost-small">Exit</button>
          </div>
          <div class="finish-video-actions">
            <button id="saveVideoBtn" type="button" class="btn btn-ghost-small" disabled>Save Video</button>
            <button id="shareVideoBtn" type="button" class="btn btn-ghost-small" disabled>Share Video</button>
          </div>
          <p id="finishCta" class="finish-cta">Post this run and challenge a friend to beat your score.</p>
          <p id="videoActionHint" class="video-action-hint">No run video yet.</p>
        </div>
      </section>
    </section>
  </main>
`;

const els = {
  homeScreen: document.querySelector("#homeScreen"),
  settingsScreen: document.querySelector("#settingsScreen"),
  gameScreen: document.querySelector("#gameScreen"),

  startFromHomeBtn: document.querySelector("#startFromHomeBtn"),
  openSettingsBtn: document.querySelector("#openSettingsBtn"),
  faceFilterToggle: document.querySelector("#faceFilterToggle"),
  clearLeaderboardBtn: document.querySelector("#clearLeaderboardBtn"),
  leaderboardList: document.querySelector("#leaderboardList"),
  challengeLine: document.querySelector("#challengeLine"),

  settingsBackBtn: document.querySelector("#settingsBackBtn"),
  settingsDoneBtn: document.querySelector("#settingsDoneBtn"),
  deckOptions: document.querySelector("#deckOptions"),
  roundSecondsSelect: document.querySelector("#roundSecondsSelect"),
  wordCountSelect: document.querySelector("#wordCountSelect"),

  cameraVideo: document.querySelector("#cameraVideo"),
  faceFxCanvas: document.querySelector("#faceFxCanvas"),

  exitToHomeBtn: document.querySelector("#exitToHomeBtn"),
  switchCameraBtn: document.querySelector("#switchCameraBtn"),
  modeChip: document.querySelector("#modeChip"),

  scoreValue: document.querySelector("#scoreValue"),
  streakValue: document.querySelector("#streakValue"),
  livesValue: document.querySelector("#livesValue"),
  wordProgressValue: document.querySelector("#wordProgressValue"),
  scoreChip: document.querySelector("#scoreChip"),
  streakChip: document.querySelector("#streakChip"),
  livesChip: document.querySelector("#livesChip"),
  wordChip: document.querySelector("#wordChip"),

  promptWord: document.querySelector("#promptWord"),
  promptMeta: document.querySelector("#promptMeta"),
  heardText: document.querySelector("#heardText"),
  answerLine: document.querySelector("#answerLine"),
  correctAnswer: document.querySelector("#correctAnswer"),
  feedbackBadge: document.querySelector("#feedbackBadge"),
  comboBurst: document.querySelector("#comboBurst"),

  timerFill: document.querySelector("#timerFill"),
  statusText: document.querySelector("#statusText"),

  readyOverlay: document.querySelector("#readyOverlay"),
  readyHook: document.querySelector("#readyHook"),
  readyDetails: document.querySelector("#readyDetails"),
  finishOverlay: document.querySelector("#finishOverlay"),
  finishTitle: document.querySelector("#finishTitle"),
  finishStats: document.querySelector("#finishStats"),
  finishCta: document.querySelector("#finishCta"),
  tryAgainBtn: document.querySelector("#tryAgainBtn"),
  finishExitBtn: document.querySelector("#finishExitBtn"),
  saveVideoBtn: document.querySelector("#saveVideoBtn"),
  shareVideoBtn: document.querySelector("#shareVideoBtn"),
  videoActionHint: document.querySelector("#videoActionHint")
};

const state = {
  settings: loadSettings(),
  run: null,
  leaderboard: loadLeaderboard(),
  challengeTargetScore: 1200,
  cameraStream: null,
  cameraFacingMode: "user",
  cameraFitMode: "cover",
  recognition: null,
  recognitionSupported: false,
  listening: false,
  stopListeningRequested: false,
  audioCtx: null,
  audioMasterGain: null,
  audioSupported: Boolean(AudioContextCtor),
  recordingSupported: Boolean(
    navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === "function" &&
      MediaRecorderCtor
  ),
  shareSupported: Boolean(navigator.share && typeof File !== "undefined"),
  captureStream: null,
  recorder: null,
  recordingChunks: [],
  recordingBlob: null,
  recordingUrl: "",
  recordingFilename: "",
  recordingProcessing: false,
  pendingDiscardRecording: false,
  recordingMixDestination: null,
  recordingMicStream: null,
  recordingMicSource: null,
  isLikelyMobile: /android|iphone|ipad|ipod/i.test(navigator.userAgent || ""),
  faceFx: {
    loadingPromise: null,
    landmarker: null,
    rafId: null,
    detectIntervalMs: FACE_FX_DETECT_INTERVAL_MS,
    lastDetectAt: 0,
    lastVideoTime: -1,
    hasWarnedFailure: false,
    frameCanvas: document.createElement("canvas"),
    frameCtx: null,
    layout: null
  }
};

state.faceFx.frameCtx = state.faceFx.frameCanvas.getContext("2d", { alpha: true });

init();

function init() {
  buildDeckOptions();
  buildSettingSelects();
  syncHomeFilterToggle();
  applyFaceFilterMode();
  renderLeaderboard();
  updateChallengeCopy();
  setupRecognition();
  applyVoiceSupportState();
  updateFinishVideoActions();
  bindEvents();
  setStatus(defaultHomeStatus());
}

function applyVoiceSupportState() {
  if (state.recognitionSupported) {
    return;
  }
  els.startFromHomeBtn.disabled = true;
  els.startFromHomeBtn.textContent = "Use Chrome for Voice";
}

function bindEvents() {
  els.startFromHomeBtn.addEventListener("click", () => {
    openGameFromHome();
  });

  els.openSettingsBtn.addEventListener("click", () => {
    switchScreen("settings");
  });

  els.settingsBackBtn.addEventListener("click", () => {
    switchScreen("home");
  });

  els.settingsDoneBtn.addEventListener("click", () => {
    switchScreen("home");
  });

  els.clearLeaderboardBtn.addEventListener("click", () => {
    state.leaderboard = [];
    persistLeaderboard();
    renderLeaderboard();
  });

  els.deckOptions.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.name !== "deckOption") {
      return;
    }
    state.settings.deckId = target.value;
    persistSettings();
    syncRunMetaToSettings();
  });

  els.roundSecondsSelect.addEventListener("change", () => {
    state.settings.roundSeconds = Number(els.roundSecondsSelect.value);
    persistSettings();
  });

  els.wordCountSelect.addEventListener("change", () => {
    state.settings.wordCount = Number(els.wordCountSelect.value);
    persistSettings();
  });

  els.faceFilterToggle.addEventListener("change", () => {
    state.settings.faceFilterEnabled = Boolean(els.faceFilterToggle.checked);
    persistSettings();
    applyFaceFilterMode();
  });

  els.readyOverlay.addEventListener("click", () => {
    if (!els.readyOverlay.classList.contains("hidden")) {
      startRunNow();
    }
  });

  els.readyOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!els.readyOverlay.classList.contains("hidden")) {
        startRunNow();
      }
    }
  });

  els.tryAgainBtn.addEventListener("click", () => {
    prepareRun();
    showReadyOverlay();
  });

  els.exitToHomeBtn.addEventListener("click", () => {
    exitToHome();
  });

  els.finishExitBtn.addEventListener("click", () => {
    exitToHome();
  });

  els.saveVideoBtn.addEventListener("click", () => {
    saveRunVideo();
  });

  els.shareVideoBtn.addEventListener("click", () => {
    shareRunVideo();
  });

  els.switchCameraBtn.addEventListener("click", () => {
    toggleCameraFacing();
  });

  window.addEventListener("beforeunload", () => {
    stopRunRecording({ discard: true });
    teardownRun();
    stopFaceFxRendering({ clear: true });
    stopCamera();
    stopCaptureStream();
    clearRunVideoArtifact();
  });

  window.addEventListener("resize", () => {
    syncFaceFxCanvasSize();
  });
}

function buildDeckOptions() {
  els.deckOptions.innerHTML = DECKS.map((deck) => {
    const checked = deck.id === state.settings.deckId ? "checked" : "";
    return `
      <label class="deck-card">
        <input type="radio" name="deckOption" value="${deck.id}" ${checked} />
        <span class="deck-card-inner">
          <strong>${deck.from.flag} ${deck.from.label}</strong>
          <em>to</em>
          <strong>${deck.to.flag} ${deck.to.label}</strong>
        </span>
      </label>
    `;
  }).join("");
}

function buildSettingSelects() {
  els.roundSecondsSelect.innerHTML = ROUND_SECONDS_OPTIONS.map((value) => {
    const selected = value === state.settings.roundSeconds ? "selected" : "";
    return `<option value="${value}" ${selected}>${value}s</option>`;
  }).join("");

  els.wordCountSelect.innerHTML = WORD_COUNT_OPTIONS.map((value) => {
    const selected = value === state.settings.wordCount ? "selected" : "";
    return `<option value="${value}" ${selected}>${value}</option>`;
  }).join("");
}

function syncHomeFilterToggle() {
  if (!els.faceFilterToggle) {
    return;
  }
  els.faceFilterToggle.checked = Boolean(state.settings.faceFilterEnabled);
}

function syncRunMetaToSettings() {
  if (!state.run) {
    return;
  }
  const deck = getDeckById(state.settings.deckId);
  els.modeChip.textContent = `${deck.from.flag} ${deck.from.label} -> ${deck.to.flag} ${deck.to.label}`;
  els.promptMeta.textContent = `${deck.from.flag} ${deck.promptLangLabel} -> ${deck.to.flag} ${deck.answerLangLabel}`;
}

function switchScreen(screen) {
  const isHome = screen === "home";
  const isSettings = screen === "settings";
  const isGame = screen === "game";

  els.homeScreen.classList.toggle("hidden", !isHome);
  els.settingsScreen.classList.toggle("hidden", !isSettings);
  els.gameScreen.classList.toggle("hidden", !isGame);
}
function openGameFromHome() {
  if (!state.recognitionSupported) {
    setStatus("Speech recognition is unavailable. Open in Chrome or Edge.");
    return;
  }
  prepareRun();
  switchScreen("game");
  showReadyOverlay();
  startCamera();
}

function prepareRun() {
  teardownRun();
  clearRunVideoArtifact();
  state.recordingProcessing = false;
  updateFinishVideoActions();

  const deck = getDeckById(state.settings.deckId);
  const words = pickWords(deck.items, state.settings.wordCount).map((item) => {
    const preparedAnswers = prepareAnswerVariants(item.answers);
    const minAnswerLength = preparedAnswers.length
      ? Math.min(...preparedAnswers.map((answer) => answer.compact.length))
      : 1;
    return {
      ...item,
      preparedAnswers,
      minAnswerLength
    };
  });
  const challengeTargetScore = calculateChallengeTarget();
  state.challengeTargetScore = challengeTargetScore;

  state.run = {
    deck,
    words,
    challengeTargetScore,
    index: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    lives: DEFAULT_LIVES,
    totalAnswered: 0,
    totalCorrect: 0,
    timeLeft: state.settings.roundSeconds,
    roundTimerId: null,
    roundStartedAt: 0,
    nextRoundId: null,
    feedbackResetId: null,
    autoMicId: null,
    micRetryId: null,
    micRetriesLeft: getRoundMicRetryLimit(),
    heardFinalInRound: false,
    currentWord: null,
    roundLocked: true,
    active: false,
    finished: false,
    lastLivesVisual: DEFAULT_LIVES,
    lastScoreVisual: 0,
    lastStreakVisual: 0,
    lastWordsVisual: words.length,
    lastTickSecond: Math.ceil(state.settings.roundSeconds),
    comboBurstId: null
  };

  els.finishOverlay.classList.add("hidden");
  els.answerLine.classList.add("hidden");

  els.modeChip.textContent = `${deck.from.flag} ${deck.from.label} -> ${deck.to.flag} ${deck.to.label}`;

  els.promptWord.textContent = "tap anywhere";
  els.promptMeta.textContent = `${deck.from.flag} ${deck.promptLangLabel} -> ${deck.to.flag} ${deck.answerLangLabel}`;
  els.heardText.textContent = "-";
  els.correctAnswer.textContent = "-";
  setFeedback("READY", "neutral");
  updateTimer(1);
  updateHud();
  setStatus("Tap anywhere to start.");
  setComboBurst("", "neutral", true);
  els.gameScreen.classList.remove("is-urgent", ...GAME_FLASH_CLASSES);
}

function showReadyOverlay() {
  if (!state.run) {
    return;
  }

  const deck = state.run.deck;
  const details = [
    `${deck.from.flag} ${deck.promptLangLabel} -> ${deck.to.flag} ${deck.answerLangLabel}`,
    `${state.settings.wordCount} words`,
    `${state.settings.roundSeconds}s per word`,
    `target ${state.challengeTargetScore} pts`,
    `say "skip" or "дальше" to skip`,
    `allow screen capture if you want save/share video`
  ];

  if (els.readyHook) {
    els.readyHook.textContent = `Challenge: beat ${state.challengeTargetScore} pts`;
  }
  els.readyDetails.textContent = details.join(" | ");
  els.readyOverlay.classList.remove("hidden");
  els.readyOverlay.focus();
}

async function startRunNow() {
  if (!state.run) {
    return;
  }
  if (state.run.active) {
    return;
  }

  els.readyOverlay.classList.add("hidden");
  els.finishOverlay.classList.add("hidden");

  ensureAudioContext();
  state.run.active = true;
  state.run.finished = false;
  void startRunRecording().catch(() => {
    if (isRunActive()) {
      setStatus("Run started. Browser recording unavailable.");
    }
  });
  playRunStartSound();
  vibrate([10, 30, 10]);

  startNextRound();
}

function startNextRound() {
  if (!isRunActive() || !state.run) {
    return;
  }

  if (state.run.index >= state.run.words.length) {
    finishRun(true);
    return;
  }

  state.run.currentWord = state.run.words[state.run.index];
  state.run.roundLocked = false;
  state.run.timeLeft = state.settings.roundSeconds;
  state.run.roundStartedAt = performance.now();
  state.run.heardFinalInRound = false;
  state.run.micRetriesLeft = getRoundMicRetryLimit();
  state.run.lastTickSecond = Math.ceil(state.settings.roundSeconds);

  els.promptWord.textContent = state.run.currentWord.prompt;
  els.correctAnswer.textContent = state.run.currentWord.answers.join(", ");
  els.answerLine.classList.add("hidden");
  els.heardText.textContent = "-";
  setFeedback("GO", "neutral");
  setComboBurst("", "neutral", true);
  setStatus("Say translation now.");
  updateHud();
  updateTimer(1);
  pulseElement(els.promptWord, "fx-word-enter");
  pulseElement(els.wordChip, "fx-chip-pop");

  clearRoundTimer();
  clearMicRetryTimer();
  state.run.roundTimerId = window.setInterval(() => {
    if (!state.run) {
      return;
    }

    const elapsed = (performance.now() - state.run.roundStartedAt) / 1000;
    const left = Math.max(0, state.settings.roundSeconds - elapsed);
    state.run.timeLeft = left;
    updateTimer(left / state.settings.roundSeconds);
    handleRoundTimerCue(left);

    if (left <= 0) {
      resolveRound(false, "TIME", "Time is up");
    }
  }, ROUND_TIMER_INTERVAL_MS);

  if (state.recognitionSupported) {
    if (state.run.autoMicId) {
      window.clearTimeout(state.run.autoMicId);
    }
    state.run.autoMicId = window.setTimeout(() => {
      if (isRunActive() && state.run && !state.run.roundLocked) {
        startListening();
      }
      if (state.run) {
        state.run.autoMicId = null;
      }
    }, ROUND_MIC_START_DELAY_MS);
  }
}

function evaluateAnswerCandidates(rawCandidates, { allowMiss = true } = {}) {
  if (!isRunActive() || !state.run || state.run.roundLocked || !state.run.currentWord) {
    return;
  }

  const candidates = rawCandidates
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!candidates.length) {
    return;
  }

  const normalizedCandidates = candidates.map((candidate) => normalizeText(candidate));
  els.heardText.textContent = candidates[0];

  if (!allowMiss && state.run.currentWord.minAnswerLength) {
    const hasEnoughChars = normalizedCandidates.some(
      (candidate) => compactText(candidate).length >= Math.max(2, state.run.currentWord.minAnswerLength - 1)
    );
    if (!hasEnoughChars) {
      return;
    }
  }

  const hasSkipCommand = normalizedCandidates.some((candidate) => isSkipCommand(candidate));
  if (hasSkipCommand) {
    resolveSkipRound();
    return;
  }

  const isCorrect = normalizedCandidates.some((candidate) =>
    isCorrectAnswer(candidate, state.run.currentWord.preparedAnswers || [])
  );

  if (isCorrect) {
    resolveRound(true, "PERFECT", "Correct");
  } else if (allowMiss) {
    resolveRound(false, "MISS", "Miss");
  }
}

function resolveSkipRound() {
  if (!isRunActive() || !state.run || state.run.roundLocked || !state.run.currentWord) {
    return;
  }

  state.run.roundLocked = true;
  stopListening();
  clearRoundTimer();
  clearMicRetryTimer();
  state.run.streak = 0;

  setFeedback("SKIP", "neutral");
  setStatus("Skipped by voice command.");
  els.answerLine.classList.remove("hidden");
  playSkipSound();
  setComboBurst("SKIP", "neutral");
  pulseElement(els.wordChip, "fx-chip-pop");
  pulseElement(els.streakChip, "fx-chip-soft");
  flashGame("fx-skip");
  updateHud();
  scheduleFeedbackReset();

  state.run.index += 1;
  queueNextRound(700);
}

function resolveRound(isCorrect, badgeText, statusText) {
  if (!isRunActive() || !state.run || state.run.roundLocked || !state.run.currentWord) {
    return;
  }

  state.run.roundLocked = true;
  state.run.totalAnswered += 1;
  stopListening();
  clearRoundTimer();
  clearMicRetryTimer();

  if (isCorrect) {
    state.run.totalCorrect += 1;
    state.run.streak += 1;
    state.run.bestStreak = Math.max(state.run.bestStreak, state.run.streak);

    const speedBonus = Math.round(state.run.timeLeft * 16);
    const streakBonus = state.run.streak * 16;
    const gain = 100 + speedBonus + streakBonus;

    state.run.score += gain;
    setFeedback(badgeText, "success");
    setStatus(`${statusText} | +${gain} points`);
    playSuccessSound();
    vibrate([12]);
    playStreakSound(state.run.streak);
    if (state.run.streak >= 2) {
      setComboBurst(`x${state.run.streak} COMBO`, "hot");
    } else {
      setComboBurst("+100", "success");
    }
    pulseElement(els.scoreChip, "fx-chip-pop");
    pulseElement(els.streakChip, "fx-chip-hot");
    flashGame("fx-hit");

    if (STREAK_MILESTONES.includes(state.run.streak)) {
      setStatus(`Streak x${state.run.streak}! Keep pushing.`);
      playMilestoneSound(state.run.streak);
      vibrate([16, 20, 16]);
    }
  } else {
    state.run.streak = 0;
    state.run.lives -= 1;

    setFeedback(badgeText, "fail");
    setStatus(statusText);
    els.answerLine.classList.remove("hidden");
    playFailSound();
    setComboBurst("MISS", "fail");
    vibrate([35, 25, 35]);
    pulseElement(els.livesChip, "fx-chip-shake");
    pulseElement(els.streakChip, "fx-chip-soft");
    flashGame("fx-miss");
  }

  updateHud();
  scheduleFeedbackReset();

  state.run.index += 1;
  queueNextRound(900);
}

function finishRun(deckCompleted) {
  if (!state.run || state.run.finished) {
    return;
  }

  state.run.finished = true;
  state.run.active = false;
  teardownRoundTimers();
  stopListening();
  stopRunRecording();

  const accuracy = state.run.totalAnswered
    ? Math.round((state.run.totalCorrect / state.run.totalAnswered) * 100)
    : 0;
  const beatChallenge = state.run.score >= state.run.challengeTargetScore;

  els.finishTitle.textContent = beatChallenge ? "Challenge Beaten" : deckCompleted ? "Deck Cleared" : "Run Over";
  els.finishStats.textContent =
    `Score: ${state.run.score} / Target: ${state.run.challengeTargetScore}` +
    ` | Best streak: ${state.run.bestStreak} | Accuracy: ${accuracy}%`;
  if (els.finishCta) {
    els.finishCta.textContent = beatChallenge
      ? "Challenge cleared. Post this run and tag a friend to beat it."
      : "Post your run and challenge a friend to beat your score.";
  }
  els.finishOverlay.classList.remove("hidden");
  updateFinishVideoActions();

  pushLeaderboardEntry({
    score: state.run.score,
    bestStreak: state.run.bestStreak,
    accuracy,
    deckId: state.run.deck.id,
    words: state.run.words.length,
    roundSeconds: state.settings.roundSeconds,
    createdAt: Date.now()
  });

  if (beatChallenge) {
    playMilestoneSound(state.run.bestStreak + 4);
    vibrate([24, 35, 24]);
  }
  setStatus(deckCompleted ? "Great run. Try again or exit." : "Out of lives.");
}

function exitToHome() {
  teardownRun();
  stopCamera();
  stopCaptureStream();
  switchScreen("home");
  renderLeaderboard();
  setStatus(defaultHomeStatus());
}

function teardownRun() {
  stopRunRecording({ discard: true });
  stopListening();
  teardownRoundTimers();

  state.run = null;
  els.finishOverlay.classList.add("hidden");
  els.readyOverlay.classList.add("hidden");
  els.gameScreen.dataset.speed = "0";
  els.gameScreen.dataset.cameraFit = "cover";
  els.gameScreen.classList.remove("is-urgent");
  setComboBurst("", "neutral", true);
}

function teardownRoundTimers() {
  if (!state.run) {
    return;
  }

  clearRoundTimer();

  if (state.run.nextRoundId) {
    window.clearTimeout(state.run.nextRoundId);
    state.run.nextRoundId = null;
  }
  if (state.run.feedbackResetId) {
    window.clearTimeout(state.run.feedbackResetId);
    state.run.feedbackResetId = null;
  }
  if (state.run.autoMicId) {
    window.clearTimeout(state.run.autoMicId);
    state.run.autoMicId = null;
  }
  if (state.run.comboBurstId) {
    window.clearTimeout(state.run.comboBurstId);
    state.run.comboBurstId = null;
  }
  clearMicRetryTimer();
}

function clearRoundTimer() {
  if (!state.run || !state.run.roundTimerId) {
    return;
  }
  window.clearInterval(state.run.roundTimerId);
  state.run.roundTimerId = null;
}

function clearMicRetryTimer() {
  if (!state.run || !state.run.micRetryId) {
    return;
  }
  window.clearTimeout(state.run.micRetryId);
  state.run.micRetryId = null;
}

function queueNextRound(delayMs) {
  if (!state.run) {
    return;
  }

  if (state.run.nextRoundId) {
    window.clearTimeout(state.run.nextRoundId);
  }

  state.run.nextRoundId = window.setTimeout(() => {
    if (!state.run || state.run.finished) {
      return;
    }
    if (state.run.lives <= 0) {
      finishRun(false);
      return;
    }
    if (state.run.index >= state.run.words.length) {
      finishRun(true);
      return;
    }
    startNextRound();
  }, delayMs);
}

function scheduleFeedbackReset() {
  if (!state.run) {
    return;
  }

  if (state.run.feedbackResetId) {
    window.clearTimeout(state.run.feedbackResetId);
  }

  state.run.feedbackResetId = window.setTimeout(() => {
    if (!state.run) {
      return;
    }
    setFeedback("READY", "neutral");
    state.run.feedbackResetId = null;
  }, 700);
}

function updateHud() {
  if (!state.run) {
    els.scoreValue.textContent = "0";
    els.streakValue.textContent = "0";
    els.livesValue.innerHTML = renderLives(DEFAULT_LIVES);
    els.wordProgressValue.textContent = "0";
    els.gameScreen.dataset.speed = "0";
    return;
  }

  const wordsLeft = Math.max(0, state.run.words.length - state.run.index);
  if (state.run.score > state.run.lastScoreVisual) {
    pulseElement(els.scoreChip, "fx-chip-pop");
  }
  if (state.run.streak > state.run.lastStreakVisual) {
    pulseElement(els.streakChip, "fx-chip-hot");
  }
  if (wordsLeft < state.run.lastWordsVisual) {
    pulseElement(els.wordChip, "fx-chip-pop");
  }
  if (state.run.lives < state.run.lastLivesVisual) {
    animateLivesLoss();
  }

  state.run.lastScoreVisual = state.run.score;
  state.run.lastStreakVisual = state.run.streak;
  state.run.lastWordsVisual = wordsLeft;
  state.run.lastLivesVisual = state.run.lives;

  els.scoreValue.textContent = String(state.run.score);
  els.streakValue.textContent = String(state.run.streak);
  els.livesValue.innerHTML = renderLives(state.run.lives);
  els.wordProgressValue.textContent = String(wordsLeft);

  const speedLevel = Math.min(4, Math.floor(state.run.streak / 2));
  els.gameScreen.dataset.speed = String(speedLevel);
}

function renderLives(count) {
  const maxLives = DEFAULT_LIVES;
  return Array.from({ length: maxLives }, (_, index) => {
    const on = index < count;
    return `<span class="heart ${on ? "heart-on" : "heart-off"}">❤</span>`;
  }).join("");
}

function animateLivesLoss() {
  els.livesValue.classList.remove("lives-hit");
  void els.livesValue.offsetWidth;
  els.livesValue.classList.add("lives-hit");
  pulseElement(els.livesChip, "fx-chip-shake");
}

function setFeedback(text, tone) {
  els.feedbackBadge.textContent = text;
  els.feedbackBadge.dataset.tone = tone;
  pulseElement(els.feedbackBadge, "fx-badge-pop");
}

function updateTimer(ratio) {
  const bounded = Math.max(0, Math.min(1, ratio));
  els.timerFill.style.transform = `scaleX(${bounded})`;
  els.timerFill.classList.toggle("is-danger", bounded <= 0.25);
  els.gameScreen.classList.toggle("is-urgent", bounded <= 0.25 && isRunActive());
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function defaultHomeStatus() {
  if (state.recognitionSupported) {
    return "Press Start Challenge to begin.";
  }
  return "Speech recognition is unavailable. Open in Chrome or Edge.";
}

function getTopScore() {
  if (!state.leaderboard.length) {
    return 0;
  }
  return Math.max(0, Number(state.leaderboard[0].score) || 0);
}

function calculateChallengeTarget() {
  const topScore = getTopScore();
  if (!topScore) {
    return 1200;
  }
  const boosted = Math.round(topScore * 1.08);
  return Math.max(1200, Math.ceil(boosted / 10) * 10);
}

function updateChallengeCopy() {
  state.challengeTargetScore = calculateChallengeTarget();
  if (els.challengeLine) {
    const topScore = getTopScore();
    els.challengeLine.textContent = topScore
      ? `Today's challenge: beat ${state.challengeTargetScore} pts (top is ${topScore}).`
      : `Today's challenge: hit ${state.challengeTargetScore} pts.`;
  }
  if (els.readyHook) {
    els.readyHook.textContent = `Challenge: beat ${state.challengeTargetScore} pts`;
  }
}

function handleRoundTimerCue(timeLeft) {
  if (!state.run || state.run.roundLocked) {
    return;
  }

  if (timeLeft > WARNING_TIMER_SECONDS) {
    state.run.lastTickSecond = Math.ceil(timeLeft);
    return;
  }

  const wholeLeft = Math.ceil(timeLeft);
  if (wholeLeft < state.run.lastTickSecond) {
    state.run.lastTickSecond = wholeLeft;
    playWarningTickSound(wholeLeft);
    if (wholeLeft <= 2) {
      vibrate([8]);
    }
  }
}

function setComboBurst(text, tone = "neutral", hidden = false) {
  if (!els.comboBurst) {
    return;
  }

  if (!state.run) {
    els.comboBurst.textContent = "";
    els.comboBurst.classList.add("hidden");
    return;
  }

  if (state.run.comboBurstId) {
    window.clearTimeout(state.run.comboBurstId);
    state.run.comboBurstId = null;
  }

  if (hidden || !text) {
    els.comboBurst.textContent = "";
    els.comboBurst.classList.add("hidden");
    els.comboBurst.dataset.tone = "neutral";
    return;
  }

  els.comboBurst.textContent = text;
  els.comboBurst.dataset.tone = tone;
  els.comboBurst.classList.remove("hidden");
  pulseElement(els.comboBurst, "combo-burst-pop");

  state.run.comboBurstId = window.setTimeout(() => {
    if (!state.run) {
      return;
    }
    els.comboBurst.classList.add("hidden");
    state.run.comboBurstId = null;
  }, 740);
}

function getRoundMicRetryLimit() {
  return Math.max(MIC_AUTO_RETRY_MIN, Math.ceil(state.settings.roundSeconds * 1.2));
}

function pulseElement(element, className) {
  if (!element) {
    return;
  }
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function flashGame(className) {
  for (const flashClass of GAME_FLASH_CLASSES) {
    els.gameScreen.classList.remove(flashClass);
  }
  void els.gameScreen.offsetWidth;
  els.gameScreen.classList.add(className);
}

function isRunActive() {
  return Boolean(state.run && state.run.active && !state.run.finished);
}

async function startCamera() {
  stopCamera();

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    setStatus("Camera API is not available in this browser.");
    return;
  }

  const targetRatio = getTargetCameraAspectRatio();
  const cameraAttempts = [
    {
      video: {
        facingMode: { exact: state.cameraFacingMode },
        width: { ideal: 1080 },
        height: { ideal: 1920 },
        aspectRatio: { ideal: targetRatio },
        resizeMode: "crop-and-scale",
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    },
    {
      video: {
        facingMode: { ideal: state.cameraFacingMode },
        width: { ideal: 1080 },
        height: { ideal: 1920 },
        aspectRatio: { ideal: targetRatio },
        resizeMode: "crop-and-scale",
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    },
    {
      video: {
        facingMode: { ideal: state.cameraFacingMode },
        width: { ideal: 1280 },
        aspectRatio: { ideal: targetRatio },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    }
  ];

  try {
    const stream = await getFirstWorkingCameraStream(cameraAttempts);

    state.cameraStream = stream;
    els.cameraVideo.srcObject = stream;
    els.gameScreen.dataset.facing = state.cameraFacingMode;
    els.gameScreen.dataset.cameraFit = "cover";
    let framingStatus = "Camera ready. Tap anywhere to start.";
    const [videoTrack] = stream.getVideoTracks();
    if (videoTrack) {
      framingStatus = await applyBestCameraFraming(videoTrack);
    }
    setStatus(framingStatus);
    await startFaceFxRendering();
  } catch {
    stopFaceFxRendering({ clear: true });
    setStatus("Camera permission blocked. Game still works without camera.");
  }
}

async function getFirstWorkingCameraStream(constraintsList) {
  let lastError = null;
  for (const constraints of constraintsList) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Camera init failed");
}

function getTargetCameraAspectRatio() {
  if (!window.innerWidth || !window.innerHeight) {
    return 9 / 16;
  }

  const ratio = window.innerWidth / window.innerHeight;
  return Math.min(CAMERA_MAX_PORTRAIT_RATIO, Math.max(CAMERA_MIN_PORTRAIT_RATIO, ratio));
}

function stopCamera() {
  stopFaceFxRendering({ clear: true });

  if (!state.cameraStream) {
    return;
  }

  for (const track of state.cameraStream.getTracks()) {
    track.stop();
  }

  state.cameraStream = null;
  els.cameraVideo.srcObject = null;
}

function stopCaptureStream() {
  if (!state.captureStream) {
    return;
  }

  for (const track of state.captureStream.getTracks()) {
    track.stop();
  }
  state.captureStream = null;
}

function toggleCameraFacing() {
  state.cameraFacingMode = state.cameraFacingMode === "user" ? "environment" : "user";
  if (!els.gameScreen.classList.contains("hidden")) {
    startCamera();
  }
}

async function applyBestCameraFraming(videoTrack) {
  const initialAspectRatio = getTrackAspectRatio(videoTrack);
  let didForcePortrait = false;
  if (initialAspectRatio > CAMERA_WIDE_THRESHOLD) {
    didForcePortrait = await forcePortraitTrack(videoTrack);
  }

  let didApplyZoomOut = false;
  if (typeof videoTrack.getCapabilities === "function") {
    const capabilities = videoTrack.getCapabilities();
    if (capabilities && capabilities.zoom && typeof capabilities.zoom.min === "number") {
      try {
        await videoTrack.applyConstraints({ advanced: [{ zoom: capabilities.zoom.min }] });
        didApplyZoomOut = true;
      } catch {
        didApplyZoomOut = false;
      }
    }
  }

  state.cameraFitMode = "cover";
  els.gameScreen.dataset.cameraFit = state.cameraFitMode;
  const aspectRatio = getTrackAspectRatio(videoTrack);

  if (didForcePortrait || didApplyZoomOut) {
    return "Camera ready (portrait framing). Tap anywhere to start.";
  }
  if (state.isLikelyMobile && aspectRatio > CAMERA_WIDE_THRESHOLD) {
    return "Camera ready. Your device returns wide selfie stream, using best full-screen crop.";
  }
  return "Camera ready. Tap anywhere to start.";
}

async function forcePortraitTrack(videoTrack) {
  if (!videoTrack || typeof videoTrack.applyConstraints !== "function") {
    return false;
  }

  const targetRatio = getTargetCameraAspectRatio();
  const attempts = [
    {
      width: { ideal: 1080 },
      height: { ideal: 1920 },
      aspectRatio: { ideal: targetRatio },
      resizeMode: "crop-and-scale"
    },
    {
      width: { ideal: 720 },
      height: { ideal: 1280 },
      aspectRatio: { ideal: targetRatio }
    },
    {
      aspectRatio: { ideal: targetRatio }
    }
  ];

  for (const constraints of attempts) {
    try {
      await videoTrack.applyConstraints(constraints);
      const ratio = getTrackAspectRatio(videoTrack);
      if (!ratio || ratio <= CAMERA_WIDE_THRESHOLD) {
        return true;
      }
    } catch {
      // Keep trying softer constraint sets.
    }
  }

  return false;
}

function getTrackAspectRatio(videoTrack) {
  if (!videoTrack || typeof videoTrack.getSettings !== "function") {
    return 0;
  }
  const settings = videoTrack.getSettings();
  return settings.aspectRatio || (settings.width && settings.height ? settings.width / settings.height : 0);
}

function applyFaceFilterMode() {
  const enabled = isFaceFilterEnabled();
  els.faceFxCanvas.classList.toggle("hidden", !enabled);

  if (!enabled) {
    stopFaceFxRendering({ clear: true });
    return;
  }

  if (state.cameraStream) {
    void startFaceFxRendering();
  }
}

function isFaceFilterEnabled() {
  return Boolean(state.settings.faceFilterEnabled);
}

async function ensureFaceLandmarker() {
  if (!isFaceFilterEnabled()) {
    return false;
  }
  if (state.faceFx.landmarker) {
    return true;
  }
  if (state.faceFx.loadingPromise) {
    return state.faceFx.loadingPromise;
  }

  state.faceFx.loadingPromise = (async () => {
    try {
      setStatus("Loading face filter model...");
      const visionBundle = await import(/* @vite-ignore */ MEDIAPIPE_VISION_BUNDLE_URL);
      const { FaceLandmarker, FilesetResolver } = visionBundle;
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT_URL);
      state.faceFx.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MEDIAPIPE_FACE_MODEL_URL },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.52,
        minFacePresenceConfidence: 0.52,
        minTrackingConfidence: 0.5
      });
      state.faceFx.hasWarnedFailure = false;
      return true;
    } catch {
      if (!state.faceFx.hasWarnedFailure) {
        state.faceFx.hasWarnedFailure = true;
        setStatus("Face filter failed to load. Continue without filter.");
      }
      state.settings.faceFilterEnabled = false;
      syncHomeFilterToggle();
      persistSettings();
      applyFaceFilterMode();
      return false;
    } finally {
      state.faceFx.loadingPromise = null;
    }
  })();

  return state.faceFx.loadingPromise;
}

async function startFaceFxRendering() {
  if (!state.cameraStream || !isFaceFilterEnabled()) {
    return;
  }
  const ready = await ensureFaceLandmarker();
  if (!ready || !state.cameraStream || !isFaceFilterEnabled()) {
    return;
  }
  if (state.faceFx.rafId) {
    return;
  }

  syncFaceFxCanvasSize();
  state.faceFx.lastDetectAt = 0;
  state.faceFx.lastVideoTime = -1;
  state.faceFx.rafId = window.requestAnimationFrame(faceFxTick);
}

function stopFaceFxRendering({ clear = false } = {}) {
  if (state.faceFx.rafId) {
    window.cancelAnimationFrame(state.faceFx.rafId);
    state.faceFx.rafId = null;
  }
  state.faceFx.lastVideoTime = -1;
  state.faceFx.lastDetectAt = 0;
  state.faceFx.layout = null;
  state.faceFx.tracked = null;
  if (clear) {
    clearFaceFxCanvas();
  }
}

function clearFaceFxCanvas() {
  if (!els.faceFxCanvas) {
    return;
  }
  const ctx = els.faceFxCanvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, els.faceFxCanvas.width || 0, els.faceFxCanvas.height || 0);
}

function syncFaceFxCanvasSize() {
  if (!els.faceFxCanvas) {
    return;
  }

  const rect = els.gameScreen.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let width = Math.max(2, Math.round(rect.width * dpr));
  let height = Math.max(2, Math.round(rect.height * dpr));
  const pixels = width * height;
  if (pixels > FACE_FX_MAX_PIXELS) {
    const downScale = Math.sqrt(FACE_FX_MAX_PIXELS / pixels);
    width = Math.max(2, Math.round(width * downScale));
    height = Math.max(2, Math.round(height * downScale));
  }

  if (els.faceFxCanvas.width !== width || els.faceFxCanvas.height !== height) {
    els.faceFxCanvas.width = width;
    els.faceFxCanvas.height = height;
  }
  if (state.faceFx.frameCanvas.width !== width || state.faceFx.frameCanvas.height !== height) {
    state.faceFx.frameCanvas.width = width;
    state.faceFx.frameCanvas.height = height;
  }
}

function faceFxTick(now) {
  if (!state.faceFx.landmarker || !state.cameraStream || !isFaceFilterEnabled()) {
    stopFaceFxRendering({ clear: true });
    return;
  }

  const video = els.cameraVideo;
  if (!video || video.readyState < 2) {
    state.faceFx.rafId = window.requestAnimationFrame(faceFxTick);
    return;
  }

  if (now - state.faceFx.lastDetectAt < state.faceFx.detectIntervalMs) {
    state.faceFx.rafId = window.requestAnimationFrame(faceFxTick);
    return;
  }
  if (video.currentTime === state.faceFx.lastVideoTime) {
    state.faceFx.rafId = window.requestAnimationFrame(faceFxTick);
    return;
  }

  syncFaceFxCanvasSize();
  const canvas = els.faceFxCanvas;
  const ctx = canvas.getContext("2d");
  const frameCtx = state.faceFx.frameCtx;
  if (!ctx || !frameCtx || !canvas.width || !canvas.height) {
    state.faceFx.rafId = window.requestAnimationFrame(faceFxTick);
    return;
  }

  state.faceFx.lastDetectAt = now;
  state.faceFx.lastVideoTime = video.currentTime;

  const layout = computeCameraLayout(canvas.width, canvas.height, video.videoWidth, video.videoHeight);
  state.faceFx.layout = layout;
  drawCameraFrameToContext(frameCtx, state.faceFx.frameCanvas, video, layout);

  let result = null;
  try {
    result = state.faceFx.landmarker.detectForVideo(video, now);
  } catch {
    if (!state.faceFx.hasWarnedFailure) {
      state.faceFx.hasWarnedFailure = true;
      setStatus("Face filter tracking error. Turn it off from Home if needed.");
    }
    state.faceFx.rafId = window.requestAnimationFrame(faceFxTick);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const landmarks = result && Array.isArray(result.faceLandmarks) ? result.faceLandmarks[0] : null;
  if (landmarks) {
    renderFaceFilterFrame(ctx, landmarks);
  }

  state.faceFx.rafId = window.requestAnimationFrame(faceFxTick);
}

function computeCameraLayout(canvasWidth, canvasHeight, sourceWidth, sourceHeight) {
  const safeSourceWidth = Math.max(2, sourceWidth || canvasWidth || 2);
  const safeSourceHeight = Math.max(2, sourceHeight || canvasHeight || 2);
  const useContain = state.cameraFitMode === "contain";
  const scale = useContain
    ? Math.min(canvasWidth / safeSourceWidth, canvasHeight / safeSourceHeight)
    : Math.max(canvasWidth / safeSourceWidth, canvasHeight / safeSourceHeight);
  const drawWidth = safeSourceWidth * scale;
  const drawHeight = safeSourceHeight * scale;
  const offsetX = (canvasWidth - drawWidth) * 0.5;
  const offsetY = (canvasHeight - drawHeight) * 0.5;

  return {
    drawWidth,
    drawHeight,
    offsetX,
    offsetY,
    mirrored: els.gameScreen.dataset.facing !== "environment"
  };
}

function drawCameraFrameToContext(ctx, canvas, video, layout) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (layout.mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, layout.offsetX, layout.offsetY, layout.drawWidth, layout.drawHeight);
  ctx.restore();
}

function renderFaceFilterFrame(ctx, landmarks) {
  if (!state.faceFx.layout) {
    return;
  }
  drawMemeBigEyesBigMouthEffect(ctx, landmarks);
}

function drawMemeBigEyesBigMouthEffect(ctx, landmarks) {
  const leftEye = getLandmarkBounds(landmarks, FACE_LEFT_EYE_INDICES);
  const rightEye = getLandmarkBounds(landmarks, FACE_RIGHT_EYE_INDICES);
  const mouth = getLandmarkBounds(landmarks, FACE_MOUTH_INDICES);
  if (!leftEye || !rightEye || !mouth) {
    return;
  }

  const mouthMetrics = computeMouthMetrics(landmarks, mouth);
  const rawPlate = computeMemePlateBounds(leftEye, rightEye, mouth);
  const plate = smoothTrackedBounds("plate", rawPlate, 0.34);
  const nosePoint = mapLandmarkToCanvas(landmarks[FACE_NOSE_CENTER_INDEX]) || {
    x: plate.cx,
    y: plate.cy
  };
  const skinTone = sampleSkinToneFromFrame(nosePoint.x, nosePoint.y);
  drawMemeFacePlate(ctx, plate, skinTone);

  const eyeY = plate.y + plate.h * 0.305;
  const eyeRx = plate.w * 0.266;
  const eyeRy = plate.h * 0.172;
  const leftEyeAngle = computeEyeAngle(landmarks, 33, 133);
  const rightEyeAngle = computeEyeAngle(landmarks, 362, 263);
  const leftRawTarget = {
    cx: plate.cx - plate.w * 0.252,
    cy: eyeY,
    rx: eyeRx,
    ry: eyeRy
  };
  const rightRawTarget = {
    cx: plate.cx + plate.w * 0.252,
    cy: eyeY,
    rx: eyeRx,
    ry: eyeRy
  };
  const leftTarget = smoothTrackedBounds("leftEye", leftRawTarget, 0.45);
  const rightTarget = smoothTrackedBounds("rightEye", rightRawTarget, 0.45);

  drawMemeEye(ctx, leftEye, leftTarget, leftEyeAngle);
  drawMemeEye(ctx, rightEye, rightTarget, rightEyeAngle);

  const mouthOpenRatio = clamp(mouthMetrics.height / Math.max(1, mouthMetrics.width), 0.08, 0.62);
  const rawMouthTarget = {
    cx: plate.cx + clamp(mouth.cx - plate.cx, -plate.w * 0.09, plate.w * 0.09),
    cy: plate.y + plate.h * 0.705 + clamp(mouth.cy - (plate.y + plate.h * 0.705), -plate.h * 0.08, plate.h * 0.1),
    rx: plate.w * 0.448,
    ry: plate.h * (0.155 + mouthOpenRatio * 0.36)
  };
  const mouthTarget = smoothTrackedBounds("mouth", rawMouthTarget, 0.55);

  drawMemeMouth(ctx, mouth, mouthTarget, mouthMetrics.angle);
}

function computeMemePlateBounds(leftEye, rightEye, mouth) {
  const minX = Math.min(leftEye.cx - leftEye.rx * 1.8, rightEye.cx - rightEye.rx * 1.8, mouth.cx - mouth.rx * 1.5);
  const maxX = Math.max(leftEye.cx + leftEye.rx * 1.8, rightEye.cx + rightEye.rx * 1.8, mouth.cx + mouth.rx * 1.5);
  const minY = Math.min(leftEye.cy - leftEye.ry * 1.5, rightEye.cy - rightEye.ry * 1.5);
  const maxY = mouth.cy + mouth.ry * 2.2;

  const rawW = Math.max(90, maxX - minX);
  const rawH = Math.max(120, maxY - minY);
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;

  const paddingX = rawW * 0.08;
  const paddingY = rawH * 0.06;
  const maxWidth = els.faceFxCanvas.width - 6;
  const maxHeight = els.faceFxCanvas.height - 6;
  const w = Math.min(rawW + paddingX * 2, maxWidth);
  const h = Math.min(rawH + paddingY * 2, maxHeight);

  let x = centerX - w * 0.5;
  let y = centerY - h * 0.5;
  x = clamp(x, 3, Math.max(3, els.faceFxCanvas.width - w - 3));
  y = clamp(y, 3, Math.max(3, els.faceFxCanvas.height - h - 3));

  return {
    x,
    y,
    w,
    h,
    cx: x + w * 0.5,
    cy: y + h * 0.5
  };
}

function sampleSkinToneFromFrame(x, y) {
  const ctx = state.faceFx.frameCtx;
  const canvas = state.faceFx.frameCanvas;
  if (!ctx || !canvas.width || !canvas.height) {
    return { r: 214, g: 188, b: 170 };
  }

  const sampleRadius = 4;
  const startX = clamp(Math.round(x - sampleRadius), 0, Math.max(0, canvas.width - 1));
  const startY = clamp(Math.round(y - sampleRadius), 0, Math.max(0, canvas.height - 1));
  const endX = clamp(Math.round(x + sampleRadius), 0, Math.max(0, canvas.width - 1));
  const endY = clamp(Math.round(y + sampleRadius), 0, Math.max(0, canvas.height - 1));
  const width = Math.max(1, endX - startX + 1);
  const height = Math.max(1, endY - startY + 1);

  try {
    const data = ctx.getImageData(startX, startY, width, height).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 24) {
        continue;
      }
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }

    if (!count) {
      return { r: 214, g: 188, b: 170 };
    }
    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count)
    };
  } catch {
    return { r: 214, g: 188, b: 170 };
  }
}

function drawMemeFacePlate(ctx, plate, skinTone) {
  const radius = Math.min(plate.w, plate.h) * 0.035;
  const sourceCanvas = state.faceFx.frameCanvas;
  const sourceRect = clampRectToCanvas(sourceCanvas, plate.x - 5, plate.y - 5, plate.w + 10, plate.h + 10);

  ctx.save();
  drawRoundedRectPath(ctx, plate.x, plate.y, plate.w, plate.h, radius);
  ctx.clip();

  if (sourceRect) {
    ctx.filter = "blur(15px)";
    ctx.drawImage(
      sourceCanvas,
      sourceRect.x,
      sourceRect.y,
      sourceRect.w,
      sourceRect.h,
      plate.x,
      plate.y,
      plate.w,
      plate.h
    );
    ctx.filter = "none";
  }

  ctx.fillStyle = `rgba(${skinTone.r}, ${skinTone.g}, ${skinTone.b}, 0.62)`;
  ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
  ctx.restore();
}

function drawMemeEye(ctx, sourceBounds, target, angle = 0) {
  drawFeatureCutout(ctx, sourceBounds, target, {
    sourceScaleX: 2.06,
    sourceScaleY: 1.95,
    angle,
    feather: 3.5
  });
}

function drawMemeMouth(ctx, sourceBounds, target, angle = 0) {
  drawFeatureCutout(ctx, sourceBounds, target, {
    sourceScaleX: 1.92,
    sourceScaleY: 1.58,
    angle,
    feather: 2.6
  });
}

function drawFeatureCutout(ctx, sourceBounds, targetBounds, options = {}) {
  const sourceCanvas = state.faceFx.frameCanvas;
  const sourceScaleX = Number(options.sourceScaleX) || 1.4;
  const sourceScaleY = Number(options.sourceScaleY) || 1.4;
  const angle = Number(options.angle) || 0;
  const feather = Math.max(0, Number(options.feather) || 0);

  const srcX = sourceBounds.cx - sourceBounds.rx * sourceScaleX;
  const srcY = sourceBounds.cy - sourceBounds.ry * sourceScaleY;
  const srcW = Math.max(4, sourceBounds.rx * 2 * sourceScaleX);
  const srcH = Math.max(4, sourceBounds.ry * 2 * sourceScaleY);
  const safeSrc = clampRectToCanvas(sourceCanvas, srcX, srcY, srcW, srcH);

  if (!safeSrc) {
    return;
  }

  ctx.save();
  ctx.translate(targetBounds.cx, targetBounds.cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, targetBounds.rx, targetBounds.ry, 0, 0, Math.PI * 2);
  ctx.clip();

  if (feather > 0) {
    ctx.filter = `blur(${feather}px)`;
  }
  ctx.drawImage(
    sourceCanvas,
    safeSrc.x,
    safeSrc.y,
    safeSrc.w,
    safeSrc.h,
    -targetBounds.rx,
    -targetBounds.ry,
    targetBounds.rx * 2,
    targetBounds.ry * 2
  );
  ctx.filter = "none";
  ctx.restore();
}

function computeMouthMetrics(landmarks, fallbackBounds) {
  const leftCorner = mapLandmarkToCanvas(landmarks[61]);
  const rightCorner = mapLandmarkToCanvas(landmarks[291]);
  const topLip = mapLandmarkToCanvas(landmarks[13]);
  const bottomLip = mapLandmarkToCanvas(landmarks[14]);

  if (!leftCorner || !rightCorner || !topLip || !bottomLip) {
    return {
      width: fallbackBounds.rx * 2,
      height: fallbackBounds.ry * 2,
      angle: 0
    };
  }

  return {
    width: distanceBetween(leftCorner, rightCorner),
    height: distanceBetween(topLip, bottomLip),
    angle: Math.atan2(rightCorner.y - leftCorner.y, rightCorner.x - leftCorner.x)
  };
}

function computeEyeAngle(landmarks, leftIndex, rightIndex) {
  const leftPoint = mapLandmarkToCanvas(landmarks[leftIndex]);
  const rightPoint = mapLandmarkToCanvas(landmarks[rightIndex]);
  if (!leftPoint || !rightPoint) {
    return 0;
  }
  return Math.atan2(rightPoint.y - leftPoint.y, rightPoint.x - leftPoint.x);
}

function smoothTrackedBounds(key, nextBounds, alpha = 0.45) {
  if (!state.faceFx.tracked) {
    state.faceFx.tracked = {};
  }
  const prev = state.faceFx.tracked[key];
  if (!prev) {
    const seeded = { ...nextBounds };
    state.faceFx.tracked[key] = seeded;
    return seeded;
  }

  const smoothed = {};
  for (const prop of Object.keys(nextBounds)) {
    const prevValue = Number(prev[prop]);
    const nextValue = Number(nextBounds[prop]);
    smoothed[prop] = Number.isFinite(prevValue) && Number.isFinite(nextValue)
      ? lerpNumber(prevValue, nextValue, alpha)
      : nextBounds[prop];
  }

  state.faceFx.tracked[key] = smoothed;
  return smoothed;
}

function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clampRectToCanvas(canvas, x, y, width, height) {
  if (!canvas || !canvas.width || !canvas.height) {
    return null;
  }
  const x0 = clamp(Math.floor(x), 0, Math.max(0, canvas.width - 1));
  const y0 = clamp(Math.floor(y), 0, Math.max(0, canvas.height - 1));
  const x1 = clamp(Math.ceil(x + width), 1, canvas.width);
  const y1 = clamp(Math.ceil(y + height), 1, canvas.height);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 2 || h < 2) {
    return null;
  }
  return { x: x0, y: y0, w, h };
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getLandmarkBounds(landmarks, indices) {
  const points = indices
    .map((index) => mapLandmarkToCanvas(landmarks[index]))
    .filter(Boolean);

  if (!points.length) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const width = Math.max(10, maxX - minX);
  const height = Math.max(8, maxY - minY);
  return {
    cx: minX + width * 0.5,
    cy: minY + height * 0.5,
    rx: width * 0.5,
    ry: height * 0.5
  };
}

function mapLandmarkToCanvas(landmark) {
  if (!landmark || !state.faceFx.layout || !els.faceFxCanvas.width || !els.faceFxCanvas.height) {
    return null;
  }

  const layout = state.faceFx.layout;
  const normalizedX = clamp(layout.mirrored ? 1 - landmark.x : landmark.x, 0, 1);
  const normalizedY = clamp(landmark.y, 0, 1);

  return {
    x: layout.offsetX + normalizedX * layout.drawWidth,
    y: layout.offsetY + normalizedY * layout.drawHeight
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pickRecordingMimeType() {
  if (!MediaRecorderCtor || typeof MediaRecorderCtor.isTypeSupported !== "function") {
    return "";
  }

  for (const mimeType of RECORDING_MIME_CANDIDATES) {
    if (MediaRecorderCtor.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return "";
}

function buildRecordingFilename(mimeType = "video/webm") {
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `word-rush-${stamp}.${extension}`;
}

function clearRunVideoArtifact() {
  if (state.recordingUrl) {
    URL.revokeObjectURL(state.recordingUrl);
  }
  state.recordingBlob = null;
  state.recordingUrl = "";
  state.recordingFilename = "";
}

function buildShareableRecordingFile() {
  if (!state.recordingBlob || typeof File === "undefined") {
    return null;
  }
  const mimeType = state.recordingBlob.type || "video/webm";
  const filename = state.recordingFilename || buildRecordingFilename(mimeType);
  return new File([state.recordingBlob], filename, {
    type: mimeType,
    lastModified: Date.now()
  });
}

function canShareRecordingFile() {
  if (!state.shareSupported || !state.recordingBlob) {
    return false;
  }

  const file = buildShareableRecordingFile();
  if (!file) {
    return false;
  }

  if (typeof navigator.canShare === "function") {
    try {
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  }

  return true;
}

function updateFinishVideoActions() {
  if (!els.saveVideoBtn || !els.shareVideoBtn || !els.videoActionHint) {
    return;
  }

  if (!state.recordingSupported) {
    els.saveVideoBtn.disabled = true;
    els.shareVideoBtn.disabled = true;
    els.shareVideoBtn.title = "Share is unavailable on this browser.";
    els.videoActionHint.textContent = "Browser recording not supported. Use phone screen recording.";
    return;
  }

  if (state.recordingProcessing) {
    els.saveVideoBtn.disabled = true;
    els.shareVideoBtn.disabled = true;
    els.shareVideoBtn.title = "";
    els.videoActionHint.textContent = "Processing run video...";
    return;
  }

  const hasVideo = Boolean(state.recordingBlob && state.recordingUrl);
  els.saveVideoBtn.disabled = !hasVideo;

  const shareReady = hasVideo && canShareRecordingFile();
  els.shareVideoBtn.disabled = !shareReady;
  els.shareVideoBtn.title = shareReady ? "" : "Share file flow is unavailable on this device/browser.";

  if (!hasVideo) {
    els.videoActionHint.textContent = "No run video yet. Allow tab capture when run starts.";
  } else if (!shareReady) {
    els.videoActionHint.textContent = "Clip ready. Save video, then upload to TikTok/Instagram.";
  } else {
    els.videoActionHint.textContent = "Clip ready. Save or share.";
  }
}

async function ensureCaptureStream() {
  if (!state.recordingSupported) {
    return null;
  }

  const hasActiveVideo =
    state.captureStream &&
    state.captureStream.getVideoTracks().some((track) => track.readyState === "live");
  if (hasActiveVideo) {
    return state.captureStream;
  }

  stopCaptureStream();
  setStatus('Select "This tab" in the picker to capture this run.');

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 30, max: 30 }
      },
      audio: true
    });

    const [videoTrack] = stream.getVideoTracks();
    if (videoTrack) {
      videoTrack.addEventListener("ended", () => {
        stopCaptureStream();
        if (isRunActive()) {
          setStatus("Screen capture stopped. Run continues without recording.");
        }
      });
    }

    state.captureStream = stream;
    return stream;
  } catch (error) {
    if (error && (error.name === "AbortError" || error.name === "NotAllowedError")) {
      setStatus("Run recording skipped.");
    } else {
      setStatus("Screen capture failed. Run continues without recording.");
    }
    return null;
  }
}

function teardownRecordingAudioMix() {
  if (state.recordingMicSource) {
    try {
      state.recordingMicSource.disconnect();
    } catch {
      // Ignore disconnect errors from stale nodes.
    }
    state.recordingMicSource = null;
  }

  if (state.audioMasterGain && state.recordingMixDestination) {
    try {
      state.audioMasterGain.disconnect(state.recordingMixDestination);
    } catch {
      // Ignore disconnect errors from stale nodes.
    }
  }

  if (state.recordingMixDestination) {
    for (const track of state.recordingMixDestination.stream.getTracks()) {
      track.stop();
    }
    state.recordingMixDestination = null;
  }

  if (state.recordingMicStream) {
    for (const track of state.recordingMicStream.getTracks()) {
      track.stop();
    }
    state.recordingMicStream = null;
  }
}

async function ensureRecordingMicStream() {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    return null;
  }

  const hasActiveMic =
    state.recordingMicStream &&
    state.recordingMicStream.getAudioTracks().some((track) => track.readyState === "live");
  if (hasActiveMic) {
    return state.recordingMicStream;
  }

  if (state.recordingMicStream) {
    for (const track of state.recordingMicStream.getTracks()) {
      track.stop();
    }
  }

  try {
    state.recordingMicStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    return state.recordingMicStream;
  } catch {
    state.recordingMicStream = null;
    return null;
  }
}

async function buildRecorderInputStream(displayStream) {
  const recorderInputStream = new MediaStream();

  for (const track of displayStream.getVideoTracks()) {
    recorderInputStream.addTrack(track);
  }

  const audioCtx = ensureAudioContext();
  if (!audioCtx || !state.audioMasterGain) {
    return { recorderInputStream, hasAudio: false, hasMic: false };
  }

  teardownRecordingAudioMix();

  state.recordingMixDestination = audioCtx.createMediaStreamDestination();
  try {
    state.audioMasterGain.connect(state.recordingMixDestination);
  } catch {
    // Keep going without duplicate mix connection.
  }

  let hasMic = false;
  const micStream = await ensureRecordingMicStream();
  if (micStream) {
    try {
      state.recordingMicSource = audioCtx.createMediaStreamSource(micStream);
      state.recordingMicSource.connect(state.recordingMixDestination);
      hasMic = true;
    } catch {
      hasMic = false;
      state.recordingMicSource = null;
    }
  }

  const [mixTrack] = state.recordingMixDestination.stream.getAudioTracks();
  if (mixTrack) {
    recorderInputStream.addTrack(mixTrack);
    return { recorderInputStream, hasAudio: true, hasMic };
  }

  return { recorderInputStream, hasAudio: false, hasMic: false };
}

async function startRunRecording() {
  if (!state.recordingSupported || !state.run) {
    updateFinishVideoActions();
    return;
  }

  clearRunVideoArtifact();
  state.recordingChunks = [];
  state.pendingDiscardRecording = false;
  state.recordingProcessing = false;
  updateFinishVideoActions();

  const stream = await ensureCaptureStream();
  if (!stream) {
    return;
  }
  if (!isRunActive()) {
    return;
  }

  const { recorderInputStream, hasAudio, hasMic } = await buildRecorderInputStream(stream);
  if (!isRunActive()) {
    teardownRecordingAudioMix();
    return;
  }
  const preferredMimeType = pickRecordingMimeType();
  let recorder;
  try {
    recorder = preferredMimeType
      ? new MediaRecorderCtor(recorderInputStream, { mimeType: preferredMimeType })
      : new MediaRecorderCtor(recorderInputStream);
  } catch {
    teardownRecordingAudioMix();
    setStatus("Recorder init failed. Use system screen recording.");
    return;
  }

  state.recorder = recorder;
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      state.recordingChunks.push(event.data);
    }
  };
  recorder.onerror = () => {
    if (state.recorder === recorder) {
      state.recorder = null;
    }
    teardownRecordingAudioMix();
    state.recordingProcessing = false;
    setStatus("Recorder error. Use system screen recording.");
    updateFinishVideoActions();
  };
  recorder.onstop = () => {
    const shouldDiscard = state.pendingDiscardRecording;
    const stoppedMimeType = recorder.mimeType || preferredMimeType || "video/webm";

    if (state.recorder === recorder) {
      state.recorder = null;
    }
    state.pendingDiscardRecording = false;
    teardownRecordingAudioMix();

    if (shouldDiscard) {
      state.recordingChunks = [];
      state.recordingProcessing = false;
      clearRunVideoArtifact();
      updateFinishVideoActions();
      return;
    }

    if (!state.recordingChunks.length) {
      state.recordingProcessing = false;
      updateFinishVideoActions();
      return;
    }

    clearRunVideoArtifact();
    state.recordingBlob = new Blob(state.recordingChunks, { type: stoppedMimeType });
    state.recordingFilename = buildRecordingFilename(stoppedMimeType);
    state.recordingUrl = URL.createObjectURL(state.recordingBlob);
    state.recordingChunks = [];
    state.recordingProcessing = false;
    updateFinishVideoActions();
  };

  try {
    recorder.start(RECORDING_CHUNK_MS);
    if (hasAudio && hasMic) {
      setStatus("Run recording started with game audio + mic.");
    } else if (hasAudio) {
      setStatus("Run recording started with game audio.");
    } else {
      setStatus("Run recording started (video only).");
    }
  } catch {
    if (state.recorder === recorder) {
      state.recorder = null;
    }
    teardownRecordingAudioMix();
    setStatus("Could not start recorder.");
  }
}

function stopRunRecording({ discard = false } = {}) {
  if (discard) {
    state.pendingDiscardRecording = true;
  }

  if (!state.recorder) {
    if (discard) {
      state.recordingChunks = [];
      clearRunVideoArtifact();
    }
    teardownRecordingAudioMix();
    state.recordingProcessing = false;
    updateFinishVideoActions();
    return;
  }

  if (state.recorder.state === "inactive") {
    teardownRecordingAudioMix();
    updateFinishVideoActions();
    return;
  }

  state.recordingProcessing = true;
  updateFinishVideoActions();
  try {
    state.recorder.stop();
  } catch {
    state.recordingProcessing = false;
    state.recorder = null;
    teardownRecordingAudioMix();
    updateFinishVideoActions();
  }
}

function saveRunVideo() {
  if (!state.recordingBlob || !state.recordingUrl) {
    setStatus("No run clip to save.");
    return;
  }

  const filename = state.recordingFilename || buildRecordingFilename(state.recordingBlob.type);
  const anchor = document.createElement("a");
  anchor.href = state.recordingUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setStatus("Video download started.");
}

async function shareRunVideo() {
  if (!state.recordingBlob) {
    setStatus("No run clip to share.");
    return;
  }

  if (!state.shareSupported) {
    setStatus("Share is unavailable. Save video and upload manually.");
    return;
  }

  const file = buildShareableRecordingFile();
  if (!file) {
    setStatus("Could not prepare file for sharing.");
    return;
  }

  if (typeof navigator.canShare === "function") {
    try {
      if (!navigator.canShare({ files: [file] })) {
        setStatus("Direct file share not supported here. Save video first.");
        return;
      }
    } catch {
      setStatus("Direct file share not supported here. Save video first.");
      return;
    }
  }

  try {
    await navigator.share({
      title: "Word Rush Challenge",
      text: "Can you beat my score?",
      files: [file]
    });
    setStatus("Share sheet opened.");
  } catch (error) {
    if (error && error.name === "AbortError") {
      setStatus("Share cancelled.");
      return;
    }
    setStatus("Share failed. Save video and upload manually.");
  }
}

function scheduleMicRetry(statusText) {
  if (!isRunActive() || !state.run || state.run.roundLocked) {
    return;
  }
  if (state.run.micRetriesLeft <= 0) {
    if (statusText) {
      setStatus(`${statusText} Keep going, time is running.`);
    }
    return;
  }
  if (state.run.micRetryId) {
    return;
  }

  state.run.micRetriesLeft -= 1;
  if (statusText) {
    setStatus(`${statusText} Retrying mic...`);
  }

  state.run.micRetryId = window.setTimeout(() => {
    if (!state.run) {
      return;
    }
    state.run.micRetryId = null;
    if (isRunActive() && !state.run.roundLocked && !state.listening) {
      startListening();
    }
  }, MIC_AUTO_RETRY_DELAY_MS);
}

function setupRecognition() {
  if (!SpeechRecognitionCtor) {
    state.recognitionSupported = false;
    return;
  }

  try {
    state.recognition = new SpeechRecognitionCtor();
  } catch {
    state.recognitionSupported = false;
    state.recognition = null;
    return;
  }

  state.recognitionSupported = true;
  state.recognition.continuous = false;
  state.recognition.interimResults = true;
  state.recognition.maxAlternatives = 2;

  state.recognition.onstart = () => {
    state.listening = true;
    state.stopListeningRequested = false;
    els.gameScreen.classList.add("is-listening");
  };

  state.recognition.onresult = (event) => {
    if (!state.run || state.run.roundLocked) {
      return;
    }

    let interim = "";
    const finalCandidates = [];

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];

      if (result.isFinal) {
        for (let alt = 0; alt < Math.min(3, result.length); alt += 1) {
          finalCandidates.push(result[alt].transcript.trim());
        }
      } else {
        interim += `${result[0].transcript.trim()} `;
      }
    }

    if (interim.trim()) {
      const interimText = interim.trim();
      els.heardText.textContent = interimText;
      evaluateAnswerCandidates([interimText], { allowMiss: false });
    }

    if (finalCandidates.length) {
      state.run.heardFinalInRound = true;
      evaluateAnswerCandidates(finalCandidates, { allowMiss: true });
    }
  };

  state.recognition.onerror = (event) => {
    if (!isRunActive()) {
      return;
    }

    if (event.error === "no-speech") {
      scheduleMicRetry("No speech detected.");
      return;
    }

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setStatus("Microphone permission denied. Enable mic in browser settings.");
      return;
    }

    setStatus(`Speech error: ${event.error}`);
    scheduleMicRetry("Speech glitch.");
  };

  state.recognition.onend = () => {
    state.listening = false;
    els.gameScreen.classList.remove("is-listening");
    if (state.stopListeningRequested) {
      state.stopListeningRequested = false;
      return;
    }
    if (isRunActive() && state.run && !state.run.roundLocked && !state.run.heardFinalInRound) {
      scheduleMicRetry("Listening paused.");
    }
  };
}

function startListening() {
  if (!state.recognitionSupported || !state.recognition || state.listening || !state.run) {
    return;
  }

  try {
    state.stopListeningRequested = false;
    state.recognition.lang = state.run.deck.answerSpeechLang;
    state.recognition.start();
  } catch {
    scheduleMicRetry("Mic busy.");
  }
}

function stopListening() {
  if (!state.recognitionSupported || !state.recognition) {
    return;
  }

  if (!state.listening) {
    state.stopListeningRequested = false;
    return;
  }

  state.stopListeningRequested = true;
  try {
    state.recognition.stop();
  } catch {
    state.listening = false;
    els.gameScreen.classList.remove("is-listening");
    state.stopListeningRequested = false;
  }
}

function normalizeText(text) {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-яё\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSkipCommand(candidate) {
  if (!candidate) {
    return false;
  }
  return SKIP_COMMANDS.some((command) => candidate === command || candidate.includes(command));
}

function prepareAnswerVariants(answers) {
  return answers
    .map((answer) => normalizeText(answer))
    .filter(Boolean)
    .map((normalized) => ({
      normalized,
      compact: compactText(normalized),
      hasCyrillic: /[а-яё]/i.test(normalized),
      hasLatin: /[a-z]/i.test(normalized),
      maxDistance: allowedDistance(normalized.length)
    }));
}

function isCorrectAnswer(candidate, preparedAnswers) {
  if (!candidate) {
    return false;
  }
  if (!preparedAnswers.length) {
    return false;
  }

  const compactCandidate = compactText(candidate);

  for (const answer of preparedAnswers) {
    const normalizedAnswer = answer.normalized;
    const compactAnswer = answer.compact;
    const alignedCandidate = alignToAnswerScript(candidate, answer);
    const chunks = splitCandidate(alignedCandidate);
    const compactAligned = compactText(alignedCandidate);
    const maxDistance = answer.maxDistance;

    if (alignedCandidate === normalizedAnswer || alignedCandidate.includes(normalizedAnswer)) {
      return true;
    }
    if (compactAligned && compactAnswer && compactAligned === compactAnswer) {
      return true;
    }

    for (const chunk of chunks) {
      if (!chunk) {
        continue;
      }
      if (chunk === normalizedAnswer) {
        return true;
      }
      if (compactText(chunk) === compactAnswer) {
        return true;
      }
      if (Math.abs(chunk.length - normalizedAnswer.length) > maxDistance) {
        continue;
      }
      if (levenshtein(chunk, normalizedAnswer) <= maxDistance) {
        return true;
      }
    }

    if (
      Math.abs(alignedCandidate.length - normalizedAnswer.length) <= maxDistance + 1 &&
      levenshtein(alignedCandidate, normalizedAnswer) <= maxDistance + 1
    ) {
      return true;
    }
    if (compactCandidate && compactAnswer) {
      if (Math.abs(compactCandidate.length - compactAnswer.length) > maxDistance + 1) {
        continue;
      }
      const compactDistance = levenshtein(compactCandidate, compactAnswer);
      if (compactDistance <= maxDistance + 1) {
        return true;
      }
    }
  }

  return false;
}

function compactText(text) {
  return text.replace(/\s+/g, "");
}

function alignToAnswerScript(candidate, answer) {
  if (answer.hasCyrillic) {
    return convertLatinLookalikesToCyrillic(candidate);
  }
  if (answer.hasLatin) {
    return convertCyrillicLookalikesToLatin(candidate);
  }
  return candidate;
}

function convertLatinLookalikesToCyrillic(text) {
  const map = {
    a: "а",
    b: "в",
    c: "с",
    e: "е",
    h: "н",
    k: "к",
    m: "м",
    o: "о",
    p: "р",
    t: "т",
    x: "х",
    y: "у"
  };
  return text.replace(/[abcehkmoptxy]/g, (char) => map[char] || char);
}

function convertCyrillicLookalikesToLatin(text) {
  const map = {
    а: "a",
    в: "b",
    с: "c",
    е: "e",
    н: "h",
    к: "k",
    м: "m",
    о: "o",
    р: "p",
    т: "t",
    х: "x",
    у: "y"
  };
  return text.replace(/[авсенкмортух]/g, (char) => map[char] || char);
}

function splitCandidate(candidate) {
  const words = candidate.split(" ").filter(Boolean);
  if (words.length <= 1) {
    return words;
  }

  const pairs = [];
  for (let i = 0; i < words.length - 1; i += 1) {
    pairs.push(`${words[i]} ${words[i + 1]}`);
  }

  return [...words, ...pairs];
}

function allowedDistance(length) {
  if (length <= 2) {
    return 0;
  }
  if (length <= 4) {
    return 1;
  }
  if (length <= 7) {
    return 1;
  }
  if (length <= 10) {
    return 2;
  }
  return 3;
}

function levenshtein(a, b) {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function pickWords(items, count) {
  const shuffled = shuffle([...items]);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function normalizeSettings(rawSettings = {}) {
  const deckIds = new Set(DECKS.map((deck) => deck.id));
  const deckId = deckIds.has(rawSettings.deckId) ? rawSettings.deckId : DEFAULT_DECK_ID;
  const roundSeconds = ROUND_SECONDS_OPTIONS.includes(rawSettings.roundSeconds)
    ? rawSettings.roundSeconds
    : 6;
  const wordCount = WORD_COUNT_OPTIONS.includes(rawSettings.wordCount) ? rawSettings.wordCount : 10;
  const faceFilterEnabled =
    typeof rawSettings.faceFilterEnabled === "boolean"
      ? rawSettings.faceFilterEnabled
      : typeof rawSettings.faceFilter === "string"
        ? rawSettings.faceFilter !== "none"
        : false;
  return { deckId, roundSeconds, wordCount, faceFilterEnabled };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return normalizeSettings();
    }
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed);
  } catch {
    return normalizeSettings();
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(state.settings)));
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.slice(0, MAX_LEADERBOARD_ITEMS);
  } catch {
    return [];
  }
}

function persistLeaderboard() {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(state.leaderboard.slice(0, MAX_LEADERBOARD_ITEMS)));
}

function pushLeaderboardEntry(entry) {
  state.leaderboard = [entry, ...state.leaderboard]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.bestStreak - a.bestStreak;
    })
    .slice(0, MAX_LEADERBOARD_ITEMS);

  persistLeaderboard();
  renderLeaderboard();
}

function renderLeaderboard() {
  if (!state.leaderboard.length) {
    els.leaderboardList.innerHTML = `
      <li class="leaderboard-empty">No runs yet. Your first run sets the pace.</li>
    `;
    updateChallengeCopy();
    return;
  }

  els.leaderboardList.innerHTML = state.leaderboard
    .slice(0, 7)
    .map((entry, index) => {
      const deck = getDeckById(entry.deckId);
      const date = new Date(entry.createdAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      return `
        <li>
          <span class="rank">#${index + 1}</span>
          <div>
            <p>${entry.score} pts | streak x${entry.bestStreak}</p>
            <small>${deck.from.flag}->${deck.to.flag} | ${entry.words}w | ${entry.roundSeconds}s | ${date}</small>
          </div>
        </li>
      `;
    })
    .join("");
  updateChallengeCopy();
}

function ensureAudioContext() {
  if (!state.audioSupported || !AudioContextCtor) {
    return null;
  }

  if (!state.audioCtx) {
    state.audioCtx = new AudioContextCtor();
  }

  if (!state.audioMasterGain) {
    state.audioMasterGain = state.audioCtx.createGain();
    state.audioMasterGain.gain.value = 1;
    state.audioMasterGain.connect(state.audioCtx.destination);
  }

  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }

  return state.audioCtx;
}

function playTone({ frequency, duration = 0.12, type = "sine", when = 0, gain = 0.05, sweepTo }) {
  const audioCtx = ensureAudioContext();
  if (!audioCtx) {
    return;
  }

  const startAt = audioCtx.currentTime + when;
  const stopAt = startAt + duration;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  if (sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), stopAt);
  }

  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  osc.connect(amp);
  if (state.audioMasterGain) {
    amp.connect(state.audioMasterGain);
  } else {
    amp.connect(audioCtx.destination);
  }
  osc.start(startAt);
  osc.stop(stopAt + 0.01);
}

function playSuccessSound() {
  playTone({ frequency: 560, duration: 0.08, gain: 0.05, type: "triangle" });
  playTone({ frequency: 790, duration: 0.12, gain: 0.06, type: "triangle", when: 0.07 });
}

function playFailSound() {
  playTone({ frequency: 240, duration: 0.18, gain: 0.05, type: "sawtooth", sweepTo: 125 });
}

function playSkipSound() {
  playTone({ frequency: 330, duration: 0.06, gain: 0.04, type: "square" });
  playTone({ frequency: 280, duration: 0.08, gain: 0.04, type: "square", when: 0.05 });
}

function playRunStartSound() {
  playTone({ frequency: 420, duration: 0.05, gain: 0.04, type: "triangle" });
  playTone({ frequency: 560, duration: 0.06, gain: 0.05, type: "triangle", when: 0.06 });
  playTone({ frequency: 720, duration: 0.1, gain: 0.055, type: "triangle", when: 0.12 });
}

function playStreakSound(streak) {
  const capped = Math.min(streak, 10);
  const base = 520 + capped * 24;
  playTone({ frequency: base, duration: 0.06, gain: 0.035, type: "triangle" });
}

function playMilestoneSound(streak) {
  const base = 620 + Math.min(streak, 12) * 10;
  playTone({ frequency: base, duration: 0.08, gain: 0.05, type: "triangle" });
  playTone({ frequency: base * 1.25, duration: 0.09, gain: 0.055, type: "triangle", when: 0.06 });
  playTone({ frequency: base * 1.55, duration: 0.12, gain: 0.06, type: "triangle", when: 0.13 });
}

function playWarningTickSound(wholeLeft) {
  const isFinalSecond = wholeLeft <= 1;
  playTone({
    frequency: isFinalSecond ? 940 : 760,
    duration: isFinalSecond ? 0.05 : 0.04,
    gain: isFinalSecond ? 0.045 : 0.03,
    type: "square"
  });
}

function vibrate(pattern) {
  if (!("vibrate" in navigator)) {
    return;
  }
  navigator.vibrate(pattern);
}
