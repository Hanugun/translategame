import "./style.css";
import { DECKS, DEFAULT_DECK_ID, getDeckById } from "./wordDeck";

const LEADERBOARD_KEY = "word-rush-leaderboard-v3";
const SETTINGS_KEY = "word-rush-settings-v1";
const MAX_LEADERBOARD_ITEMS = 20;
const WORD_COUNT_OPTIONS = [5, 10, 15, 20];
const ROUND_SECONDS_OPTIONS = [4, 6, 8, 10];
const ROUND_MIC_START_DELAY_MS = 170;
const MIC_AUTO_RETRY_DELAY_MS = 230;
const MIC_AUTO_RETRY_MIN = 4;
const GAME_FLASH_CLASSES = ["fx-hit", "fx-miss", "fx-skip"];
const RECORDING_CHUNK_MS = 250;
const RECORDING_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm"
];

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
      </header>

      <section class="home-actions">
        <button id="startFromHomeBtn" class="btn btn-start" type="button">Start Challenge</button>
        <button id="openSettingsBtn" class="btn btn-ghost" type="button">Settings</button>
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

    <section id="gameScreen" class="screen screen-game hidden" data-speed="0" data-facing="user">
      <video id="cameraVideo" class="camera-video" autoplay muted playsinline></video>
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
  clearLeaderboardBtn: document.querySelector("#clearLeaderboardBtn"),
  leaderboardList: document.querySelector("#leaderboardList"),

  settingsBackBtn: document.querySelector("#settingsBackBtn"),
  settingsDoneBtn: document.querySelector("#settingsDoneBtn"),
  deckOptions: document.querySelector("#deckOptions"),
  roundSecondsSelect: document.querySelector("#roundSecondsSelect"),
  wordCountSelect: document.querySelector("#wordCountSelect"),

  cameraVideo: document.querySelector("#cameraVideo"),

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

  timerFill: document.querySelector("#timerFill"),
  statusText: document.querySelector("#statusText"),

  readyOverlay: document.querySelector("#readyOverlay"),
  readyDetails: document.querySelector("#readyDetails"),
  finishOverlay: document.querySelector("#finishOverlay"),
  finishTitle: document.querySelector("#finishTitle"),
  finishStats: document.querySelector("#finishStats"),
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
  cameraStream: null,
  cameraFacingMode: "user",
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
  recordingMicSource: null
};

init();

function init() {
  buildDeckOptions();
  buildSettingSelects();
  renderLeaderboard();
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
    stopCamera();
    stopCaptureStream();
    clearRunVideoArtifact();
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
  const words = pickWords(deck.items, state.settings.wordCount);

  state.run = {
    deck,
    words,
    index: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    lives: 3,
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
    lastLivesVisual: 3,
    lastScoreVisual: 0,
    lastStreakVisual: 0,
    lastWordsVisual: words.length
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
    `say "skip" or "дальше" to skip`,
    `allow screen capture if you want save/share video`
  ];

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
  await startRunRecording();
  state.run.active = true;
  state.run.finished = false;

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

  els.promptWord.textContent = state.run.currentWord.prompt;
  els.correctAnswer.textContent = state.run.currentWord.answers.join(", ");
  els.answerLine.classList.add("hidden");
  els.heardText.textContent = "-";
  setFeedback("GO", "neutral");
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

    if (left <= 0) {
      resolveRound(false, "TIME", "Time is up");
    }
  }, 50);

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

