import { useMemo, useEffect, useState, useCallback } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EntryScreen } from './components/EntryScreen';
import { WalkieInterface } from './components/WalkieInterface';
import { useWalkieTalkie } from './hooks/useWalkieTalkie';
import { getChannelValidation, sanitizeChannelInput } from './lib/channels';
import { toggleFavoriteChannel, isChannelFavorite } from './lib/favoriteChannels';
import { getChannelLabels, saveChannelLabel } from './lib/channelLabels';
import { saveRoomVibe as saveRoomVibes, getAllRoomVibes } from './lib/roomVibes';
import { incrementChannelsJoined } from './lib/localStats';

const DEFAULT_CHANNEL = '272';

function getInitialChannelInput() {
  const params = new URLSearchParams(window.location.search);
  const channelParam = params.get('channel');
  
  // No channel param: use default
  if (channelParam === null) {
    return DEFAULT_CHANNEL;
  }
  
  // Channel param exists: sanitize and validate
  const sanitizedChannel = sanitizeChannelInput(channelParam);
  const validation = getChannelValidation(sanitizedChannel);
  
  // Valid param: use it (preserves leading zeros since sanitizedChannel is a string)
  if (validation.valid) {
    return sanitizedChannel;
  }
  
  // Invalid param: return empty string to force validation error
  // Do NOT fall back to DEFAULT_CHANNEL
  return '';
}

function getHasInvalidInviteParam() {
  const params = new URLSearchParams(window.location.search);
  const channelParam = params.get('channel');
  
  // No channel param: no invalid invite
  if (channelParam === null) {
    return false;
  }
  
  // Channel param exists but is invalid after sanitization
  const sanitizedChannel = sanitizeChannelInput(channelParam);
  const validation = getChannelValidation(sanitizedChannel);
  
  return !validation.valid;
}

export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('walkieTalking.username') || '');
  const [channelInput, setChannelInput] = useState(getInitialChannelInput);
  const [hasInvalidInviteParam, setHasInvalidInviteParam] = useState(getHasInvalidInviteParam);
  const [channelLabels, setChannelLabels] = useState(getChannelLabels);
  const [roomVibes, setRoomVibes] = useState(getAllRoomVibes);
  const [isTuning, setIsTuning] = useState(false);
  const [tuningStage, setTuningStage] = useState('');
  const radio = useWalkieTalkie();

  const channelValidation = useMemo(() => getChannelValidation(channelInput), [channelInput]);

  useEffect(() => {
    if (isTuning && radio.joinStatus) {
      setTuningStage(radio.joinStatus);
    }
  }, [isTuning, radio.joinStatus]);

  function updateChannelInput(value) {
    const sanitized = sanitizeChannelInput(value);
    setChannelInput(sanitized);
    // User is typing: clear the invalid invite flag since they're actively correcting
    if (hasInvalidInviteParam && sanitized !== channelInput) {
      setHasInvalidInviteParam(false);
    }
  }

  async function handleJoin(event) {
    event?.preventDefault?.();
    if (!channelValidation.valid || isTuning) return;

    setIsTuning(true);
    setTuningStage(radio.joinStatus || 'SCANNING CHANNEL');
    let transitionTimer;
    let syncTimer;
    
    try {
      localStorage.setItem('walkieTalking.username', username.trim());
      
      const joinPromise = radio.joinChannel({
        username: username.trim() || 'Operator',
        channelNumber: channelInput,
      });

      transitionTimer = setTimeout(() => setTuningStage('LOCKING SIGNAL'), 180);
      syncTimer = setTimeout(() => setTuningStage('SYNCING OPERATORS'), 420);

      await joinPromise;
      
      setTuningStage('ROOM LINKED');
      
      incrementChannelsJoined(channelInput);
    } catch (err) {
      console.error('[Join] error during tuning', err);
    } finally {
      if (transitionTimer) clearTimeout(transitionTimer);
      if (syncTimer) clearTimeout(syncTimer);
      console.log('[Join] tuning reset', { channelNumber: channelInput });
      setIsTuning(false);
      setTuningStage('');
    }
  }

  function handleToggleFavorite(channel) {
    toggleFavoriteChannel(channel);
  }

  const handleToggleCurrentFavorite = useCallback(() => {
    toggleFavoriteChannel(radio.channelNumber);
  }, [radio.channelNumber]);

  function handleSetChannelLabel(channel, label) {
    const nextLabels = saveChannelLabel(channel, label);
    setChannelLabels(nextLabels);
  }

  function handleSetRoomVibe(channel, vibe) {
    const nextVibes = saveRoomVibes(channel, vibe);
    setRoomVibes(nextVibes);
  }

  if (!radio.joined) {
    return (
      <ErrorBoundary>
        <EntryScreen
          username={username}
          setUsername={setUsername}
          channelInput={channelInput}
          setChannelInput={updateChannelInput}
          onJoin={handleJoin}
          error={radio.error}
          channelValidation={channelValidation}
          hasInvalidInviteParam={hasInvalidInviteParam}
          isTuning={isTuning}
          micStatus={radio.micStatus}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={isChannelFavorite(channelInput)}
          tuningStage={tuningStage}
          joinStatus={radio.joinStatus}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <WalkieInterface 
        radio={radio} 
        isFavorite={isChannelFavorite(radio.channelNumber)}
        onToggleFavorite={handleToggleCurrentFavorite}
        channelLabels={channelLabels}
        onSetChannelLabel={handleSetChannelLabel}
        roomVibes={roomVibes}
        onSetRoomVibe={handleSetRoomVibe}
      />
    </ErrorBoundary>
  );
}
