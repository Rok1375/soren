import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { attachAudioStream, createPeerConnection, removeAudioStream, startAudioLevelMeter } from '../lib/webrtc';
import { playEndBeep, playStartBeep, startStatic, stopStatic } from '../lib/radioAudio';

const DEFAULT_SIGNALING_URL = 'http://localhost:3001';
const SIGNALING_URL = (import.meta.env.VITE_SIGNALING_URL || DEFAULT_SIGNALING_URL).trim();
const BUSY_MESSAGE_MS = 1200;
const JOIN_ACK_TIMEOUT_MS = 12000;
const JOIN_TIMEOUT_MESSAGE = 'Could not join channel. Check your connection and try again.';

function webrtcDebug(message, details = {}) {
  console.log(`[WebRTC] ${message}`, details);
}

function joinDebug(message, details = {}) {
  console.log(`[Join] ${message}`, details);
}

function waitForSocketConnection(socket, timeoutMs) {
  if (!socket) return Promise.reject(new Error(JOIN_TIMEOUT_MESSAGE));
  if (socket.connected) {
    joinDebug('socket connected', { socketId: socket.id, alreadyConnected: true });
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleConnect = () => settle(() => {
      joinDebug('socket connected', { socketId: socket.id, alreadyConnected: false });
      resolve();
    });
    const handleConnectError = (error) => {
      joinDebug('join failed', { stage: 'socket connect', message: error?.message });
    };
    const timeoutId = window.setTimeout(() => settle(() => {
      joinDebug('join timed out', { stage: 'socket connect', timeoutMs });
      reject(new Error(JOIN_TIMEOUT_MESSAGE));
    }), timeoutMs);

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.connect();
  });
}

