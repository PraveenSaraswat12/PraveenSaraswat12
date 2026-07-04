/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070912',
          900: '#0c0e1c',
          800: '#12152b',
          700: '#1a1e3a',
          600: '#262b4f',
          500: '#3a4068',
        },
        mist: {
          50: '#f4f1ea',
          100: '#e9e5da',
          300: '#b8bdd9',
          400: '#8e93b8',
          500: '#6d7298',
        },
        pulse: {
          300: '#8fb0ff',
          400: '#6189fa',
          500: '#3a6df4',
          600: '#2c55cf',
        },
        aura: {
          400: '#9d7bff',
          500: '#7c4dff',
        },
        glow: {
          400: '#37e6c3',
          500: '#19c9a6',
        },
        amberx: { 400: '#ffb454' },
        rosex: { 400: '#ff6b8b' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glowBlue: '0 0 24px rgba(58,109,244,.35)',
        glowTeal: '0 0 24px rgba(25,201,166,.3)',
        card: '0 8px 30px rgba(3,5,16,.45)',
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
