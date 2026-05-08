import { useEffect, useRef, useState } from 'react';
import { BatteryFull, Copy, Lock, LogOut, Mic, MicOff, RadioTower, Unlock, Users } from 'lucide-react';
import { Waveform } from './Waveform';
import { shareInviteLink } from '../lib/invite';

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

function MeterCard({ label, children, tone = 'green' }) {
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
  return 'green';
}

export function WalkieInterface({ radio }) {
  const [inviteStatus, setInviteStatus] = useState('idle');
  const inviteTimerRef = useRef(null);
  const statusClass = statusStyles[radio.status] || statusStyles.OFFLINE;
  const waveformActive = radio.isTransmitting || radio.status === 'RECEIVING' || radio.status === 'CHANNEL BUSY';
  const isOnlyOperator = radio.joined && radio.onlineCount <= 1;

  useEffect(() => () => {
    if (inviteTimerRef.current) window.clearTimeout(inviteTimerRef.current);
  }, []);

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

        <section className="lcd-glass relative overflow-hidden rounded-[1.7rem] border border-tactical-green/25 bg-[#8dff6a]/10 p-4 shadow-signal">
          <div className="absolute inset-0 animate-scan bg-gradient-to-b from-transparent via-white/8 to-transparent" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-tactical-green/25" />
          <div className="relative mb-2 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-full border border-tactical-green/20 bg-black/25 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-tactical-green/70">
              Internet room code — not RF
            </div>
            <button
              type="button"
              onClick={copyInviteLink}
              className="touch-manipulation rounded-full border border-white/10 bg-black/35 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/65 transition active:scale-[0.98]"
            >
              <Copy className="mr-1 inline" size={12} />
              {inviteStatus === 'copied' ? 'Invite copied — send it to a friend to start talking.' : inviteStatus === 'error' ? 'Copy failed' : 'Share Channel'}
            </button>
          </div>
          <div className="relative flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-tactical-green/60">CHANNEL</p>
              <h2 className="font-mono text-6xl font-bold leading-none tracking-[0.06em] text-tactical-green drop-shadow-[0_0_16px_rgba(124,255,107,.45)] sm:text-7xl">
                <span className="mr-2 text-2xl tracking-[0.18em] text-tactical-green/65">CH</span>{radio.channelNumber}
              </h2>
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
          <MeterCard label="BATTERY"><BatteryFull className="mr-1 inline" size={14} />98%</MeterCard>
        </section>

        <section className={`mt-3 rounded-2xl border p-3 ${radio.channelLocked ? 'border-tactical-amber/25 bg-tactical-amber/10' : 'border-tactical-green/20 bg-tactical-green/10'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">Channel Control</p>
              <p className={`mt-1 font-mono text-xs font-bold uppercase tracking-[0.16em] ${radio.channelLocked ? 'text-tactical-amber' : 'text-tactical-green'}`}>
                {radio.channelLocked ? 'CHANNEL LOCKED' : 'CHANNEL OPEN'}
              </p>
            </div>
            {radio.isHost ? (
              <button
                type="button"
                onClick={() => radio.setChannelLock(!radio.channelLocked)}
                className="touch-manipulation rounded-xl border border-white/10 bg-black/35 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/75 transition active:scale-[0.98]"
              >
                {radio.channelLocked ? <Unlock className="mr-1 inline" size={13} /> : <Lock className="mr-1 inline" size={13} />}
                {radio.channelLocked ? 'Unlock Channel' : 'Lock Channel'}
              </button>
            ) : null}
          </div>
          <p className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-white/40">
            Locking prevents new people from joining. Current users stay connected.
          </p>
          <p className="mt-1 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-white/40">
            Recommended MVP group size: up to 8 users for best peer-to-peer audio performance.
          </p>
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
                  ) : null}
                </div>
                <div className={`mt-2 rounded-full border px-2 py-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] ${peerClass}`}>
                  {peerStatus}
                </div>
              </div>
            );
          })}
        </section>

        {isOnlyOperator ? (
          <section className="mt-3 rounded-2xl border border-tactical-green/20 bg-tactical-green/10 p-3 text-center">
            <p className="font-mono text-xs uppercase leading-relaxed tracking-[0.14em] text-tactical-green/75">
              You’re live on CH {radio.channelNumber}. Send this invite — the first friend to join can talk instantly.
            </p>
            <button
              type="button"
              onClick={copyInviteLink}
              className="mt-3 touch-manipulation rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white/75 transition active:scale-[0.98]"
            >
              <Copy className="mr-2 inline" size={15} />
              {inviteStatus === 'copied' ? 'Invite copied — send it to a friend to start talking.' : inviteStatus === 'error' ? 'Copy Failed' : 'Share Channel'}
            </button>
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

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={radio.toggleMute} className="touch-manipulation rounded-2xl border border-white/10 bg-black/45 px-4 py-4 font-bold uppercase tracking-[0.16em] text-white/80 transition active:scale-[0.98]">
              {radio.muted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" onClick={radio.leaveChannel} className="touch-manipulation rounded-2xl border border-tactical-red/30 bg-tactical-red/10 px-4 py-4 font-bold uppercase tracking-[0.16em] text-tactical-red transition active:scale-[0.98]">
              <LogOut className="mr-2 inline" size={17} /> Leave
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
