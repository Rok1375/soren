import { useEffect, useRef, useState } from 'react';
import { Copy, Delete, Dice5, Radio, Shield, SignalHigh, Star, Users } from 'lucide-react';
import { createRandomChannel, getChannelCategory } from '../lib/channels';
import { shareInviteLink } from '../lib/invite';

const keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const callsignPresets = ['Ghost', 'Raven', 'Echo', 'Nova', 'Agent 007', 'Static', 'Night Owl', 'Chaos'];
const useCaseChips = ['Friends', 'Gaming', 'Events', 'Crews', 'Family', 'Fitness Teams'];
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
  micStatus,
  recentChannels,
  onRecentChannelSelect,
  onClearRecentChannels,
  favoriteChannels,
  onToggleFavorite,
  isFavorite,
  channelLabels,
  themeId,
  themes,
  onThemeChange,
}) {
  const [ignoredInvalidInput, setIgnoredInvalidInput] = useState(false);
  const [inviteStatus, setInviteStatus] = useState('idle');
  const [qaOpen, setQaOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [qaChecks, setQaChecks] = useState(() => {
    try {
      const saved = localStorage.getItem('walkieTalking.qaChecks');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('walkieTalking.qaChecks', JSON.stringify(qaChecks));
  }, [qaChecks]);

  const toggleQaCheck = (id) => {
    setQaChecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const qaItems = [
    { id: 'health', label: 'Open backend health' },
    { id: 'ch272', label: 'Join Channel 272' },
    { id: 'ch007', label: 'Join Channel 007' },
    { id: 'users2', label: 'Confirm USERS 2' },
    { id: 'a2b', label: 'Test Alpha to Bravo audio' },
    { id: 'b2a', label: 'Test Bravo to Alpha audio' },
    { id: 'busy', label: 'Test CHANNEL BUSY' },
    { id: 'lock', label: 'Test Lock Channel' },
    { id: 'invite', label: 'Test Invite Link' },
    { id: 'cellular', label: 'Test phone on cellular' },
  ];
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
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-3 py-4 font-display text-white sm:px-4 sm:py-5">
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

          <section className="mb-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-tactical-green/80">How it works</p>
              <button
                type="button"
                onClick={() => setHowItWorksOpen(!howItWorksOpen)}
                className="sm:hidden touch-manipulation rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/50 transition active:scale-95"
              >
                {howItWorksOpen ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className={`${howItWorksOpen ? 'block' : 'hidden sm:block'}`}>
              <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] leading-snug text-white/70 sm:text-[13px] sm:text-sm">
                <li>1. Pick a channel code.</li>
                <li>2. Share the invite link.</li>
                <li>3. Hold Push-to-Talk to speak.</li>
                <li>4. Release to listen.</li>
              </ol>
              <div className="mt-2 flex flex-wrap gap-1 sm:mt-3" aria-label="Common Walkie Talking use cases">
                {useCaseChips.map((chip) => (
                  <span key={chip} className="rounded-full border border-tactical-green/15 bg-tactical-green/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-tactical-green/75 sm:px-2.5 sm:py-1 sm:text-[9px]">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </section>

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
                >
                  {callsign}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUsername(generateRandomCallsign())}
                disabled={isTuning}
                className="touch-manipulation rounded-lg border border-tactical-amber/20 bg-tactical-amber/10 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-tactical-amber transition hover:bg-tactical-amber/20 active:scale-95 disabled:opacity-30"
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
                        ? tuningStage || `Tuning virtual room ${channelInput}...`
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
                  >
                    {digit}
                  </button>
                ))}
                <button type="button" onClick={deleteDigit} disabled={isTuning || !channelInput} className="touch-manipulation rounded-xl border border-tactical-amber/20 bg-tactical-amber/10 py-2.5 font-mono font-bold text-tactical-amber transition active:scale-95 disabled:opacity-35 sm:py-3">
                  <Delete className="mx-auto" size={22} />
                </button>
                <button type="button" onClick={randomizeChannel} disabled={isTuning} className="touch-manipulation col-span-2 rounded-xl border border-tactical-green/25 bg-tactical-green/10 py-2.5 font-mono text-sm font-bold uppercase tracking-[0.16em] text-tactical-green transition active:scale-95 disabled:opacity-35 sm:py-3">
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

              {channelValidation.valid && !isTuning && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(channelInput)}
                  className={`mt-2 touch-manipulation w-full rounded-xl border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition active:scale-[0.98] ${
                    isFavorite 
                      ? 'border-tactical-amber/30 bg-tactical-amber/10 text-tactical-amber' 
                      : 'border-white/5 bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
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

          {error ? <p className="rounded-xl border border-tactical-red/30 bg-tactical-red/10 p-3 text-sm text-tactical-red">{error}</p> : null}

          {favoriteChannels?.length ? (
              <section className="rounded-2xl border border-tactical-amber/15 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
                  <span className="text-white/45">Favorite Channels</span>
                  <Star size={12} className="text-tactical-amber/60" />
                </div>
                <p className="mb-3 text-[11px] leading-relaxed text-white/40">
                  Favorite channels are saved on this device.
                </p>
                <div className="flex flex-wrap gap-2">
                  {favoriteChannels.map((channel) => (
                    <div key={channel} className="flex overflow-hidden rounded-full border border-tactical-amber/20 bg-tactical-amber/5 transition-colors hover:bg-tactical-amber/10">
                      <button
                        type="button"
                        onClick={() => onRecentChannelSelect(channel)}
                        disabled={isTuning}
                        className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-tactical-amber transition active:scale-[0.98] disabled:opacity-35"
                      >
                        CH {channel} {channelLabels[channel] && <span className="opacity-50">— {channelLabels[channel]}</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(channel)}
                        disabled={isTuning}
                        className="border-l border-tactical-amber/20 px-2 py-2 text-tactical-amber/40 transition hover:bg-tactical-amber/10 hover:text-tactical-amber active:scale-90"
                        aria-label="Remove favorite"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

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
                <p className="mb-3 text-xs leading-relaxed text-white/50">
                  Local history on this device — not public room discovery. Pick a recent channel to fill the input. It will not auto-join.
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentChannels.map((channel) => (
                    <button
                      type="button"
                      key={channel}
                      onClick={() => onRecentChannelSelect(channel)}
                      disabled={isTuning}
                      className="touch-manipulation rounded-full border border-tactical-green/20 bg-tactical-green/10 px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-tactical-green transition active:scale-[0.98] disabled:opacity-35"
                    >
                      CH {channel} {channelLabels[channel] && <span className="opacity-50">— {channelLabels[channel]}</span>}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

          <section className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-center">
            <p className="text-sm leading-relaxed text-white/68">
              Add Walkie Talking to your home screen for faster access to your channels.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              If your browser supports it, use its Add to Home Screen or Install option. You can keep using the app without installing.
            </p>
          </section>

          <section className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Radio Theme</div>
            <div className="grid grid-cols-3 gap-1.5">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onThemeChange(t.id)}
                  className={`rounded-lg border px-2 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition active:scale-95 ${
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

          <section className="mt-3">
            <button
              type="button"
              onClick={() => setQaOpen(!qaOpen)}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 transition active:scale-[0.98]"
            >
              {qaOpen ? 'Hide QA Checklist' : 'Show QA Checklist'}
            </button>
            {qaOpen && (
              <div className="mt-2 rounded-2xl border border-tactical-amber/20 bg-tactical-amber/5 p-3">
                <p className="mb-3 text-[11px] leading-relaxed text-white/50">
                  Testing on real devices? Use this checklist to verify audio and channel behavior.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {qaItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleQaCheck(item.id)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                        qaChecks[item.id]
                          ? 'border-tactical-green/30 bg-tactical-green/10 text-tactical-green'
                          : 'border-white/5 bg-black/20 text-white/30'
                      }`}
                    >
                      <div className={`h-3 w-3 rounded-sm border ${qaChecks[item.id] ? 'bg-tactical-green border-tactical-green' : 'border-white/20'}`} />
                      <span className="font-mono text-[10px] uppercase tracking-wider">{item.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setQaChecks({})}
                  className="mt-4 w-full rounded-xl border border-white/5 bg-black/20 py-2 font-mono text-[9px] uppercase tracking-widest text-white/25 hover:text-white/40"
                >
                  Reset Checklist
                </button>
              </div>
            )}
          </section>

          <p className="mt-3 text-center text-xs leading-relaxed text-white/45">
            Virtual channel ID only — not RF. Users on the exact same string, like 007, share one code-based internet voice room.
          </p>
        </div>
      </section>
    </main>
  );
}
