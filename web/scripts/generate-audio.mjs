import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(rootDir, "static", "sounds");
const sampleRate = 44_100;

const cues = {
  place: {
    duration: 0.18,
    layers: [
      tone("triangle", 210, 0, 0.18, 0.62, 0.004, 0.055),
      tone("sine", 110, 0.008, 0.14, 0.25, 0.004, 0.06),
      tone("noise", 0, 0, 0.035, 0.08, 0.001, 0.012),
    ],
  },
  move: {
    duration: 0.14,
    layers: [
      tone("triangle", 330, 0, 0.14, 0.45, 0.003, 0.045),
      tone("sine", 520, 0.006, 0.08, 0.16, 0.003, 0.035),
      tone("noise", 0, 0, 0.025, 0.045, 0.001, 0.01),
    ],
  },
  jare: {
    duration: 0.42,
    layers: [
      tone("sine", 440, 0, 0.2, 0.32, 0.012, 0.11),
      tone("sine", 660, 0.17, 0.24, 0.34, 0.012, 0.12),
      tone("triangle", 880, 0.25, 0.16, 0.12, 0.01, 0.08),
    ],
  },
  capture: {
    duration: 0.26,
    layers: [
      tone("triangle", 150, 0, 0.22, 0.68, 0.003, 0.07),
      tone("sine", 92, 0.01, 0.2, 0.3, 0.004, 0.08),
      tone("noise", 0, 0, 0.06, 0.1, 0.001, 0.018),
    ],
  },
  invalid: {
    duration: 0.22,
    layers: [
      tone("triangle", 120, 0, 0.22, 0.38, 0.006, 0.13),
      tone("triangle", 128, 0, 0.22, 0.34, 0.006, 0.13),
      tone("sine", 80, 0, 0.18, 0.14, 0.006, 0.1),
    ],
  },
  win: {
    duration: 0.56,
    layers: [
      tone("sine", 392, 0, 0.18, 0.26, 0.012, 0.095),
      tone("sine", 523.25, 0.16, 0.2, 0.3, 0.012, 0.105),
      tone("sine", 659.25, 0.34, 0.22, 0.34, 0.012, 0.12),
      tone("triangle", 784, 0.42, 0.13, 0.14, 0.01, 0.08),
    ],
  },
};

await mkdir(outputDir, { recursive: true });

for (const [name, cue] of Object.entries(cues)) {
  const samples = renderCue(cue);
  await writeFile(resolve(outputDir, `${name}.wav`), encodeWav(samples));
}

function tone(wave, frequency, start, duration, gain, attack, decay) {
  return { wave, frequency, start, duration, gain, attack, decay };
}

function renderCue(cue) {
  const length = Math.ceil(cue.duration * sampleRate);
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    let value = 0;

    for (const layer of cue.layers) {
      value += renderLayer(layer, t, i);
    }

    samples[i] = Math.max(-0.95, Math.min(0.95, value));
  }

  return samples;
}

function renderLayer(layer, t, index) {
  const localTime = t - layer.start;
  if (localTime < 0 || localTime > layer.duration) {
    return 0;
  }

  const envelope = amplitudeEnvelope(
    localTime,
    layer.duration,
    layer.attack,
    layer.decay,
  );
  const wave = sampleWave(layer.wave, layer.frequency, localTime, index);

  return wave * envelope * layer.gain;
}

function amplitudeEnvelope(t, duration, attack, decay) {
  const attackGain = attack <= 0 ? 1 : Math.min(1, t / attack);
  const releaseStart = Math.max(attack, duration - decay);
  const releaseGain =
    t <= releaseStart || decay <= 0
      ? 1
      : Math.max(0, 1 - (t - releaseStart) / decay);
  const bodyDecay = Math.exp(-4.2 * (t / duration));

  return attackGain * releaseGain * bodyDecay;
}

function sampleWave(wave, frequency, t, index) {
  if (wave === "noise") {
    return deterministicNoise(index);
  }

  const phase = 2 * Math.PI * frequency * t;

  if (wave === "triangle") {
    return (2 / Math.PI) * Math.asin(Math.sin(phase));
  }

  return Math.sin(phase);
}

function deterministicNoise(index) {
  const x = Math.sin((index + 1) * 12.9898) * 43_758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function encodeWav(samples) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(8 * bytesPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.round(samples[i] * 32_767);
    buffer.writeInt16LE(value, 44 + i * bytesPerSample);
  }

  return buffer;
}
