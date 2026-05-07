export function createInviteLink(channelNumber) {
  const url = new URL(window.location.href);
  url.searchParams.set('channel', channelNumber);
  return url.toString();
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

  await navigator.clipboard.writeText(`${text} ${url}`);
  return { method: 'clipboard', url };
}
