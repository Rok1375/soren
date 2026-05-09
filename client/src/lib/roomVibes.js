const STORAGE_KEY = 'walkieTalking.roomVibes';

/**
 * Get the saved room vibe for a channel.
 * @param {string} channelNumber 
 * @returns {string|null} The saved vibe or null
 */
export function getRoomVibe(channelNumber) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const vibes = saved ? JSON.parse(saved) : {};
    return vibes[channelNumber] || null;
  } catch (e) {
    console.warn('Failed to load room vibe:', e);
    return null;
  }
}

/**
 * Save a room vibe for a channel.
 * @param {string} channelNumber 
 * @param {string} vibe 
 * @returns {Object} Updated vibes map
 */
export function saveRoomVibe(channelNumber, vibe) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const vibes = saved ? JSON.parse(saved) : {};
    
    if (!vibe || !vibe.trim()) {
      delete vibes[channelNumber];
    } else {
      vibes[channelNumber] = vibe.trim();
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vibes));
    return vibes;
  } catch (e) {
    console.warn('Failed to save room vibe:', e);
    return {};
  }
}

/**
 * Get all saved room vibes.
 * @returns {Object} Map of channelNumber -> vibe
 */
export function getAllRoomVibes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.warn('Failed to load all room vibes:', e);
    return {};
  }
}
