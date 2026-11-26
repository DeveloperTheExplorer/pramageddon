import * as THREE from 'three';
import { createWorld } from './world.js';
import {
  createPlayer,
  createItem,
  createBabyBundle,
  createWanderingBaby,
  makeIconTexture,
  makeIconSprite,
  makeNameTag,
} from './models.js';
import { AudioEngine } from './audio.js';
import {
  NIGHTS,
  PLAYER_START,
  ITEM_META,
  BABY_NAMES,
  PRAM_COLORS,
  NEED_POOL,
  ARCADE,
} from './config.js';
import { getIconDataUrl } from './icons.js';
import {
  fetchGlobalScores,
  formatRunClock,
  getLocalBest,
  getLocalScores,
  getSavedName,
  renameLocalScore,
  saveLocalScore,
  savePlayerName,
  submitGlobalScore,
} from './leaderboard.js';

const ICON_BG = {
  zzz: '#fff6df',
  pacifier: '#fff6df',
  bottle: '#fff6df',
  blanket: '#fff6df',
  teddy: '#fff6df',
  cry: '#ff7a6b',
  heart: '#ffd166',
  warning: '#ff7a6b',
};

const ITEM_HELP = {
  pacifier: 'Binky basket · porch',
  bottle: 'Bottle crate · inside',
  blanket: 'Blankie pile · porch',
  teddy: 'Teddy chest · inside',
};

