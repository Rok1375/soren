import { getChannelValidation } from './channels.js';

const RECENT_CHANNELS_KEY = 'walkieTalking.recentChannels';
const MAX_RECENT_CHANNELS = 5;

function normalizeRecentChannels(value) {
  if (!Array.isArray(value)) return [];

  const uniqueChannels = [];
  value.forEach((channel) => {
    const channelString = String(channel ?? '');
    if (!getChannelValidation(channelString).valid) return;
    if (uniqueChannels.includes(channelString)) return;
    uniqueChannels.push(channelString);
  });

  return uniqueChannels.slice(0, MAX_RECENT_CHANNELS);
}

export function getRecentChannels() {
  try {
    const storedChannels = JSON.parse(window.localStorage.getItem(RECENT_CHANNELS_KEY) || '[]');
    return normalizeRecentChannels(storedChannels);
  } catch {
    return [];
  }
}

export function saveRecentChannel(channel) {
  const channelString = String(channel ?? '');
  if (!getChannelValidation(channelString).valid) return getRecentChannels();

  const nextChannels = normalizeRecentChannels([
    channelString,
    ...getRecentChannels().filter((recentChannel) => recentChannel !== channelString),
  ]);

  try {
    window.localStorage.setItem(RECENT_CHANNELS_KEY, JSON.stringify(nextChannels));
  } catch {
    // Storage can fail in private/restricted browser modes; keep the app flow unchanged.
  }

  return nextChannels;
}

export function clearRecentChannels() {
  try {
    window.localStorage.removeItem(RECENT_CHANNELS_KEY);
  } catch {
    // Ignore storage failures; clearing recents is a UI convenience only.
  }

  return [];
}
