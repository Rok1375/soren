export function Waveform({ active = false, busy = false }) {
  const bars = Array.from({ length: 31 }, (_, index) => index);
  return (
    <div className="flex h-16 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/40 px-3">
      {bars.map((bar) => {
        const delay = `${(bar % 9) * 80}ms`;
        const height = 18 + ((bar * 13) % 35);
        return (
          <span
            key={bar}
            className={`w-1 rounded-full ${busy ? 'bg-tactical-amber' : 'bg-tactical-green'} ${active ? 'animate-[waveform_.72s_ease-in-out_infinite]' : 'opacity-35'}`}
            style={{ height, animationDelay: delay }}
          />
        );
      })}
    </div>
  );
}
