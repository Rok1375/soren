export const CHANNEL_PATTERN = /^\d{3,6}$/;

export function sanitizeChannelInput(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function getChannelValidation(channel) {
  const value = String(channel ?? '');
  if (!value) return { valid: false, message: 'Enter a 3–6 digit virtual channel.' };
  if (!/^\d+$/.test(value)) return { valid: false, message: 'Channels use numbers only.' };
  if (value.length < 3) return { valid: false, message: 'Channel too short — use 3 to 6 digits.' };
  if (value.length > 6) return { valid: false, message: 'Channel too long — maximum is 6 digits.' };
  return { valid: true, message: 'Channel code ready' };
}

export function createRandomChannel() {
  const length = 3 + Math.floor(Math.random() * 4);
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

export function getChannelCategory(channel) {
  if (/^\d{3}$/.test(channel) && Number(channel) >= 100) return 'PUBLIC-STYLE';
  if (/^\d{6}$/.test(channel)) return 'PRIVATE-STYLE';
  return 'CUSTOM';
}
