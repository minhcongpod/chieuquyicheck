/**
 * Web Audio API synthesizer for the Sâm celebration effect.
 * Produces an energetic high-speed swoosh, followed by a heavy impact bass slam
 * and a rich golden chime bell chord without requiring any external audio files.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

export function playSamCelebrationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  try {
    // 1. HIGH-SPEED SWOOSH (0.0s to 0.45s) - Acceleration & dive
    const bufferSize = ctx.sampleRate * 0.45;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.Q.setValueAtTime(3.0, now);
    noiseFilter.frequency.setValueAtTime(200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.44);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.01, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.4, now + 0.38);
    noiseGain.gain.linearRampToValueAtTime(0.0, now + 0.45);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.45);

    // 2. IMPACT MOMENT (at t = 0.45s):
    const impactTime = now + 0.45;

    // Sub-bass Boom (Deep punch)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, impactTime);
    subOsc.frequency.exponentialRampToValueAtTime(36, impactTime + 0.35);

    subGain.gain.setValueAtTime(0.8, impactTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, impactTime + 0.55);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(impactTime);
    subOsc.stop(impactTime + 0.6);

    // Metallic Punch / Slam Thud
    const punchOsc = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punchOsc.type = 'triangle';
    punchOsc.frequency.setValueAtTime(260, impactTime);
    punchOsc.frequency.exponentialRampToValueAtTime(60, impactTime + 0.18);

    punchGain.gain.setValueAtTime(0.5, impactTime);
    punchGain.gain.exponentialRampToValueAtTime(0.001, impactTime + 0.25);

    punchOsc.connect(punchGain);
    punchGain.connect(ctx.destination);
    punchOsc.start(impactTime);
    punchOsc.stop(impactTime + 0.28);

    // 3. GOLDEN CHIME CHORD (Majestic Casino / Victory Bell)
    // Tones: D5 (587Hz), A5 (880Hz), D6 (1175Hz), F#6 (1480Hz)
    const chordFreqs = [587.33, 880.00, 1174.66, 1479.98];
    chordFreqs.forEach((freq, idx) => {
      const bellOsc = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bellOsc.type = 'sine';
      bellOsc.frequency.setValueAtTime(freq, impactTime);

      const delay = idx * 0.02; // slight arpeggio shimmer
      const startTime = impactTime + delay;
      bellGain.gain.setValueAtTime(0.001, startTime);
      bellGain.gain.linearRampToValueAtTime(0.25 - idx * 0.04, startTime + 0.03);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

      bellOsc.connect(bellGain);
      bellGain.connect(ctx.destination);
      bellOsc.start(startTime);
      bellOsc.stop(startTime + 1.25);
    });

  } catch (err) {
    // Graceful fallback if Web Audio is blocked
    console.warn('Web Audio API notification error:', err);
  }
}