function evaluateAnswerCandidates(rawCandidates) {
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

  const hasSkipCommand = normalizedCandidates.some((candidate) => isSkipCommand(candidate));
  if (hasSkipCommand) {
    resolveSkipRound();
    return;
  }

  const isCorrect = normalizedCandidates.some((candidate) =>
    isCorrectAnswer(candidate, state.run.currentWord.answers)
  );

  if (isCorrect) {
    resolveRound(true, "PERFECT", "Correct");
  } else {
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
  pulseElement(els.wordChip, "fx-chip-pop");
  pulseElement(els.streakChip, "fx-chip-soft");
  flashGame("fx-skip");
  updateHud();
  scheduleFeedbackReset();

  state.run.index += 1;
  if (state.run.nextRoundId) {
    window.clearTimeout(state.run.nextRoundId);
  }
  state.run.nextRoundId = window.setTimeout(() => {
    if (!state.run || state.run.finished) {
      return;
    }
    if (state.run.index >= state.run.words.length) {
      finishRun(true);
      return;
    }
    startNextRound();
  }, 700);
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
    pulseElement(els.scoreChip, "fx-chip-pop");
    pulseElement(els.streakChip, "fx-chip-hot");
    flashGame("fx-hit");
  } else {
    state.run.streak = 0;
    state.run.lives -= 1;

    setFeedback(badgeText, "fail");
    setStatus(statusText);
    els.answerLine.classList.remove("hidden");
    playFailSound();
    vibrate([35, 25, 35]);
    pulseElement(els.livesChip, "fx-chip-shake");
    pulseElement(els.streakChip, "fx-chip-soft");
    flashGame("fx-miss");
  }

  updateHud();
  scheduleFeedbackReset();

  state.run.index += 1;
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
    startNextRound();
  }, 900);
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

  els.finishTitle.textContent = deckCompleted ? "Deck Cleared" : "Run Over";
  els.finishStats.textContent = `Score: ${state.run.score} | Best streak: ${state.run.bestStreak} | Accuracy: ${accuracy}%`;
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
  els.gameScreen.classList.remove("is-urgent");
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
    els.livesValue.innerHTML = renderLives(3);
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
  const maxLives = 3;
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

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: state.cameraFacingMode },
        width: { ideal: 1080 },
        height: { ideal: 1920 }
      },
      audio: false
    });

    state.cameraStream = stream;
    els.cameraVideo.srcObject = stream;
    els.gameScreen.dataset.facing = state.cameraFacingMode;
    setStatus("Camera ready. Tap anywhere to start.");
  } catch {
    setStatus("Camera permission blocked. Game still works without camera.");
  }
}

function stopCamera() {
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

  const { recorderInputStream, hasAudio, hasMic } = await buildRecorderInputStream(stream);
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
  state.recognition.maxAlternatives = 4;

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
      els.heardText.textContent = interim.trim();
    }

    if (finalCandidates.length) {
      state.run.heardFinalInRound = true;
      evaluateAnswerCandidates(finalCandidates);
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
  const skipCommands = ["skip", "дальше", "далее"];
  return skipCommands.some((command) => candidate === command || candidate.includes(command));
}

function isCorrectAnswer(candidate, answers) {
  if (!candidate) {
    return false;
  }

  const normalizedAnswers = answers.map((answer) => normalizeText(answer));
  const compactCandidate = compactText(candidate);

  for (const normalizedAnswer of normalizedAnswers) {
    if (!normalizedAnswer) {
      continue;
    }

    const alignedCandidate = alignToAnswerScript(candidate, normalizedAnswer);
    const chunks = splitCandidate(alignedCandidate);
    const compactAnswer = compactText(normalizedAnswer);
    const compactAligned = compactText(alignedCandidate);

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
      if (levenshtein(chunk, normalizedAnswer) <= allowedDistance(normalizedAnswer.length)) {
        return true;
      }
    }

    if (levenshtein(alignedCandidate, normalizedAnswer) <= allowedDistance(normalizedAnswer.length + 1)) {
      return true;
    }
    if (compactCandidate && compactAnswer) {
      const compactDistance = levenshtein(compactCandidate, compactAnswer);
      if (compactDistance <= allowedDistance(compactAnswer.length)) {
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
  if (/[а-яё]/i.test(answer)) {
    return convertLatinLookalikesToCyrillic(candidate);
  }
  if (/[a-z]/i.test(answer)) {
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

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
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
  return { deckId, roundSeconds, wordCount };
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

function vibrate(pattern) {
  if (!("vibrate" in navigator)) {
    return;
  }
  navigator.vibrate(pattern);
}
