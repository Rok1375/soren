import { useEffect, useRef, useState } from 'react';
import { Copy, Delete, Dice5, Radio, Shield, SignalHigh, Star, Users } from 'lucide-react';
import { createRandomChannel, getChannelCategory } from '../lib/channels';
import { shareInviteLink } from '../lib/invite';

const keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const callsignPresets = ['Ghost', 'Raven', 'Echo', 'Nova', 'Agent 007', 'Static', 'Night Owl', 'Chaos'];
const IGNORED_HELPER_MS = 1600;

const randomCallsignPrefixes = ['Raven', 'Ghost', 'Echo', 'Nova', 'Static', 'Shadow', 'Viper', 'Phoenix'];
function generateRandomCallsign() {
  const prefix = randomCallsignPrefixes[Math.floor(Math.random() * randomCallsignPrefixes.length)];
  const num = Math.floor(Math.random() * 100);
  return `${prefix}-${String(num).padStart(2, '0')}`;
}

export function EntryScreen({
  username,
  setUsername,
  channelInput,
  setChannelInput,
  onJoin,
  error,
  channelValidation,
  hasInvalidInviteParam,
  isTuning,
  tuningStage,
  joinStatus,
  micStatus,
  onToggleFavorite,
  isFavorite,
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
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-3 py-4 font-display text-white sm:px-4 sm:py-5 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="noise-overlay absolute inset-0" />
      <div className="absolute -top-28 h-72 w-72 rounded-full bg-tactical-green/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-tactical-edge bg-tactical-panel/90 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-4">
        <div className="rounded-[1.45rem] border border-white/10 bg-gradient-to-b from-white/8 to-black/40 p-3 shadow-insetPanel sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="hidden font-mono text-xs uppercase tracking-[0.35em] text-tactical-green/70 sm:block">Digital Internet Radio</p>
              <h1 className="mt-1 text-3xl font-bold uppercase leading-none tracking-tight sm:mt-2 sm:text-4xl">Walkie Talking</h1>
              <p className="mt-2 max-w-[18rem] text-xs leading-relaxed text-white/72 sm:text-sm">
                Instant push-to-talk voice rooms. Enter a channel code, share the link, and talk live in your browser — no app install.
              </p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-tactical-green/30 bg-tactical-green/10 shadow-signal">
              <Radio className="text-tactical-green" size={28} />
            </div>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-[0.18em] text-white/55">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3"><SignalHigh className="mx-auto mb-1 text-tactical-green" size={18} />Internet</div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3"><Users className="mx-auto mb-1 text-tactical-green" size={18} />Rooms</div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3"><Shield className="mx-auto mb-1 text-tactical-green" size={18} />PTT Lock</div>
          </div>

          <form className="space-y-3" onSubmit={onJoin}>
            <label className="block">
              <span className="mb-1.5 block font-mono text-xs uppercase tracking-[0.24em] text-white/50">Operator name</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Callsign"
                maxLength={24}
                disabled={isTuning}
                className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 font-mono text-lg outline-none ring-tactical-green/40 transition focus:border-tactical-green/60 focus:ring-4 disabled:opacity-60"
              />
            </label>

            <div className="flex flex-wrap gap-1.5 overflow-hidden">
              {callsignPresets.map((callsign) => (
                <button
                  key={callsign}
                  type="button"
                  onClick={() => setUsername(callsign)}
                  disabled={isTuning}
                  className="touch-manipulation rounded-lg border border-white/5 bg-white/5 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 transition hover:border-tactical-green/30 hover:bg-tactical-green/5 hover:text-tactical-green active:scale-95 disabled:opacity-30"
                  aria-label={`Use callsign ${callsign}`}
                >
                  {callsign}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUsername(generateRandomCallsign())}
                disabled={isTuning}
                className="touch-manipulation rounded-lg border border-tactical-amber/20 bg-tactical-amber/10 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-tactical-amber transition hover:bg-tactical-amber/20 active:scale-95 disabled:opacity-30"
                aria-label="Generate random callsign"
              >
                🎲 Random
              </button>
            </div>

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
                      className="w-full bg-transparent text-right font-mono text-5xl font-bold leading-none tracking-[0.08em] text-tactical-green outline-none placeholder:text-tactical-green/20 disabled:opacity-80 sm:text-6xl"
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
                  : hasInvalidInviteParam
                    ? 'Invalid invite link. Channels must be 3–6 digits.'
                    : ignoredInvalidInput
                      ? 'Numbers only — letters and symbols are ignored.'
                      : isTuning
                        ? joinStatus || tuningStage || `Tuning virtual room ${channelInput}...`
                        : channelValidation.message}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {keypadDigits.map((digit) => (
                  <button
                    type="button"
                    key={digit}
                    onClick={() => appendDigit(digit)}
                    disabled={isTuning || channelInput.length >= 6}
                    className="touch-manipulation rounded-xl border border-white/10 bg-[#101712] py-2.5 font-mono text-2xl font-bold text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition active:scale-95 disabled:opacity-35 sm:py-3"
                    aria-label={`Add digit ${digit}`}
                  >
                    {digit}
                  </button>
                ))}
                <button type="button" onClick={deleteDigit} disabled={isTuning || !channelInput} className="touch-manipulation rounded-xl border border-tactical-amber/20 bg-tactical-amber/10 py-2.5 font-mono font-bold text-tactical-amber transition active:scale-95 disabled:opacity-35 sm:py-3" aria-label="Delete last digit">
                  <Delete className="mx-auto" size={22} />
                </button>
                <button type="button" onClick={randomizeChannel} disabled={isTuning} className="touch-manipulation col-span-2 rounded-xl border border-tactical-green/25 bg-tactical-green/10 py-2.5 font-mono text-sm font-bold uppercase tracking-[0.16em] text-tactical-green transition active:scale-95 disabled:opacity-35 sm:py-3" aria-label="Generate random channel">
                  <Dice5 className="mr-2 inline" size={18} /> Random CH
                </button>
              </div>

              <button
                type="button"
                onClick={copyInviteLink}
                disabled={!channelValidation.valid || isTuning}
                className="mt-3 touch-manipulation w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white/70 transition active:scale-[0.98] disabled:opacity-35"
                aria-label="Copy invite link to share with others"
              >
                <Copy className="mr-2 inline" size={15} />
                {inviteStatus === 'copied' ? 'Invite copied — send it to a friend to start talking.' : inviteStatus === 'error' ? 'Copy Failed' : 'Copy Invite Link'}
              </button>

              {channelValidation.valid && !isTuning && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(channelInput)}
                  className={`mt-2 touch-manipulation w-full rounded-xl border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition active:scale-[0.98] ${
                    isFavorite 
                      ? 'border-tactical-amber/30 bg-tactical-amber/10 text-tactical-amber' 
                      : 'border-white/5 bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                  aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                >
                  <Star className={`mr-2 inline ${isFavorite ? 'fill-current' : ''}`} size={14} />
                  {isFavorite ? 'Saved to Favorites' : 'Save as Favorite'}
                </button>
              )}
            </section>

            <button
              type="submit"
              disabled={!channelValidation.valid || isTuning}
              className="touch-manipulation w-full rounded-2xl border border-tactical-green/50 bg-tactical-green px-5 py-4 text-lg font-bold uppercase tracking-[0.22em] text-black shadow-signal transition active:scale-[0.98] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none sm:py-4"
              aria-label={isRequestingMic ? 'Requesting microphone access' : isTuning ? 'Joining channel' : 'Join channel'}
            >
              {isRequestingMic ? 'Requesting Mic...' : isTuning ? 'Tuning...' : 'Join Channel'}
            </button>
          </form>

          <section className="mt-3 rounded-2xl border border-tactical-amber/25 bg-gradient-to-b from-tactical-amber/10 to-black/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] sm:mt-4">
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-tactical-amber">
              <Shield size={16} />
              Microphone Permission
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/68">
              Mic access is required. Your mic only transmits while Push-to-Talk is held.
            </p>
            <p className="hidden mt-2 text-sm leading-relaxed text-white/55 sm:block">
              Your browser will ask for microphone access when you join. Your mic stays muted until you hold Push-to-Talk.
            </p>
          </section>

          {error ? (
            <div className="rounded-xl border border-tactical-red/30 bg-tactical-red/10 p-3 text-sm text-tactical-red">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => onJoin()}
                disabled={!channelValidation.valid || isTuning}
                className="mt-3 touch-manipulation rounded-lg border border-tactical-red/30 bg-tactical-red/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-tactical-red transition active:scale-95 disabled:opacity-35"
              >
                Try Again
              </button>
            </div>
          ) : null}


        </div>
      </section>
    </main>
  );
}
