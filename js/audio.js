// colony-game/js/audio.js — Procedural Game Audio
// Web Audio API — zero external files, zero loading times
// Built by Jeletor for the Colony collaborative platformer
//
// API:
//   Audio.init()          — Initialize (call on first user gesture)
//   Audio.playJump()      — Short pitch-up chirp
//   Audio.playLand()      — Soft thud on landing
//   Audio.playCollect()   — Two-tone coin ding
//   Audio.playDeath()     — Descending sad tone
//   Audio.playPowerup()   — Rising arpeggio
//   Audio.playHurt()      — Quick buzz hit
//   Audio.startMusic()    — Begin procedural chiptune loop
//   Audio.stopMusic()     — Stop music
//   Audio.setVolume(0-1)  — Master volume
//   Audio.setSfxVolume(0-1)   — Sound effects volume
//   Audio.setMusicVolume(0-1) — Music volume
//   Audio.mute() / Audio.unmute() / Audio.toggleMute()

const Audio = (() => {
  'use strict';

  // ─── State ──────────────────────────────────────────────────
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let initialized = false;
  let muted = false;
  let musicPlaying = false;
  let musicTimeout = null;
  let musicNodes = [];

  // ─── Constants ──────────────────────────────────────────────
  const MASTER_VOLUME = 0.5;
  const SFX_VOLUME = 0.7;
  const MUSIC_VOLUME = 0.3;

  // Musical scale (C major pentatonic, good for chiptune)
  const SCALE = [
    261.63, 293.66, 329.63, 392.00, 440.00,  // C4 D4 E4 G4 A4
    523.25, 587.33, 659.26, 783.99, 880.00    // C5 D5 E5 G5 A5
  ];

  // Bass notes (C major)
  const BASS = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94]; // C3-B3

  // ─── Init ───────────────────────────────────────────────────

  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Master → output
      masterGain = ctx.createGain();
      masterGain.gain.value = MASTER_VOLUME;
      masterGain.connect(ctx.destination);

      // SFX bus → master
      sfxGain = ctx.createGain();
      sfxGain.gain.value = SFX_VOLUME;
      sfxGain.connect(masterGain);

      // Music bus → master
      musicGain = ctx.createGain();
      musicGain.gain.value = MUSIC_VOLUME;
      musicGain.connect(masterGain);

      initialized = true;
    } catch (e) {
      console.warn('[audio] Web Audio API not available:', e.message);
    }
  }

  function ensureCtx() {
    if (!initialized) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return !!ctx;
  }

  // ─── Utility: create oscillator note ────────────────────────

  function playTone(freq, type, startTime, duration, gainValue, destination) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type || 'square';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(gainValue || 0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(destination || sfxGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);

    return { osc, gain };
  }

  // Utility: white noise burst
  function playNoise(startTime, duration, gainValue, destination) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue || 0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    // Low-pass filter for thud-like quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination || sfxGain);

    source.start(startTime);
    source.stop(startTime + duration + 0.05);

    return { source, gain, filter };
  }

  // ─── Sound Effects ──────────────────────────────────────────

  /**
   * Jump — quick upward chirp (sine, pitch rises)
   */
  function playJump() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.08);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * Land — soft thud (filtered noise + low sine)
   */
  function playLand() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;

    // Noise thud
    playNoise(t, 0.06, 0.15);

    // Low sine impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * Collect — classic two-tone ding (like Mario coin)
   */
  function playCollect() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;

    // First tone (E5)
    playTone(659.26, 'square', t, 0.08, 0.2);
    // Second tone (B5) — higher, slightly delayed
    playTone(987.77, 'square', t + 0.07, 0.12, 0.2);
  }

  /**
   * Death — descending sad tone with warble
   */
  function playDeath() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.6);

    // Add vibrato for drama
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 8;
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.setValueAtTime(0.25, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.75);
    lfo.stop(t + 0.75);
  }

  /**
   * Powerup — rising arpeggio
   */
  function playPowerup() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.26, 783.99, 1046.50]; // C5 E5 G5 C6

    notes.forEach((freq, i) => {
      playTone(freq, 'square', t + i * 0.08, 0.15, 0.18);
    });
  }

  /**
   * Hurt — quick dissonant buzz
   */
  function playHurt() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;

    // Harsh square wave
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.setValueAtTime(150, t + 0.05);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.18);

    // Noise layer
    playNoise(t, 0.1, 0.2);
  }

  // ─── Procedural Music Engine ────────────────────────────────
  //
  // Generates an endless chiptune loop with:
  //   - Bass line (triangle wave, root notes)
  //   - Melody (square wave, pentatonic scale)
  //   - Arpeggios (pulse, fast note runs)
  //   - Percussion (noise hits on beat)
  //
  // All procedural — no samples, no loops, just math.

  const BPM = 140;
  const BEAT = 60 / BPM;           // seconds per beat
  const BAR = BEAT * 4;            // seconds per bar
  const STEP = BEAT / 4;           // sixteenth note

  // Chord progressions (scale degrees, 0-indexed into BASS)
  const PROGRESSIONS = [
    [0, 0, 3, 4],    // I  I  IV V
    [0, 5, 3, 4],    // I  vi IV V
    [0, 3, 5, 4],    // I  IV vi V
    [0, 0, 5, 3],    // I  I  vi IV
  ];

  // Melody patterns (rhythm: 1 = play, 0 = rest, over 16 steps per bar)
  const MELODY_RHYTHMS = [
    [1,0,1,0, 1,0,0,1, 0,1,0,1, 1,0,0,0],
    [1,0,0,1, 1,0,1,0, 0,1,1,0, 1,0,0,1],
    [1,1,0,0, 1,0,1,1, 0,0,1,0, 1,1,0,0],
    [0,1,1,0, 1,0,0,1, 1,0,1,0, 0,1,1,0],
  ];

  // Percussion patterns (kick/hat style)
  const PERC_PATTERNS = [
    // [kick, hat] per step
    [[1,0],[0,1],[0,0],[0,1], [1,0],[0,1],[0,0],[0,1], [1,0],[0,1],[0,0],[0,1], [1,0],[0,1],[1,0],[0,1]],
    [[1,0],[0,0],[0,1],[0,0], [1,0],[0,0],[0,1],[0,1], [1,0],[0,0],[0,1],[0,0], [1,0],[0,1],[1,0],[0,1]],
  ];

  let currentBar = 0;
  let currentProgression = 0;

  function scheduleBar(startTime) {
    if (!musicPlaying || !ctx) return;

    const prog = PROGRESSIONS[currentProgression % PROGRESSIONS.length];
    const chordDeg = prog[currentBar % 4];
    const bassFreq = BASS[chordDeg];

    const melodyRhythm = MELODY_RHYTHMS[(currentBar + currentProgression) % MELODY_RHYTHMS.length];
    const percPattern = PERC_PATTERNS[currentProgression % PERC_PATTERNS.length];

    // ── Bass (triangle wave, whole notes / half notes) ──
    const bassOsc = ctx.createOscillator();
    const bassGainNode = ctx.createGain();
    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(bassFreq, startTime);

    // Slight pitch variation on beat 3
    if (currentBar % 2 === 1) {
      bassOsc.frequency.setValueAtTime(bassFreq * 1.01, startTime + BEAT * 2);
    }

    bassGainNode.gain.setValueAtTime(0.25, startTime);
    bassGainNode.gain.setValueAtTime(0.25, startTime + BAR - 0.05);
    bassGainNode.gain.exponentialRampToValueAtTime(0.001, startTime + BAR);

    bassOsc.connect(bassGainNode);
    bassGainNode.connect(musicGain);
    bassOsc.start(startTime);
    bassOsc.stop(startTime + BAR + 0.1);
    musicNodes.push(bassOsc);

    // ── Melody (square wave, pentatonic) ──
    let lastNote = Math.floor(Math.random() * SCALE.length);
    for (let step = 0; step < 16; step++) {
      if (!melodyRhythm[step]) continue;

      const t = startTime + step * STEP;

      // Walk the scale (mostly stepwise, occasional leaps)
      const leap = Math.random() < 0.2;
      const direction = Math.random() < 0.5 ? 1 : -1;
      const interval = leap ? direction * (2 + Math.floor(Math.random() * 3)) : direction;
      lastNote = Math.max(0, Math.min(SCALE.length - 1, lastNote + interval));

      // Bias toward chord tones
      if (Math.random() < 0.3) {
        const chordTones = [0, 2, 4, 5, 7]; // pentatonic degrees that sound good
        lastNote = chordTones[Math.floor(Math.random() * chordTones.length)];
      }

      const freq = SCALE[lastNote];
      const dur = STEP * (0.6 + Math.random() * 0.3);

      const { osc } = playTone(freq, 'square', t, dur, 0.12, musicGain);
      musicNodes.push(osc);
    }

    // ── Arpeggio (pulse-ish, fast notes on some bars) ──
    if (currentBar % 4 >= 2) { // arps on bars 3-4
      const arpNotes = [0, 2, 4, 7]; // scale degrees for arp
      for (let step = 0; step < 16; step++) {
        if (step % 2 !== 0) continue; // every other step
        const t = startTime + step * STEP;
        const noteIdx = arpNotes[step % arpNotes.length];
        const freq = SCALE[noteIdx] * 2; // one octave up
        const { osc } = playTone(freq, 'square', t, STEP * 0.4, 0.06, musicGain);
        musicNodes.push(osc);
      }
    }

    // ── Percussion (noise-based kicks and hats) ──
    for (let step = 0; step < 16; step++) {
      const t = startTime + step * STEP;
      const [kick, hat] = percPattern[step];

      if (kick) {
        // Kick: sine pitch drop + noise
        const kickOsc = ctx.createOscillator();
        const kickGainNode = ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(150, t);
        kickOsc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
        kickGainNode.gain.setValueAtTime(0.3, t);
        kickGainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        kickOsc.connect(kickGainNode);
        kickGainNode.connect(musicGain);
        kickOsc.start(t);
        kickOsc.stop(t + 0.12);
        musicNodes.push(kickOsc);
      }

      if (hat) {
        // Hi-hat: short noise burst, high-pass filtered
        const bufSize = Math.floor(ctx.sampleRate * 0.03);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) ch[i] = Math.random() * 2 - 1;

        const src = ctx.createBufferSource();
        src.buffer = buf;

        const hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 7000;

        const hatGainNode = ctx.createGain();
        hatGainNode.gain.setValueAtTime(0.15, t);
        hatGainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        src.connect(hpf);
        hpf.connect(hatGainNode);
        hatGainNode.connect(musicGain);
        src.start(t);
        src.stop(t + 0.05);
        musicNodes.push(src);
      }
    }

    // Advance
    currentBar++;
    if (currentBar % 4 === 0) {
      // Every 4 bars, maybe change progression
      if (Math.random() < 0.4) {
        currentProgression = (currentProgression + 1) % PROGRESSIONS.length;
      }
    }

    // Schedule next bar
    musicTimeout = setTimeout(() => {
      if (musicPlaying) scheduleBar(startTime + BAR);
    }, (BAR - 0.1) * 1000);
  }

  function startMusic() {
    if (!ensureCtx()) return;
    if (musicPlaying) return;

    musicPlaying = true;
    currentBar = 0;
    currentProgression = Math.floor(Math.random() * PROGRESSIONS.length);
    scheduleBar(ctx.currentTime + 0.05);
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimeout) {
      clearTimeout(musicTimeout);
      musicTimeout = null;
    }
    // Stop all active music nodes
    for (const node of musicNodes) {
      try { node.stop(); } catch (_) {}
    }
    musicNodes = [];
  }

  // ─── Volume Controls ───────────────────────────────────────

  function setVolume(v) {
    if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  function setSfxVolume(v) {
    if (sfxGain) sfxGain.gain.value = Math.max(0, Math.min(1, v));
  }

  function setMusicVolume(v) {
    if (musicGain) musicGain.gain.value = Math.max(0, Math.min(1, v));
  }

  function muteAudio() {
    muted = true;
    if (masterGain) masterGain.gain.value = 0;
  }

  function unmuteAudio() {
    muted = false;
    if (masterGain) masterGain.gain.value = MASTER_VOLUME;
  }

  function toggleMute() {
    if (muted) unmuteAudio();
    else muteAudio();
    return muted;
  }

  // ─── Public API ─────────────────────────────────────────────

  return {
    init,
    playJump,
    playLand,
    playCollect,
    playDeath,
    playPowerup,
    playHurt,
    startMusic,
    stopMusic,
    setVolume,
    setSfxVolume,
    setMusicVolume,
    mute: muteAudio,
    unmute: unmuteAudio,
    toggleMute,
    get initialized() { return initialized; },
    get isMuted() { return muted; },
    get isMusicPlaying() { return musicPlaying; }
  };
})();

// Export for module systems (if used), otherwise it's a global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Audio;
}
