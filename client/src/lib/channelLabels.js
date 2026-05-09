const STORAGE_KEY = 'walkieTalking.channelLabels';

/**
 * Get all saved channel labels from local storage.
 * @returns {Object} Map of channelNumber -> label
 */
export function getChannelLabels() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.warn('Failed to load channel labels:', e);
    return {};
  }
}

/**
 * Save or update a label for a channel.
 * @param {string} channelNumber 
 * @param {string} label 
 * @returns {Object} Updated labels map
 */
export function saveChannelLabel(channelNumber, label) {
  const labels = getChannelLabels();
  const sanitizedLabel = String(label || '').trim().slice(0, 24);
  
  if (!sanitizedLabel) {
    delete labels[channelNumber];
  } else {
    labels[channelNumber] = sanitizedLabel;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  return labels;
}

/**
 * Remove a label for a channel.
 */
export function removeChannelLabel(channelNumber) {
  const labels = getChannelLabels();
  delete labels[channelNumber];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  return labels;
}
