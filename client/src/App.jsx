import { useMemo, useState, useEffect } from 'react';
import { EntryScreen } from './components/EntryScreen';
import { WalkieInterface } from './components/WalkieInterface';
import { useWalkieTalkie } from './hooks/useWalkieTalkie';
import { getChannelValidation, sanitizeChannelInput } from './lib/channels';
import { clearRecentChannels, getRecentChannels, saveRecentChannel } from './lib/recentChannels';
import { getFavoriteChannels, toggleFavoriteChannel, isChannelFavorite } from './lib/favoriteChannels';

import { getChannelLabels, saveChannelLabel } from './lib/channelLabels';

const THEMES = [
  { id: 'tactical-green', name: 'Tactical Green', class: '' },
  { id: 'amber-lcd', name: 'Amber LCD', class: 'theme-amber' },
  { id: 'cyber-blue', name: 'Cyber Blue', class: 'theme-blue' },
  { id: 'emergency-red', name: 'Emergency Red', class: 'theme-red' },
  { id: 'stealth-black', name: 'Stealth Black', class: 'theme-stealth' },
  { id: 'retro-radio', name: 'Retro Radio', class: 'theme-retro' },
];

function getInitialTheme() {
  return localStorage.getItem('walkieTalking.theme') || 'tactical-green';
}

const TUNING_DURATION_MS = 720;
const DEFAULT_CHANNEL = '272';

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getInitialChannelInput() {
  const channelParam = new URLSearchParams(window.location.search).get('channel');
  const sanitizedChannel = sanitizeChannelInput(channelParam);

  if (getChannelValidation(sanitizedChannel).valid) return sanitizedChannel;
  return DEFAULT_CHANNEL;
}

export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('walkieTalking.username') || '');
  const [themeId, setThemeId] = useState(getInitialTheme);
  const theme = useMemo(() => THEMES.find(t => t.id === themeId) || THEMES[0], [themeId]);

  useEffect(() => {
    localStorage.setItem('walkieTalking.theme', themeId);
    document.body.className = theme.class;
    // Update body background immediately
    document.documentElement.className = theme.class;
  }, [themeId, theme.class]);

  const [channelInput, setChannelInput] = useState(getInitialChannelInput);
  const [recentChannels, setRecentChannels] = useState(getRecentChannels);
  const [favoriteChannels, setFavoriteChannels] = useState(getFavoriteChannels);
  const [channelLabels, setChannelLabels] = useState(getChannelLabels);
  const [isTuning, setIsTuning] = useState(false);
  const [tuningStage, setTuningStage] = useState('');
  const radio = useWalkieTalkie();

  const channelValidation = useMemo(() => getChannelValidation(channelInput), [channelInput]);

  function updateChannelInput(value) {
    setChannelInput(sanitizeChannelInput(value));
  }

  function handleRecentChannelSelect(channel) {
    if (isTuning) return;
    setChannelInput(channel);
  }

  function handleClearRecentChannels() {
    if (isTuning) return;
    setRecentChannels(clearRecentChannels());
  }

  async function handleJoin(event) {
    event.preventDefault();
    if (!channelValidation.valid || isTuning) return;

    setIsTuning(true);
    setTuningStage('VALIDATING CHANNEL');
    
    try {
      localStorage.setItem('walkieTalking.username', username.trim());
      // Small pause for "intentional" feel without slowing it down significantly
      await wait(180);
      setTuningStage('REQUESTING MIC');
      
      const joinPromise = radio.joinChannel({
        username: username.trim() || 'Operator',
        channelNumber: channelInput,
      });

      // Update tuning text based on progress
      const transitionTimer = setTimeout(() => setTuningStage('LINKING ROOM'), 400);
      const syncTimer = setTimeout(() => setTuningStage('SYNCING SIGNAL'), 900);
      const readyTimer = setTimeout(() => setTuningStage('READY'), 1400);

      await joinPromise;
      
      clearTimeout(transitionTimer);
      clearTimeout(syncTimer);
      clearTimeout(readyTimer);

      setTuningStage('READY');
      await wait(TUNING_DURATION_MS / 3);
      
      setRecentChannels(saveRecentChannel(channelInput));
    } catch (err) {
      console.error('[Join] error during tuning', err);
      // useWalkieTalkie already sets the error state
    } finally {
      console.log('[Join] tuning reset', { channelNumber: channelInput });
      setIsTuning(false);
      setTuningStage('');
    }
  }

  function handleToggleFavorite(channel) {
    const nextFavs = toggleFavoriteChannel(channel);
    setFavoriteChannels(nextFavs);
  }

  function handleSetChannelLabel(channel, label) {
    const nextLabels = saveChannelLabel(channel, label);
    setChannelLabels(nextLabels);
  }

  if (!radio.joined) {
    return (
      <EntryScreen
        username={username}
        setUsername={setUsername}
        channelInput={channelInput}
        setChannelInput={updateChannelInput}
        onJoin={handleJoin}
        error={radio.error}
        channelValidation={channelValidation}
        isTuning={isTuning}
        micStatus={radio.micStatus}
        recentChannels={recentChannels}
        favoriteChannels={favoriteChannels}
        onRecentChannelSelect={handleRecentChannelSelect}
        onClearRecentChannels={handleClearRecentChannels}
        onToggleFavorite={handleToggleFavorite}
        isFavorite={isChannelFavorite(channelInput)}
        channelLabels={channelLabels}
        onSetChannelLabel={handleSetChannelLabel}
        tuningStage={tuningStage}
        themeId={themeId}
        themes={THEMES}
        onThemeChange={setThemeId}
      />
    );
  }

  return (
    <WalkieInterface 
      radio={radio} 
      isFavorite={isChannelFavorite(radio.channelNumber)}
      onToggleFavorite={() => handleToggleFavorite(radio.channelNumber)}
      channelLabels={channelLabels}
      onSetChannelLabel={handleSetChannelLabel}
      themeId={themeId}
      themes={THEMES}
      onThemeChange={setThemeId}
    />
  );
}
