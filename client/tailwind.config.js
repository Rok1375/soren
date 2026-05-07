/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Rajdhani', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Share Tech Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        tactical: {
          black: '#030504',
          panel: '#07100c',
          metal: '#101712',
          edge: '#1c2d23',
          green: '#7CFF6B',
          amber: '#ffbf47',
          red: '#ff4d4d',
        },
      },
      boxShadow: {
        signal: '0 0 25px rgba(124, 255, 107, 0.35)',
        insetPanel: 'inset 0 1px 0 rgba(255,255,255,.08), inset 0 -22px 40px rgba(0,0,0,.4)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '.55', transform: 'scale(.98)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
        waveform: {
          '0%, 100%': { transform: 'scaleY(.25)' },
          '50%': { transform: 'scaleY(1)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        blink: {
          '0%, 48%': { opacity: '1' },
          '49%, 100%': { opacity: '.08' },
        },
        tune: {
          '0%': { transform: 'translateX(-110%)', width: '35%' },
          '55%': { width: '70%' },
          '100%': { transform: 'translateX(310%)', width: '35%' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 1.7s ease-in-out infinite',
        scan: 'scan 3s linear infinite',
        blink: 'blink 1s steps(1,end) infinite',
        tune: 'tune .72s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