function emitJoinWithTimeout(socket, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      joinDebug('join timed out', { channelNumber: payload.channelNumber, timeoutMs });
      reject(new Error(JOIN_TIMEOUT_MESSAGE));
    }, timeoutMs);

    joinDebug('join emitted', { channelNumber: payload.channelNumber, username: payload.username });
    socket.emit('channel:join', payload, (response) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      joinDebug('join ack received', {
        ok: response?.ok,
        error: response?.error,
        channelNumber: response?.channelNumber,
        users: response?.users,
      });
      resolve(response);
    });
  });
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
  const [isHost, setIsHost] = useState(false);
  const [hostSocketId, setHostSocketId] = useState(null);
  const [channelLocked, setChannelLocked] = useState(false);
  const [channelLockError, setChannelLockError] = useState('');
  const [channelState, setChannelState] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const localAudioLevelStopRef = useRef(null);
  const remoteAudioLevelStopsRef = useRef(new Map());
  const peersRef = useRef(new Map());
  const makingOfferRef = useRef(new Set());
  const busyTimeoutRef = useRef(null);
  const channelStateRef = useRef(null);
  const usersRef = useRef([]);

  const addEvent = useCallback((text, tone = 'green') => {
    const freshEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      text,
      tone,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setEvents((prev) => [freshEvent, ...prev].slice(0, 10));
  }, []);

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
    joinDebug('mic permission requesting');
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
      joinDebug('mic granted');
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
      const previousState = channelStateRef.current;
      if (previousState) {
        if (!previousState.locked && state.locked) addEvent('Channel locked by host', 'amber');
        if (previousState.locked && !state.locked) addEvent('Channel unlocked by host', 'green');
        if (previousState.hostSocketId !== state.hostSocketId) {
          const newHost = state.users.find(u => u.socketId === state.hostSocketId);
          if (newHost) addEvent(`Host transferred to ${newHost.username}`, 'amber');
        }
      }

      channelStateRef.current = state;
      usersRef.current = state.users || [];
      setChannelState(state);
      setOnlineCount(state.onlineCount);
      setUsers(state.users || []);
      setHostSocketId(state.hostSocketId || null);
      setIsHost(state.hostSocketId === socket.id);
      setChannelLocked(Boolean(state.locked));
      setChannelLockError('');
      setTransmittingSocketId(state.transmittingSocketId);
      if (!state.transmittingSocketId) clearBusyAttempt();
    });

    socket.on('peer:joined', ({ socketId: peerId, username }) => {
      addEvent(`${username || 'Someone'} joined CP`, 'green');
      webrtcDebug('remote peer socket id', { localSocketId: socket.id, peerId, source: 'peer:joined' });
      webrtcDebug('existing peer waiting for joining peer offer to avoid offer glare', {
        localSocketId: socket.id,
        peerId,
      });
    });

    socket.on('peer:left', ({ socketId: peerId }) => {
      const leavingUser = usersRef.current.find(u => u.socketId === peerId);
      if (leavingUser) addEvent(`${leavingUser.username} left CP`, 'amber');
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

    socket.on('ptt:started', ({ socketId: speakerId, username }) => {
      if (speakerId !== socket.id) addEvent(`${username || 'Operator'} transmitting`, 'green');
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

    socket.on('channel:ended', ({ message }) => {
      leaveChannel();
      setError(message || 'The host ended this channel session.');
    });

    socket.on('channel:removed', ({ message }) => {
      leaveChannel();
      setError(message || 'You were removed from this channel by the host.');
    });

    socket.on('disconnect', () => {
      setJoined(false);
      setOnlineCount(0);
      setTransmittingSocketId(null);
      setPeerStatuses({});
      setIsHost(false);
      setHostSocketId(null);
      setChannelLocked(false);
      setChannelLockError('');
      setChannelState(null);
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
    // Socket lifecycle is intentionally initialized once. Event handlers read volatile channel/user state from refs to avoid reconnecting media sockets on every room update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callPeer, clearBusyAttempt, closePeer, getPeer, addEvent]);

  const joinChannel = useCallback(async ({ username, channelNumber: requestedChannel }) => {
    joinDebug('join started', { channelNumber: requestedChannel, username });
    setError('');
    clearBusyAttempt();
    try {
      await ensureLocalStream();
      const socket = socketRef.current;
      await waitForSocketConnection(socket, JOIN_ACK_TIMEOUT_MS);
      const response = await emitJoinWithTimeout(
        socket,
        { username, channelNumber: requestedChannel },
        JOIN_ACK_TIMEOUT_MS,
      );

      if (!response?.ok) {
        if (response?.error === 'CHANNEL_LOCKED') {
          throw new Error('This channel is locked by the host.');
        }
        throw new Error(response?.error || 'Could not join channel.');
      }

      setJoined(true);
      setChannelNumber(response.channelNumber);
      channelStateRef.current = response.state || null;
      usersRef.current = response.state.users || [];
      setChannelState(response.state || null);
      setOnlineCount(response.state.onlineCount);
      setUsers(response.state.users || []);
      setHostSocketId(response.state.hostSocketId || response.hostSocketId || null);
      setIsHost(Boolean(response.isHost));
      setChannelLocked(Boolean(response.state.locked ?? response.locked));
      setChannelLockError('');
      setTransmittingSocketId(response.state.transmittingSocketId);

      webrtcDebug('channel joined', {
        localSocketId: socketRef.current?.id,
        channelNumber: response.channelNumber,
        peers: response.peers || [],
      });

      await Promise.all((response.peers || []).map((peerId) => callPeer(peerId)));
      return response;
    } catch (err) {
      joinDebug('join failed', { message: err?.message });
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
    usersRef.current = [];
    setHostSocketId(null);
    setIsHost(false);
    setChannelLocked(false);
    setChannelLockError('');
    channelStateRef.current = null;
    setChannelState(null);
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

  const setChannelLock = useCallback(async (locked) => {
    setChannelLockError('');
    const response = await new Promise((resolve) => {
      socketRef.current?.emit('channel:set-lock', { locked }, resolve);
    });

    if (!response?.ok) {
      const message = response?.error === 'NOT_HOST'
        ? 'Only the host can lock this channel.'
        : response?.error || 'Could not update channel lock.';
      setChannelLockError(message);
      return false;
    }

    if (response.state) {
      setChannelState(response.state);
      setHostSocketId(response.state.hostSocketId || null);
      setIsHost(response.state.hostSocketId === socketRef.current?.id);
      channelStateRef.current = response.state;
      usersRef.current = response.state.users || [];
      setChannelLocked(Boolean(response.state.locked));
    } else {
      setChannelLocked(Boolean(response.locked));
    }
    return true;
  }, []);

  return {
    socketId,
    joined,
    channelNumber,
    onlineCount,
    users,
    muted,
    micStatus,
    peerStatuses,
    isHost,
    hostSocketId,
    channelLocked,
    channelLockError,
    channelState,
    status,
    isBusy,
    isHolding,
    isTransmitting,
    transmittingUser: users.find((user) => user.socketId === transmittingSocketId) || null,
    events,
    error,
    joinChannel,
    leaveChannel,
    startTransmitting,
    stopTransmitting,
    toggleMute,
    setChannelLock,
    endChannel: useCallback(async () => {
      const response = await new Promise((resolve) => {
        socketRef.current?.emit('channel:end', {}, resolve);
      });
      if (!response?.ok) {
        setError(response?.error || 'Could not end channel.');
        return false;
      }
      return true;
    }, []),
    removeUser: useCallback(async (targetSocketId) => {
      const response = await new Promise((resolve) => {
        socketRef.current?.emit('channel:remove-user', { targetSocketId }, resolve);
      });
      if (!response?.ok) {
        setError(response?.error || 'Could not remove user.');
        return false;
      }
      return true;
    }, []),
  };
}
