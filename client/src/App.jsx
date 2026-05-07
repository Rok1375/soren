import { useMemo, useState } from 'react';
import { EntryScreen } from './components/EntryScreen';
import { WalkieInterface } from './components/WalkieInterface';
import { useWalkieTalkie } from './hooks/useWalkieTalkie';
import { getChannelValidation, sanitizeChannelInput } from './lib/channels';

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
  const [username, setUsername] = useState('');
  const [channelInput, setChannelInput] = useState(getInitialChannelInput);
  const [isTuning, setIsTuning] = useState(false);
  const radio = useWalkieTalkie();

  const channelValidation = useMemo(() => getChannelValidation(channelInput), [channelInput]);

  function updateChannelInput(value) {
    setChannelInput(sanitizeChannelInput(value));
  }

  async function handleJoin(event) {
    event.preventDefault();
    if (!channelValidation.valid || isTuning) return;

    setIsTuning(true);
    try {
      await Promise.all([
        radio.joinChannel({
          username: username.trim() || 'Operator',
          channelNumber: channelInput,
        }),
        wait(TUNING_DURATION_MS),
      ]);
    } finally {
      setIsTuning(false);
    }
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
      />
    );
  }

  return <WalkieInterface radio={radio} />;
}
