#!/usr/bin/env node
/**
 * Generates the seven PollWise sound effects described in DESIGN §4 as WAV files in
 * mobile/assets/sounds/. Pure Node, no dependencies, so the sounds carry no licence questions.
 *
 * Format: 16-bit mono PCM at 11,025 Hz. DESIGN §4 asks for 44.1 kHz, but at that rate the 1-second
 * `pass` sound alone is about 88 KB, well over the 25 KB limit. The tones here sit below 2 kHz, so
 * the lower rate costs nothing audible. The choice is recorded in docs/DECISIONS.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 11025;
const MAX_BYTES = 25 * 1024;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile', 'assets', 'sounds');

/** Equal-temperament frequency for a MIDI note number (A4 = 69 = 440 Hz). */
const midi = (note) => 440 * 2 ** ((note - 69) / 12);

/**
 * Render a list of notes into samples. Each note is a sine with a short attack and an exponential
 * decay, so nothing clicks.
 * @param {{ start: number, dur: number, freq: number, freqEnd?: number, amp?: number, decay?: number }[]} notes
 * @param {number} totalSec
 * @returns {Float32Array}
 */
function render(notes, totalSec) {
  const out = new Float32Array(Math.round(totalSec * SAMPLE_RATE));
  for (const note of notes) {
    const from = Math.round(note.start * SAMPLE_RATE);
    const len = Math.round(note.dur * SAMPLE_RATE);
    const amp = note.amp ?? 0.5;
    const decay = note.decay ?? 4;
    let phase = 0;
    for (let i = 0; i < len && from + i < out.length; i += 1) {
      const t = i / len;
      const f = note.freqEnd ? note.freq + (note.freqEnd - note.freq) * t : note.freq;
      phase += (2 * Math.PI * f) / SAMPLE_RATE;
      const attack = Math.min(1, i / (0.006 * SAMPLE_RATE));
      const env = attack * Math.exp(-decay * t);
      out[from + i] += Math.sin(phase) * env * amp;
    }
  }
  return out;
}

/** Filtered noise burst, used for the whoosh and the tap. Deterministic so builds are repeatable. */
function noise(start, dur, amp, decay, seed = 1) {
  return { start, dur, amp, decay, noise: true, seed };
}

function renderWithNoise(parts, totalSec) {
  const samples = new Float32Array(Math.round(totalSec * SAMPLE_RATE));
  for (const part of parts) {
    if (part.noise) {
      const from = Math.round(part.start * SAMPLE_RATE);
      const len = Math.round(part.dur * SAMPLE_RATE);
      let state = part.seed;
      let last = 0;
      for (let i = 0; i < len && from + i < samples.length; i += 1) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        const white = state / 0x7fffffff - 0.5;
        last = last * 0.85 + white * 0.15; // one-pole low-pass keeps it soft
        const t = i / len;
        const env = Math.min(1, i / (0.01 * SAMPLE_RATE)) * Math.exp(-part.decay * t);
        samples[from + i] += last * env * part.amp;
      }
    } else {
      const tone = render([part], totalSec);
      for (let i = 0; i < samples.length; i += 1) samples[i] += tone[i];
    }
  }
  return samples;
}

/**
 * Encode float samples as a 16-bit mono WAV file, normalising so the peak sits at 0.8 of full scale.
 * @param {Float32Array} samples
 * @returns {Buffer}
 */
export function encodeWav(samples) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const scale = peak > 0 ? 0.8 / peak : 1;

  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i] * scale));
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buffer;
}

const C5 = midi(72);
const E5 = midi(76);
const G5 = midi(79);
const C6 = midi(84);

/** @type {Record<string, { totalSec: number, samples: Float32Array }>} */
const SOUNDS = {
  // Two bright notes rising by a major third, 180 ms (DESIGN §4: correct answer).
  correct: {
    totalSec: 0.18,
    samples: render(
      [
        { start: 0, dur: 0.09, freq: midi(76), amp: 0.5, decay: 5 },
        { start: 0.085, dur: 0.095, freq: midi(80), amp: 0.5, decay: 5 },
      ],
      0.18
    ),
  },
  // One soft, low note falling, 200 ms, not harsh (DESIGN §4: not quite).
  wrong: {
    totalSec: 0.2,
    samples: render([{ start: 0, dur: 0.2, freq: 330, freqEnd: 262, amp: 0.35, decay: 6 }], 0.2),
  },
  // Four-note rising arpeggio, 600 ms (lesson complete).
  complete: {
    totalSec: 0.6,
    samples: render(
      [
        { start: 0, dur: 0.2, freq: C5, amp: 0.45, decay: 4 },
        { start: 0.14, dur: 0.2, freq: E5, amp: 0.45, decay: 4 },
        { start: 0.28, dur: 0.2, freq: G5, amp: 0.45, decay: 4 },
        { start: 0.42, dur: 0.18, freq: C6, amp: 0.45, decay: 4 },
      ],
      0.6
    ),
  },
  // Arpeggio into a sustained chord, 1 s (module passed).
  pass: {
    totalSec: 1.0,
    samples: render(
      [
        { start: 0, dur: 0.16, freq: C5, amp: 0.4, decay: 5 },
        { start: 0.12, dur: 0.16, freq: E5, amp: 0.4, decay: 5 },
        { start: 0.24, dur: 0.16, freq: G5, amp: 0.4, decay: 5 },
        { start: 0.36, dur: 0.64, freq: C6, amp: 0.3, decay: 3 },
        { start: 0.36, dur: 0.64, freq: C5, amp: 0.2, decay: 2.5 },
        { start: 0.36, dur: 0.64, freq: E5, amp: 0.2, decay: 2.5 },
        { start: 0.36, dur: 0.64, freq: G5, amp: 0.2, decay: 2.5 },
      ],
      1.0
    ),
  },
  // Soft rising whoosh, 500 ms (streak extended): a rising tone under a little filtered noise.
  streak: {
    totalSec: 0.5,
    samples: renderWithNoise(
      [
        { start: 0, dur: 0.5, freq: 300, freqEnd: 900, amp: 0.25, decay: 3 },
        noise(0, 0.5, 0.5, 2.5, 7),
      ],
      0.5
    ),
  },
  // Light sparkle chime, 400 ms (module unlocked): two high bell tones, staggered.
  unlock: {
    totalSec: 0.4,
    samples: render(
      [
        { start: 0, dur: 0.35, freq: midi(91), amp: 0.35, decay: 7 },
        { start: 0.0, dur: 0.35, freq: midi(98), amp: 0.2, decay: 9 },
        { start: 0.1, dur: 0.3, freq: midi(96), amp: 0.3, decay: 8 },
      ],
      0.4
    ),
  },
  // Very short click, 30 ms (lip buttons, optional, off by default).
  tap: {
    totalSec: 0.03,
    samples: renderWithNoise([noise(0, 0.03, 0.9, 12, 3)], 0.03),
  },
};

mkdirSync(OUT_DIR, { recursive: true });
let failed = false;
for (const [name, { samples }] of Object.entries(SOUNDS)) {
  const wav = encodeWav(samples);
  if (wav.length > MAX_BYTES) {
    console.error(`${name}.wav is ${wav.length} bytes, over the ${MAX_BYTES} byte limit`);
    failed = true;
    continue;
  }
  writeFileSync(join(OUT_DIR, `${name}.wav`), wav);
  console.log(`${name}.wav  ${(wav.length / 1024).toFixed(1)} KB`);
}
if (failed) process.exit(1);
