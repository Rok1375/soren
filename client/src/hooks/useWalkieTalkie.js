import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { attachAudioStream, createPeerConnection, removeAudioStream, startAudioLevelMeter } from '../lib/webrtc';
import { playEndBeep, playStartBeep, startStatic, stopStatic } from '../lib/radioAudio';

const DEFAULT_SIGNALING_URL = 'http://localhost:3001';
const SIGNALING_URL = (import.meta.env.VITE_SIGNALING_URL || DEFAULT_SIGNALING_URL).trim();
const BUSY_MESSAGE_MS = 1200;

function webrtcDebug(message, details = {}) {
  console.log(`[WebRTC] ${message}`, details);
}

function getStatus({ joined, transmittingSocketId, mySocketId, isHolding, attemptedWhileBusy }) {
  if (!joined) return 'OFFLINE';
  if (transmittingSocketId === mySocketId) return 'TRANSMITTING';
  if (transmittingSocketId && attemptedWhileBusy) return 'CHANNEL BUSY';
  if (transmittingSocketId) return 'RECEIVING';
  if (isHolding) return 'TUNING';
  return 'LISTENING';
}

function getPeerBadgeStatus(connectionState = 'new', iceConnectionState = 'new') {
  if (connectionState === 'failed' || iceConnectionState === 'failed' || connectionState === 'closed') {
    return 'FAILED';
  }
  if (connectionState === 'disconnected' || iceConnectionState === 'disconnected') {
    return 'RECONNECTING';
  }
  if (connectionState === 'connected' || iceConnectionState === 'connected' || iceConnectionState === 'completed') {
    return 'AUDIO LINKED';
  }
  return 'CONNECTING';
}

function safeRadioAudio(action) {
  try {
    action();
  } catch {
    // AudioContext/autoplay can fail on locked-down browsers. PTT state should never break.
  }
}

