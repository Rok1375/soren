const DEFAULT_STUN_URL = 'stun:stun.l.google.com:19302';
let audioLevelContext;

function webrtcDebug(message, details = {}) {
  console.log(`[WebRTC] ${message}`, details);
}

function getAudioLevelContext() {
  audioLevelContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioLevelContext.state === 'suspended') audioLevelContext.resume();
  return audioLevelContext;
}

export function startAudioLevelMeter({ stream, label, localSocketId, peerId, intervalMs = 500 }) {
  if (!stream) return () => {};

  const ctx = getAudioLevelContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const samples = new Uint8Array(analyser.fftSize);
  const timer = window.setInterval(() => {
    analyser.getByteTimeDomainData(samples);

    let sumSquares = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const centered = (samples[i] - 128) / 128;
      sumSquares += centered * centered;
    }

    const audioLevel = Math.sqrt(sumSquares / samples.length);
    const key = label === 'local' ? 'localAudioLevel' : 'remoteAudioLevel';

    webrtcDebug(key, {
      localSocketId,
      peerId,
      [key]: Number(audioLevel.toFixed(4)),
      tracks: stream.getAudioTracks().map((track) => ({
        id: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      })),
    });
  }, intervalMs);

  return () => {
    window.clearInterval(timer);
    source.disconnect();
    analyser.disconnect();
  };
}

function splitUrls(value) {
  return String(value || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

function buildIceServers() {
  const stunUrls = splitUrls(import.meta.env.VITE_STUN_URL || DEFAULT_STUN_URL);
  const turnUrls = splitUrls(import.meta.env.VITE_TURN_URL);
  const turnUsername = import.meta.env.VITE_TURN_USERNAME || '';
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL || '';

  const iceServers = [];

  if (stunUrls.length) {
    iceServers.push({ urls: stunUrls });
  }

  if (turnUrls.length) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return iceServers;
}

export const RTC_CONFIGURATION = {
  iceServers: buildIceServers(),
};

export function createPeerConnection({
  peerId,
  localSocketId,
  onConnectionStateChange,
  onIceConnectionStateChange,
  onSignalingStateChange,
} = {}) {
  webrtcDebug('createPeerConnection', { localSocketId, peerId, rtcConfiguration: RTC_CONFIGURATION });
  const pc = new RTCPeerConnection(RTC_CONFIGURATION);

  pc.onconnectionstatechange = () => {
    webrtcDebug('connectionState changed', {
      localSocketId,
      peerId,
      connectionState: pc.connectionState,
    });
    onConnectionStateChange?.(pc.connectionState, pc);
  };

  pc.oniceconnectionstatechange = () => {
    webrtcDebug('iceConnectionState changed', {
      localSocketId,
      peerId,
      iceConnectionState: pc.iceConnectionState,
    });
    onIceConnectionStateChange?.(pc.iceConnectionState, pc);
  };

  pc.onsignalingstatechange = () => {
    webrtcDebug('signalingState changed', {
      localSocketId,
      peerId,
      signalingState: pc.signalingState,
    });
    onSignalingStateChange?.(pc.signalingState, pc);
  };

  return pc;
}

export function attachAudioStream(stream, id) {
  let audio = document.getElementById(id);
  if (!audio) {
    webrtcDebug('audio element creation', { id });
    audio = document.createElement('audio');
    audio.id = id;
    audio.autoplay = true;
    audio.playsInline = true;
    document.body.appendChild(audio);
  }
  audio.muted = false;
  audio.volume = 1;
  webrtcDebug('remote stream being attached', {
    id,
    audioMuted: audio.muted,
    audioVolume: audio.volume,
    streamId: stream.id,
    audioTracks: stream.getAudioTracks().map((track) => ({
      id: track.id,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    })),
  });
  audio.srcObject = stream;
  audio.play().then(() => {
    webrtcDebug('audio.play() success', { id });
  }).catch((err) => {
    webrtcDebug('audio.play() failure', { id, name: err?.name, message: err?.message });
    // Mobile browsers may require a user gesture. Never let autoplay rejection break PTT.
  });
  return audio;
}

export function removeAudioStream(id) {
  const audio = document.getElementById(id);
  if (audio) audio.remove();
}
