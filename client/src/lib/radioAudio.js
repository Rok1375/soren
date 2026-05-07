let audioContext;
let staticNode;
let staticGain;

function getAudioContext() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

export function playTone({ frequency = 880, duration = 0.08, type = 'square', gain = 0.055 } = {}) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  amp.gain.setValueAtTime(0.0001, ctx.currentTime);
  amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(amp).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.02);
}

export function playStartBeep() {
  playTone({ frequency: 1160, duration: 0.07, gain: 0.05 });
  window.setTimeout(() => playTone({ frequency: 860, duration: 0.05, gain: 0.04 }), 75);
}

export function playEndBeep() {
  playTone({ frequency: 520, duration: 0.09, gain: 0.05 });
}

export function startStatic() {
  const ctx = getAudioContext();
  if (staticNode) return;

  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    output[i] = Math.random() * 2 - 1;
  }

  staticNode = ctx.createBufferSource();
  staticGain = ctx.createGain();
  staticNode.buffer = buffer;
  staticNode.loop = true;
  staticGain.gain.value = 0.012;
  staticNode.connect(staticGain).connect(ctx.destination);
  staticNode.start();
}

export function stopStatic() {
  if (!staticNode) return;
  staticGain.gain.exponentialRampToValueAtTime(0.0001, getAudioContext().currentTime + 0.06);
  window.setTimeout(() => {
    staticNode?.stop();
    staticNode?.disconnect();
    staticGain?.disconnect();
    staticNode = null;
    staticGain = null;
  }, 90);
}
