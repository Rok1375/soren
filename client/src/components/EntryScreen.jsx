import { useEffect, useRef, useState } from 'react';
import { Copy, Delete, Dice5, Radio, Shield, SignalHigh, Users } from 'lucide-react';
import { createRandomChannel, getChannelCategory } from '../lib/channels';
import { shareInviteLink } from '../lib/invite';

const keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const useCaseChips = ['Friends', 'Gaming', 'Events', 'Crews', 'Family', 'Fitness Teams'];
const IGNORED_HELPER_MS = 1600;

export function EntryScreen({
  username,
  setUsername,
  channelInput,
  setChannelInput,
  onJoin,
  error,
  channelValidation,
  isTuning,
  micStatus,
  recentChannels,
  onRecentChannelSelect,
  onClearRecentChannels,
}) {
  const [ignoredInvalidInput, setIgnoredInvalidInput] = useState(false);
  const [inviteStatus, setInviteStatus] = useState('idle');
  const ignoredTimerRef = useRef(null);
  const inviteTimerRef = useRef(null);
  const channelCategory = getChannelCategory(channelInput);
  const isRequestingMic = micStatus === 'requesting';

  useEffect(() => () => {
    if (ignoredTimerRef.current) window.clearTimeout(ignoredTimerRef.current);
    if (inviteTimerRef.current) window.clearTimeout(inviteTimerRef.current);
  }, []);

  function showIgnoredHelper() {
    if (ignoredTimerRef.current) window.clearTimeout(ignoredTimerRef.current);
    setIgnoredInvalidInput(true);
    ignoredTimerRef.current = window.setTimeout(() => {
      setIgnoredInvalidInput(false);
      ignoredTimerRef.current = null;
    }, IGNORED_HELPER_MS);
  }

  function appendDigit(digit) {
    if (channelInput.length >= 6 || isTuning) return;
    setChannelInput(`${channelInput}${digit}`);
  }

  function deleteDigit() {
    if (isTuning) return;
    setChannelInput(channelInput.slice(0, -1));
  }

  function randomizeChannel() {
    if (isTuning) return;
    setChannelInput(createRandomChannel());
  }

  async function copyInviteLink() {
    if (!channelValidation.valid || isTuning) return;

    try {
      const result = await shareInviteLink(channelInput);
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

  function handleChannelChange(event) {
    if (/\D/.test(event.target.value)) showIgnoredHelper();
    setChannelInput(event.target.value);
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-5 font-display text-white">
      <div className="noise-overlay absolute inset-0" />
      <div className="absolute -top-28 h-72 w-72 rounded-full bg-tactical-green/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-tactical-edge bg-tactical-panel/90 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="rounded-[1.45rem] border border-white/10 bg-gradient-to-b from-white/8 to-black/40 p-4 shadow-insetPanel">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-tactical-green/70">Digital Internet Radio</p>
              <h1 className="mt-2 text-4xl font-bold uppercase leading-none tracking-tight">Walkie Talking</h1>
              <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-white/72">
                Instant push-to-talk voice rooms. Enter a channel code, share the link, and talk live in your browser — no app install.
              </p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-tactical-green/30 bg-tactical-green/10 shadow-signal">
              <Radio className="text-tactical-green" size={28} />
            </div>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-[0.18em] text-white/55">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3"><SignalHigh className="mx-auto mb-1 text-tactical-green" size={18} />Internet</div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3"><Users className="mx-auto mb-1 text-tactical-green" size={18} />Rooms</div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3"><Shield className="mx-auto mb-1 text-tactical-green" size={18} />PTT Lock</div>
          </div>

          <section className="mb-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-tactical-green/80">How it works</p>
            <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm leading-snug text-white/70">
              <li>1. Pick a channel code.</li>
              <li>2. Share the invite link.</li>
              <li>3. Hold Push-to-Talk to speak.</li>
              <li>4. Release to listen.</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Common Walkie Talking use cases">
              {useCaseChips.map((chip) => (
                <span key={chip} className="rounded-full border border-tactical-green/15 bg-tactical-green/10 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-tactical-green/75">
                  {chip}
                </span>
              ))}
            </div>
          </section>

          <form className="space-y-3" onSubmit={onJoin}>
            <label className="block">
              <span className="mb-2 block font-mono text-xs uppercase tracking-[0.24em] text-white/50">Operator name</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Soren"
                maxLength={24}
                disabled={isTuning}
                className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-4 font-mono text-lg outline-none ring-tactical-green/40 transition focus:border-tactical-green/60 focus:ring-4 disabled:opacity-60"
              />
            </label>

            <section className="rounded-[1.4rem] border border-tactical-green/20 bg-black/45 p-3">
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
                <span>CHANNEL</span>
                <span>{channelCategory}</span>
              </div>
              <div className="mb-2 inline-flex rounded-full border border-tactical-green/20 bg-tactical-green/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-tactical-green/70">
                Internet room code — not RF
              </div>
              <p className="mb-3 text-sm leading-relaxed text-white/65">
                Internet room code, not a radio frequency. Anyone with this code or invite link can join while the channel is open.
              </p>

              <div className={`lcd-glass relative overflow-hidden rounded-2xl border px-4 py-4 shadow-signal ${channelValidation.valid ? 'border-tactical-green/35 bg-[#9dff75]/10' : 'border-tactical-amber/35 bg-tactical-amber/10'}`}>
                <div className="absolute inset-0 animate-scan bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-tactical-green/20" />
                <label className="relative block">
                  <span className="sr-only">Channel number</span>
                  <div className="flex items-end justify-between gap-3">
                    <span className="font-mono text-xl font-bold uppercase tracking-[0.2em] text-tactical-green/70">CH</span>
                    <input
                      value={channelInput}
                      onChange={handleChannelChange}
                      onBeforeInput={(event) => {
                        if (event.data && /\D/.test(event.data)) {
                          event.preventDefault();
                          showIgnoredHelper();
                        }
                      }}
                      onPaste={(event) => {
                        const pastedText = event.clipboardData.getData('text');
                        event.preventDefault();
                        if (/\D/.test(pastedText)) showIgnoredHelper();
                        setChannelInput(pastedText);
                      }}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="007"
                      disabled={isTuning}
                      className="w-full bg-transparent text-right font-mono text-6xl font-bold leading-none tracking-[0.08em] text-tactical-green outline-none placeholder:text-tactical-green/20 disabled:opacity-80"
                    />
                    <span className="mb-1 h-12 w-1 animate-blink rounded-full bg-tactical-green shadow-signal" />
                  </div>
                </label>
                {isTuning ? (
                  <div className="relative mt-3 overflow-hidden rounded-full border border-tactical-green/30 bg-black/50 p-1">
                    <div className="h-2 animate-tune rounded-full bg-tactical-green shadow-signal" />
                  </div>
                ) : null}
              </div>

              <p className={`mt-2 min-h-5 font-mono text-xs uppercase tracking-[0.12em] ${channelValidation.valid ? 'text-tactical-green/75' : 'text-tactical-amber'}`}>
                {isRequestingMic
                  ? 'Requesting microphone access...'
                  : ignoredInvalidInput
                    ? 'Numbers only — letters and symbols are ignored.'
                    : isTuning
                      ? `Tuning virtual room ${channelInput}...`
                      : channelValidation.message}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {keypadDigits.map((digit) => (
                  <button
                    type="button"
                    key={digit}
                    onClick={() => appendDigit(digit)}
                    disabled={isTuning || channelInput.length >= 6}
                    className="touch-manipulation rounded-xl border border-white/10 bg-[#101712] py-3 font-mono text-2xl font-bold text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition active:scale-95 disabled:opacity-35"
                  >
                    {digit}
                  </button>
                ))}
                <button type="button" onClick={deleteDigit} disabled={isTuning || !channelInput} className="touch-manipulation rounded-xl border border-tactical-amber/20 bg-tactical-amber/10 py-3 font-mono font-bold text-tactical-amber transition active:scale-95 disabled:opacity-35">
                  <Delete className="mx-auto" size={22} />
                </button>
                <button type="button" onClick={randomizeChannel} disabled={isTuning} className="touch-manipulation col-span-2 rounded-xl border border-tactical-green/25 bg-tactical-green/10 py-3 font-mono text-sm font-bold uppercase tracking-[0.16em] text-tactical-green transition active:scale-95 disabled:opacity-35">
                  <Dice5 className="mr-2 inline" size={18} /> Random CH
                </button>
              </div>

              <button
                type="button"
                onClick={copyInviteLink}
                disabled={!channelValidation.valid || isTuning}
                className="mt-3 touch-manipulation w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white/70 transition active:scale-[0.98] disabled:opacity-35"
              >
                <Copy className="mr-2 inline" size={15} />
                {inviteStatus === 'copied' ? 'Invite copied — send it to a friend to start talking.' : inviteStatus === 'error' ? 'Copy Failed' : 'Copy Invite Link'}
              </button>
            </section>

            {recentChannels?.length ? (
              <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-3 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
                  <span className="text-white/45">Recent Channels</span>
                  <button
                    type="button"
                    onClick={onClearRecentChannels}
                    disabled={isTuning}
                    className="touch-manipulation rounded-full border border-tactical-amber/20 bg-tactical-amber/10 px-3 py-1 font-bold text-tactical-amber/80 transition active:scale-[0.98] disabled:opacity-35"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentChannels.map((channel) => (
                    <button
                      type="button"
                      key={channel}
                      onClick={() => onRecentChannelSelect(channel)}
                      disabled={isTuning}
                      className="touch-manipulation rounded-full border border-tactical-green/20 bg-tactical-green/10 px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-tactical-green transition active:scale-[0.98] disabled:opacity-35"
                    >
                      CH {channel}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {error ? <p className="rounded-xl border border-tactical-red/30 bg-tactical-red/10 p-3 text-sm text-tactical-red">{error}</p> : null}

            <section className="rounded-2xl border border-tactical-amber/25 bg-gradient-to-b from-tactical-amber/10 to-black/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-tactical-amber">
                <Shield size={16} />
                Microphone Permission
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/68">
                Your browser will ask for microphone access when you join a channel. Your mic stays muted until you hold Push-to-Talk.
              </p>
              <p className="mt-2 rounded-xl border border-tactical-green/15 bg-tactical-green/10 px-3 py-2 text-sm leading-relaxed text-white/72">
                Live browser audio. Your mic only transmits while Push-to-Talk is held.
              </p>
              <ul className="mt-3 space-y-1.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-white/50">
                <li>• Mic access is required for live voice.</li>
                <li>• You are not transmitting while in LISTENING mode.</li>
                <li>• Hold Push-to-Talk to speak.</li>
                <li>• Release to return to listening.</li>
                <li>• This is an internet room, not real radio frequency.</li>
              </ul>
            </section>

            <button
              type="submit"
              disabled={!channelValidation.valid || isTuning}
              className="touch-manipulation w-full rounded-2xl border border-tactical-green/50 bg-tactical-green px-5 py-4 text-lg font-bold uppercase tracking-[0.22em] text-black shadow-signal transition active:scale-[0.98] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none"
            >
              {isRequestingMic ? 'Requesting Mic...' : isTuning ? 'Tuning...' : 'Join Channel'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs leading-relaxed text-white/45">
            Virtual channel ID only — not RF. Users on the exact same string, like 007, share one code-based internet voice room.
          </p>
        </div>
      </section>
    </main>
  );
}
