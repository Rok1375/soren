export function createInviteLink(channelNumber) {
  return `${window.location.origin}?channel=${encodeURIComponent(String(channelNumber))}`;
}

export function createInviteText(channelNumber) {
  return `Join my Walkie Talking room: CH ${channelNumber}. Internet room, not RF.`;
}

export async function shareInviteLink(channelNumber) {
  const url = createInviteLink(channelNumber);
  const text = createInviteText(channelNumber);

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Walkie Talking',
        text,
        url,
      });
      return { method: 'share', url };
    } catch (error) {
      if (error?.name === 'AbortError') return { method: 'cancelled', url };
      // Fall through to clipboard if native sharing is unavailable after opening.
    }
  }

  await navigator.clipboard.writeText(url);
  return { method: 'clipboard', url };
}