const FORECASTS = ['LOW SUN', 'A FOX ABOUT', 'BLUE HOUR'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (current, target, lambda, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, '0')}`;
}

function createProgressBar(color = '#ffd166') {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.15, 0.05),
    new THREE.MeshBasicMaterial({ color: '#281f3d', depthTest: false })
  );
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.08, 0.06),
    new THREE.MeshBasicMaterial({ color, depthTest: false })
  );
  fill.position.z = 0.01;
  group.add(bg, fill);
  group.userData = { fill };
  group.visible = false;
  group.renderOrder = 30;
  bg.renderOrder = 30;
  fill.renderOrder = 31;
  return group;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.isCoarse = window.matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isCoarse ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 160);
    this.cameraBase = new THREE.Vector3(0, 15.9, 18.5);
    this.cameraTarget = new THREE.Vector3(0, 0.2, 0.9);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(this.cameraTarget);
    this.isPortrait = window.innerHeight > window.innerWidth;
    this.cameraFocus = new THREE.Vector3(0, 0.2, 0.9);

    this.world = createWorld(this.scene, { mobile: this.isCoarse });
    this.player = createPlayer();
    this.player.position.set(PLAYER_START.x, 0, PLAYER_START.z);
    this.player.rotation.y = 0;
    this.scene.add(this.player);
    this.playerParts = this.player.userData;

    this.audio = new AudioEngine();
    this.lastFrameTime = performance.now();
    this.elapsed = 0;
    this.mode = 'title';
    this.nightIndex = 0;
    this.night = NIGHTS[0];

    this.timeLeft = this.night.duration;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.bestCombo = 1;
    this.peace = 100;
    this.soothed = 0;
    this.deliveries = 0;
    this.tucks = 0;
    this.chaos = 0;
    this.lastHud = 0;
    this.trauma = 0;
    this.walkPhase = 0;
    this.footstepTimer = 0;
    this.elapsedShift = 0;
    this.intensity = 1;
    this.musicIntensity = 0.1;
    this.activePramCount = ARCADE.startPrams;
    this.nextPramSlot = ARCADE.startPrams;
    this.nextPramAt = ARCADE.addPramAt[0];
    this.moodIndex = 0;
    this.aimTarget = null;
    this.aimPulse = 0;
    this.playerName = getSavedName();
    this.localEntry = null;
    this.remoteSubmitted = false;
    this.leaderboardGlobal = [];
    this.leaderboardLocal = getLocalScores();
    this.leaderboardStatus = 'idle';
    this.leaderboardReturn = 'title';
    this.leaderboardLoading = false;
    this.scoreSaved = false;
    this.countdownHide = 0;
    this.countdownStep = 3;
    this.countdownTimer = 0;
    this.activeInteraction = null;
    this.carry = null;
    this.pramStates = [];
    this.cardEls = [];
    this.particles = [];
    this.offscreenEls = [];
    this.fox = null;
    this.foxTimer = 999;
    this.wanderingBaby = null;
    this.escapeCheckTimer = 30 + Math.random() * 10;
    this.escapeCooldown = 0;
    this.birdTimer = 8 + Math.random() * 7;
    this.cribOccupant = null;
    this.tipsShown = new Set();
    this.needSequence = [];
    this.muted = false;
    this.keys = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.joystickPointer = null;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.dashDuration = 0.27;
    this.dashSpeed = 9.4;
    this.dashCooldownMax = 1.35;
    this.dashDirection = new THREE.Vector2(0, 1);
    this.throwAnimation = 0;
    this.projectiles = [];
    this.failureReason = null;
    this.missedBabyName = '';
    this.missedTargetLabel = '';
    this.playerVelocity = new THREE.Vector3();
    this.velocityXZ = new THREE.Vector2();
    this.flashTimer = 0;
    this.toastTimeout = null;
    this.lastResult = null;
    this.newBest = false;
    this.bestScore = getLocalBest();
    try {
      this.bestScore = Math.max(this.bestScore, Number(window.localStorage.getItem('pramageddon-best') || 0) || 0);
    } catch (error) {
      // Local storage can be unavailable in private mode.
    }
    this.helpReturnMode = 'title';
    this.pendingNightIntro = false;

    this.iconMaps = {};
    for (const [key, bg] of Object.entries(ICON_BG)) {
      this.iconMaps[key] = makeIconTexture(key, bg);
    }

    this.progressCrib = createProgressBar('#b3a4ff');
    this.progressCrib.position.set(-3.35, 3.28, -5.9);
    this.scene.add(this.progressCrib);
    this.progressWarmer = createProgressBar('#ffd166');
    this.progressWarmer.position.set(2.55, 3.25, -6.35);
    this.progressWarmer.scale.setScalar(1.25);
    this.scene.add(this.progressWarmer);

    this.foxAlert = makeIconSprite('warning', { scale: 0.5, bg: '#ff7a6b' });
    this.foxAlert.visible = false;
    this.scene.add(this.foxAlert);

    this.cribArrow = new THREE.Group();
    const arrowCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.62, 4),
      new THREE.MeshBasicMaterial({ color: '#c7bbff', depthTest: false, transparent: true })
    );
    arrowCone.rotation.x = Math.PI;
    arrowCone.renderOrder = 40;
    const arrowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.06, 4, 14),
      new THREE.MeshBasicMaterial({ color: '#b3a4ff', depthTest: false, transparent: true })
    );
    arrowRing.rotation.x = Math.PI / 2;
    arrowRing.position.y = 0.4;
    arrowRing.renderOrder = 40;
    const arrowLabel = makeNameTag('CRIB', '#e4dcff');
    arrowLabel.position.set(0, -0.52, 0);
    arrowLabel.scale.set(0.92, 0.345, 1);
    this.cribArrow.add(arrowCone, arrowRing, arrowLabel);
    this.cribArrow.position.set(-3.35, 4.1, -5.6);
    this.cribArrow.visible = false;
    this.scene.add(this.cribArrow);

    this.createAimHelpers();
    this.cacheDom();
    this.bindUI();
    this.bindInput();
    this.resize();
    this.windowHandlers();
    this.showStart();

    this.renderer.setAnimationLoop(() => this.frame());
    window.__PRAM = this;
  }

  cacheDom() {
    const $ = (id) => document.getElementById(id);
    this.dom = {
      hud: $('hud'),
      flash: $('flash'),
      fade: $('fade'),
      screenStart: $('screen-start'),
      screenNight: $('screen-night'),
      screenPause: $('screen-pause'),
      screenHelp: $('screen-help'),
      screenResults: $('screen-results'),
      screenLeaderboard: $('screen-leaderboard'),
      hudNight: $('hud-night'),
      hudShiftName: $('hud-shift-name'),
      hudTimer: $('hud-timer'),
      peaceFill: $('peace-fill'),
      peaceValue: $('peace-value'),
      peaceNote: $('peace-note'),
      hudScore: $('hud-score'),
      hudCombo: $('hud-combo'),
      heatPill: $('heat-pill'),
      warmerHud: $('warmer-hud'),
      warmerFill: $('warmer-fill'),
      warmerStatus: $('warmer-status'),
      personalBest: $('personal-best'),
      bestValue: $('best-value'),
      resultsBest: $('results-best'),
      joystick: $('joystick'),
      joystickKnob: $('joystick-knob'),
      touchAction: $('touch-action'),
      touchDrop: $('touch-drop'),
      touchThrow: $('touch-throw'),
      dashBtn: $('dash-btn'),
      handThrow: $('hand-throw'),
      fullscreenBtn: $('fullscreen-btn'),
      orderRail: $('order-rail'),
      offscreenMarkers: $('offscreen-markers'),
      handPill: $('hand-pill'),
      handContent: $('hand-content'),
      prompt: $('prompt'),
      promptText: $('prompt-text'),
      toasts: $('toasts'),
      fxLayer: $('fx-layer'),
      countdown: $('countdown'),
      chaosFrame: $('chaos-frame'),
      nightNumber: $('night-number'),
      nightEyebrow: $('night-eyebrow'),
      nightTitle: $('night-title'),
      nightSubtitle: $('night-subtitle'),
      nightDuration: $('night-duration'),
      nightPrams: $('night-prams'),
      nightForecast: $('night-forecast'),
      nightTip: $('night-tip'),
      nightControls: $('night-controls'),
      resultsEyebrow: $('results-eyebrow'),
      resultsTitle: $('results-title'),
      resultsFlavor: $('results-flavor'),
      resultsStars: $('results-stars'),
      resultsScore: $('results-score'),
      resultSoothed: $('result-soothed'),
      resultCombo: $('result-combo'),
      resultTime: $('result-time'),
      resultRank: $('result-rank'),
      resultsActions: document.querySelector('.results-actions'),
      retryNightBtn: $('retry-night-btn'),
      resultsLeaderboardBtn: $('results-leaderboard-btn'),
      resultsTitleBtn: $('results-title-btn'),
      scoreNameInput: $('score-name-input'),
      submitScoreBtn: $('submit-score-btn'),
      scoreSubmitStatus: $('score-submit-status'),
      leaderboardBtn: $('leaderboard-btn'),
      leaderboardClose: $('leaderboard-close'),
      leaderboardBack: $('leaderboard-back'),
      leaderboardPlay: $('leaderboard-play'),
      leaderboardList: $('leaderboard-list'),
      leaderboardStatus: $('leaderboard-status'),
      leaderboardBest: $('leaderboard-best'),
      leaderboardPersonal: $('leaderboard-personal'),
      startMuteBtn: $('start-mute-btn'),
      muteBtn: $('mute-btn'),
      pauseBtn: $('pause-btn'),
      resumeBtn: $('resume-btn'),
      pauseHelpBtn: $('pause-help-btn'),
      quitBtn: $('quit-btn'),
      helpClose: $('help-close'),
      helpOk: $('help-ok'),
      helpControls: $('help-controls'),
      nightBtn: $('night-btn'),
      startBtn: $('start-btn'),
      helpBtn: $('help-btn'),
      startMute: $('start-mute-btn'),
      chaos: $('chaos-frame'),
    };
  }

  bindUI() {
    this.dom.startBtn.addEventListener('click', () => this.startClicked());
    this.dom.pauseBtn.addEventListener('click', () => this.togglePause());
    this.dom.resumeBtn.addEventListener('click', () => this.resumeGame());
    this.dom.quitBtn.addEventListener('click', () => this.returnToTitle());
    this.dom.pauseHelpBtn.addEventListener('click', () => this.openHelp('paused'));
    this.dom.helpBtn.addEventListener('click', () => this.openHelp('title'));
    this.dom.helpClose.addEventListener('click', () => this.closeHelp());
    this.dom.helpOk.addEventListener('click', () => this.closeHelp());
    this.dom.muteBtn.addEventListener('click', () => this.toggleMute());
    this.dom.startMute.addEventListener('click', () => this.toggleMute());
    this.dom.dashBtn?.addEventListener('click', () => this.startDash());
    this.dom.retryNightBtn.addEventListener('click', () => this.retryNight());
    this.dom.resultsLeaderboardBtn?.addEventListener('click', () => this.openLeaderboard('results'));
    this.dom.resultsTitleBtn.addEventListener('click', () => this.returnToTitle());
    this.dom.leaderboardBtn?.addEventListener('click', () => this.openLeaderboard('title'));
    this.dom.leaderboardClose?.addEventListener('click', () => this.closeLeaderboard());
    this.dom.leaderboardBack?.addEventListener('click', () => this.closeLeaderboard());
    this.dom.leaderboardPlay?.addEventListener('click', () => this.startArcadeRun());
    this.dom.submitScoreBtn?.addEventListener('click', () => this.submitScore());
    this.dom.scoreNameInput?.addEventListener('input', () => {
      this.playerName = savePlayerName(this.dom.scoreNameInput.value);
    });
    this.dom.scoreNameInput?.addEventListener('focus', () => {
      const input = this.dom.scoreNameInput;
      if (input.value === this.playerName) input.select();
      if (this.isCoarse) {
        window.setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 220);
      }
    });
    this.dom.scoreNameInput?.addEventListener('blur', () => {
      this.dom.scoreNameInput.value = savePlayerName(this.dom.scoreNameInput.value);
    });
    this.dom.scoreNameInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.submitScore();
      }
    });
    window.addEventListener('resize', () => this.resize());
    this.bindTouchControls();
    this.bindFullscreen();
  }

  bindInput() {
    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const code = event.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        event.preventDefault();
      }
      if (event.repeat) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        this.keys.add(code);
      }
      if (code === 'KeyM') {
        this.toggleMute();
      } else if (code === 'Enter') {
        if (this.mode === 'title') this.startClicked();
        else if (this.mode === 'paused') this.resumeGame();
        else if (this.mode === 'help') this.closeHelp();
        else if (this.mode === 'results') this.retryNight();
        else if (this.mode === 'leaderboard') this.closeLeaderboard();
      } else if (code === 'Escape' || code === 'KeyP') {
        if (this.mode === 'playing' || this.mode === 'countdown') this.togglePause();
        else if (this.mode === 'paused') this.resumeGame();
        else if (this.mode === 'help') this.closeHelp();
        else if (this.mode === 'leaderboard') this.closeLeaderboard();
      } else if (code === 'KeyH') {
        if (this.mode === 'help') this.closeHelp();
        else if (this.mode === 'playing' || this.mode === 'countdown' || this.mode === 'paused') this.openHelp(this.mode === 'paused' ? 'paused' : this.mode);
        else if (this.mode === 'title') this.openHelp(this.mode);
      } else if (code === 'KeyE' || code === 'Space') {
        if (this.mode === 'playing') this.interact();
        else if (this.mode === 'title') this.startClicked();
      } else if (code === 'KeyQ') {
        if (this.mode === 'playing') this.dropCarried();
      } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
        if (this.mode === 'playing') this.startDash();
      } else if (code === 'KeyR') {
        if (this.mode === 'playing') this.throwCarried();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      if (this.mode === 'playing' || this.mode === 'countdown') this.togglePause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.mode === 'playing' || this.mode === 'countdown')) this.togglePause();
    });
  }

  bindTouchControls() {
    const joystick = this.dom.joystick;
    const knob = this.dom.joystickKnob;
    if (!joystick || !knob) return;
    let active = null;
    let lastTap = 0;
    const update = (event) => {
      if (event.pointerId !== active) return;
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (event.clientX - cx) / (rect.width * 0.34);
      let dy = (event.clientY - cy) / (rect.height * 0.34);
      const length = Math.hypot(dx, dy);
      if (length > 1) {
        dx /= length;
        dy /= length;
      }
      this.touchMove.x = dx;
      this.touchMove.y = -dy;
      knob.style.transform = `translate(${dx * rect.width * 0.26}px, ${dy * rect.height * 0.26}px)`;
    };
    const end = (event) => {
      if (active !== null && event.pointerId !== active) return;
      active = null;
      this.joystickPointer = null;
      this.touchMove.x = 0;
      this.touchMove.y = 0;
      knob.style.transform = 'translate(0px, 0px)';
    };
    joystick.addEventListener('pointerdown', (event) => {
      const now = performance.now();
      if (this.mode === 'playing' && now - lastTap < 280) this.startDash();
      lastTap = now;
      active = event.pointerId;
      this.joystickPointer = active;
      joystick.setPointerCapture(event.pointerId);
      update(event);
      event.preventDefault();
    });
    joystick.addEventListener('pointermove', update);
    joystick.addEventListener('pointerup', end);
    joystick.addEventListener('pointercancel', end);
    joystick.addEventListener('lostpointercapture', end);
    this.dom.touchAction?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.mode === 'playing') this.interact();
    });
    this.dom.touchDrop?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.mode === 'playing') this.dropCarried();
    });
    this.dom.touchThrow?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.mode === 'playing') this.throwCarried();
    });
  }

  bindFullscreen() {
    this.fullscreenSupported = Boolean(document.documentElement.requestFullscreen);
    if (this.dom.fullscreenBtn) {
      if (!this.fullscreenSupported) this.dom.fullscreenBtn.classList.add('hidden');
      this.dom.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }
    document.addEventListener('fullscreenchange', () => this.updateFullscreenUI());
    this.updateFullscreenUI();
  }

  async toggleFullscreen() {
    if (!this.fullscreenSupported) return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      // Some embedded browsers expose the API but refuse the request.
    }
    this.updateFullscreenUI();
  }

  updateFullscreenUI() {
    if (!this.dom.fullscreenBtn) return;
    const active = Boolean(document.fullscreenElement);
    this.dom.fullscreenBtn.classList.toggle('active', active);
    this.dom.fullscreenBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    const glyph = this.dom.fullscreenBtn.querySelector('.fullscreen-glyph');
    if (glyph) glyph.textContent = active ? '⤡' : '⛶';
  }

  tryEnterMobileFullscreen() {
    if (!this.isCoarse || !this.fullscreenSupported || document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }

  windowHandlers() {}

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const wasPortrait = this.isPortrait;
    this.isPortrait = h > w;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = this.isPortrait ? 46 : 40;
    if (this.isPortrait && !wasPortrait && this.player) {
      this.cameraFocus.set(this.player.position.x, 0.2, 0.9);
    }
    this.camera.updateProjectionMatrix();
  }

  showScreens() {
    for (const key of ['screenStart', 'screenNight', 'screenPause', 'screenHelp', 'screenResults', 'screenLeaderboard']) {
      this.dom[key].classList.add('hidden');
    }
  }

  showStart() {
    this.mode = 'title';
    this.showScreens();
    this.dom.screenStart.classList.remove('hidden');
    this.dom.hud.classList.add('hidden');
    this.dom.fade.classList.remove('on');
    this.dom.countdown.classList.add('hidden');
    this.dom.prompt.classList.add('hidden');
    this.audio.setMusicPaused(false);
    this.audio.setIntensity(0.18);
    this.world.setShiftMood(0);
    this.moodIndex = 0;
    this.pramStates = [];
    this.cardEls = [];
    this.offscreenEls = [];
    this.dom.orderRail.innerHTML = '';
    if (this.dom.offscreenMarkers) this.dom.offscreenMarkers.innerHTML = '';
    this.setPreviewPrams(ARCADE.startPrams);
    for (const pram of this.world.prams) {
      pram.group.userData.shakeGroup.position.set(0, 0, 0);
      pram.group.userData.shakeGroup.rotation.set(0, 0, 0);
      pram.group.userData.babyGroup.visible = true;
      pram.icon.material.map = this.iconMaps.zzz;
      pram.icon.material.needsUpdate = true;
      pram.icon.material.opacity = 0.8;
      pram.icon.scale.setScalar(0.62);
      pram.icon.visible = false;
      pram.arrow.visible = false;
      pram.highlight.group.visible = false;
    }
    this.player.position.set(PLAYER_START.x, 0, PLAYER_START.z);
    this.player.rotation.y = 0;
    for (const station of Object.values(this.world.stations)) {
      if (station.icon) station.icon.visible = false;
    }
    this.clearCarryVisual();
    this.clearWandering();
    this.carry = null;
    this.clearCrib();
    this.resetWarmer();
    this.clearParticles();
    this.clearToasts();
    this.fox = null;
    this.world.fox.visible = false;
    this.foxAlert.visible = false;
    this.progressCrib.visible = false;
    this.progressWarmer.visible = false;
    this.cribArrow.visible = false;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.tipsShown.clear();
    this.bestScore = getLocalBest();
    this.playerName = getSavedName();
    this.leaderboardLocal = getLocalScores();
    if (this.dom.bestValue) this.dom.bestValue.textContent = String(this.bestScore);
    if (this.dom.scoreNameInput) this.dom.scoreNameInput.value = this.playerName;
    this.hideAimHelper();
  }

  setPreviewPrams(count) {
    for (const pram of this.world.prams) {
      pram.group.visible = pram.index < count;
      pram.highlight.group.visible = false;
      pram.arrow.visible = false;
    }
    if (this.world.stations.crib) {
      this.world.stations.crib.group.userData.baby.visible = false;
      this.world.stations.crib.group.userData.blanket.visible = false;
    }
  }

  async startClicked() {
    if (this.mode !== 'title') return;
    this.tryEnterMobileFullscreen();
    await this.audio.init();
    this.audio.ui();
    this.audio.startMusic();
    this.dom.screenStart.classList.add('hidden');
    this.startArcadeRun();
  }

  startArcadeRun() {
    this.audio.ui();
    this.showScreens();
    this.dom.screenStart.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    this.resetShift();
    this.mode = 'countdown';
    this.countdownStep = 3;
    this.countdownTimer = 0.95;
    this.countdownHide = 0;
    this.dom.countdown.classList.remove('hidden');
    this.showCountdown('3', 'GET READY');
    this.audio.countdown(false);
    this.dom.prompt.classList.add('hidden');
    this.dom.fade.classList.remove('on');
    this.audio.setMusicPaused(false);
    this.audio.startMusic();
  }

  showCountdown(text, sub = '') {
    this.dom.countdown.innerHTML = `<span>${text}</span>${sub ? `<small>${sub}</small>` : ''}`;
    this.dom.countdown.classList.remove('hidden');
    this.dom.countdown.classList.remove('pop');
    void this.dom.countdown.offsetWidth;
    this.dom.countdown.classList.add('pop');
  }

  findPramState(index) {
    return this.pramStates.find((p) => p.index === index) || null;
  }

  createPramState(index, calmTimer) {
    const pram = this.world.prams[index];
    const state = {
      index,
      pram,
      name: BABY_NAMES[index],
      state: 'calm',
      need: null,
      fuss: 0.05 + Math.random() * 0.1,
      calmTimer,
      cryTimer: 0,
      shake: 0,
      carryMood: null,
      iconKey: 'zzz',
      needFlash: 0,
    };
    this.pramStates.push(state);
    this.applyPramIcon(state);
    return state;
  }

  resetShift() {
    this.night = NIGHTS[0];
    this.timeLeft = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.bestCombo = 1;
    this.peace = 100;
    this.soothed = 0;
    this.deliveries = 0;
    this.tucks = 0;
    this.elapsedShift = 0;
    this.intensity = 1;
    this.musicIntensity = 0.1;
    this.chaos = 0;
    this.trauma = 0;
    this.countdownHide = 0;
    this.lastHud = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.throwAnimation = 0;
    this.failureReason = null;
    this.missedBabyName = '';
    this.missedTargetLabel = '';
    this.localEntry = null;
    this.remoteSubmitted = false;
    this.scoreSaved = false;
    this.nextPramSlot = ARCADE.startPrams;
    this.nextPramAt = ARCADE.addPramAt[0] ?? null;
    this.activePramCount = ARCADE.startPrams;
    this.moodIndex = 0;
    this.clearWandering();
    this.clearProjectiles();
    this.escapeCheckTimer = 30 + Math.random() * 10;
    this.escapeCooldown = 0;
    this.foxTimer = ARCADE.firstFoxAt;
    this.birdTimer = 7 + Math.random() * 8;
    this.fox = null;
    this.world.fox.visible = false;
    this.foxAlert.visible = false;
    this.needSequence = ['pacifier', 'blanket', 'bottle', 'teddy'];
    this.player.position.set(PLAYER_START.x, 0, PLAYER_START.z);
    this.player.rotation.y = 0;
    this.cameraFocus.set(PLAYER_START.x, 0.2, 0.9);
    this.playerVelocity.set(0, 0, 0);
    this.velocityXZ.set(0, 0);
    this.keys.clear();
    this.carry = null;
    this.clearCarryVisual();
    this.clearCrib();
    this.resetWarmer();
    this.clearParticles();
    this.clearToasts();
    this.world.stations.warmer.state = 'empty';
    this.world.stations.warmer.timer = 0;
    this.progressWarmer.visible = false;
    this.progressCrib.visible = false;
    this.cribArrow.visible = false;

    for (const pram of this.world.prams) {
      pram.group.visible = false;
      pram.group.scale.setScalar(1);
      pram.highlight.group.visible = false;
      pram.arrow.visible = false;
      pram.icon.visible = false;
      pram.group.position.set(pram.basePosition.x, 0, pram.basePosition.z);
      pram.group.rotation.y = pram.baseRotation;
      pram.group.userData.shakeGroup.position.set(0, 0, 0);
      pram.group.userData.shakeGroup.rotation.set(0, 0, 0);
      pram.group.userData.babyGroup.visible = true;
      pram.nameTag.visible = true;
    }

    this.pramStates = [];
    for (let slot = 0; slot < ARCADE.startPrams; slot += 1) {
      const index = ARCADE.pramOrder[slot];
      const pram = this.world.prams[index];
      pram.group.visible = true;
      pram.icon.visible = true;
      this.createPramState(index, 5.4 + slot * 2.4 + Math.random() * 1.2);
    }

    for (const station of Object.values(this.world.stations)) {
      if (station.icon) station.icon.visible = true;
    }
    this.buildOrderCards();
    this.dom.hudNight.textContent = 'ARCADE';
    this.dom.hudShiftName.textContent = 'INGER · GJERDRUM';
    this.dom.hudTimer.textContent = '0:00';
    this.dom.hudTimer.classList.remove('warn');
    this.dom.hudScore.textContent = '0';
    this.dom.hudCombo.classList.add('hidden');
    if (this.dom.heatPill) {
      this.dom.heatPill.textContent = 'HEAT ×1.0';
      this.dom.heatPill.className = 'heat-pill';
    }
    this.dom.peaceFill.style.width = '100%';
    this.dom.peaceFill.className = 'peace-fill';
    this.dom.peaceValue.textContent = '100%';
    this.dom.peaceNote.textContent = 'Two prams. The street is watching.';
    this.dom.handContent.textContent = 'nothing yet';
    this.dom.handThrow?.classList.add('hidden');
    if (this.dom.warmerHud) {
      this.dom.warmerHud.classList.add('hidden');
      this.dom.hud.classList.remove('has-warmer');
    }
    this.dom.hud.classList.remove('hidden');
    this.dom.chaosFrame.classList.remove('on');
    this.dom.prompt.classList.add('hidden');
    this.dom.countdown.classList.add('hidden');
    if (this.dom.scoreNameInput) this.dom.scoreNameInput.value = this.playerName;
    if (this.dom.scoreSubmitStatus) this.dom.scoreSubmitStatus.textContent = '';
    this.audio.setIntensity(0.1);
    this.world.setShiftMood(0);
    this.hideAimHelper();
    this.updateHud(true);
  }

  hideAimHelper() {
    if (this.aimArrow) this.aimArrow.visible = false;
    if (this.aimRing) this.aimRing.visible = false;
    this.aimTarget = null;
  }

  clearWandering() {
    if (!this.wanderingBaby) return;
    const mesh = this.wanderingBaby.mesh;
    this.scene.remove(mesh);
    mesh.traverse((child) => {
      if (child.isMesh && child.geometry) child.geometry.dispose();
    });
    this.wanderingBaby = null;
  }

  tryStartEscape() {
    if (this.wanderingBaby || this.elapsedShift < 30) return;
    const crib = this.world.stations.crib;
    const cribState = this.findPramState(this.cribOccupant);
    const cribEligible =
      cribState &&
      (cribState.state === 'soothing' || cribState.state === 'ready') &&
      (crib.state === 'soothing' || crib.state === 'ready');
    const pramCandidates = this.pramStates.filter((p) => p.state === 'calm');
    if (!cribEligible && !pramCandidates.length) return;
    const chance = clamp(0.45 + (this.intensity - 1) * 0.1, 0.45, 0.65);
    if (Math.random() > chance) return;
    if (cribEligible && (Math.random() < 0.45 || !pramCandidates.length)) {
      this.beginWandering(cribState, 'crib');
    } else {
      const p = pramCandidates[Math.floor(Math.random() * pramCandidates.length)];
      this.beginWandering(p, 'pram');
    }
  }

  beginWandering(p, from) {
    if (!p || this.wanderingBaby) return;
    if (p.state !== 'calm' && p.state !== 'soothing' && p.state !== 'ready') return;
    const crib = this.world.stations.crib;
    let start;
    if (from === 'crib') {
      this.clearCrib();
      start = crib.position.clone();
      start.x += 0.55;
      start.z += 0.9;
    } else {
      start = p.pram.group.position.clone();
      start.z += 0.85;
    }
    p.state = 'wandering';
    p.need = null;
    p.carryMood = null;
    p.shake = 0;
    p.fuss = 0;
    p.pram.group.userData.babyGroup.visible = false;
    p.pram.icon.visible = true;
    this.applyPramIcon(p);

    const mesh = createWanderingBaby(PRAM_COLORS[p.index].blanket);
    mesh.position.set(start.x, 0, start.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    const tag = makeNameTag(p.name, PRAM_COLORS[p.index].trim);
    tag.position.set(0, 1.48, 0);
    tag.scale.set(0.9, 0.34, 1);
    mesh.add(tag);
    const alert = makeIconSprite('warning', { scale: 0.44, bg: '#ff9ec7' });
    alert.position.set(0, 1.92, 0);
    mesh.add(alert);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: '#ff9ec7', transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    mesh.add(ring);

    const duration = from === 'crib' ? 18 : 22;
    this.wanderingBaby = {
      pramIndex: p.index,
      name: p.name,
      from,
      mesh,
      tag,
      alert,
      ring,
      escapeTimer: duration,
      maxEscapeTimer: duration,
      speed: 1.05 + Math.random() * 0.32,
      phase: Math.random() * Math.PI * 2,
      retarget: 0,
      target: new THREE.Vector2(),
      bounds:
        from === 'crib'
          ? { minX: -5.8, maxX: 1.8, minZ: -8.2, maxZ: -2.6 }
          : { minX: -9.6, maxX: 9.6, minZ: 1.2, maxZ: 9.2 },
    };
    this.pickWanderTarget();
    this.escapeCheckTimer = 28 + Math.random() * 10;
    this.audio.cry(p.index, 1);
    this.addShake(0.18);
    this.flashScreen('#ffd166', 0.18);
    this.showToast(
      `${p.name} climbed out of the ${from === 'crib' ? 'crib' : 'pram'}! Catch them before they wander off!`,
      'urgent',
      'warning',
      3800
    );
    this.updateOrderCard(p, true);
    this.updateHud(true);
  }

  pickWanderTarget() {
    const w = this.wanderingBaby;
    if (!w) return;
    const b = w.bounds;
    const pos = w.mesh.position;
    let x = pos.x;
    let z = pos.z;
    for (let i = 0; i < 6; i += 1) {
      x = b.minX + Math.random() * (b.maxX - b.minX);
      z = b.minZ + Math.random() * (b.maxZ - b.minZ);
      if (Math.hypot(x - pos.x, z - pos.z) > 1.2) break;
    }
    w.target.set(x, z);
    w.retarget = 1.7 + Math.random() * 2.2;
  }

  updateWandering(dt) {
    const w = this.wanderingBaby;
    if (!w) return;
    w.escapeTimer -= dt;
    if (w.escapeTimer <= 0) {
      this.loseWandering();
      return;
    }
    w.retarget -= dt;
    const pos = w.mesh.position;
    const dx = w.target.x - pos.x;
    const dz = w.target.y - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.22 || w.retarget <= 0) {
      this.pickWanderTarget();
    } else {
      const step = Math.min(w.speed * dt, dist);
      const next = pos.clone();
      next.x += (dx / dist) * step;
      next.z += (dz / dist) * step;
      this.resolveCollisions(next);
      next.x = clamp(next.x, w.bounds.minX, w.bounds.maxX);
      next.z = clamp(next.z, w.bounds.minZ, w.bounds.maxZ);
      pos.x = next.x;
      pos.z = next.z;
      w.mesh.rotation.y = Math.atan2(dx, dz);
      w.phase += dt * (7 + w.speed * 2);
    }
    const swing = Math.sin(w.phase) * 0.55;
    const ud = w.mesh.userData;
    if (ud.leftLeg) ud.leftLeg.rotation.x = swing;
    if (ud.rightLeg) ud.rightLeg.rotation.x = -swing;
    if (ud.leftArm) ud.leftArm.rotation.x = -swing * 0.7;
    if (ud.rightArm) ud.rightArm.rotation.x = swing * 0.7;
    if (ud.body) ud.body.position.y = 0.43 + Math.abs(Math.sin(w.phase)) * 0.035;
    if (ud.head) ud.head.rotation.z = Math.sin(w.phase * 0.7) * 0.08;
    w.alert.position.y = 1.92 + Math.sin(this.elapsed * 6) * 0.08;
    w.tag.position.y = 1.48 + Math.sin(this.elapsed * 4) * 0.04;
    w.ring.material.opacity = 0.55 + Math.sin(this.elapsed * 7) * 0.22;
    w.ring.scale.setScalar(1 + Math.sin(this.elapsed * 5) * 0.08);
    if (w.escapeTimer <= 5) {
      w.alert.material.opacity = 0.55 + Math.sin(this.elapsed * 14) * 0.35;
    }
    const p = this.findPramState(w.pramIndex);
    if (p) this.updateOrderCard(p, false);
  }

  catchWanderingBaby() {
    const w = this.wanderingBaby;
    if (!w || this.mode !== 'playing' || this.carry) return;
    if (this.player.position.distanceTo(w.mesh.position) > 2.2) return;
    const p = this.findPramState(w.pramIndex);
    if (!p) return;
    const name = w.name;
    this.clearWandering();
    p.state = 'carried';
    p.carryMood = 'crying';
    p.cryTimer = 0.6;
    p.shake = 0;
    p.need = null;
    this.applyPramIcon(p);
    this.carry = {
      kind: 'baby',
      type: 'baby',
      pramIndex: p.index,
      name,
      mood: 'crying',
      mesh: null,
    };
    this.attachBabyMesh(p);
    this.escapeCooldown = 24 + Math.random() * 10;
    this.audio.pickup();
    this.flashScreen('#7ee0c3', 0.18);
    this.showToast(`Caught ${name}! Now get them to the crib.`, 'good', 'heart', 2400);
    this.updateOrderCard(p, true);
    this.updateHud(true);
  }

  loseWandering() {
    const w = this.wanderingBaby;
    if (!w) return;
    const p = this.findPramState(w.pramIndex);
    const name = w.name;
    this.clearWandering();
    if (p) {
      p.state = 'lost';
      p.need = null;
      p.carryMood = null;
      p.fuss = 0;
      p.pram.group.userData.babyGroup.visible = false;
      p.pram.icon.visible = true;
      this.applyPramIcon(p);
      this.updateOrderCard(p, true);
    }
    this.peace = clamp(this.peace - 28, 0, 100);
    this.escapeCooldown = 30 + Math.random() * 12;
    this.addShake(0.65);
    this.flashScreen('#e84a5f', 0.32);
    this.audio.error();
    this.audio.cry(p?.index ?? 0, 1);
    this.showToast(`${name} wandered out of Gjerdrum. Peace -28.`, 'bad', 'warning', 3600);
    this.updateHud(true);
  }

  addNextPram() {
    if (this.pramStates.length >= ARCADE.maxPrams) return;
    const slot = this.nextPramSlot;
    const index = ARCADE.pramOrder[slot];
    if (index === undefined) return;
    const pram = this.world.prams[index];
    pram.group.visible = true;
    pram.group.scale.setScalar(0.25);
    pram.group.position.set(pram.basePosition.x, 0, pram.basePosition.z);
    pram.group.rotation.y = pram.baseRotation;
    pram.highlight.group.visible = false;
    pram.arrow.visible = false;
    pram.icon.visible = true;
    pram.nameTag.visible = true;
    pram.group.userData.shakeGroup.position.set(0, 0, 0);
    pram.group.userData.shakeGroup.rotation.set(0, 0, 0);
    pram.group.userData.babyGroup.visible = true;
    const state = this.createPramState(index, 2.1 + Math.random() * 1.8);
    state.fuss = 0.1;
    this.pramStates.sort((a, b) => a.index - b.index);
    this.activePramCount = this.pramStates.length;
    this.nextPramSlot += 1;
    this.nextPramAt = ARCADE.addPramAt[this.activePramCount - ARCADE.startPrams] ?? null;
    this.buildOrderCards();
    this.spawnConfetti(pram.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 20);
    this.flashScreen('#ffe8b8', 0.22);
    this.addShake(0.08);
    this.audio.coo(index);
    this.showToast(`A new pram arrives! ${state.name} is now in the yard.`, 'urgent', 'warning', 3000);
    this.updateHud(true);
  }

  buildOrderCards() {
    this.dom.orderRail.innerHTML = this.pramStates
      .map(
        (p) => `
        <div class="order-card" data-pram="${p.index}">
          <div class="order-top">
            <span class="order-name">${p.name}</span>
            <span class="order-state">ASLEEP</span>
          </div>
          <div class="order-main">
            <div class="order-icon-box"><img class="pixel-icon" src="${getIconDataUrl('zzz')}" alt="" draggable="false" /></div>
            <div class="order-bars">
              <div class="fuss-bar"><div class="fuss-fill"></div></div>
              <div class="order-need-label">dreaming</div>
            </div>
          </div>
        </div>`
      )
      .join('');
    this.cardEls = [];
    for (const p of this.pramStates) {
      const el = this.dom.orderRail.querySelector(`.order-card[data-pram="${p.index}"]`);
      if (!el) continue;
      this.cardEls[p.index] = {
        el,
        icon: el.querySelector('img'),
        state: el.querySelector('.order-state'),
        bar: el.querySelector('.fuss-fill'),
        label: el.querySelector('.order-need-label'),
        lastName: '',
        lastState: '',
        lastIcon: '',
      };
    }

    if (this.dom.offscreenMarkers) {
      this.dom.offscreenMarkers.innerHTML = this.pramStates
        .map(
          (p) => `
          <div class="offscreen-marker" data-pram="${p.index}">
            <span class="om-orbit"><span class="om-arrow">▲</span></span>
            <img class="pixel-icon" src="${getIconDataUrl('zzz')}" alt="" draggable="false" />
          </div>`
        )
        .join('');
      this.offscreenEls = this.pramStates.map((p) => {
        const el = this.dom.offscreenMarkers.querySelector(`[data-pram="${p.index}"]`);
        return {
          el,
          icon: el.querySelector('img'),
          orbit: el.querySelector('.om-orbit'),
          lastIcon: '',
          lastClass: '',
        };
      });
    } else {
      this.offscreenEls = [];
    }
  }

  frame() {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    this.elapsed += dt;

    if (this.mode === 'playing') {
      this.updatePlaying(dt);
    } else if (this.mode === 'countdown') {
      this.updateCountdown(dt);
    }

    if (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'help' || this.mode === 'results') {
      this.world.update(dt, this.elapsed, this.chaos);
    } else {
      this.world.update(dt, this.elapsed, 0.1);
    }

    this.updatePlayerAnimation(dt);
    this.updateParticleVisuals(dt);
    this.updateCamera(dt);
    this.updatePramVisuals(dt);
    this.updateProgressBars();
    this.renderer.render(this.scene, this.camera);
  }

  updateCountdown(dt) {
    this.countdownTimer -= dt;
    if (this.countdownTimer > 0) return;
    if (this.countdownStep > 1) {
      this.countdownStep -= 1;
      this.countdownTimer = 0.95;
      this.showCountdown(String(this.countdownStep), this.countdownStep === 2 ? 'PRAMS ARE WARM' : 'KEEP IT DOWN');
      this.audio.countdown(false);
      return;
    }
    if (this.countdownStep === 1) {
      this.countdownStep = 0;
      this.showCountdown('SHHH', 'KEEP THE PEACE');
      this.audio.countdown(true);
      this.mode = 'playing';
      this.countdownHide = 0.95;
      this.updateHud(true);
      if (!this.tipsShown.has('welcome')) {
        this.tipsShown.add('welcome');
        window.setTimeout(() => {
          if (this.mode === 'playing') {
            this.showToast('Arcade run started. Read the bubbles — and keep the peace.', 'good', 'zzz');
          }
        }, 500);
      }
    }
  }

  updatePlaying(dt) {
    this.elapsedShift += dt;
    this.updateArcade(dt);
    if (this.countdownHide > 0) {
      this.countdownHide -= dt;
      if (this.countdownHide <= 0) this.dom.countdown.classList.add('hidden');
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboTimer = 0;
        this.updateHud(true);
      }
    }

    this.updatePlayer(dt);
    this.updateAimHelper();
    this.updateProjectiles(dt);
    this.updatePrams(dt);
    this.updateWandering(dt);
    this.updateWarmer(dt);
    this.updateCrib(dt);
    this.updateFox(dt);
    this.updateInteractions();

    let cryingCount = 0;
    let needyCount = 0;
    for (const p of this.pramStates) {
      if (p.state === 'crying') cryingCount += 1;
      if (p.state === 'needy') needyCount += 1;
    }
    if (this.carry?.kind === 'baby' && this.carry.mood === 'crying') cryingCount += 0.5;
    const drain = (ARCADE.baseCryDrain + Math.min(2.2, this.elapsedShift * 0.0035)) * Math.max(0, cryingCount);
    const minorDrain = needyCount * (0.07 + Math.min(0.08, this.elapsedShift * 0.0002));
    this.peace -= (drain + minorDrain) * dt;
    if (cryingCount === 0 && needyCount === 0) this.peace += 0.63 * dt;
    else if (cryingCount === 0) this.peace += 0.18 * dt;
    this.peace = clamp(this.peace, 0, 100);

    const activeCount = Math.max(1, this.pramStates.length);
    const danger = 1 - this.peace / 100;
    this.chaos = clamp(
      (cryingCount / activeCount) * 0.55 +
        needyCount * 0.065 +
        danger * 0.55 +
        (this.intensity - 1) * 0.16,
      0,
      1
    );
    const musicTarget = clamp(
      0.08 + danger * 0.62 + (this.intensity - 1) * 0.18 + Math.min(0.18, cryingCount * 0.05),
      0,
      1
    );
    this.musicIntensity = damp(this.musicIntensity, musicTarget, 1.6, dt);
    this.audio.setIntensity(this.musicIntensity);
    this.dom.chaosFrame.classList.toggle('on', cryingCount >= 2 || this.peace < 28 || this.intensity > 2.05);
    if (this.dom.chaosFrame.classList.contains('on')) {
      this.chaosPulse = (this.chaosPulse || 0) + dt;
    }

    if (this.foxTimer > 0) {
      this.foxTimer -= dt;
      if (this.foxTimer <= 0 && !this.fox) this.spawnFox();
    }

    if (this.birdTimer > 0) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        if (this.chaos < 0.52 && this.peace > 40) this.audio.bird();
        this.birdTimer = 10 + Math.random() * 15;
      }
    }

    this.updateHud(false);
    this.checkEnd();
  }

  updateArcade(dt) {
    let guard = 0;
    while (
      this.nextPramAt !== null &&
      this.elapsedShift >= this.nextPramAt &&
      this.pramStates.length < ARCADE.maxPrams &&
      guard < ARCADE.maxPrams
    ) {
      this.addNextPram();
      guard += 1;
    }
    const timeHeat = Math.min(1.5, this.elapsedShift / 240);
    this.intensity = 1 + timeHeat + Math.max(0, this.pramStates.length - ARCADE.startPrams) * 0.07;
    const targetMood = this.elapsedShift > 160 ? 2 : this.elapsedShift > 75 ? 1 : 0;
    if (targetMood !== this.moodIndex) {
      this.moodIndex = targetMood;
      this.world.setShiftMood(targetMood);
    }
    if (this.escapeCooldown > 0) this.escapeCooldown -= dt;
    if (!this.wanderingBaby && this.escapeCooldown <= 0) {
      this.escapeCheckTimer -= dt;
      if (this.escapeCheckTimer <= 0) {
        this.escapeCheckTimer = 24 + Math.random() * 12;
        this.tryStartEscape();
      }
    }
  }

  calmTime(base = 12, variance = 5) {
    return clamp((base + Math.random() * variance) / Math.max(1, this.intensity * 0.9), 3.2, 16);
  }

  startDash() {
    if (this.mode !== 'playing' || this.dashCooldown > 0 || this.dashTime > 0) return;
    const forward =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
      this.touchMove.y;
    const right =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.touchMove.x;
    let dx = right;
    let dz = -forward;
    if (Math.hypot(dx, dz) < 0.12) {
      dx = Math.sin(this.player.rotation.y);
      dz = Math.cos(this.player.rotation.y);
    }
    const length = Math.hypot(dx, dz) || 1;
    this.dashDirection.set(dx / length, dz / length);
    this.dashTime = this.dashDuration;
    this.dashCooldown = this.dashCooldownMax;
    this.dashTrailTimer = 0;
    this.player.rotation.y = Math.atan2(this.dashDirection.x, this.dashDirection.y);
    this.audio.dash();
    this.addShake(0.045);
    this.spawnFootPuff();
    this.updateHud(true);
  }

  updatePlayer(dt) {
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const forward =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
      this.touchMove.y;
    const right =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.touchMove.x;
    const move = new THREE.Vector2(right, -forward);
    if (move.lengthSq() > 1) move.normalize();

    const carryingBaby = this.carry?.kind === 'baby';
    const speed = carryingBaby ? 3.85 : this.carry?.kind === 'item' ? 4.55 : 5.15;
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      const dashSpeed = carryingBaby ? 7.7 : this.dashSpeed;
      this.velocityXZ.set(this.dashDirection.x * dashSpeed, this.dashDirection.y * dashSpeed);
      this.dashTrailTimer = (this.dashTrailTimer || 0) - dt;
      if (this.dashTrailTimer <= 0) {
        this.spawnFootPuff();
        this.dashTrailTimer = 0.055;
      }
      this.player.rotation.y = Math.atan2(this.dashDirection.x, this.dashDirection.y);
    } else {
      const targetX = move.x * speed;
      const targetZ = move.y * speed;
      this.velocityXZ.x = damp(this.velocityXZ.x, targetX, 13, dt);
      this.velocityXZ.y = damp(this.velocityXZ.y, targetZ, 13, dt);
      if (Math.abs(this.velocityXZ.x) < 0.02) this.velocityXZ.x = 0;
      if (Math.abs(this.velocityXZ.y) < 0.02) this.velocityXZ.y = 0;
    }

    this.player.position.x += this.velocityXZ.x * dt;
    this.player.position.z += this.velocityXZ.y * dt;
    this.resolveCollisions(this.player.position);

    const speedNow = Math.hypot(this.velocityXZ.x, this.velocityXZ.y);
    if (speedNow > 0.25) {
      const targetAngle = Math.atan2(this.velocityXZ.x, this.velocityXZ.y);
      let diff = targetAngle - this.player.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.player.rotation.y += diff * (1 - Math.exp(-16 * dt));
      this.walkPhase += dt * (5.8 + speedNow * 1.35);
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.audio.footstep();
        this.footstepTimer = carryingBaby ? 0.48 : 0.33;
        if (Math.random() < 0.6) this.spawnFootPuff();
      }
    } else {
      this.walkPhase += dt * 1.5;
      this.footstepTimer = Math.min(this.footstepTimer, 0.12);
    }

    this.playerParts.bodyGroup.position.y = Math.sin(this.walkPhase * 2) * 0.025 * clamp(speedNow / 4, 0, 1);
    if (this.carry?.kind === 'item') {
      this.carry.mesh.position.y = -0.04 + Math.sin(this.elapsed * 4) * 0.012;
      this.carry.mesh.rotation.z = Math.sin(this.elapsed * 2.4) * 0.02;
    } else if (this.carry?.kind === 'baby') {
      this.carry.mesh.position.y = -0.07 + Math.sin(this.elapsed * 3.4) * 0.015;
    }
  }

  updatePlayerAnimation(dt) {
    this.throwAnimation = Math.max(0, this.throwAnimation - dt);
    const speed =
      this.mode === 'playing'
        ? Math.hypot(this.velocityXZ.x, this.velocityXZ.y)
        : 0;
    const moving = speed > 0.2;
    const swing = moving ? clamp(speed / 4.2, 0, 1) : 0;
    const legSwing = Math.sin(this.walkPhase) * 0.62 * swing;
    this.playerParts.leftLeg.rotation.x = legSwing;
    this.playerParts.rightLeg.rotation.x = -legSwing;

    const carryingBaby = this.carry?.kind === 'baby';
    if (this.throwAnimation > 0) {
      this.playerParts.leftArm.rotation.x = damp(this.playerParts.leftArm.rotation.x, -2.25, 24, dt);
      this.playerParts.rightArm.rotation.x = damp(this.playerParts.rightArm.rotation.x, -2.25, 24, dt);
      this.playerParts.leftArm.rotation.z = damp(this.playerParts.leftArm.rotation.z, 0.2, 18, dt);
      this.playerParts.rightArm.rotation.z = damp(this.playerParts.rightArm.rotation.z, -0.2, 18, dt);
    } else if (carryingBaby) {
      this.playerParts.leftArm.rotation.x = damp(this.playerParts.leftArm.rotation.x, -1.2, 12, dt);
      this.playerParts.rightArm.rotation.x = damp(this.playerParts.rightArm.rotation.x, -1.2, 12, dt);
      this.playerParts.leftArm.rotation.z = damp(this.playerParts.leftArm.rotation.z, 0.16, 10, dt);
      this.playerParts.rightArm.rotation.z = damp(this.playerParts.rightArm.rotation.z, -0.16, 10, dt);
    } else if (this.carry?.kind === 'item') {
      this.playerParts.leftArm.rotation.x = damp(this.playerParts.leftArm.rotation.x, -0.8, 12, dt);
      this.playerParts.rightArm.rotation.x = damp(this.playerParts.rightArm.rotation.x, -0.8, 12, dt);
      this.playerParts.leftArm.rotation.z = damp(this.playerParts.leftArm.rotation.z, 0, 10, dt);
      this.playerParts.rightArm.rotation.z = damp(this.playerParts.rightArm.rotation.z, 0, 10, dt);
    } else {
      this.playerParts.leftArm.rotation.x = damp(this.playerParts.leftArm.rotation.x, legSwing * 0.8, 11, dt);
      this.playerParts.rightArm.rotation.x = damp(this.playerParts.rightArm.rotation.x, -legSwing * 0.8, 11, dt);
      this.playerParts.leftArm.rotation.z = damp(this.playerParts.leftArm.rotation.z, 0, 10, dt);
      this.playerParts.rightArm.rotation.z = damp(this.playerParts.rightArm.rotation.z, 0, 10, dt);
    }

    const leanTarget = this.dashTime > 0 ? -0.14 : 0;
    this.playerParts.bodyGroup.rotation.x = damp(this.playerParts.bodyGroup.rotation.x, leanTarget, 12, dt);
    if (this.playerParts.head) {
      this.playerParts.head.rotation.z = Math.sin(this.elapsed * 1.6) * 0.012;
      this.playerParts.head.rotation.y = Math.sin(this.elapsed * 0.8) * 0.04;
    }
    if (this.playerParts.pom) {
      this.playerParts.pom.position.y = 0.43 + Math.sin(this.walkPhase * 1.5) * 0.02 * swing;
    }
  }

  resolveCollisions(pos) {
    const radius = 0.38;
    for (let iteration = 0; iteration < 2; iteration += 1) {
      for (const collider of this.world.colliders) {
        const minX = collider.minX - radius;
        const maxX = collider.maxX + radius;
        const minZ = collider.minZ - radius;
        const maxZ = collider.maxZ + radius;
        if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue;
        const dl = pos.x - minX;
        const dr = maxX - pos.x;
        const dt = pos.z - minZ;
        const db = maxZ - pos.z;
        const smallest = Math.min(dl, dr, dt, db);
        if (smallest === dl) pos.x = minX;
        else if (smallest === dr) pos.x = maxX;
        else if (smallest === dt) pos.z = minZ;
        else pos.z = maxZ;
      }
    }
    pos.x = clamp(pos.x, this.world.bounds.minX, this.world.bounds.maxX);
    pos.z = clamp(pos.z, this.world.bounds.minZ, this.world.bounds.maxZ);
  }

  updatePrams(dt) {
    for (const p of this.pramStates) {
      if (p.state === 'calm') {
        p.fuss = Math.max(0, p.fuss - dt * 0.018);
        p.calmTimer -= dt;
        if (p.calmTimer <= 0) this.becomeNeedy(p);
      } else if (p.state === 'needy') {
        p.fuss = clamp(p.fuss + ARCADE.baseNeedBite * this.intensity * dt, 0, 1);
        p.needFlash = Math.max(0, p.needFlash - dt);
        if (p.fuss >= 1) this.becomeCrying(p);
      } else if (p.state === 'crying') {
        p.fuss = 1;
        p.cryTimer -= dt;
        if (p.cryTimer <= 0) {
          this.audio.cry(p.index, 0.8);
          this.spawnTears(p, 2);
          p.cryTimer = 1.6 + Math.random() * 1.4;
        }
        p.shake = Math.min(1, p.shake + dt * 4);
      } else if (p.state === 'soothing' || p.state === 'ready' || p.state === 'carried') {
        p.fuss = 0;
      }
    }
    if (this.carry?.kind === 'baby' && this.carry.mood === 'crying') {
      this.carryCryTimer = (this.carryCryTimer || 0) - dt;
      if (this.carryCryTimer <= 0) {
        this.audio.cry(this.carry.pramIndex, 0.65);
        this.carryCryTimer = 2.2;
      }
    }
  }

  becomeNeedy(p) {
    if (p.state !== 'calm') return;
    p.state = 'needy';
    p.fuss = clamp(0.42 + (this.intensity - 1) * 0.06, 0.42, 0.62);
    p.need = this.chooseNeed();
    p.needFlash = 1.4;
    p.calmTimer = 0;
    this.applyPramIcon(p);
    this.audio.coo(p.index);
    if (!this.tipsShown.has('firstNeed')) {
      this.tipsShown.add('firstNeed');
      this.showToast(`A baby stirs! They want a ${ITEM_META[p.need].short.toLowerCase()}.`, 'good', p.need);
    }
    this.updateHud(true);
  }

  chooseNeed() {
    if (this.needSequence.length) return this.needSequence.shift();
    const roll = Math.random();
    if (roll < 0.3) return 'pacifier';
    if (roll < 0.58) return 'bottle';
    if (roll < 0.84) return 'blanket';
    return 'teddy';
  }

  becomeCrying(p) {
    if (p.state !== 'needy' && p.state !== 'calm') return;
    p.state = 'crying';
    p.need = null;
    p.fuss = 1;
    p.shake = 0;
    p.cryTimer = 0.2;
    this.applyPramIcon(p);
    this.audio.cry(p.index, 1);
    this.addShake(0.5);
    this.spawnTears(p, 4);
    if (!this.tipsShown.has('firstCry')) {
      this.tipsShown.add('firstCry');
      this.showToast(`${p.name} is wailing! Scoop them up (E) and carry them to the crib.`, 'urgent', 'cry');
    } else {
      this.showToast(`${p.name} is wailing!`, 'urgent', 'cry');
    }
    for (const other of this.pramStates) {
      if (other === p) continue;
      if (other.state === 'calm') other.calmTimer = Math.max(0.2, other.calmTimer - 1.4);
      if (other.state === 'needy') other.fuss = clamp(other.fuss + 0.05, 0, 0.99);
    }
    this.updateHud(true);
  }

  applyPramIcon(p) {
    let key = 'zzz';
    let opacity = 0.8;
    let scale = 0.62;
    if (p.state === 'wandering' || p.state === 'lost') {
      key = 'warning';
      opacity = 1;
      scale = 0.7;
    } else if (p.state === 'needy' && p.need) {
      key = p.need;
      opacity = 1;
      scale = 0.7;
    } else if (p.state === 'crying') {
      key = 'cry';
      opacity = 1;
      scale = 0.74;
    } else if (p.state === 'carried') {
      p.pram.icon.visible = false;
      return;
    } else if (p.state === 'soothing') {
      p.pram.icon.visible = false;
      return;
    } else if (p.state === 'ready') {
      p.pram.icon.visible = false;
      return;
    }
    p.pram.icon.material.map = this.iconMaps[key];
    p.pram.icon.material.needsUpdate = true;
    p.pram.icon.material.opacity = opacity;
    p.pram.icon.scale.set(scale, scale, 1);
    p.pram.icon.visible = true;
    p.iconKey = key;
  }

  updatePramVisuals(dt) {
    for (const p of this.pramStates) {
      if (!p.pram.group.visible) continue;
      if (p.pram.group.scale.x < 0.999) {
        const nextScale = damp(p.pram.group.scale.x, 1, 7, dt);
        p.pram.group.scale.setScalar(nextScale);
      }
      const userData = p.pram.group.userData;
      const isCrying = p.state === 'crying';
      const shakeAmount = isCrying ? 0.05 : p.shake > 0 ? p.shake * 0.04 : 0;
      if (isCrying) {
        userData.shakeGroup.position.x = Math.sin(this.elapsed * 34 + p.index) * 0.027;
        userData.shakeGroup.position.z = Math.cos(this.elapsed * 26 + p.index) * 0.012;
        userData.shakeGroup.rotation.z = Math.sin(this.elapsed * 28 + p.index) * 0.017;
        userData.babyGroup.rotation.z = Math.sin(this.elapsed * 20 + p.index) * 0.04;
        p.pram.icon.scale.setScalar(0.74 + Math.sin(this.elapsed * 12) * 0.025);
        p.pram.icon.position.y = 2.5 + Math.sin(this.elapsed * 9) * 0.09;
      } else {
        userData.shakeGroup.position.x *= Math.max(0, 1 - dt * 8);
        userData.shakeGroup.position.z *= Math.max(0, 1 - dt * 8);
        userData.shakeGroup.rotation.z *= Math.max(0, 1 - dt * 8);
        userData.babyGroup.rotation.z = Math.sin(this.elapsed * 1.2 + p.index) * 0.006;
        if (p.state === 'needy') {
          p.pram.icon.scale.setScalar(0.7 + Math.sin(this.elapsed * 3.4) * 0.018);
        }
      }
      userData.babyGroup.visible = !['carried', 'soothing', 'ready', 'wandering', 'lost'].includes(p.state);
      if (p.state === 'carried' || p.state === 'soothing' || p.state === 'ready') {
        p.pram.icon.visible = false;
      } else if (!isCrying) {
        p.pram.icon.visible = true;
      }
      if (p.pram.arrow.visible) {
        p.pram.arrow.position.y = 2.95 + Math.sin(this.elapsed * 4) * 0.12;
        p.pram.arrow.material.rotation = Math.sin(this.elapsed * 2) * 0.08;
      }
      if (isCrying) {
        p.pram.highlight.group.visible = true;
        p.pram.highlight.ring.material.color.set('#ff6b6b');
        p.pram.highlight.inner.material.color.set('#ff6b6b');
        p.pram.highlight.ring.material.opacity = 0.2 + Math.sin(this.elapsed * 5) * 0.12;
        p.pram.highlight.inner.material.opacity = 0.04 + Math.sin(this.elapsed * 5) * 0.025;
      }
    }
  }

  updateWarmer(dt) {
    const station = this.world.stations.warmer;
    if (!station) return;
    if (station.state === 'warming') {
      station.timer += dt;
      const progress = clamp(station.timer / station.maxTimer, 0, 1);
      station.group.userData.bottle.visible = true;
      station.group.userData.steamGroup.visible = true;
      if (station.icon) station.icon.visible = false;
      this.progressWarmer.visible = true;
      this.progressWarmer.userData.fill.scale.x = Math.max(0.001, progress);
      this.progressWarmer.userData.fill.position.x = -0.59 + 0.59 * progress;
      if (station.timer >= station.maxTimer) {
        station.state = 'ready';
        station.timer = 0;
        station.group.userData.steamGroup.visible = true;
        this.progressWarmer.visible = false;
        this.audio.warmReady();
        this.showToast('Warm bottle ready! Grab it with E.', 'good', 'bottle');
        if (station.icon) {
          station.icon.material.map = this.iconMaps.bottle;
          station.icon.material.needsUpdate = true;
        }
      }
    } else if (station.state === 'ready') {
      if (station.icon) station.icon.visible = false;
      station.group.userData.steamGroup.visible = true;
      station.group.userData.steamGroup.children.forEach((puff, i) => {
        puff.position.y = (this.elapsed * 0.2 + i * 0.14) % 0.55;
        puff.material.opacity = 0.22 * (1 - puff.position.y / 0.55);
      });
    } else {
      station.group.userData.bottle.visible = false;
      station.group.userData.steamGroup.visible = false;
      if (station.icon) station.icon.visible = true;
      this.progressWarmer.visible = false;
    }
    this.updateWarmerHud();
  }

  updateWarmerHud() {
    if (!this.dom.warmerHud) return;
    const station = this.world.stations.warmer;
    if (!station) return;
    const active = this.mode === 'playing' || this.mode === 'countdown' || this.mode === 'paused';
    if (!active || station.state === 'empty') {
      this.dom.warmerHud.classList.add('hidden');
      this.dom.hud.classList.remove('has-warmer');
      return;
    }
    this.dom.warmerHud.classList.remove('hidden');
    this.dom.hud.classList.add('has-warmer');
    if (station.state === 'warming') {
      const progress = clamp(station.timer / station.maxTimer, 0, 1);
      this.dom.warmerHud.classList.remove('ready');
      this.dom.warmerHud.classList.add('warming');
      this.dom.warmerFill.style.width = `${Math.max(2, progress * 100)}%`;
      this.dom.warmerStatus.textContent = `${Math.max(0, station.maxTimer - station.timer).toFixed(1)}s`;
    } else {
      this.dom.warmerHud.classList.remove('warming');
      this.dom.warmerHud.classList.add('ready');
      this.dom.warmerFill.style.width = '100%';
      this.dom.warmerStatus.textContent = 'READY · E';
    }
  }

  resetWarmer() {
    const station = this.world.stations.warmer;
    if (!station) return;
    station.state = 'empty';
    station.timer = 0;
    station.group.userData.bottle.visible = false;
    station.group.userData.steamGroup.visible = false;
    if (station.icon) station.icon.visible = true;
    this.progressWarmer.visible = false;
    if (this.dom.warmerHud) {
      this.dom.warmerHud.classList.add('hidden');
      this.dom.warmerHud.classList.remove('warming', 'ready');
      this.dom.hud.classList.remove('has-warmer');
    }
  }

  updateCrib(dt) {
    const crib = this.world.stations.crib;
    if (!crib) return;
    if (crib.state === 'soothing') {
      crib.timer += dt;
      const progress = clamp(crib.timer / crib.maxTimer, 0, 1);
      this.progressCrib.visible = true;
      this.progressCrib.userData.fill.scale.x = Math.max(0.001, progress);
      this.progressCrib.userData.fill.position.x = -0.59 + 0.59 * progress;
      if (crib.timer >= crib.maxTimer) {
        crib.state = 'ready';
        this.progressCrib.visible = false;
        const p = this.findPramState(this.cribOccupant);
        if (p) {
          p.state = 'ready';
          this.audio.warmReady();
          this.showToast(`${p.name} is soothed! Carry them back to their pram.`, 'good', 'zzz');
          this.applyPramIcon(p);
          this.addShake(0.04);
          this.updateOrderCard(p, true);
        }
        this.updateHud(true);
      }
    } else if (crib.state === 'ready') {
      const baby = crib.group.userData.baby;
      if (baby) {
        baby.position.y = 0.84 + Math.sin(this.elapsed * 2) * 0.012;
      }
    }
  }

  clearCrib() {
    const crib = this.world.stations.crib;
    if (!crib) return;
    crib.state = 'empty';
    crib.timer = 0;
    crib.group.userData.baby.visible = false;
    crib.group.userData.blanket.visible = false;
    this.progressCrib.visible = false;
    this.cribOccupant = null;
  }

  updateFox(dt) {
    if (this.fox) {
      const fox = this.fox;
      const f = this.world.fox;
      if (!f.visible) {
        this.fox = null;
        return;
      }
      if (fox.state === 'approach') {
        const target = fox.targetPram.group.position;
        const dx = target.x - f.position.x;
        const dz = target.z - f.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.45) {
          const p = fox.targetPramState;
          this.audio.fox();
          this.addShake(0.45);
          if (p && (p.state === 'calm' || p.state === 'needy')) {
            this.becomeCrying(p);
            this.showToast('The fox scared a baby! Shoo it away!', 'urgent', 'warning');
          }
          fox.state = 'flee';
          fox.fleeTimer = 2.4;
          f.position.x += dx * 0.1;
          f.position.z += dz * 0.1;
        } else {
          const speed = 2.7;
          f.position.x += (dx / dist) * speed * dt;
          f.position.z += (dz / dist) * speed * dt;
          f.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
          f.position.y = Math.abs(Math.sin(this.elapsed * 10)) * 0.04;
          fox.legPhase += dt * 10;
          this.animateFoxLegs(fox.legPhase);
        }
      } else if (fox.state === 'flee') {
        fox.fleeTimer -= dt;
        const dx = 11.5 - f.position.x;
        const dz = 2.2 - f.position.z;
        const dist = Math.hypot(dx, dz) || 1;
        f.position.x += (dx / dist) * 5.2 * dt;
        f.position.z += (dz / dist) * 5.2 * dt;
        f.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
        f.position.y = Math.abs(Math.sin(this.elapsed * 16)) * 0.06;
        fox.legPhase += dt * 16;
        this.animateFoxLegs(fox.legPhase);
        if (fox.fleeTimer <= 0 || f.position.x > 10.5) {
          f.visible = false;
          this.fox = null;
          this.foxAlert.visible = false;
          this.foxTimer = Math.max(12, 38 - this.elapsedShift * 0.035) * (0.85 + Math.random() * 0.5);
        }
      }
      if (this.fox) {
        this.foxAlert.position.set(f.position.x, 2.1, f.position.z + 0.1);
        this.foxAlert.visible = this.fox.state === 'approach';
        this.foxAlert.position.y = 2.1 + Math.sin(this.elapsed * 4) * 0.1;
      }
      if (f.userData.tail) f.userData.tail.rotation.y = Math.sin(this.elapsed * 6) * 0.2;
    }
  }

  animateFoxLegs(phase) {
    if (!this.world.fox) return;
    const legs = this.world.fox.userData.legs;
    if (!legs) return;
    legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(phase + i * Math.PI * 0.5) * 0.5;
    });
  }

  spawnFox() {
    const candidates = this.pramStates.filter((p) => p.state === 'calm' || p.state === 'needy');
    if (!candidates.length) {
      this.foxTimer = 8;
      return;
    }
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const fox = this.world.fox;
    fox.position.set(11.8, 0, 0.1);
    fox.visible = true;
    fox.rotation.y = Math.PI;
    fox.userData.head.rotation.z = 0;
    this.fox = {
      state: 'approach',
      targetPram: target.pram,
      targetPramState: target,
      legPhase: 0,
      fleeTimer: 2.4,
    };
    this.foxAlert.visible = true;
    this.foxAlert.position.set(11.8, 2.1, 0.2);
    this.audio.fox();
    this.showToast('A fox is sneaking through the yard! Shoo it!', 'urgent', 'warning');
    this.addShake(0.18);
  }

  updateInteractions() {
    for (const p of this.pramStates) {
      if (p.state !== 'crying') p.pram.highlight.group.visible = false;
    }
    let best = null;
    let bestDist = Infinity;
    const playerPos = this.player.position;

    for (const p of this.pramStates) {
      const d = playerPos.distanceTo(p.pram.group.position);
      if (p.state === 'crying') {
        p.pram.highlight.group.visible = true;
        p.pram.highlight.ring.material.color.set('#ff6b6b');
        p.pram.highlight.inner.material.color.set('#ff6b6b');
        p.pram.highlight.ring.material.opacity = 0.24 + Math.sin(this.elapsed * 5) * 0.12;
        p.pram.highlight.inner.material.opacity = 0.035;
        p.pram.highlight.group.scale.setScalar(1 + Math.sin(this.elapsed * 4) * 0.04);
      }
      if (d < 2.05) {
        const candidate = this.pramInteraction(p, d);
        if (candidate) candidate.distance = d;
        if (candidate && (!best || d < bestDist)) {
          best = candidate;
          bestDist = d;
        }
      }
    }

    for (const [key, station] of Object.entries(this.world.stations)) {
      const radius = key === 'crib' ? 2.0 : 1.65;
      const d = playerPos.distanceTo(station.position);
      if (d < radius) {
        const candidate = this.stationInteraction(key, station, d);
        if (candidate) candidate.distance = d;
        if (candidate && (!best || d < bestDist)) {
          best = candidate;
          bestDist = d;
        }
      }
    }

    if (this.wanderingBaby) {
      const d = playerPos.distanceTo(this.wanderingBaby.mesh.position);
      if (d < 2.15) {
        const candidate = {
          type: 'wander',
          distance: d,
          action: 'catchWanderingBaby',
          label: this.carry
            ? `Hands full — drop it to catch ${this.wanderingBaby.name}`
            : `Catch ${this.wanderingBaby.name}!`,
          enabled: !this.carry,
          highlight: null,
        };
        if (!best || d < bestDist) {
          best = candidate;
          bestDist = d;
        }
      }
    }

    if (this.fox) {
      const d = playerPos.distanceTo(this.world.fox.position);
      if (d < 1.85) {
        const candidate = {
          type: 'fox',
          distance: d,
          action: 'shooFox',
          label: 'Shoo the fox!',
          enabled: true,
          highlight: null,
        };
        if (!best || d < bestDist) {
          best = candidate;
          bestDist = d;
        }
      }
    }

    if (best) {
      this.showInteractionHighlight(best);
    } else {
      for (const station of Object.values(this.world.stations)) {
        station.highlight.group.visible = false;
      }
    }

    const cribBusy = this.world.stations.crib.state !== 'empty';
    if (this.carry?.kind === 'baby' && this.carry.mood === 'crying' && !cribBusy) {
      const crib = this.world.stations.crib;
      crib.highlight.group.visible = true;
      crib.highlight.ring.material.color.set('#b3a4ff');
      crib.highlight.inner.material.color.set('#b3a4ff');
      crib.highlight.ring.material.opacity = 0.34 + Math.sin(this.elapsed * 4) * 0.12;
      crib.highlight.inner.material.opacity = 0.05;
      if (crib.icon) {
        const pulse = 0.66 + Math.sin(this.elapsed * 4) * 0.06;
        crib.icon.scale.setScalar(pulse);
      }
      this.cribArrow.visible = true;
      if (this.player.position.z < -1.05) {
        this.cribArrow.position.set(-3.35, 4.02 + Math.sin(this.elapsed * 4.5) * 0.14, -5.6);
      } else {
        this.cribArrow.position.set(0.2, 3.62 + Math.sin(this.elapsed * 4.5) * 0.14, 0.35);
      }
      this.cribArrow.rotation.y = Math.sin(this.elapsed * 2) * 0.18;
      this.cribArrow.children[1].rotation.z = this.elapsed * 1.5;
    } else {
      this.cribArrow.visible = false;
      if (this.world.stations.crib.icon) {
        this.world.stations.crib.icon.scale.setScalar(0.58);
      }
    }

    this.activeInteraction = best;
    this.dom.prompt.classList.toggle('hidden', !best);
    if (best) {
      this.dom.prompt.classList.toggle('disabled', !best.enabled);
      this.dom.promptText.textContent = best.label;
    }
    this.dom.prompt.classList.toggle('disabled', !best?.enabled);

    // The baby's own pram is flagged when it is the next step: a sleepy baby
    // returning home, or a crying baby whose crib is occupied.
    for (const p of this.pramStates) {
      const isTarget = this.carry?.kind === 'baby' && this.carry.pramIndex === p.index;
      const returningCrying = isTarget && this.carry.mood === 'crying' && cribBusy && p.state === 'carried';
      const returningReady = isTarget && this.carry.mood === 'ready' && p.state === 'carried';
      p.pram.arrow.visible = Boolean((returningReady || returningCrying) && this.mode === 'playing');
      if (returningReady || returningCrying) {
        p.pram.highlight.group.visible = true;
        const color = returningReady ? '#ffd166' : '#ff9ec7';
        p.pram.highlight.ring.material.color.set(color);
        p.pram.highlight.inner.material.color.set(color);
        p.pram.highlight.ring.material.opacity = 0.42 + Math.sin(this.elapsed * 4) * 0.13;
        p.pram.highlight.inner.material.opacity = 0.06;
      }
    }
  }

  pramInteraction(p, distance) {
    const carryingBaby = this.carry?.kind === 'baby';
    const carryingItem = this.carry?.kind === 'item';
    const base = { type: 'pram', target: p, distance, enabled: false, action: null, label: '', highlight: p.pram };

    if (p.state === 'wandering') {
      return { ...base, enabled: false, action: null, label: `${p.name} is on the loose — catch them!` };
    }
    if (p.state === 'lost') {
      return { ...base, enabled: false, action: null, label: `${p.name} wandered out of Gjerdrum` };
    }

    if (carryingBaby) {
      if (p.index === this.carry.pramIndex) {
        if (this.carry.mood === 'ready') {
          return {
            ...base,
            enabled: true,
            action: 'tuckBaby',
            label: `Tuck ${p.name} back into their pram`,
          };
        }
        return {
          ...base,
          enabled: true,
          action: 'returnBabyToPram',
          label: `Put ${p.name} back in their pram (still crying)`,
        };
      }
      if (this.carry.mood === 'ready') {
        return {
          ...base,
          enabled: false,
          action: null,
          label: `Wrong pram! ${this.carry.name} belongs over there`,
        };
      }
      return {
        ...base,
        enabled: false,
        action: null,
        label: `This isn't ${this.carry.name}'s pram`,
      };
    }

    if (carryingItem) {
      if (p.state === 'needy' && p.need) {
        const correct = this.carry.type === p.need;
        if (!correct) {
          return {
            ...base,
            enabled: false,
            action: null,
            label: `Needs a ${ITEM_META[p.need].short.toLowerCase()} — not that`,
          };
        }
        if (p.need === 'bottle' && !this.carry.warm) {
          return {
            ...base,
            enabled: false,
            action: null,
            label: 'That bottle is cold! Warm it on the stove',
          };
        }
        return {
          ...base,
          enabled: true,
          action: 'deliverItem',
          label: `Give the ${ITEM_META[p.need].short.toLowerCase()} to ${p.name}`,
        };
      }
      if (p.state === 'crying') {
        return { ...base, enabled: false, action: null, label: `${p.name} is too upset for that — scoop them up` };
      }
      if (p.state === 'calm') {
        return { ...base, enabled: false, action: null, label: `${p.name} is sleeping. Don't wake them!` };
      }
      return { ...base, enabled: false, action: null, label: `${p.name} is busy being soothed` };
    }

    if (p.state === 'crying') {
      return {
        ...base,
        enabled: true,
        action: 'pickupBaby',
        label: `Scoop up ${p.name} (they're wailing!)`,
      };
    }
    if (p.state === 'needy' && p.need) {
      return {
        ...base,
        enabled: false,
        action: null,
        label: `${p.name} needs a ${ITEM_META[p.need].short.toLowerCase()} — ${ITEM_HELP[p.need]}`,
      };
    }
    if (p.state === 'calm') {
      return { ...base, enabled: false, action: null, label: `Shh... ${p.name} is dreaming` };
    }
    if (p.state === 'carried') {
      return { ...base, enabled: false, action: null, label: `${p.name}'s pram is empty — carry them home` };
    }
    if (p.state === 'soothing') {
      return { ...base, enabled: false, action: null, label: `${p.name} is being soothed inside` };
    }
    if (p.state === 'ready') {
      return { ...base, enabled: false, action: null, label: `${p.name} is waiting in the crib` };
    }
    return null;
  }

  stationInteraction(key, station, distance) {
    const carryingBaby = this.carry?.kind === 'baby';
    const carryingItem = this.carry?.kind === 'item';
    const base = { type: 'station', key, target: station, distance, enabled: false, action: null, label: '', highlight: station };

    if (key === 'crib') {
      if (carryingBaby) {
        if (this.carry.mood === 'crying') {
          if (station.state === 'empty') {
            return { ...base, enabled: true, action: 'placeInCrib', label: `Tuck ${this.carry.name} into the big crib` };
          }
          return {
            ...base,
            enabled: false,
            action: null,
            label: `Crib busy — put ${this.carry.name} back in their pram`,
          };
        }
        return { ...base, enabled: false, action: null, label: `${this.carry.name} is ready for their pram, not the crib` };
      }
      if (station.state === 'empty') {
        return { ...base, enabled: false, action: null, label: 'The big crib · for wailing babies only' };
      }
      if (station.state === 'soothing') {
        const remain = Math.max(0, station.maxTimer - station.timer);
        return { ...base, enabled: false, action: null, label: `Ssshh... ${remain.toFixed(1)} seconds` };
      }
      if (station.state === 'ready') {
        if (!carryingItem) {
          return { ...base, enabled: true, action: 'pickupCribBaby', label: `Pick up sleepy ${this.findPramState(this.cribOccupant)?.name || 'baby'}` };
        }
        return { ...base, enabled: false, action: null, label: 'Hands full! Put that down first' };
      }
      return null;
    }

    if (key === 'warmer') {
      if (station.state === 'empty') {
        if (carryingItem && this.carry.type === 'bottle' && !this.carry.warm) {
          return { ...base, enabled: true, action: 'warmBottle', label: 'Place the cold bottle in the warmer' };
        }
        return {
          ...base,
          enabled: false,
          action: null,
          label: carryingItem ? 'The warmer needs a cold bottle' : 'Bring a cold bottle here to warm it',
        };
      }
      if (station.state === 'warming') {
        const remain = Math.max(0, station.maxTimer - station.timer);
        return { ...base, enabled: false, action: null, label: `Warming... ${remain.toFixed(1)}s` };
      }
      if (station.state === 'ready') {
        if (!carryingItem && !carryingBaby) {
          return { ...base, enabled: true, action: 'takeWarmBottle', label: 'Grab the warm bottle' };
        }
        return { ...base, enabled: false, action: null, label: 'Hands full! Put that down first' };
      }
    }

    if (['paci', 'blanket', 'bottles', 'teddy'].includes(key)) {
      if (carryingBaby) {
        return { ...base, enabled: false, action: null, label: 'Your arms are full of baby' };
      }
      if (carryingItem) {
        return { ...base, enabled: false, action: null, label: 'Hands full! Q drops what you have' };
      }
      const item = station.item || (key === 'bottles' ? 'bottle' : null);
      const label =
        key === 'bottles'
          ? 'Grab a cold bottle'
          : `Grab a ${ITEM_META[item]?.short.toLowerCase() || 'thing'}`;
      return { ...base, enabled: true, action: 'pickupItem', item, label };
    }

    return null;
  }

  showInteractionHighlight(interaction) {
    for (const station of Object.values(this.world.stations)) {
      station.highlight.group.visible = false;
    }
    for (const p of this.pramStates) {
      if (p.state !== 'crying') p.pram.highlight.group.visible = false;
    }
    if (interaction.type === 'wander') {
      if (this.wanderingBaby) {
        this.wanderingBaby.ring.material.color.set(interaction.enabled ? '#7ee0c3' : '#ff9ec7');
      }
    } else if (interaction.type === 'pram') {
      const p = interaction.target;
      const ring = p.pram ? p.pram.highlight : p.highlight;
      if (p.state !== 'crying' && ring) {
        ring.group.visible = true;
        ring.ring.material.color.set(interaction.enabled ? '#ffd166' : '#8ecae6');
        ring.inner.material.color.set(interaction.enabled ? '#ffd166' : '#8ecae6');
        ring.ring.material.opacity = interaction.enabled ? 0.42 : 0.18;
        ring.inner.material.opacity = 0.035;
      }
    } else if (interaction.type === 'station') {
      const station = interaction.target;
      station.highlight.group.visible = true;
      station.highlight.ring.material.color.set(interaction.enabled ? '#ffd166' : '#8ecae6');
      station.highlight.inner.material.color.set(interaction.enabled ? '#ffd166' : '#8ecae6');
      station.highlight.ring.material.opacity = interaction.enabled ? 0.4 : 0.16;
      station.highlight.inner.material.opacity = 0.03;
    }
  }

  interact() {
    if (this.mode !== 'playing') return;
    const interaction = this.activeInteraction;
    if (!interaction) return;
    if (!interaction.enabled) {
      this.audio.error();
      if (interaction.label) this.showToast(interaction.label, 'bad', null, 1500);
      return;
    }
    switch (interaction.action) {
      case 'pickupBaby':
        this.pickupBaby(interaction.target);
        break;
      case 'deliverItem':
        this.deliverItem(interaction.target);
        break;
      case 'tuckBaby':
        this.tuckBaby(interaction.target);
        break;
      case 'returnBabyToPram':
        this.returnBabyToPram(interaction.target);
        break;
      case 'catchWanderingBaby':
        this.catchWanderingBaby();
        break;
      case 'pickupItem':
        this.pickupItem(interaction.item, interaction.key);
        break;
      case 'warmBottle':
        this.placeBottleInWarmer();
        break;
      case 'takeWarmBottle':
        this.takeWarmBottle();
        break;
      case 'placeInCrib':
        this.placeInCrib();
        break;
      case 'pickupCribBaby':
        this.pickupCribBaby();
        break;
      case 'shooFox':
        this.shooFox();
        break;
      default:
        break;
    }
    this.updateHud(true);
  }

  pickupBaby(p) {
    if (this.carry) return;
    if (p.state !== 'crying') return;
    p.state = 'carried';
    p.carryMood = 'crying';
    p.shake = 0;
    p.cryTimer = 0;
    this.applyPramIcon(p);
    this.carry = {
      kind: 'baby',
      type: 'baby',
      pramIndex: p.index,
      name: p.name,
      mood: 'crying',
      mesh: null,
    };
    this.attachBabyMesh(p);
    this.audio.pickup();
    const cribBusy = this.world.stations.crib.state !== 'empty';
    this.showToast(
      cribBusy
        ? `${p.name} is in your arms. The crib is busy — put them back in their pram (E there) if you need free hands.`
        : `${p.name} is in your arms. Inside! To the crib!`,
      cribBusy ? 'urgent' : 'good',
      cribBusy ? 'warning' : 'cry',
      cribBusy ? 3400 : 3000
    );
    this.addShake(0.03);
    this.updateHud(true);
  }

  attachBabyMesh(p) {
    const bundle = createBabyBundle(PRAM_COLORS[p.index].blanket);
    const holder = new THREE.Group();
    holder.add(bundle);
    bundle.position.set(0, -0.1, 0);
    bundle.scale.setScalar(0.82);
    bundle.rotation.x = -0.18;
    holder.scale.setScalar(1);
    this.playerParts.handAnchor.add(holder);
    this.carry.mesh = holder;
    this.carry.babyMesh = bundle;
  }

  deliveryLabel(type) {
    return ITEM_META[type]?.short || type;
  }

  deliverItem(p) {
    if (this.carry?.kind !== 'item') return;
    if (p.state !== 'needy' || !p.need) return;
    if (this.carry.type !== p.need) return;
    if (p.need === 'bottle' && !this.carry.warm) {
      this.audio.error();
      this.showToast('That bottle is cold! Warm it on the stove inside.', 'bad', 'bottle');
      return;
    }
    const itemName = this.deliveryLabel(p.need);
    this.removeCarryMesh();
    this.carry = null;
    this.completeItemDelivery(p, itemName, false);
  }

  completeItemDelivery(p, itemName, thrown = false) {
    p.state = 'calm';
    p.fuss = 0;
    p.need = null;
    p.calmTimer = this.calmTime(12, 5);
    p.needFlash = 0;
    this.applyPramIcon(p);
    this.audio.deliver();
    this.registerServe(thrown ? 140 : 110, p);
    this.peace = clamp(this.peace + (thrown ? 7.5 : 5.8), 0, 100);
    this.showToast(
      thrown
        ? `BULLSEYE! The ${itemName.toLowerCase()} landed perfectly. ${p.name} is back asleep.`
        : `${p.name} got the ${itemName.toLowerCase()}. Back to sleep.`,
      'good',
      null,
      2200
    );
    this.spawnConfetti(p.pram.group.position, thrown ? 11 : 7);
    this.addShake(0.03);
    this.updateHud(true);
  }

  pickupItem(type, stationKey) {
    if (this.carry) return;
    if (!type) return;
    const mesh = createItem(type);
    mesh.scale.multiplyScalar(0.82);
    mesh.position.set(0, -0.05, 0);
    this.playerParts.handAnchor.add(mesh);
    this.carry = {
      kind: 'item',
      type,
      warm: false,
      mesh,
    };
    this.audio.pickup();
    if (!this.tipsShown.has('firstPickup')) {
      this.tipsShown.add('firstPickup');
      this.showToast('Carry it to a matching pram and press E — or press R to throw it.', 'good', type);
    }
    if (type === 'bottle') {
      this.showToast('Cold bottle. Warm it on the stove inside.', 'good', 'bottle', 2200);
    }
    this.updateHud(true);
  }

  placeBottleInWarmer() {
    if (this.carry?.kind !== 'item' || this.carry.type !== 'bottle' || this.carry.warm) return;
    const station = this.world.stations.warmer;
    this.removeCarryMesh();
    this.carry = null;
    station.state = 'warming';
    station.timer = 0;
    station.group.userData.bottle.visible = true;
    station.group.userData.steamGroup.visible = true;
    this.audio.bottleIn();
    this.showToast('Bottle warming. You can leave it — the stove does the rest.', 'good', 'bottle');
    this.updateWarmerHud();
    this.updateHud(true);
  }

  takeWarmBottle() {
    if (this.carry) return;
    const station = this.world.stations.warmer;
    if (station.state !== 'ready') return;
    station.state = 'empty';
    station.timer = 0;
    station.group.userData.bottle.visible = false;
    station.group.userData.steamGroup.visible = false;
    const mesh = createItem('bottle');
    mesh.scale.multiplyScalar(0.82);
    mesh.position.set(0, -0.05, 0);
    this.playerParts.handAnchor.add(mesh);
    this.carry = { kind: 'item', type: 'bottle', warm: true, mesh };
    this.audio.pickup();
    if (this.world.stations.warmer.icon) this.world.stations.warmer.icon.visible = true;
    this.updateWarmerHud();
    this.showToast('Warm bottle, straight from the stove.', 'good', 'bottle', 2000);
    this.updateHud(true);
  }

  placeInCrib() {
    if (this.carry?.kind !== 'baby' || this.carry.mood !== 'crying') return;
    const crib = this.world.stations.crib;
    if (crib.state !== 'empty') return;
    const p = this.findPramState(this.carry.pramIndex);
    this.removeCarryMesh();
    this.carry = null;
    this.completeCribPlacement(p, false);
  }

  completeCribPlacement(p, thrown = false) {
    const crib = this.world.stations.crib;
    crib.state = 'soothing';
    crib.timer = 0;
    crib.group.userData.baby.visible = true;
    crib.group.userData.blanket.visible = true;
    this.cribOccupant = p.index;
    p.state = 'soothing';
    this.applyPramIcon(p);
    this.audio.shush();
    this.showToast(
      thrown
        ? `AIRBABY! ${p.name} made it into the crib. Smooth.`
        : `Shhh... ${p.name} is being rocked to sleep.`,
      'good',
      'zzz',
      2600
    );
    this.peace = clamp(this.peace + 2.5, 0, 100);
    this.updateOrderCard(p, true);
    this.updateHud(true);
  }

  pickupCribBaby() {
    const crib = this.world.stations.crib;
    if (crib.state !== 'ready' || this.carry) return;
    const p = this.findPramState(this.cribOccupant);
    if (!p) return;
    crib.state = 'empty';
    crib.group.userData.baby.visible = false;
    crib.group.userData.blanket.visible = false;
    this.cribOccupant = null;
    this.progressCrib.visible = false;
    p.state = 'carried';
    p.carryMood = 'ready';
    this.carry = {
      kind: 'baby',
      type: 'baby',
      pramIndex: p.index,
      name: p.name,
      mood: 'ready',
      mesh: null,
    };
    this.attachBabyMesh(p);
    this.audio.pickup();
    this.showToast(`Carry sleepy ${p.name} back to their own pram.`, 'good', 'zzz', 2400);
    this.updateHud(true);
  }

  tuckBaby(p) {
    if (this.carry?.kind !== 'baby' || this.carry.mood !== 'ready' || this.carry.pramIndex !== p.index) return;
    const name = this.carry.name;
    this.removeCarryMesh();
    this.carry = null;
    this.completeTuck(p, name, false);
  }

  completeTuck(p, name, thrown = false) {
    p.state = 'calm';
    p.fuss = 0;
    p.need = null;
    p.carryMood = null;
    p.calmTimer = this.calmTime(14, 5);
    p.pram.group.userData.babyGroup.visible = true;
    p.pram.arrow.visible = false;
    p.pram.highlight.group.visible = false;
    this.applyPramIcon(p);
    this.audio.tuck();
    this.registerServe(thrown ? 310 : 260, p);
    this.peace = clamp(this.peace + 12, 0, 100);
    this.tucks += 1;
    this.spawnConfetti(p.pram.group.position, thrown ? 23 : 18);
    this.flashScreen('#ffe8b8', 0.26);
    this.addShake(0.1);
    this.showToast(
      thrown
        ? `SWISH! ${name} landed back in their own pram. Show-off.`
        : `${name} is tucked in. Peace restored (mostly).`,
      'good',
      'zzz',
      2400
    );
    this.updateOrderCard(p, true);
    this.updateHud(true);
  }

  returnBabyToPram(p) {
    if (!p || this.carry?.kind !== 'baby' || this.carry.pramIndex !== p.index || this.carry.mood !== 'crying') return;
    this.removeCarryMesh();
    this.carry = null;
    p.state = 'crying';
    p.carryMood = null;
    p.cryTimer = 0.4;
    p.shake = 0;
    p.pram.group.userData.babyGroup.visible = true;
    p.pram.icon.visible = true;
    this.applyPramIcon(p);
    this.audio.cry(p.index, 0.8);
    this.showToast(`${p.name} is back in their pram — still wailing. Come back when the crib is free.`, 'urgent', 'cry', 3000);
    this.updateOrderCard(p, true);
    this.updateHud(true);
  }

  dropCarried() {
    if (!this.carry) {
      this.audio.error();
      return;
    }
    if (this.carry.kind === 'baby') {
      const p = this.findPramState(this.carry.pramIndex);
      if (p && this.player.position.distanceTo(p.pram.group.position) < 2.05) {
        this.returnBabyToPram(p);
        return;
      }
      this.audio.error();
      this.showToast("You can't put a baby down in the snow! Take them to their pram, or find a free crib.", 'bad', 'warning', 2000);
      return;
    }
    this.removeCarryMesh();
    this.carry = null;
    this.audio.drop();
    this.updateHud(true);
  }

  getThrowTarget() {
    if (!this.carry) return null;
    const isBaby = this.carry.kind === 'baby';
    const range = isBaby ? ARCADE.babyThrowRange : ARCADE.itemThrowRange;
    const forwardX = Math.sin(this.player.rotation.y);
    const forwardZ = Math.cos(this.player.rotation.y);
    const aimWidth = isBaby ? ARCADE.babyAimWidth : ARCADE.itemAimWidth;
    let best = null;
    let bestScore = Infinity;

    const consider = (x, z, target) => {
      const dx = x - this.player.position.x;
      const dz = z - this.player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.15 || distance > range) return;
      const along = dx * forwardX + dz * forwardZ;
      if (along <= 0) return;
      const lateral = Math.abs(dx * forwardZ - dz * forwardX);
      if (lateral > aimWidth) return;
      const score = lateral * 3.4 + distance * 0.045;
      if (score < bestScore) {
        bestScore = score;
        best = target;
      }
    };

    if (this.carry.kind === 'item') {
      for (const p of this.pramStates) {
        if (p.state !== 'needy' || p.need !== this.carry.type) continue;
        if (p.need === 'bottle' && !this.carry.warm) continue;
        consider(p.pram.group.position.x, p.pram.group.position.z, {
          kind: 'pram',
          pram: p,
          point: p.pram.group.position.clone().add(new THREE.Vector3(0, 1.35, 0.1)),
          label: p.name,
        });
      }
      return best;
    }

    if (this.carry.mood === 'crying') {
      const crib = this.world.stations.crib;
      if (crib.state === 'empty') {
        consider(crib.position.x, crib.position.z, {
          kind: 'crib',
          station: crib,
          pram: this.findPramState(this.carry.pramIndex),
          point: crib.position.clone().add(new THREE.Vector3(0, 1.25, 0.1)),
          label: 'the crib',
        });
      }
      return best;
    }

    if (this.carry.mood === 'ready') {
      const p = this.findPramState(this.carry.pramIndex);
      if (p && p.state === 'carried') {
        consider(p.pram.group.position.x, p.pram.group.position.z, {
          kind: 'pram',
          pram: p,
          point: p.pram.group.position.clone().add(new THREE.Vector3(0, 1.35, 0.1)),
          label: p.name,
        });
      }
    }
    return best;
  }

  createAimHelpers() {
    this.aimMaterial = new THREE.MeshBasicMaterial({
      color: '#7ee0c3',
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.35), this.aimMaterial);
    shaft.rotation.x = -Math.PI / 2;
    shaft.position.set(0, 0.045, 0.78);
    shaft.renderOrder = 36;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.52, 3), this.aimMaterial);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0.045, 1.55);
    head.renderOrder = 36;
    arrow.add(shaft, head);
    arrow.visible = false;
    this.player.add(arrow);
    this.aimArrow = arrow;

    this.aimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.56, 0.73, 28),
      new THREE.MeshBasicMaterial({
        color: '#7ee0c3',
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.aimRing.rotation.x = -Math.PI / 2;
    this.aimRing.position.y = 0.05;
    this.aimRing.visible = false;
    this.aimRing.renderOrder = 35;
    this.scene.add(this.aimRing);
  }

  updateAimHelper() {
    const active = this.mode === 'playing' && this.carry;
    this.aimTarget = active ? this.getThrowTarget() : null;
    if (!this.aimArrow || !this.aimRing) return;
    this.aimArrow.visible = Boolean(active);
    if (!active) {
      this.aimRing.visible = false;
      return;
    }
    const valid = Boolean(this.aimTarget);
    const color = valid ? '#7ee0c3' : '#ff5e6c';
    this.aimMaterial.color.set(color);
    this.aimRing.material.color.set(color);
    if (valid) {
      this.aimPulse += 0.05;
      this.aimRing.position.set(this.aimTarget.point.x, 0.06, this.aimTarget.point.z);
      this.aimRing.visible = true;
      this.aimRing.material.opacity = 0.58 + Math.sin(this.elapsed * 6) * 0.2;
      this.aimRing.scale.setScalar(1 + Math.sin(this.elapsed * 4) * 0.06);
    } else {
      this.aimRing.visible = false;
    }
  }

  throwCarried() {
    if (this.mode !== 'playing' || !this.carry?.mesh) return;
    if (this.carry.kind === 'baby' && this.carry.mood === 'crying' && this.world.stations.crib.state !== 'empty') {
      this.audio.error();
      this.showToast('The crib is busy. Put this baby back in their pram, or wait for the crib.', 'urgent', 'warning', 2400);
      return;
    }
    const carry = this.carry;
    const target = this.getThrowTarget();
    this.player.updateMatrixWorld(true);
    const start = new THREE.Vector3();
    carry.mesh.getWorldPosition(start);
    start.y += 0.12;
    const mesh = carry.mesh;
    this.scene.attach(mesh);
    mesh.position.copy(start);

    let end;
    let targetKind = null;
    let targetPram = null;
    let targetStation = null;
    let targetLabel = 'the snow';
    if (target) {
      end = target.point.clone();
      targetKind = target.kind;
      targetPram = target.pram || null;
      targetStation = target.station || null;
      targetLabel = target.label;
      this.player.rotation.y = Math.atan2(end.x - this.player.position.x, end.z - this.player.position.z);
    } else {
      const facingX = Math.sin(this.player.rotation.y);
      const facingZ = Math.cos(this.player.rotation.y);
      end = new THREE.Vector3(this.player.position.x + facingX * 8.6, 0.35, this.player.position.z + facingZ * 8.6);
    }

    const distance = start.distanceTo(end);
    const duration = clamp(0.38 + distance * 0.038, 0.42, 0.92);
    this.projectiles.push({
      mesh,
      kind: carry.kind,
      type: carry.type,
      warm: carry.warm,
      pramIndex: carry.pramIndex,
      name: carry.name,
      mood: carry.mood,
      targetKind,
      targetPram,
      targetStation,
      targetLabel,
      start,
      end,
      elapsed: 0,
      duration,
      arc: 1.25 + distance * 0.13,
      spin: (Math.random() - 0.5) * 8,
    });
    this.carry = null;
    this.throwAnimation = 0.36;
    this.audio.whoosh();
    if (carry.kind === 'baby' && carry.mood === 'crying') this.audio.cry(carry.pramIndex, 0.65);
    this.addShake(0.06);
    this.showScorePopupAt(start, carry.kind === 'baby' ? 'YEET!' : 'THROW!', 'soft');
    if (!target) {
      this.showToast(
        carry.kind === 'baby'
          ? 'No safe target! Inger, do NOT throw that baby!'
          : `No target nearby — the ${this.deliveryLabel(carry.type).toLowerCase()} is gone.`,
        'urgent',
        'warning',
        2400
      );
    }
    this.updateHud(true);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      if (!projectile) continue;
      projectile.elapsed += dt;
      const t = Math.min(1, projectile.elapsed / projectile.duration);
      const eased = t * t * (3 - 2 * t);
      projectile.mesh.position.lerpVectors(projectile.start, projectile.end, eased);
      projectile.mesh.position.y += Math.sin(t * Math.PI) * projectile.arc;
      projectile.mesh.rotation.x += dt * 8;
      projectile.mesh.rotation.z += dt * projectile.spin;
      if (t >= 1) {
        this.removeProjectileMesh(projectile);
        this.projectiles.splice(i, 1);
        this.resolveThrow(projectile);
      }
    }
  }

  resolveThrow(projectile) {
    if (projectile.kind === 'item') {
      const p = projectile.targetPram;
      if (
        projectile.targetKind === 'pram' &&
        p &&
        p.state === 'needy' &&
        p.need === projectile.type &&
        (projectile.type !== 'bottle' || projectile.warm)
      ) {
        this.completeItemDelivery(p, this.deliveryLabel(projectile.type), true);
        this.spawnConfetti(projectile.end, 8);
      } else {
        this.audio.error();
        this.showToast(`Missed! The ${this.deliveryLabel(projectile.type).toLowerCase()} is lost in the snow.`, 'bad', projectile.type, 2200);
      }
      return;
    }

    const p = projectile.targetPram;
    let success = false;
    if (projectile.targetKind === 'crib' && p) {
      const crib = this.world.stations.crib;
      if (crib.state === 'empty' && p.state === 'carried' && projectile.mood === 'crying') {
        this.completeCribPlacement(p, true);
        success = true;
      }
    } else if (projectile.targetKind === 'pram' && p) {
      if (p.state === 'carried' && projectile.mood === 'ready') {
        this.completeTuck(p, projectile.name, true);
        success = true;
      }
    }
    if (!success) this.babyThrowMiss(p, projectile.name, projectile.targetLabel);
  }

  babyThrowMiss(pram, name, targetLabel) {
    this.failureReason = 'babyThrow';
    this.missedBabyName = name;
    this.missedTargetLabel = targetLabel;
    this.addShake(1);
    this.flashScreen('#e84a5f', 0.5);
    this.audio.error();
    this.showScorePopupAt(this.player.position, 'MISS!', 'bad');
    this.endShift(false);
  }

  removeProjectileMesh(projectile) {
    if (!projectile.mesh) return;
    this.scene.remove(projectile.mesh);
    projectile.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
    projectile.mesh = null;
  }

  clearProjectiles() {
    for (const projectile of this.projectiles) this.removeProjectileMesh(projectile);
    this.projectiles = [];
  }

  removeCarryMesh() {
    if (!this.carry?.mesh) return;
    this.playerParts.handAnchor.remove(this.carry.mesh);
    this.carry.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
    this.carry.mesh = null;
  }

  clearCarryVisual() {
    if (this.carry?.mesh) {
      this.playerParts.handAnchor.remove(this.carry.mesh);
    }
    this.carry = null;
  }

  shooFox() {
    if (!this.fox) return;
    this.fox.state = 'flee';
    this.fox.fleeTimer = 1.8;
    this.audio.whoosh();
    this.addShake(0.15);
    this.score += 50;
    this.showToast('Shooed! The fox will think twice.', 'good', 'star', 1800);
    this.showScorePopupAt(this.world.fox.position, '+50 SHOO', 'soft');
    this.updateHud(true);
  }

  registerServe(base, p) {
    const comboMultiplier = Math.min(5, this.combo);
    const points = base * comboMultiplier;
    this.score += points;
    this.soothed += 1;
    this.combo = Math.min(6, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, comboMultiplier);
    this.comboTimer = 11;
    const label = comboMultiplier > 1 ? `+${points}  ×${comboMultiplier}` : `+${points}`;
    this.showScorePopup(p, label, '');
    if (this.combo > 2) {
      this.showToast(`COMBO ×${comboMultiplier}! The prams are thriving.`, 'good', 'star', 1600);
    }
  }

  showScorePopup(p, text, cls = '') {
    const pos = p.pram.group.position.clone();
    pos.y = 2.75;
    this.showScorePopupAt(pos, text, cls);
  }

  showScorePopupAt(pos, text, cls = '') {
    const projected = pos.clone().project(this.camera);
    if (projected.z > 1) return;
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    if (x < -80 || x > window.innerWidth + 80 || y < -80 || y > window.innerHeight + 80) return;
    const el = document.createElement('div');
    el.className = `score-pop ${cls}`.trim();
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.dom.fxLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 1100);
  }

  spawnConfetti(position, count = 12) {
    const colors = ['#ffd166', '#ff9ec7', '#7ee0c3', '#8ecae6', '#fff6df', '#b3a4ff'];
    for (let i = 0; i < count; i += 1) {
      const size = 0.07 + Math.random() * 0.09;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({ color: colors[i % colors.length] })
      );
      mesh.position.set(position.x + (Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 0.6, position.z + (Math.random() - 0.5) * 0.6);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 2.6,
        vy: 2.2 + Math.random() * 2.4,
        vz: (Math.random() - 0.5) * 2.0,
        spin: (Math.random() - 0.5) * 8,
        life: 1.0 + Math.random() * 0.6,
        maxLife: 1.6,
        gravity: 6,
      });
    }
  }

  spawnFootPuff() {
    const pos = this.player.position;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.02, 0.09),
      new THREE.MeshBasicMaterial({ color: '#f2f7fb', transparent: true, opacity: 0.5 })
    );
    mesh.position.set(pos.x + (Math.random() - 0.5) * 0.3, 0.04, pos.z + 0.1);
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0.25,
      vz: (Math.random() - 0.5) * 0.4,
      spin: Math.random() * 2,
      life: 0.28,
      maxLife: 0.28,
      gravity: 0.5,
    });
  }

  spawnTears(p, count = 3) {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 4, 3),
        new THREE.MeshBasicMaterial({ color: '#9bd9f0', transparent: true, opacity: 0.85 })
      );
      mesh.position.set(
        p.pram.group.position.x + (Math.random() - 0.5) * 0.4,
        1.35 + Math.random() * 0.25,
        p.pram.group.position.z + 0.25 + (Math.random() - 0.5) * 0.3
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.8 + Math.random() * 0.8,
        vz: 0.3 + Math.random() * 0.4,
        spin: 0,
        life: 0.7,
        maxLife: 0.7,
        gravity: 5,
      });
    }
  }

  updateParticleVisuals(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.z += p.spin * 0.7 * dt;
      if (p.mesh.material.transparent) p.mesh.material.opacity = clamp(p.life / p.maxLife, 0, 1) * 0.5;
    }
  }

  clearParticles() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.particles = [];
    this.offscreenEls = [];
  }

  updateProgressBars() {
    if (this.progressWarmer.visible && this.world.stations.warmer.state !== 'warming') {
      this.progressWarmer.visible = false;
    }
  }

  updateHud(force = false) {
    const now = this.elapsed;
    if (!force && now - this.lastHud < 0.09) return;
    this.lastHud = now;

    this.dom.hudTimer.textContent = formatRunClock(this.elapsedShift);
    this.dom.hudTimer.classList.remove('warn');
    this.dom.peaceFill.style.width = `${Math.max(0, this.peace)}%`;
    this.dom.peaceValue.textContent = `${Math.round(this.peace)}%`;
    this.dom.peaceFill.className = `peace-fill${this.peace < 30 ? ' danger' : this.peace < 62 ? ' warn' : ''}`;
    this.dom.peaceValue.style.color = this.peace < 30 ? '#c83248' : this.peace < 62 ? '#b27510' : '#2f9e82';
    this.dom.hudScore.textContent = String(this.score);
    if (this.dom.heatPill) {
      this.dom.heatPill.textContent = `HEAT ×${this.intensity.toFixed(1)}`;
      this.dom.heatPill.classList.toggle('hot', this.intensity >= 1.7);
      this.dom.heatPill.classList.toggle('blazing', this.intensity >= 2.25);
    }
    if (this.combo > 1) {
      this.dom.hudCombo.classList.remove('hidden');
      this.dom.hudCombo.textContent = `COMBO ×${Math.min(5, this.combo)}`;
    } else {
      this.dom.hudCombo.classList.add('hidden');
    }

    let note = `${this.pramStates.length} prams. The street is watching.`;
    const crying = this.pramStates.filter((p) => p.state === 'crying').length;
    if (this.peace < 22) note = 'A neighbour just peeked through the blinds.';
    else if (this.peace < 45) note = 'A few curtains are twitching...';
    else if (crying >= 2) note = 'The whole street can hear this.';
    else if (crying === 1) note = 'One baby is testing the acoustics.';
    else if (this.peace < 72) note = 'The neighbourhood is holding its breath.';
    else if (this.pramStates.some((p) => p.state === 'needy')) note = 'A tiny request, before it becomes a wail.';
    else if (this.pramStates.some((p) => p.state === 'ready')) note = 'A sleepy baby is waiting in the crib.';
    else if (this.intensity > 2.1) note = 'Five prams. The whole street is holding its breath.';
    this.dom.peaceNote.textContent = note;

    if (!this.carry) {
      this.dom.handContent.textContent = 'nothing yet';
    } else if (this.carry.kind === 'item') {
      const label = this.carry.type === 'bottle' ? (this.carry.warm ? 'Warm bottle' : 'Cold bottle') : ITEM_META[this.carry.type]?.label || 'Item';
      this.dom.handContent.innerHTML = `<img class="pixel-icon" src="${getIconDataUrl(this.carry.type)}" alt="" /> ${label}`;
    } else {
      const cribBusy = this.world.stations.crib.state !== 'empty';
      const label = this.carry.mood === 'ready'
        ? `Sleepy ${this.carry.name} → pram`
        : cribBusy
          ? `Crying ${this.carry.name} → crib busy`
          : `Crying ${this.carry.name} → crib`;
      this.dom.handContent.innerHTML = `<img class="pixel-icon" src="${getIconDataUrl(this.carry.mood === 'ready' ? 'zzz' : 'cry')}" alt="" /> ${label}`;
    }

    if (this.dom.handThrow) {
      if (!this.carry) {
        this.dom.handThrow.classList.add('hidden');
      } else {
        const cribBusy = this.carry.kind === 'baby' && this.carry.mood === 'crying' && this.world.stations.crib.state !== 'empty';
        if (cribBusy) {
          this.dom.handThrow.classList.remove('hidden');
          this.dom.handThrow.classList.add('danger');
          this.dom.handThrow.innerHTML = '<span class="throw-key">E</span> CRIB BUSY → PUT BACK IN PRAM';
        } else {
          const target = this.getThrowTarget();
          this.dom.handThrow.classList.remove('hidden');
          this.dom.handThrow.classList.toggle('danger', !target);
          this.dom.handThrow.innerHTML = target
            ? `<span class="throw-key">R</span> THROW → ${target.label}`
            : `<span class="throw-key">R</span> ${this.carry.kind === 'baby' ? 'NOT AIMED → MISS!' : 'NOT AIMED → NO TARGET'}`;
        }
      }
    }
    if (this.dom.dashBtn) {
      const cooling = this.dashCooldown > 0 || this.dashTime > 0;
      this.dom.dashBtn.classList.toggle('cooldown', cooling);
      this.dom.dashBtn.setAttribute('aria-disabled', String(cooling));
    }
    if (this.dom.touchThrow) {
      const busyBaby = this.carry?.kind === 'baby' && this.carry.mood === 'crying' && this.world.stations.crib.state !== 'empty';
      const disabled = !this.carry || busyBaby;
      this.dom.touchThrow.classList.toggle('disabled', disabled);
      this.dom.touchThrow.setAttribute('aria-disabled', String(disabled));
    }

    for (const p of this.pramStates) this.updateOrderCard(p, force);
    this.updateOffscreenMarkers();
  }

  updateOffscreenMarkers() {
    if (!this.offscreenEls.length || !this.dom.offscreenMarkers) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const portrait = this.isPortrait;
    const topSafe = portrait ? 168 : 154;
    const bottomSafe = portrait ? 155 : 136;
    const sideSafe = portrait ? 30 : 26;
    const canShow = this.mode === 'playing' || this.mode === 'paused';
    const playerIsHoldingBaby = this.carry?.kind === 'baby';

    for (let i = 0; i < this.offscreenEls.length; i += 1) {
      const entry = this.offscreenEls[i];
      const p = this.pramStates[i];
      if (!entry || !p) continue;
      const targetReady = playerIsHoldingBaby && this.carry.pramIndex === p.index && this.carry.mood === 'ready';
      const relevant = p.state === 'crying' || p.state === 'needy' || p.state === 'wandering' || targetReady;
      if (!canShow || !relevant) {
        entry.el.classList.remove('show');
        continue;
      }

      const wanderingHere = p.state === 'wandering' && this.wanderingBaby?.pramIndex === p.index;
      const worldPos = wanderingHere
        ? this.wanderingBaby.mesh.position.clone().setY(1.8)
        : p.pram.group.position.clone().setY(2.45);
      const projected = worldPos.project(this.camera);
      const px = (projected.x * 0.5 + 0.5) * width;
      const py = (-projected.y * 0.5 + 0.5) * height;
      const onScreen = px > sideSafe && px < width - sideSafe && py > topSafe && py < height - bottomSafe;

      let icon = 'zzz';
      let cls = 'ready';
      if (p.state === 'wandering') {
        icon = 'warning';
        cls = 'wandering';
      } else if (p.state === 'crying') {
        icon = 'cry';
        cls = 'crying';
      } else if (p.state === 'needy' && p.need) {
        icon = p.need;
        cls = 'needy';
      }

      if (onScreen) {
        entry.el.classList.remove('show');
        continue;
      }

      const x = clamp(px, sideSafe, width - sideSafe);
      const y = clamp(py, topSafe, height - bottomSafe);
      entry.el.style.left = `${x}px`;
      entry.el.style.top = `${y}px`;
      const angle = Math.atan2(x - width / 2, -(y - height / 2));
      entry.orbit.style.transform = `rotate(${angle}rad)`;
      if (entry.lastIcon !== icon) {
        entry.icon.src = getIconDataUrl(icon);
        entry.lastIcon = icon;
      }
      if (entry.lastClass !== cls) {
        entry.el.classList.remove('crying', 'needy', 'ready', 'wandering');
        entry.el.classList.add(cls);
        entry.lastClass = cls;
      }
      entry.el.classList.add('show');
    }
  }

  updateOrderCard(p, force = false) {
    const card = this.cardEls[p.index];
    if (!card) return;
    let icon = 'zzz';
    let stateLabel = 'ASLEEP';
    let needLabel = 'dreaming';
    let bar = p.fuss;
    let cls = '';
    if (p.state === 'wandering') {
      icon = 'warning';
      stateLabel = 'ON THE LOOSE';
      const remain = this.wanderingBaby?.pramIndex === p.index ? Math.ceil(this.wanderingBaby.escapeTimer) : 0;
      needLabel = `catch them! ${remain}s`;
      bar = 1;
      cls = 'wandering';
    } else if (p.state === 'lost') {
      icon = 'warning';
      stateLabel = 'LOST';
      needLabel = 'wandered off';
      bar = 0.04;
      cls = 'lost';
    } else if (p.state === 'needy' && p.need) {
      icon = p.need;
      stateLabel = 'STIRRING';
      needLabel = `needs ${ITEM_META[p.need].short.toLowerCase()}`;
      bar = Math.max(0.2, p.fuss);
      cls = 'needy';
    } else if (p.state === 'crying') {
      icon = 'cry';
      stateLabel = 'WAAH!';
      needLabel = 'scoop + soothe';
      bar = 1;
      cls = 'crying';
    } else if (p.state === 'carried') {
      icon = p.carryMood === 'ready' ? 'zzz' : 'cry';
      stateLabel = 'IN ARMS';
      needLabel = p.carryMood === 'ready' ? 'carry home' : 'to the crib';
      bar = p.carryMood === 'ready' ? 0.75 : 0.55;
      cls = p.carryMood === 'ready' ? 'ready' : 'crying';
    } else if (p.state === 'soothing') {
      icon = 'zzz';
      stateLabel = 'SHUSHING';
      needLabel = 'rock-a-bye';
      bar = clamp(this.world.stations.crib.timer / this.world.stations.crib.maxTimer, 0, 1);
      cls = 'soothing';
    } else if (p.state === 'ready') {
      icon = 'zzz';
      stateLabel = 'READY';
      needLabel = 'carry home';
      bar = 1;
      cls = 'ready';
    }
    if (card.lastState !== cls) {
      card.el.className = `order-card ${cls}`.trim();
      card.lastState = cls;
    }
    if (card.lastIcon !== icon) {
      card.icon.src = getIconDataUrl(icon);
      card.lastIcon = icon;
    }
    card.state.textContent = stateLabel;
    card.label.textContent = needLabel;
    card.bar.style.width = `${clamp(bar, 0.04, 1) * 100}%`;
    card.bar.className = `fuss-fill${bar > 0.98 ? ' danger' : bar > 0.62 ? ' warn' : ''}`;
    if (p.state === 'soothing' || p.state === 'ready') card.bar.classList.add('warm');
  }

  updateCamera(dt) {
    if (this.mode === 'title' || this.mode === 'nightIntro') {
      const t = this.elapsed;
      this.camera.position.set(Math.sin(t * 0.1) * 1.1, 15.7 + Math.sin(t * 0.14) * 0.2, 18.5);
      this.camera.lookAt(0.2, 0.2, 0.9);
      return;
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.15);
    const shake = this.trauma * this.trauma;
    const sx = (Math.random() - 0.5) * 0.55 * shake;
    const sy = (Math.random() - 0.5) * 0.33 * shake;
    const sz = (Math.random() - 0.5) * 0.18 * shake;

    if (this.isPortrait) {
      const lookAheadX = this.velocityXZ.x * 0.22;
      const desiredX = clamp(this.player.position.x + lookAheadX, -7.4, 7.4);
      const desiredZ = Math.min(0.9, this.player.position.z + 1.0);
      this.cameraFocus.x = damp(this.cameraFocus.x, desiredX, 5.5, dt);
      this.cameraFocus.z = damp(this.cameraFocus.z, desiredZ, 5.5, dt);
      const focus = this.cameraFocus;
      this.camera.position.set(focus.x + sx, 15.9 + sy, focus.z + 17.6 + sz);
      this.camera.lookAt(focus.x + sx * 0.4, 0.2 + sy * 0.4, focus.z + sz * 0.4);
    } else {
      this.camera.position.set(this.cameraBase.x + sx, this.cameraBase.y + sy, this.cameraBase.z + sz);
      this.camera.lookAt(this.cameraTarget.x + sx * 0.5, this.cameraTarget.y + sy * 0.5, this.cameraTarget.z + sz * 0.5);
    }
  }

  addShake(amount) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  flashScreen(color = '#fff6df', strength = 0.4) {
    const el = this.dom.flash;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = String(strength);
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.32s ease-out';
      el.style.opacity = '0';
    });
  }

  showToast(text, type = 'good', icon = null, duration = 3000) {
    if (!this.dom.toasts) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon ? `<img class="pixel-icon" src="${getIconDataUrl(icon)}" alt="" />` : ''}<span>${text}</span>`;
    this.dom.toasts.appendChild(el);
    const maxToasts = window.matchMedia('(pointer: coarse)').matches ? 1 : 2;
    while (this.dom.toasts.children.length > maxToasts) {
      this.dom.toasts.firstElementChild.remove();
    }
    window.setTimeout(() => el.remove(), duration);
  }

  clearToasts() {
    if (this.dom.toasts) this.dom.toasts.innerHTML = '';
  }

  checkEnd() {
    if (this.peace <= 0) this.endShift();
    else if (this.pramStates.length && this.pramStates.every((p) => p.state === 'lost')) this.endShift();
  }

  endShift() {
    if (this.mode !== 'playing') return;
    this.mode = 'results';
    this.activeInteraction = null;
    this.dom.prompt.classList.add('hidden');
    this.dom.hud.classList.add('hidden');
    this.dom.countdown.classList.add('hidden');
    this.dom.chaosFrame.classList.remove('on');
    if (this.dom.warmerHud) {
      this.dom.warmerHud.classList.add('hidden');
      this.dom.hud.classList.remove('has-warmer');
    }
    this.audio.setMusicPaused(true);
    this.clearCarryVisual();
    this.clearWandering();
    this.clearProjectiles();
    this.keys.clear();
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.hideAimHelper();
    const previousBest = this.bestScore;
    this.bestScore = Math.max(previousBest, this.score);
    this.newBest = this.score > previousBest;
    try {
      window.localStorage.setItem('pramageddon-best', String(this.bestScore));
    } catch (error) {
      // Local storage can be unavailable in private mode.
    }
    this.lastResult = {
      score: this.score,
      seconds: Math.round(this.elapsedShift),
      soothed: this.soothed,
      bestCombo: this.bestCombo,
      prams: this.pramStates.length,
      failureReason: this.failureReason,
    };
    if (!this.scoreSaved) {
      this.localEntry = saveLocalScore({
        name: this.playerName,
        score: this.score,
        seconds: this.lastResult.seconds,
        soothed: this.soothed,
        combo: this.bestCombo,
      });
      this.scoreSaved = true;
      this.leaderboardLocal = getLocalScores();
    }
    this.remoteSubmitted = false;
    this.audio.fail();
    this.showResults();
  }

  showResults() {
    this.showScreens();
    this.dom.screenResults.classList.remove('hidden');
    this.dom.screenResults.classList.add('failed');
    this.dom.screenResults.classList.remove('success');
    const result = this.lastResult || { score: this.score, seconds: 0, soothed: this.soothed, bestCombo: this.bestCombo, prams: this.pramStates.length };
    const babyThrowMiss = this.failureReason === 'babyThrow';
    this.dom.resultsEyebrow.textContent = babyThrowMiss ? 'RUN OVER · YEET FAILED' : 'RUN OVER · GJERDRUM ARCADE';
    this.dom.resultsTitle.textContent = babyThrowMiss
      ? 'BUTTERFINGERS.'
      : result.score >= 4000
        ? 'THE STREET WILL TALK.'
        : 'THE NEIGHBOURS CALLED.';
    this.dom.resultsFlavor.textContent = babyThrowMiss
      ? `Inger threw ${this.missedBabyName} toward ${this.missedTargetLabel} and missed. Gjerdrum will never let her forget it.`
      : `${formatRunClock(result.seconds)} of relative peace. ${result.prams} prams. Then the street won.`;
    this.dom.resultsScore.textContent = String(result.score);
    this.dom.resultsBest?.classList.toggle('hidden', !this.newBest);
    this.dom.resultSoothed.textContent = String(result.soothed);
    this.dom.resultTime.textContent = formatRunClock(result.seconds);
    this.dom.resultCombo.textContent = `×${Math.min(5, result.bestCombo)}`;
    this.dom.resultRank.textContent = this.rank();
    if (this.dom.scoreNameInput) this.dom.scoreNameInput.value = this.playerName;
    if (this.dom.submitScoreBtn) {
      this.dom.submitScoreBtn.disabled = false;
      this.dom.submitScoreBtn.querySelector('.big-btn-main').textContent = 'SEND TO GJERDRUM';
    }
    if (this.dom.scoreSubmitStatus) this.dom.scoreSubmitStatus.textContent = '';
    this.mode = 'results';
  }

  rank() {
    const score = this.lastResult?.score ?? this.score;
    if (score >= 7000) return 'GJERDRUM IMMORTAL';
    if (score >= 4000) return 'PRAM LEGEND';
    if (score >= 2000) return 'SHUSH SPECIALIST';
    if (score >= 800) return 'MILK WARMER';
    return 'PRAM ROOKIE';
  }

  retryNight() {
    this.audio.ui();
    this.startArcadeRun();
  }

  async submitScore() {
    if (!this.lastResult || this.remoteSubmitted) return;
    const name = savePlayerName(this.dom.scoreNameInput?.value || this.playerName);
    this.playerName = name;
    if (this.dom.submitScoreBtn) {
      this.dom.submitScoreBtn.disabled = true;
      this.dom.submitScoreBtn.querySelector('.big-btn-main').textContent = 'SENDING...';
    }
    if (this.dom.scoreSubmitStatus) this.dom.scoreSubmitStatus.textContent = 'Sending a covered dish of points to Gjerdrum...';
    const result = await submitGlobalScore(name, this.lastResult.score, this.lastResult.seconds);
    if (result.ok) {
      this.remoteSubmitted = true;
      if (this.dom.scoreSubmitStatus) this.dom.scoreSubmitStatus.textContent = `Sent as ${name}. The global board has been notified.`;
      if (this.dom.submitScoreBtn) {
        this.dom.submitScoreBtn.querySelector('.big-btn-main').textContent = 'SENT TO GJERDRUM';
      }
      if (this.localEntry?.id) {
        renameLocalScore(this.localEntry.id, name);
        this.localEntry.name = name;
      }
      this.leaderboardGlobal = [];
      this.leaderboardLocal = getLocalScores();
    } else {
      if (this.dom.scoreSubmitStatus) this.dom.scoreSubmitStatus.textContent = 'Global board unreachable — your score is safe in the local leaderboard.';
      if (this.dom.submitScoreBtn) {
        this.dom.submitScoreBtn.disabled = false;
        this.dom.submitScoreBtn.querySelector('.big-btn-main').textContent = 'TRY AGAIN';
      }
    }
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  renderLeaderboard() {
    if (!this.dom.leaderboardList) return;
    const local = this.leaderboardLocal?.length ? this.leaderboardLocal : getLocalScores();
    const global = this.leaderboardGlobal || [];
    const localBest = local.length ? local[0].score : 0;
    if (this.dom.leaderboardPersonal) {
      this.dom.leaderboardPersonal.innerHTML = `<span>YOUR LOCAL BEST</span><strong>${localBest}</strong><small>${local.length ? `Top ${Math.min(3, local.length)} saved on this device` : 'No local runs yet'}</small>`;
    }
    const source = global.length ? global : local;
    const isGlobal = global.length > 0;
    const rows = source.slice(0, 10);
    if (this.dom.leaderboardStatus) {
      if (this.leaderboardLoading && !global.length) {
        this.dom.leaderboardStatus.textContent = 'Loading the global board... local scores are ready.';
      } else if (isGlobal) {
        this.dom.leaderboardStatus.textContent = 'GLOBAL BOARD · DreamLo · scores from every Gjerdrum run.';
      } else if (this.leaderboardStatus === 'offline') {
        this.dom.leaderboardStatus.textContent = 'Global board unavailable. Showing scores stored on this device.';
      } else {
        this.dom.leaderboardStatus.textContent = 'No global scores yet — finish a run and send the first one.';
      }
    }
    if (!rows.length) {
      this.dom.leaderboardList.innerHTML = '<div class="lb-empty">No scores yet. The prams are waiting.</div>';
      return;
    }
    this.dom.leaderboardList.innerHTML = `
      <div class="lb-row lb-head"><span>#</span><span>NAME</span><span>SCORE</span><span>TIME</span></div>
      ${rows
        .map(
          (entry, index) => `
          <div class="lb-row ${index === 0 ? 'first' : ''}">
            <span class="lb-rank">${index + 1}</span>
            <span class="lb-name">${this.escapeHtml(entry.name)}${entry.local ? ' <i>YOU</i>' : ''}</span>
            <span class="lb-score">${entry.score}</span>
            <span class="lb-time">${formatRunClock(entry.seconds)}</span>
          </div>`
        )
        .join('')}
    `;
  }

  async loadLeaderboard() {
    this.leaderboardLoading = true;
    this.renderLeaderboard();
    const result = await fetchGlobalScores({ force: true });
    this.leaderboardLoading = false;
    if (result.ok) {
      this.leaderboardGlobal = result.entries;
      this.leaderboardStatus = result.entries.length ? 'global' : 'empty';
    } else {
      this.leaderboardStatus = 'offline';
    }
    if (this.mode === 'leaderboard') this.renderLeaderboard();
  }

  openLeaderboard(returnMode = 'title') {
    this.leaderboardReturn = returnMode;
    this.mode = 'leaderboard';
    this.leaderboardLocal = getLocalScores();
    this.showScreens();
    this.dom.screenLeaderboard.classList.remove('hidden');
    this.dom.hud.classList.add('hidden');
    this.dom.prompt.classList.add('hidden');
    this.dom.countdown.classList.add('hidden');
    this.audio.ui();
    this.leaderboardGlobal = [];
    this.leaderboardStatus = 'idle';
    this.renderLeaderboard();
    this.loadLeaderboard();
  }

  closeLeaderboard() {
    this.audio.ui();
    if (this.leaderboardReturn === 'results' && this.lastResult) {
      this.showScreens();
      this.dom.screenResults.classList.remove('hidden');
      this.mode = 'results';
      this.audio.setMusicPaused(true);
    } else {
      this.showStart();
      this.audio.setMusicPaused(false);
    }
  }

  returnToTitle() {
    this.showStart();
    this.audio.setMusicPaused(false);
  }

  togglePause() {
    if (this.mode === 'playing' || this.mode === 'countdown') {
      this.prePauseMode = this.mode;
      this.mode = 'paused';
      this.keys.clear();
      this.touchMove.x = 0;
      this.touchMove.y = 0;
      this.dom.screenPause.classList.remove('hidden');
      this.dom.prompt.classList.add('hidden');
      this.dom.countdown.classList.add('hidden');
      this.hideAimHelper();
      this.audio.setMusicPaused(true);
      this.audio.ui();
    } else if (this.mode === 'paused') {
      this.resumeGame();
    }
  }

  resumeGame() {
    if (this.mode !== 'paused') return;
    this.dom.screenPause.classList.add('hidden');
    this.mode = this.prePauseMode || 'playing';
    this.audio.setMusicPaused(false);
    this.audio.ui();
    this.lastHud = -1;
  }

  openHelp(from = 'title') {
    if (this.mode === 'help') return;
    this.helpReturnMode = from;
    this.helpPreMode = this.mode;
    this.mode = 'help';
    this.dom.screenPause.classList.add('hidden');
    this.dom.screenHelp.classList.remove('hidden');
    if (this.dom.helpControls) {
      this.dom.helpControls.innerHTML = window.matchMedia('(pointer: coarse)').matches
        ? '<span><b>STICK</b><small>MOVE</small></span><span><b>E</b><small>INTERACT</small></span><span><b>Q</b><small>DROP</small></span><span><b>THROW</b><small>YEET</small></span><span><b>ϟ</b><small>DASH</small></span><span><b>❚❚</b><small>PAUSE</small></span>'
        : '<span><b>WASD / ARROWS</b><small>WADDLE</small></span><span><b>E / SPACE</b><small>INTERACT</small></span><span><b>Q</b><small>DROP</small></span><span><b>SHIFT</b><small>DASH</small></span><span><b>R</b><small>THROW</small></span><span><b>ESC / P</b><small>PAUSE</small></span><span><b>M</b><small>MUTE</small></span>';
    }
    this.dom.prompt.classList.add('hidden');
    this.dom.countdown.classList.add('hidden');
    this.keys.clear();
    this.audio.setMusicPaused(true);
    this.audio.ui();
  }

  closeHelp() {
    if (this.mode !== 'help') return;
    this.dom.screenHelp.classList.add('hidden');
    this.audio.ui();
    if (this.helpReturnMode === 'paused') {
      this.mode = 'paused';
      this.dom.screenPause.classList.remove('hidden');
    } else {
      this.mode = this.helpPreMode || 'title';
      if (this.mode === 'title') this.dom.screenStart.classList.remove('hidden');
      if (this.mode === 'playing' || this.mode === 'countdown') {
        this.lastHud = -1;
      }
      this.audio.setMusicPaused(false);
    }
  }

  async toggleMute() {
    this.muted = !this.muted;
    if (!this.audio.started) await this.audio.init();
    this.audio.setMuted(this.muted);
    this.audio.ui();
    this.updateMuteUI();
  }

  updateMuteUI() {
    this.dom.muteBtn.classList.toggle('muted', this.muted);
    this.dom.muteBtn.querySelector('.sound-on').textContent = this.muted ? '×' : '♪';
    this.dom.startMuteBtn.textContent = `SOUND: ${this.muted ? 'OFF' : 'ON'}`;
  }
}
