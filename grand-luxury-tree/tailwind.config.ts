import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        emeraldDeep: '#03160f',
        emeraldMid: '#0b2d1f',
        goldLux: '#d4af37',
        goldBright: '#f6d87a',
        goldShadow: '#8f6a16'
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Gloock', 'serif']
      },
      boxShadow: {
        glow: '0 0 40px rgba(246, 216, 122, 0.35)',
        halo: '0 0 80px rgba(212, 175, 55, 0.35)'
      }
    }
  },
  plugins: []
} satisfies Config;
