import { getChannelValidation } from './channels.js';

const FAVORITE_CHANNELS_KEY = 'walkieTalking.favoriteChannels';
const MAX_FAVORITE_CHANNELS = 10;

function normalizeFavorites(value) {
  if (!Array.isArray(value)) return [];

  const uniqueChannels = [];
  value.forEach((channel) => {
    const channelString = String(channel ?? '');
    if (!getChannelValidation(channelString).valid) return;
    if (uniqueChannels.includes(channelString)) return;
    uniqueChannels.push(channelString);
  });

  return uniqueChannels.slice(0, MAX_FAVORITE_CHANNELS);
}

export function getFavoriteChannels() {
  try {
    const storedChannels = JSON.parse(window.localStorage.getItem(FAVORITE_CHANNELS_KEY) || '[]');
    return normalizeFavorites(storedChannels);
  } catch {
    return [];
  }
}

export function toggleFavoriteChannel(channel) {
  const channelString = String(channel ?? '');
  if (!getChannelValidation(channelString).valid) return getFavoriteChannels();

  const currentFavorites = getFavoriteChannels();
  const isFavorite = currentFavorites.includes(channelString);

  let nextFavorites;
  if (isFavorite) {
    nextFavorites = currentFavorites.filter((c) => c !== channelString);
  } else {
    nextFavorites = normalizeFavorites([channelString, ...currentFavorites]);
  }

  try {
    window.localStorage.setItem(FAVORITE_CHANNELS_KEY, JSON.stringify(nextFavorites));
  } catch {
    // Storage can fail in private/restricted modes.
  }

  return nextFavorites;
}

export function isChannelFavorite(channel) {
  const channelString = String(channel ?? '');
  return getFavoriteChannels().includes(channelString);
}