export function useWalkieTalkie() {
  const [socketId, setSocketId] = useState(null);
  const [joined, setJoined] = useState(false);
  const [channelNumber, setChannelNumber] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [users, setUsers] = useState([]);
  const [transmittingSocketId, setTransmittingSocketId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [attemptedWhileBusy, setAttemptedWhileBusy] = useState(false);
  const [micStatus, setMicStatus] = useState('idle');
  const [peerStatuses, setPeerStatuses] = useState({});
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const localAudioLevelStopRef = useRef(null);
  const remoteAudioLevelStopsRef = useRef(new Map());
  const peersRef = useRef(new Map());
  const makingOfferRef = useRef(new Set());
  const busyTimeoutRef = useRef(null);

  const status = getStatus({ joined, transmittingSocketId, mySocketId: socketId, isHolding, attemptedWhileBusy });
  const isTransmitting = transmittingSocketId === socketId;
  const isBusy = Boolean(transmittingSocketId && transmittingSocketId !== socketId);

  const clearBusyAttempt = useCallback(() => {
    if (busyTimeoutRef.current) {
      window.clearTimeout(busyTimeoutRef.current);
      busyTimeoutRef.current = null;
    }
    setAttemptedWhileBusy(false);
  }, []);

  const showBusyAttempt = useCallback(() => {
    if (busyTimeoutRef.current) window.clearTimeout(busyTimeoutRef.current);
    setAttemptedWhileBusy(true);
    setError('CHANNEL BUSY');
    busyTimeoutRef.current = window.setTimeout(() => {
      setAttemptedWhileBusy(false);
      setError((current) => (current === 'CHANNEL BUSY' ? '' : current));
      busyTimeoutRef.current = null;
    }, BUSY_MESSAGE_MS);
  }, []);

  const updatePeerStatus = useCallback((peerId, nextStatus) => {
    setPeerStatuses((current) => (
      current[peerId] === nextStatus ? current : { ...current, [peerId]: nextStatus }
    ));
  }, []);

  const removePeerStatus = useCallback((peerId) => {
    setPeerStatuses((current) => {
      if (!current[peerId]) return current;
      const next = { ...current };
      delete next[peerId];
      return next;
    });
  }, []);

  const refreshPeerStatus = useCallback((peerId, pc) => {
    updatePeerStatus(peerId, getPeerBadgeStatus(pc.connectionState, pc.iceConnectionState));
  }, [updatePeerStatus]);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      setMicStatus('granted');
      return localStreamRef.current;
    }

    setMicStatus('requesting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      setMicStatus('granted');
      webrtcDebug('local mic stream granted', {
        streamId: stream.id,
        audioTracks: stream.getAudioTracks().map((track) => ({
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      });
    } catch (err) {
      webrtcDebug('local mic stream failed', { name: err?.name, message: err?.message });
      setMicStatus(err?.name === 'NotAllowedError' ? 'blocked' : 'idle');
      throw new Error(
        err?.name === 'NotAllowedError'
          ? 'Microphone access is blocked. Allow microphone permission to join a channel.'
          : 'Microphone could not start. Check your browser audio settings.',
      );
    }

    stream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    localStreamRef.current = stream;
    localAudioLevelStopRef.current?.();
    localAudioLevelStopRef.current = startAudioLevelMeter({
      stream,
      label: 'local',
      localSocketId: socketRef.current?.id,
    });
    return stream;
  }, []);

  const setMicEnabled = useCallback((enabled) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
      webrtcDebug('local mic track enabled changed', {
        localSocketId: socketRef.current?.id,
        trackId: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
    });
  }, []);

  const closePeer = useCallback((peerId, { keepFailedStatus = false } = {}) => {
    const entry = peersRef.current.get(peerId);
    if (entry) {
      entry.pc.close();
      peersRef.current.delete(peerId);
    }
    remoteAudioLevelStopsRef.current.get(peerId)?.();
    remoteAudioLevelStopsRef.current.delete(peerId);
    removeAudioStream(`audio-${peerId}`);
    if (keepFailedStatus) updatePeerStatus(peerId, 'FAILED');
    else removePeerStatus(peerId);
  }, [removePeerStatus, updatePeerStatus]);

  const getPeer = useCallback(async (peerId) => {
    if (peersRef.current.has(peerId)) return peersRef.current.get(peerId).pc;

    updatePeerStatus(peerId, 'CONNECTING');

    const pc = createPeerConnection({
      peerId,
      localSocketId: socketRef.current?.id,
      onConnectionStateChange: (_state, peerConnection) => {
        refreshPeerStatus(peerId, peerConnection);
        if (['failed', 'closed'].includes(peerConnection.connectionState)) {
          closePeer(peerId, { keepFailedStatus: true });
        }
      },
      onIceConnectionStateChange: (_state, peerConnection) => {
        refreshPeerStatus(peerId, peerConnection);
        if (peerConnection.iceConnectionState === 'failed') {
          closePeer(peerId, { keepFailedStatus: true });
        }
      },
      onSignalingStateChange: () => {},
    });

    const stream = await ensureLocalStream();

    stream.getTracks().forEach((track) => {
      webrtcDebug('local mic stream added to peer connection', {
        localSocketId: socketRef.current?.id,
        peerId,
        streamId: stream.id,
        trackId: track.id,
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      webrtcDebug('ontrack firing', {
        localSocketId: socketRef.current?.id,
        peerId,
        trackId: event.track?.id,
        kind: event.track?.kind,
        streams: event.streams.map((remoteStream) => remoteStream.id),
      });
      const [remoteStream] = event.streams;
      if (remoteStream) {
        const audio = attachAudioStream(remoteStream, `audio-${peerId}`);
        webrtcDebug('remote audio element state', {
          localSocketId: socketRef.current?.id,
          peerId,
          muted: audio.muted,
          volume: audio.volume,
          paused: audio.paused,
          readyState: audio.readyState,
        });
        remoteAudioLevelStopsRef.current.get(peerId)?.();
        remoteAudioLevelStopsRef.current.set(peerId, startAudioLevelMeter({
          stream: remoteStream,
          label: 'remote',
          localSocketId: socketRef.current?.id,
          peerId,
        }));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        webrtcDebug('ICE candidate created', {
          localSocketId: socketRef.current?.id,
          peerId,
          candidateType: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
        });
        webrtcDebug('ICE candidate sent', {
          from: socketRef.current?.id,
          to: peerId,
        });
        socketRef.current?.emit('signal:ice-candidate', {
          to: peerId,
          candidate: event.candidate,
        });
      } else {
        webrtcDebug('ICE candidate gathering complete', {
          localSocketId: socketRef.current?.id,
          peerId,
        });
      }
    };

    peersRef.current.set(peerId, { pc });
    refreshPeerStatus(peerId, pc);
    return pc;
  }, [closePeer, ensureLocalStream, refreshPeerStatus, updatePeerStatus]);

  const callPeer = useCallback(async (peerId) => {
    if (!socketRef.current || peerId === socketRef.current.id || makingOfferRef.current.has(peerId)) return;
    makingOfferRef.current.add(peerId);
    try {
      const pc = await getPeer(peerId);
      const offer = await pc.createOffer();
      webrtcDebug('offer created', {
        from: socketRef.current?.id,
        to: peerId,
        signalingState: pc.signalingState,
      });
      await pc.setLocalDescription(offer);
      webrtcDebug('offer sent', {
        from: socketRef.current?.id,
        to: peerId,
        signalingState: pc.signalingState,
      });
      socketRef.current.emit('signal:offer', { to: peerId, description: pc.localDescription });
    } finally {
      makingOfferRef.current.delete(peerId);
    }
  }, [getPeer]);

  useEffect(() => {
    const socket = io(SIGNALING_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
    const activePeers = peersRef.current;
    const activeRemoteAudioLevelStops = remoteAudioLevelStopsRef.current;
    socketRef.current = socket;

    socket.on('server:ready', ({ socketId: id }) => {
      webrtcDebug('local socket id', { socketId: id });
      setSocketId(id);
    });

    socket.on('channel:state', (state) => {
      setOnlineCount(state.onlineCount);
      setUsers(state.users || []);
      setTransmittingSocketId(state.transmittingSocketId);
      if (!state.transmittingSocketId) clearBusyAttempt();
    });

    socket.on('peer:joined', ({ socketId: peerId }) => {
      webrtcDebug('remote peer socket id', { localSocketId: socket.id, peerId, source: 'peer:joined' });
      webrtcDebug('existing peer waiting for joining peer offer to avoid offer glare', {
        localSocketId: socket.id,
        peerId,
      });
    });

    socket.on('peer:left', ({ socketId: peerId }) => {
      closePeer(peerId);
    });

    socket.on('signal:offer', async ({ from, description }) => {
      webrtcDebug('offer received', {
        localSocketId: socket.id,
        from,
        signalingState: peersRef.current.get(from)?.pc?.signalingState,
      });
      const pc = await getPeer(from);
      await pc.setRemoteDescription(description);
      const answer = await pc.createAnswer();
      webrtcDebug('answer created', {
        from: socket.id,
        to: from,
        signalingState: pc.signalingState,
      });
      await pc.setLocalDescription(answer);
      webrtcDebug('answer sent', {
        from: socket.id,
        to: from,
        signalingState: pc.signalingState,
      });
      socket.emit('signal:answer', { to: from, description: pc.localDescription });
    });

    socket.on('signal:answer', async ({ from, description }) => {
      webrtcDebug('answer received', {
        localSocketId: socket.id,
        from,
        currentSignalingState: peersRef.current.get(from)?.pc?.signalingState,
      });
      const pc = await getPeer(from);
      if (pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(description);
        webrtcDebug('answer applied', {
          localSocketId: socket.id,
          from,
          signalingState: pc.signalingState,
        });
      } else {
        webrtcDebug('answer ignored because signalingState is stable', {
          localSocketId: socket.id,
          from,
        });
      }
    });

    socket.on('signal:ice-candidate', async ({ from, candidate }) => {
      webrtcDebug('ICE candidate received', {
        localSocketId: socket.id,
        from,
        candidateType: candidate?.type,
        protocol: candidate?.protocol,
        address: candidate?.address,
      });
      const pc = await getPeer(from);
      if (candidate) await pc.addIceCandidate(candidate);
    });

    socket.on('ptt:started', ({ socketId: speakerId }) => {
      setTransmittingSocketId(speakerId);
      safeRadioAudio(playStartBeep);
      if (speakerId !== socket.id) safeRadioAudio(startStatic);
    });

    socket.on('ptt:ended', ({ socketId: speakerId }) => {
      setTransmittingSocketId((current) => (current === speakerId ? null : current));
      clearBusyAttempt();
      safeRadioAudio(playEndBeep);
      safeRadioAudio(stopStatic);
    });

    socket.on('disconnect', () => {
      setJoined(false);
      setOnlineCount(0);
      setTransmittingSocketId(null);
      setPeerStatuses({});
      clearBusyAttempt();
      setError('Disconnected from the signaling server.');
    });

    return () => {
      if (busyTimeoutRef.current) window.clearTimeout(busyTimeoutRef.current);
      socket.disconnect();
      activePeers.forEach(({ pc }, peerId) => {
        pc.close();
        removeAudioStream(`audio-${peerId}`);
      });
      localAudioLevelStopRef.current?.();
      localAudioLevelStopRef.current = null;
      activeRemoteAudioLevelStops.forEach((stop) => stop());
      activeRemoteAudioLevelStops.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      safeRadioAudio(stopStatic);
    };
  }, [callPeer, clearBusyAttempt, closePeer, getPeer]);

  const joinChannel = useCallback(async ({ username, channelNumber: requestedChannel }) => {
    setError('');
    clearBusyAttempt();
    try {
      await ensureLocalStream();
      const response = await new Promise((resolve) => {
        socketRef.current.emit('channel:join', { username, channelNumber: requestedChannel }, resolve);
      });

      if (!response?.ok) {
        throw new Error(response?.error || 'Could not join channel.');
      }

      setJoined(true);
      setChannelNumber(response.channelNumber);
      setOnlineCount(response.state.onlineCount);
      setUsers(response.state.users || []);
      setTransmittingSocketId(response.state.transmittingSocketId);

      webrtcDebug('channel joined', {
        localSocketId: socketRef.current?.id,
        channelNumber: response.channelNumber,
        peers: response.peers || [],
      });

      await Promise.all((response.peers || []).map((peerId) => callPeer(peerId)));
      return response;
    } catch (err) {
      setError(err.message || 'Microphone permission or signaling failed.');
      throw err;
    }
  }, [callPeer, clearBusyAttempt, ensureLocalStream]);

  const leaveChannel = useCallback(async () => {
    setMicEnabled(false);
    safeRadioAudio(stopStatic);
    await new Promise((resolve) => socketRef.current?.emit('ptt:end', {}, resolve));
    await new Promise((resolve) => socketRef.current?.emit('channel:leave', {}, resolve));
    peersRef.current.forEach(({ pc }, peerId) => {
      pc.close();
      removeAudioStream(`audio-${peerId}`);
    });
    peersRef.current.clear();
    remoteAudioLevelStopsRef.current.forEach((stop) => stop());
    remoteAudioLevelStopsRef.current.clear();
    setPeerStatuses({});
    setJoined(false);
    setChannelNumber('');
    setOnlineCount(0);
    setUsers([]);
    setTransmittingSocketId(null);
    setIsHolding(false);
    clearBusyAttempt();
  }, [clearBusyAttempt, setMicEnabled]);

  const startTransmitting = useCallback(async () => {
    if (!joined) return false;
    if (isBusy) {
      setIsHolding(false);
      setMicEnabled(false);
      showBusyAttempt();
      return false;
    }

    setError('');
    clearBusyAttempt();
    setIsHolding(true);

    const response = await new Promise((resolve) => {
      socketRef.current.emit('ptt:start', {}, resolve);
    });

    if (!response?.ok) {
      setIsHolding(false);
      setMicEnabled(false);
      if (response?.busy) showBusyAttempt();
      else setError(response?.error || 'Could not transmit.');
      return false;
    }

    setMicEnabled(!muted);
    safeRadioAudio(playStartBeep);
    return true;
  }, [clearBusyAttempt, isBusy, joined, muted, setMicEnabled, showBusyAttempt]);

  const stopTransmitting = useCallback(async () => {
    setIsHolding(false);
    setMicEnabled(false);
    if (!joined) return;
    await new Promise((resolve) => socketRef.current.emit('ptt:end', {}, resolve));
    safeRadioAudio(playEndBeep);
  }, [joined, setMicEnabled]);

  const toggleMute = useCallback(() => {
    setMuted((next) => {
      const newMuted = !next;
      if (isTransmitting) setMicEnabled(!newMuted);
      return newMuted;
    });
  }, [isTransmitting, setMicEnabled]);

  return {
    socketId,
    joined,
    channelNumber,
    onlineCount,
    users,
    muted,
    micStatus,
    peerStatuses,
    status,
    isBusy,
    isHolding,
    isTransmitting,
    transmittingUser: users.find((user) => user.socketId === transmittingSocketId) || null,
    error,
    joinChannel,
    leaveChannel,
    startTransmitting,
    stopTransmitting,
    toggleMute,
  };
}
