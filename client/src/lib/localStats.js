const STORAGE_KEY = 'walkieTalking.localStats';

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get local stats from localStorage.
 * @returns {Object} Stats object
 */
export function getLocalStats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const defaultStats = {
      channelsJoined: 0,
      transmissionsToday: 0,
      lastTransmissionDate: null,
      favoriteChannel: null,
      lastSignal: null,
      totalTransmissions: 0,
    };
    
    if (!saved) return defaultStats;
    
    const parsed = JSON.parse(saved);
    const today = getTodayKey();
    
    // Reset daily transmissions if it's a new day
    if (parsed.lastTransmissionDate !== today) {
      parsed.transmissionsToday = 0;
    }
    
    return { ...defaultStats, ...parsed };
  } catch (e) {
    console.warn('Failed to load local stats:', e);
    return {
      channelsJoined: 0,
      transmissionsToday: 0,
      lastTransmissionDate: null,
      favoriteChannel: null,
      lastSignal: null,
      totalTransmissions: 0,
    };
  }
}

/**
 * Increment channels joined count.
 * @param {string} channelNumber - The channel that was joined
 * @returns {Object} Updated stats
 */
export function incrementChannelsJoined(channelNumber) {
  const stats = getLocalStats();
  stats.channelsJoined += 1;
  stats.favoriteChannel = channelNumber; // Last joined becomes favorite
  stats.lastSignal = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  return stats;
}

/**
 * Increment transmissions count for today.
 * @returns {Object} Updated stats
 */
export function incrementTransmissions() {
  const stats = getLocalStats();
  stats.transmissionsToday += 1;
  stats.totalTransmissions += 1;
  stats.lastTransmissionDate = getTodayKey();
  stats.lastSignal = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  return stats;
}

/**
 * Reset all local stats.
 * @returns {Object} Reset stats
 */
export function resetLocalStats() {
  const resetStats = {
    channelsJoined: 0,
    transmissionsToday: 0,
    lastTransmissionDate: null,
    favoriteChannel: null,
    lastSignal: null,
    totalTransmissions: 0,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(resetStats));
  return resetStats;
}

/**
 * Format time ago from ISO string.
 * @param {string|null} isoString 
 * @returns {string} Formatted time ago
 */
export function formatTimeAgo(isoString) {
  if (!isoString) return 'Never';
  
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return then.toLocaleDateString();
}
