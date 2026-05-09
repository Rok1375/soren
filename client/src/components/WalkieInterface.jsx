import { useEffect, useRef, useState } from 'react';
import { Copy, Download, Lock, LogOut, Mic, MicOff, QrCode, RadioTower, Share2, Star, Unlock, Users, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { Waveform } from './Waveform';
import { createInviteLink, shareInviteLink } from '../lib/invite';
import { formatTimeAgo, getLocalStats, incrementTransmissions, resetLocalStats } from '../lib/localStats';

const statusStyles = {
  OFFLINE: 'text-white/50 border-white/10 bg-white/5',
  LISTENING: 'text-tactical-green border-tactical-green/30 bg-tactical-green/10',
  TUNING: 'text-tactical-amber border-tactical-amber/30 bg-tactical-amber/10',
  TRANSMITTING: 'text-black border-tactical-green bg-tactical-green shadow-signal',
  RECEIVING: 'text-tactical-amber border-tactical-amber/40 bg-tactical-amber/10',
  'CHANNEL BUSY': 'text-tactical-red border-tactical-red/35 bg-tactical-red/10',
};

const peerStatusStyles = {
  CONNECTING: 'border-tactical-amber/25 bg-tactical-amber/10 text-tactical-amber',
  'AUDIO LINKED': 'border-tactical-green/25 bg-tactical-green/10 text-tactical-green',
  RECONNECTING: 'border-tactical-amber/25 bg-tactical-amber/10 text-tactical-amber',
  FAILED: 'border-tactical-red/30 bg-tactical-red/10 text-tactical-red',
};

function MeterCard({ label, children, tone = 'primary' }) {
  const toneClass = tone === 'red'
    ? 'text-tactical-red border-tactical-red/25'
    : tone === 'amber'
      ? 'text-tactical-amber border-tactical-amber/25'
      : 'text-tactical-green border-tactical-green/25';
  return (
    <div className={`rounded-xl border bg-black/35 px-3 py-2 font-mono ${toneClass}`}>
      <p className="text-[9px] uppercase tracking-[0.24em] opacity-60">{label}</p>
      <div className="mt-1 text-sm font-bold uppercase tracking-[0.1em]">{children}</div>
    </div>
  );
}

function SignalBars({ active }) {
  return (
    <div className="flex h-7 items-end gap-1">
      {[30, 48, 66, 84].map((height, index) => (
        <span
          key={height}
          className={`w-2 rounded-sm ${active || index < 3 ? 'bg-tactical-green shadow-signal' : 'bg-white/15'}`}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function getStatusTone(status) {
  if (status === 'CHANNEL BUSY') return 'red';
  if (status === 'RECEIVING' || status === 'TUNING') return 'amber';
  return 'primary';
}

export function WalkieInterface({ radio, isFavorite, onToggleFavorite, channelLabels, onSetChannelLabel, roomVibes, onSetRoomVibe, themeId, themes, onThemeChange }) {
  const [inviteStatus, setInviteStatus] = useState('idle');
  const [qrOpen, setQrOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [stats, setStats] = useState(() => getLocalStats());
  const cardRef = useRef(null);
  const inviteTimerRef = useRef(null);
  const statusClass = statusStyles[radio.status] || statusStyles.OFFLINE;
  const waveformActive = radio.isTransmitting || radio.status === 'RECEIVING' || radio.status === 'CHANNEL BUSY';
  const isOnlyOperator = radio.joined && radio.onlineCount <= 1;
  const inviteUrl = createInviteLink(radio.channelNumber);
  const isMeTransmitting = radio.isTransmitting;
  const prevTransmittingRef = useRef(false);
  
  // Track transmissions
  useEffect(() => {
    if (isMeTransmitting && !prevTransmittingRef.current) {
      setStats(incrementTransmissions());
    }
    prevTransmittingRef.current = isMeTransmitting;
  }, [isMeTransmitting]);

  useEffect(() => {
    if (radio.joined) {
      setStats(getLocalStats());
    }
  }, [radio.joined, radio.channelNumber]);

  const connectionBadges = [];
  if (radio.joined) {
    connectionBadges.push({ label: 'ROOM LINKED', tone: 'primary' });
    if (radio.micStatus === 'granted') {
      connectionBadges.push({ label: 'MIC GRANTED', tone: 'primary' });
    } else if (radio.micStatus === 'blocked') {
      connectionBadges.push({ label: 'MIC BLOCKED', tone: 'red' });
    } else {
      connectionBadges.push({ label: 'SIGNAL CHECK', tone: 'amber' });
    }

    const peerStates = Object.values(radio.peerStatuses);
    if (peerStates.includes('AUDIO LINKED')) {
      connectionBadges.push({ label: 'AUDIO READY', tone: 'primary' });
    } else if (peerStates.includes('RECONNECTING')) {
      connectionBadges.push({ label: 'RECONNECTING', tone: 'amber' });
    } else if (peerStates.includes('FAILED')) {
      connectionBadges.push({ label: 'SIGNAL CHECK', tone: 'red' });
    }
  }

  useEffect(() => () => {
    if (inviteTimerRef.current) window.clearTimeout(inviteTimerRef.current);
  }, []);

  useEffect(() => {
    if (!radio.joined) return;

    function isInputFocused() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.closest('button') !== null;
    }

    let hasFired = false;

    function handleKeyDown(event) {
      if (event.code !== 'Space') return;
      if (isInputFocused()) return;
      if (radio.status === 'CHANNEL BUSY') return;
      if (radio.muted) return;
      if (hasFired) return;

      event.preventDefault();
      hasFired = true;
      radio.startTransmitting();
    }

    function handleKeyUp(event) {
      if (event.code !== 'Space') return;
      if (!hasFired) return;

      event.preventDefault();
      hasFired = false;
      radio.stopTransmitting();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [radio, radio.joined, radio.status, radio.muted, radio.startTransmitting, radio.stopTransmitting]);

  async function copyInviteLink() {
    try {
      const result = await shareInviteLink(radio.channelNumber);
      setInviteStatus(result.method === 'cancelled' ? 'idle' : 'copied');
    } catch {
      setInviteStatus('error');
    }

    if (inviteTimerRef.current) window.clearTimeout(inviteTimerRef.current);
    inviteTimerRef.current = window.setTimeout(() => {
      setInviteStatus('idle');
      inviteTimerRef.current = null;
    }, 1800);
  }

  async function copyBareInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteStatus('copied');
    } catch {
      setInviteStatus('error');
    }

    if (inviteTimerRef.current) window.clearTimeout(inviteTimerRef.current);
    inviteTimerRef.current = window.setTimeout(() => {
      setInviteStatus('idle');
      inviteTimerRef.current = null;
    }, 1800);
  }

  async function downloadSignalCard() {
    if (!cardRef.current) return;
    try {
      setInviteStatus('generating');
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: '#030504',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `walkie-talking-ch${radio.channelNumber}.png`;
      link.href = dataUrl;
      link.click();
      setInviteStatus('downloaded');
    } catch (err) {
      console.error('Failed to generate card:', err);
      setInviteStatus('error');
    }

    if (inviteTimerRef.current) window.clearTimeout(inviteTimerRef.current);
    inviteTimerRef.current = window.setTimeout(() => {
      setInviteStatus('idle');
      inviteTimerRef.current = null;
    }, 2000);
  }

  function bindPttHandlers() {
    return {
      onPointerDown: (event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        radio.startTransmitting();
      },
      onPointerUp: (event) => {
        event.preventDefault();
        radio.stopTransmitting();
      },
      onPointerCancel: radio.stopTransmitting,
      onLostPointerCapture: radio.stopTransmitting,
      onPointerLeave: (event) => {
        if (event.buttons) radio.stopTransmitting();
      },
      onContextMenu: (event) => event.preventDefault(),
    };
  }

  return (
    <main className="relative min-h-dvh overflow-hidden px-4 py-5 font-display text-white sm:flex sm:items-center sm:justify-center">
      <div className="noise-overlay absolute inset-0" />
      <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-tactical-green/10 blur-3xl" />

      <section className="relative mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-md flex-col rounded-[2.2rem] border border-tactical-edge bg-gradient-to-b from-[#111b14] via-tactical-panel to-[#020302] p-4 shadow-2xl shadow-black sm:min-h-[820px]">
        <div className="pointer-events-none absolute inset-x-10 top-3 h-px bg-white/20" />
        <div className="pointer-events-none absolute inset-x-8 bottom-4 h-8 rounded-full border-b border-white/10" />

        <header className="mb-4 flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-black/35 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/45">Walkie Talking</p>
            <div className="mt-1 flex items-center gap-2 text-tactical-green">
              <RadioTower size={18} />
              <span className="font-mono text-sm uppercase tracking-[0.18em]">Digital Internet PTT</span>
              {radio.isHost ? (
                <span className="rounded-full border border-tactical-amber/30 bg-tactical-amber/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-tactical-amber">HOST</span>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.24em] text-white/35">INTERNET ROOM — NOT RF</p>
          </div>
          <div className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.16em] ${statusClass}`}>{radio.status}</div>
        </header>

        {connectionBadges.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 px-1">
            {connectionBadges.map((badge) => (
              <div
                key={badge.label}
                className={`rounded-full border bg-black/35 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${
                  badge.tone === 'red'
                    ? 'border-tactical-red/35 text-tactical-red'
                    : badge.tone === 'amber'
                      ? 'border-tactical-amber/35 text-tactical-amber'
                      : 'border-tactical-green/35 text-tactical-green'
                }`}
              >
                {badge.label}
              </div>
            ))}
          </div>
        )}

        <section className="lcd-glass relative overflow-hidden rounded-[1.7rem] border border-tactical-green/25 bg-[#8dff6a]/10 p-4 shadow-signal">
          <div className="absolute inset-0 animate-scan bg-gradient-to-b from-transparent via-white/8 to-transparent" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-tactical-green/25" />
          <div className="relative mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-full border border-tactical-green/20 bg-black/25 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-tactical-green/70">
              Internet room code — not RF
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`touch-manipulation rounded-full border px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] transition active:scale-[0.98] ${
                  isFavorite
                    ? 'border-tactical-amber/30 bg-tactical-amber/10 text-tactical-amber shadow-[0_0_10px_rgba(245,158,11,.15)]'
                    : 'border-white/10 bg-black/45 text-white/50 hover:text-white/80'
                }`}
                title={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
              >
                <Star className={`mr-1 inline ${isFavorite ? 'fill-current' : ''}`} size={12} />
                {isFavorite ? 'SAVED' : 'SAVE'}
              </button>
              <button
                type="button"
                onClick={copyInviteLink}
                className="touch-manipulation rounded-full border border-white/10 bg-black/35 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/65 transition active:scale-[0.98]"
              >
                <Copy className="mr-1 inline" size={12} />
                {inviteStatus === 'copied' ? 'Invite copied — send it to a friend to start talking.' : inviteStatus === 'error' ? 'Copy failed' : 'Share Channel'}
              </button>
                <button
                  type="button"
                  onClick={() => setQrOpen(true)}
                  className="touch-manipulation rounded-full border border-tactical-amber/20 bg-tactical-amber/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-tactical-amber transition active:scale-[0.98]"
                >
                  <QrCode className="mr-1 inline" size={12} />
                  Show QR
                </button>
                <button
                  type="button"
                  onClick={() => setCardOpen(true)}
                  className="touch-manipulation rounded-full border border-tactical-green/20 bg-tactical-green/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-tactical-green transition active:scale-[0.98]"
                >
                  <Share2 className="mr-1 inline" size={12} />
                  Signal Card
                </button>
              </div>
</div>
          <div className="relative flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-tactical-green/60">
                CHANNEL {channelLabels[radio.channelNumber] && <span className="text-white/40">— {channelLabels[radio.channelNumber]}</span>}
              </p>
              <h2 className="font-mono text-6xl font-bold leading-none tracking-[0.06em] text-tactical-green drop-shadow-[0_0_16px_rgba(124,255,107,.45)] sm:text-7xl">
                <span className="mr-2 text-2xl tracking-[0.18em] text-tactical-green/65">CH</span>{radio.channelNumber}
              </h2>
              {roomVibes && roomVibes[radio.channelNumber] && (
                <p className="mt-1 inline-flex rounded-full border border-tactical-amber/30 bg-tactical-amber/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-tactical-amber">
                  {roomVibes[radio.channelNumber]}
                </p>
              )}
            </div>
            <div className="mb-2 text-right">
              <SignalBars active={radio.status !== 'OFFLINE'} />
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-tactical-green/55">SIGNAL</p>
            </div>
          </div>
        </section>

        <section className="mt-3 grid grid-cols-3 gap-2">
          <MeterCard label="STATUS" tone={getStatusTone(radio.status)}>{radio.status}</MeterCard>
          <MeterCard label="USERS"><Users className="mr-1 inline" size={14} />{radio.onlineCount}</MeterCard>
          <MeterCard label="MIC" tone={radio.micStatus === 'blocked' ? 'red' : radio.micStatus === 'requesting' ? 'amber' : 'green'}>{radio.micStatus}</MeterCard>
        </section>

        <section className={`mt-3 rounded-2xl border p-3 ${radio.channelLocked ? 'border-tactical-amber/25 bg-tactical-amber/10' : 'border-tactical-green/20 bg-tactical-green/10'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">{radio.isHost ? 'HOST CONTROLS' : 'Channel Status'}</p>
              <p className={`mt-1 font-mono text-xs font-bold uppercase tracking-[0.16em] ${radio.channelLocked ? 'text-tactical-amber' : 'text-tactical-green'}`}>
                {radio.channelLocked ? 'CHANNEL LOCKED' : 'CHANNEL OPEN'}
              </p>
            </div>
            {radio.isHost ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => radio.setChannelLock(!radio.channelLocked)}
                  className="touch-manipulation rounded-xl border border-white/10 bg-black/35 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/75 transition active:scale-[0.98]"
                  title={radio.channelLocked ? 'Unlock Channel' : 'Lock Channel'}
                >
                  {radio.channelLocked ? <Unlock size={14} /> : <Lock size={14} />}
                </button>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="touch-manipulation rounded-xl border border-white/10 bg-black/35 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/75 transition active:scale-[0.98]"
                  title="Share Invite"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setQrOpen(true)}
                  className="touch-manipulation rounded-xl border border-tactical-amber/20 bg-tactical-amber/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-tactical-amber transition active:scale-[0.98]"
                  title="Show QR"
                >
                  <QrCode size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('End this room for everyone?')) {
                      radio.endChannel();
                    }
                  }}
                  className="touch-manipulation rounded-xl border border-tactical-red/30 bg-tactical-red/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-tactical-red transition active:scale-[0.98]"
                  title="End Room"
                >
                  <span className="hidden sm:inline">End Room</span>
                  <span className="sm:hidden">END</span>
                </button>
              </div>
            ) : (
              <div className="rounded-full border border-white/5 bg-black/25 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/40">
                Room controlled by host
              </div>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            {radio.isHost 
              ? "Hosts can lock the channel and manage invites for this live session."
              : "Locking prevents new people from joining. Current users stay connected."}
          </p>
          {!radio.isHost && (
            <p className="hidden mt-1 text-xs leading-relaxed text-white/45 sm:block">
              Recommended MVP group size: up to 8 users for best peer-to-peer audio performance.
            </p>
          )}
          {radio.channelLockError ? (
            <p className="mt-2 rounded-xl border border-tactical-red/25 bg-tactical-red/10 px-3 py-2 text-xs text-tactical-red">{radio.channelLockError}</p>
          ) : null}
        </section>

        <section className="mt-4 space-y-3">
          <Waveform active={waveformActive} busy={radio.status === 'CHANNEL BUSY'} />
          <div className="min-h-12 rounded-2xl border border-white/10 bg-black/30 p-3 text-center font-mono text-xs uppercase tracking-[0.18em] text-white/55">
            {radio.transmittingUser
              ? radio.status === 'CHANNEL BUSY'
                ? `CHANNEL BUSY — ${radio.transmittingUser.username} is on-air`
                : `${radio.transmittingUser.username} is on-air — receiving`
              : 'CHANNEL CLEAR — hold to transmit'}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {radio.users.map((user) => {
            const isMe = user.socketId === radio.socketId;
            const peerStatus = isMe ? `MIC ${radio.micStatus}` : radio.peerStatuses[user.socketId] || 'CONNECTING';
            const peerClass = isMe ? 'border-tactical-green/20 bg-tactical-green/10 text-tactical-green' : peerStatusStyles[peerStatus] || peerStatusStyles.CONNECTING;

            return (
              <div key={user.socketId} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${isMe ? 'bg-tactical-green shadow-signal' : 'bg-white/30'}`} />
                  <span className="truncate font-semibold">{user.username}</span>
                  {user.socketId === radio.hostSocketId ? (
                    <span className="rounded-full border border-tactical-amber/30 bg-tactical-amber/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-tactical-amber">HOST</span>
                  ) : radio.isHost ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove ${user.username} from the channel?`)) {
                          radio.removeUser(user.socketId);
                        }
                      }}
                      className="ml-auto touch-manipulation rounded-full border border-tactical-red/30 bg-tactical-red/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-tactical-red transition active:scale-[0.98]"
                      title="Remove User"
                    >
                      REMOVE
                    </button>
                  ) : null}
                </div>
                <div className={`mt-2 rounded-full border px-2 py-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] ${peerClass}`}>
                  {peerStatus}
                </div>
              </div>
            );
          })}
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
          <div className="bg-white/5 px-3 py-2 flex items-center justify-between border-b border-white/5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Channel Activity</span>
            <span className="h-1.5 w-1.5 rounded-full bg-tactical-green animate-pulse" />
          </div>
          <div className="max-h-40 overflow-y-auto p-2 space-y-1.5 font-mono text-[10px] tracking-tight">
            {radio.events.length > 0 ? (
              radio.events.map((event) => (
                <div key={event.id} className="flex gap-2 leading-tight">
                  <span className="text-white/25 shrink-0">{event.timestamp.split(':')[1]}:{event.timestamp.split(':')[2].split(' ')[0]}</span>
                  <span className={`
                    ${event.tone === 'amber' ? 'text-tactical-amber' : 
                      event.tone === 'red' ? 'text-tactical-red' : 'text-tactical-green/80'}
                  `}>
                    {event.text}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-white/20 text-center py-2 italic font-sans uppercase tracking-widest text-[9px]">
                Waiting for signal...
              </div>
            )}
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Radio Theme</div>
          <div className="grid grid-cols-3 gap-1.5">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onThemeChange(t.id)}
                className={`rounded-lg border px-1 py-2 font-mono text-[8px] font-bold uppercase tracking-[0.1em] transition active:scale-95 ${
                  themeId === t.id
                    ? 'border-tactical-green bg-tactical-green/20 text-tactical-green shadow-signal'
                    : 'border-white/10 bg-black/40 text-white/40 hover:border-white/20'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
            <span>Local Label</span>
            <span className="text-white/25">Device Only</span>
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-white/40">
            Channel labels are saved only on this device.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Gaming Crew"
              maxLength={24}
              value={channelLabels[radio.channelNumber] || ''}
              onChange={(e) => onSetChannelLabel(radio.channelNumber, e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 font-mono text-sm outline-none transition focus:border-tactical-green/40"
            />
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-tactical-amber/20 bg-black/30 p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
            <span>Room Vibe</span>
            <span className="text-white/25">Local Only</span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-white/40">
            Set a fun vibe for this channel — saved only on your device.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Gaming', 'Chilling', 'Event Crew', 'Secret Channel', 'Squad Chat', 'Emergency Mode'].map((vibe) => (
              <button
                key={vibe}
                type="button"
                onClick={() => onSetRoomVibe(radio.channelNumber, roomVibes?.[radio.channelNumber] === vibe ? '' : vibe)}
                className={`touch-manipulation rounded-full border px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] transition active:scale-[0.98] ${
                  roomVibes?.[radio.channelNumber] === vibe
                    ? 'border-tactical-amber/30 bg-tactical-amber/10 text-tactical-amber shadow-[0_0_10px_rgba(245,158,11,.15)]'
                    : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                }`}
              >
                {vibe}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
            <span>Local Stats</span>
            <span className="text-white/25">Device Only</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] uppercase tracking-[0.18em] text-white/40">Channels Joined</p>
              <p className="font-mono text-xl font-bold text-tactical-green">{stats.channelsJoined || 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] uppercase tracking-[0.18em] text-white/40">Transmissions Today</p>
              <p className="font-mono text-xl font-bold text-tactical-green">{stats.transmissionsToday || 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] uppercase tracking-[0.18em] text-white/40">Favorite Channel</p>
              <p className="font-mono text-lg font-bold text-tactical-amber">CH {stats.favoriteChannel || '—'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] uppercase tracking-[0.18em] text-white/40">Last Signal</p>
              <p className="font-mono text-xs font-bold text-white/60">
                {formatTimeAgo(stats.lastSignal)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-white/40">
            Stats are saved locally on this device.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all local stats? This cannot be undone.')) {
                setStats(resetLocalStats());
              }
            }}
            className="mt-2 touch-manipulation rounded-lg border border-tactical-red/20 bg-tactical-red/10 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-tactical-red transition active:scale-95"
          >
            Reset Stats
          </button>
        </section>

        {isOnlyOperator ? (
          <section className="mt-3 rounded-2xl border border-tactical-green/20 bg-tactical-green/10 p-3 text-center">
            <p className="font-mono text-xs uppercase leading-relaxed tracking-[0.14em] text-tactical-green/75">
              You&apos;re live on CH {radio.channelNumber}. Send the signal — first friend to join can talk instantly.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={copyInviteLink}
                className="touch-manipulation rounded-xl border border-white/10 bg-black/35 px-3 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition active:scale-[0.98]"
              >
                <Copy className="mx-auto" size={15} />
                Share
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="touch-manipulation rounded-xl border border-tactical-amber/20 bg-tactical-amber/10 px-3 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-tactical-amber transition active:scale-[0.98]"
              >
                <QrCode className="mx-auto" size={15} />
                QR
              </button>
              <button
                type="button"
                onClick={() => setCardOpen(true)}
                className="touch-manipulation rounded-xl border border-tactical-green/20 bg-tactical-green/10 px-3 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-tactical-green transition active:scale-[0.98]"
              >
                <Share2 className="mx-auto" size={15} />
                Card
              </button>
            </div>
          </section>
        ) : null}

        <div className="flex-1" />

        {radio.error ? <p className="mb-3 rounded-xl border border-tactical-red/30 bg-tactical-red/10 p-3 text-center text-sm text-tactical-red">{radio.error}</p> : null}

        <section className="pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            aria-label="Hold to talk"
            aria-disabled={radio.status === 'CHANNEL BUSY'}
            className={`ptt-button touch-none relative mx-auto grid h-56 w-56 select-none place-items-center rounded-full border transition active:scale-95 sm:h-60 sm:w-60 ${radio.isTransmitting ? 'border-tactical-green bg-tactical-green text-black shadow-signal' : 'border-white/15 bg-gradient-to-br from-[#2d342e] via-[#121913] to-black text-white shadow-[inset_0_10px_25px_rgba(255,255,255,.08),inset_0_-28px_38px_rgba(0,0,0,.65),0_24px_70px_rgba(0,0,0,.6)]'}`}
            {...bindPttHandlers()}
          >
            <span className={`absolute inset-4 rounded-full border ${radio.isTransmitting ? 'border-black/20' : 'border-white/10'}`} />
            <span className={`absolute inset-8 rounded-full ${radio.isTransmitting ? 'bg-black/10' : 'bg-black/35'}`} />
            <span className="relative flex flex-col items-center justify-center gap-3">
              {radio.muted ? <MicOff size={42} /> : <Mic size={46} />}
              <span className="text-2xl font-bold uppercase tracking-[0.16em]">Hold</span>
              <span className="font-mono text-xs uppercase tracking-[0.25em] opacity-70">Push to Talk</span>
            </span>
          </button>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
            Hold Push-to-Talk or Space to speak.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={radio.toggleMute} className="touch-manipulation rounded-2xl border border-white/10 bg-black/45 px-4 py-4 font-bold uppercase tracking-[0.16em] text-white/80 transition active:scale-[0.98]">
              {radio.muted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" onClick={radio.leaveChannel} className="touch-manipulation rounded-2xl border border-tactical-red/30 bg-tactical-red/10 px-4 py-4 font-bold uppercase tracking-[0.16em] text-tactical-red transition active:scale-[0.98]">
              <LogOut className="mr-2 inline" size={17} /> Leave
            </button>
          </div>
        </section>

        {qrOpen ? (
          <section className="absolute inset-0 z-20 grid place-items-center rounded-[2.2rem] bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Channel QR invite">
            <div className="w-full max-w-xs rounded-[1.6rem] border border-tactical-green/30 bg-[#071009] p-4 text-center shadow-2xl shadow-black">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-left">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">QR Invite</p>
                  <p className="font-mono text-xl font-bold uppercase tracking-[0.16em] text-tactical-green">CH {radio.channelNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setQrOpen(false)}
                  className="touch-manipulation rounded-full border border-white/10 bg-black/40 p-2 text-white/70 transition active:scale-[0.98]"
                  aria-label="Close QR invite"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mx-auto grid w-fit place-items-center rounded-2xl border border-tactical-green/25 bg-white p-3">
                <QRCodeSVG value={inviteUrl} size={184} level="M" includeMargin={false} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                Scan to join this internet voice room.
              </p>
              <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-white/40">{inviteUrl}</p>
              <button
                type="button"
                onClick={copyBareInviteLink}
                className="mt-4 touch-manipulation w-full rounded-xl border border-tactical-green/30 bg-tactical-green/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-tactical-green transition active:scale-[0.98]"
              >
                <Copy className="mr-2 inline" size={15} />
                {inviteStatus === 'copied' ? 'Invite copied — send it to a friend to start talking.' : inviteStatus === 'error' ? 'Copy Failed' : 'Copy Link'}
              </button>
            </div>
          </section>
        ) : null}

        {cardOpen ? (
          <section className="absolute inset-0 z-20 grid place-items-center rounded-[2.2rem] bg-black/90 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Signal Card invite">
            <div className="w-full max-w-sm">
              <div className="mb-4 flex items-center justify-between gap-3 text-white">
                <p className="font-mono text-xs uppercase tracking-[0.2em] opacity-60">Signal Card</p>
                <button
                  type="button"
                  onClick={() => setCardOpen(false)}
                  className="touch-manipulation rounded-full border border-white/10 bg-black/40 p-2 transition active:scale-[0.98]"
                >
                  <X size={20} />
                </button>
              </div>

              {/* The Actual Card to Image */}
              <div 
                ref={cardRef}
                className={`relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] border border-tactical-edge bg-gradient-to-b from-[#111b14] to-[#020302] p-8 text-white shadow-2xl ${
                  themeId === 'amber-lcd' ? 'theme-amber-card' :
                  themeId === 'cyber-blue' ? 'theme-blue-card' :
                  themeId === 'emergency-red' ? 'theme-red-card' :
                  themeId === 'retro-radio' ? 'theme-retro-card' : ''
                }`}
              >
                <div className="noise-overlay absolute inset-0 opacity-10" />
                <div className={`absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl ${
                  themeId === 'amber-lcd' ? 'bg-tactical-amber/5' :
                  themeId === 'cyber-blue' ? 'bg-cyan-500/5' :
                  themeId === 'emergency-red' ? 'bg-red-500/5' :
                  'bg-tactical-green/5'
                }`} />
                
                <div className="relative h-full flex flex-col">
                  <header className="mb-6 flex items-center gap-3">
                    <div className={`grid h-12 w-12 place-items-center rounded-xl border shadow-signal ${
                      themeId === 'amber-lcd' ? 'border-tactical-amber/30 bg-tactical-amber/10' :
                      themeId === 'cyber-blue' ? 'border-cyan-400/30 bg-cyan-500/10' :
                      themeId === 'emergency-red' ? 'border-red-400/30 bg-red-500/10' :
                      'border-tactical-green/30 bg-tactical-green/10'
                    }`}>
                      <RadioTower className={
                        themeId === 'amber-lcd' ? 'text-tactical-amber' :
                        themeId === 'cyber-blue' ? 'text-cyan-400' :
                        themeId === 'emergency-red' ? 'text-red-400' :
                        'text-tactical-green'
                      } size={24} />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">Walkie Talking</p>
                      <h3 className="font-bold text-lg uppercase tracking-tight">JOIN MY SIGNAL</h3>
                    </div>
                  </header>

                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-white/50">PUSH TO TALK</p>
                    <div className="relative">
                      <h4 className={`font-mono text-7xl font-bold leading-none tracking-tighter drop-shadow-[0_0_20px_rgba(124,255,107,.4)] ${
                        themeId === 'amber-lcd' ? 'text-tactical-amber drop-shadow-[0_0_20px_rgba(255,191,71,.3)]' :
                        themeId === 'cyber-blue' ? 'text-cyan-400 drop-shadow-[0_0_20px_rgba(71,209,255,.3)]' :
                        themeId === 'emergency-red' ? 'text-red-400 drop-shadow-[0_0_20px_rgba(255,71,71,.3)]' :
                        'text-tactical-green drop-shadow-[0_0_20px_rgba(124,255,107,.4)]'
                      }`}>
                        <span className="mr-2 text-2xl opacity-60">CH</span>{radio.channelNumber}
                      </h4>
                      {channelLabels[radio.channelNumber] && (
                        <p className="mt-4 font-mono text-sm uppercase tracking-widest text-white/60">
                          {channelLabels[radio.channelNumber]}
                        </p>
                      )}
                    </div>
                    <p className="mt-6 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/70">
                      INTERNET ROOM — NOT RF
                    </p>
                  </div>

                  <footer className="mt-auto pt-8 border-t border-white/10 flex flex-col items-center gap-4">
                    <div className="rounded-xl bg-white p-3">
                      <QRCodeSVG value={inviteUrl} size={96} level="M" />
                    </div>
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/60">
                      Scan to join this internet voice room
                    </p>
                    <p className="font-mono text-[7px] text-white/40">
                      {inviteUrl}
                    </p>
                  </footer>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={downloadSignalCard}
                  disabled={inviteStatus === 'generating'}
                  className="touch-manipulation flex w-full items-center justify-center gap-2 rounded-2xl border border-tactical-green/50 bg-tactical-green px-6 py-4 font-bold uppercase tracking-[0.18em] text-black shadow-signal transition active:scale-[0.98] disabled:opacity-60"
                >
                  {inviteStatus === 'generating' ? (
                    'Generating Card...'
                  ) : inviteStatus === 'downloaded' ? (
                    <>
                      <Download size={20} />
                      Card Saved
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      Download Card
                    </>
                  )}
                </button>
                <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
                  Ready to share on stories or text
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
