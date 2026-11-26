const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

const PROGRESSION = [
  { root: 45, chord: [0, 3, 7, 10] }, // Am7
  { root: 50, chord: [0, 3, 7, 10] }, // Dm7
  { root: 41, chord: [0, 4, 7, 11] }, // Fmaj7
  { root: 40, chord: [0, 4, 7, 10] }, // E7
];

const BASS_STEPS = [
  0, null, null, 12, null, null, 7, null, 0, null, 10, null, 12, null, 7, null,
];
const LEAD_STEPS = [
  null, 12, null, 15, 19, null, 15, null, 22, null, 19, null, 15, null, 12, null,
];
const STAB_STEPS = [2, 7, 10, 14];
const KICK_STEPS = [0, 3, 7, 8, 11, 14];
const SNARE_STEPS = [4, 12];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ambientGain = null;
    this.delay = null;
    this.noiseBuffer = null;
    this.started = false;
    this.musicStarted = false;
    this.muted = false;
    this.musicPaused = false;
    this.intensity = 0.2;
    this.step = 0;
    this.nextNoteTime = 0;
    this.lookahead = 0.12;
    this.interval = null;
    this.lastCryAt = new Map();
    this.lastStepAt = 0;
  }

  async init() {
    if (this.started) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.started = true;

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 22;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    compressor.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.95;
    this.master.connect(compressor);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.7;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1.0;
    this.sfxGain.connect(this.master);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.5;
    this.ambientGain.connect(this.master);

    // A soft dotted echo makes the square lead feel like a chiptune.
    this.delay = this.ctx.createDelay(1.0);
    this.delay.delayTime.value = (60 / 108) * 0.75;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.23;
    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 2800;
    this.delay.connect(delayFilter);
    delayFilter.connect(feedback);
    feedback.connect(this.delay);
    delayFilter.connect(this.musicGain);

    this.noiseBuffer = this.createNoiseBuffer(3);
    this.startWind();
  }

  createNoiseBuffer(seconds) {
    const sr = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.ceil(sr * seconds), sr);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.93 + white * 0.07;
      data[i] = last * 2.2;
    }
    return buffer;
  }

  startWind() {
    if (!this.ctx) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.5;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.085;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    source.start();
    lfo.start();
    this.wind = { source, filter, gain, lfo };
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.95, now + 0.08);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMusicPaused(paused) {
    this.musicPaused = paused;
    if (!this.musicGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.linearRampToValueAtTime(paused ? 0.18 : 0.7, now + 0.2);
  }

  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  startMusic() {
    if (!this.ctx || this.musicStarted) return;
    this.musicStarted = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.lastStepAt = 0;
    this.interval = window.setInterval(() => this.schedule(), 25);
  }

  schedule() {
    if (!this.ctx || !this.musicStarted) return;
    const ctx = this.ctx;
    while (this.nextNoteTime < ctx.currentTime + this.lookahead) {
      this.scheduleStep(this.step, this.nextNoteTime);
      const bpm = 100 + this.intensity * 44;
      const stepDur = 60 / bpm / 4;
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
    // If the tab slept, do not machine-gun a backlog of notes.
    if (this.nextNoteTime < ctx.currentTime - 0.4) {
      this.nextNoteTime = ctx.currentTime + 0.1;
    }
  }

  scheduleStep(step, time) {
    if (this.musicPaused) return;
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = PROGRESSION[bar];
    const swing = s % 2 === 1 ? 0.018 : 0;
    const t = time + swing;
    const intensity = this.intensity;

    if (KICK_STEPS.includes(s)) this.kick(t, 0.48 + intensity * 0.1);
    if (SNARE_STEPS.includes(s)) this.snare(t, 0.22 + intensity * 0.05);
    if (s % 2 === 0) this.hat(t, s === 6 || s === 14 ? 0.055 : 0.035, s === 6 || s === 14);
    if (intensity > 0.55 && (s === 3 || s === 11)) this.hat(t + 0.02, 0.018, false);

    const bassOffset = BASS_STEPS[s];
    if (bassOffset !== null) {
      const note = chord.root + bassOffset;
      this.bass(midiToFreq(note), t, 0.15, 0.2 + intensity * 0.06, intensity);
    }

    if (STAB_STEPS.includes(s)) {
      chord.chord.forEach((interval, i) => {
        this.tone({
          freq: midiToFreq(chord.root + 12 + interval),
          time: t,
          dur: 0.075,
          type: 'triangle',
          vol: 0.026 + intensity * 0.012,
          dest: this.musicGain,
          attack: 0.004,
          release: 0.06,
          detune: (i - 1.5) * 3,
        });
      });
    }

    const leadOffset = LEAD_STEPS[s];
    if (leadOffset !== null && intensity > 0.16) {
      const freq = midiToFreq(chord.root + leadOffset + (intensity > 0.72 ? 12 : 0));
      this.tone({
        freq,
        time: t,
        dur: 0.12,
        type: 'square',
        vol: 0.017 + intensity * 0.012,
        dest: this.musicGain,
        attack: 0.004,
        release: 0.11,
        filterFreq: 2200 + intensity * 2400,
      });
      this.tone({
        freq,
        time: t + 0.002,
        dur: 0.12,
        type: 'square',
        vol: 0.028 + intensity * 0.014,
        dest: this.delay,
        attack: 0.004,
        release: 0.11,
        filterFreq: 2200 + intensity * 2400,
      });
    }

    if (intensity > 0.78 && bar === 3 && s % 4 === 2) {
      this.tone({
        freq: midiToFreq(chord.root + 24 + chord.chord[(s / 2) % chord.chord.length]),
        time: t,
        dur: 0.06,
        type: 'square',
        vol: 0.018,
        dest: this.musicGain,
        attack: 0.002,
        release: 0.05,
      });
    }
  }

  tone({
    freq,
    time,
    dur,
    type = 'sine',
    vol = 0.1,
    dest = null,
    attack = 0.005,
    release = 0.05,
    detune = 0,
    filterFreq = null,
  }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.value = detune;
    let node = osc;
    if (filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, time);
      filter.Q.value = 0.8;
      osc.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(dest || this.sfxGain);
    const end = time + dur;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + attack);
    gain.gain.setValueAtTime(vol, Math.max(time + attack, end - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.start(time);
    osc.stop(end + 0.02);
  }

  bass(freq, time, dur, vol, intensity) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc2.type = 'sine';
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 0.5;
    filter.type = 'lowpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(180 + intensity * 420, time);
    filter.frequency.exponentialRampToValueAtTime(120, time + dur);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.start(time);
    osc2.start(time);
    osc.stop(time + dur + 0.02);
    osc2.stop(time + dur + 0.02);
  }

  kick(time, vol = 0.4) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(43, time + 0.16);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  noiseSource(time, duration) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.start(time, Math.random() * 1.5);
    src.stop(time + duration);
    return src;
  }

  snare(time, vol = 0.16) {
    if (!this.ctx) return;
    const src = this.noiseSource(time, 0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1100;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(185, time);
    bodyGain.gain.setValueAtTime(vol * 0.35, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    body.connect(bodyGain);
    bodyGain.connect(this.musicGain);
    body.start(time);
    body.stop(time + 0.1);
  }

  hat(time, vol = 0.04, open = false) {
    if (!this.ctx) return;
    const src = this.noiseSource(time, open ? 0.16 : 0.06);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (open ? 0.12 : 0.035));
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
  }

  // ------------------------------- SFX -------------------------------

  ui() {
    this.sfxTone(880, 0.05, 0.045, 'square', 660);
  }

  pickup() {
    this.sfxTone(520, 0.07, 0.06, 'square', 860);
    this.sfxTone(1050, 0.05, 0.035, 'sine', 1210, 0.012);
  }

  drop() {
    this.sfxTone(180, 0.12, 0.08, 'triangle', 90);
  }

  error() {
    this.sfxTone(150, 0.15, 0.055, 'sawtooth', 120);
    this.sfxTone(130, 0.18, 0.04, 'square', 110, 0.07);
  }

  deliver() {
    const t = this.ctx?.currentTime || 0;
    [0, 4, 7, 12].forEach((interval, i) => {
      this.sfxTone(midiToFreq(72 + interval), 0.16, 0.035, 'square', midiToFreq(72 + interval), i * 0.035);
    });
  }

  tuck() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => {
      this.sfxTone(midiToFreq(n), 0.48, 0.045, 'triangle', midiToFreq(n), i * 0.06);
    });
    this.sfxTone(midiToFreq(60), 0.5, 0.05, 'sine', midiToFreq(55));
    // Sparkle
    for (let i = 0; i < 5; i += 1) {
      this.sfxTone(midiToFreq(88 + i * 2), 0.1, 0.02, 'sine', midiToFreq(88 + i * 2), 0.12 + i * 0.035);
    }
  }

  shush() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource(t, 0.6);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.linearRampToValueAtTime(500, t + 0.5);
    filter.Q.value = 1.5;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    this.sfxTone(320, 0.4, 0.03, 'sine', 240, 0.03);
  }

  warmReady() {
    this.sfxTone(660, 0.16, 0.05, 'sine', 880);
    this.sfxTone(990, 0.2, 0.035, 'sine', 1320, 0.12);
  }

  bottleIn() {
    this.sfxTone(320, 0.1, 0.035, 'triangle', 220);
  }

  fox() {
    this.sfxTone(290, 0.08, 0.07, 'square', 190);
    this.sfxTone(220, 0.12, 0.05, 'sawtooth', 160, 0.08);
  }

  whoosh() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource(t, 0.45);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.35);
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
  }

  dash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource(t, 0.22);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(320, t + 0.18);
    filter.Q.value = 1.2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.055, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    this.sfxTone(220, 0.08, 0.02, 'triangle', 110);
  }

  footstep() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource(t, 0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.022, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
  }

  countdown(final = false) {
    this.sfxTone(final ? 880 : 550, final ? 0.4 : 0.12, final ? 0.08 : 0.05, 'square', final ? 1320 : 550);
  }

  fanfare() {
    if (!this.ctx) return;
    const notes = [60, 64, 67, 72, 76, 79];
    notes.forEach((n, i) => {
      this.sfxTone(midiToFreq(n), 0.5, 0.055, 'triangle', midiToFreq(n), i * 0.085);
    });
  }

  fail() {
    if (!this.ctx) return;
    const notes = [67, 63, 58, 53];
    notes.forEach((n, i) => {
      this.sfxTone(midiToFreq(n), 0.6, 0.06, 'sawtooth', midiToFreq(n - 12), i * 0.17);
    });
  }

  star(index = 0) {
    const notes = [84, 88, 91];
    this.sfxTone(midiToFreq(notes[index % 3]), 0.3, 0.05, 'square', midiToFreq(notes[index % 3]), 0);
  }

  cry(pramIndex, urgency = 0.7) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const last = this.lastCryAt.get(pramIndex) || 0;
    if (now - last < 0.9) return;
    this.lastCryAt.set(pramIndex, now);
    const base = 360 + pramIndex * 44;
    const vol = 0.022 + urgency * 0.026;
    const offsets = [0, 3, 1.5];
    offsets.forEach((offset, i) => {
      const t = now + i * 0.205;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      filter.type = 'bandpass';
      filter.Q.value = 4;
      filter.frequency.setValueAtTime(base * (1.2 + offset * 0.05), t);
      filter.frequency.linearRampToValueAtTime(base * 0.85, t + 0.2);
      osc.frequency.setValueAtTime(base * (1.25 + offset * 0.05), t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.2);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.21);
    });
    const src = this.noiseSource(now + 0.02, 0.12);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.4, now + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    src.connect(ng);
    ng.connect(this.sfxGain);
  }

  bird() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 1350 + Math.random() * 550;
    [0, 0.11, 0.25].forEach((delay, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const start = t + delay;
      const freq = base * (1 + i * 0.12 + (Math.random() - 0.5) * 0.04);
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * (1.22 + i * 0.05), start + 0.075);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.014, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.1);
    });
  }

  coo(pramIndex = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 620 + pramIndex * 35;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.22);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.025, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  sfxTone(freq, dur = 0.15, vol = 0.05, type = 'square', endFreq = freq, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
