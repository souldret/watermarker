/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          bg: 'rgb(var(--ink-bg) / <alpha-value>)',
          deep: 'rgb(var(--ink-deep) / <alpha-value>)',
          panel: 'rgb(var(--ink-panel) / <alpha-value>)',
          elevated: 'rgb(var(--ink-elevated) / <alpha-value>)',
          border: 'rgb(var(--ink-border) / <alpha-value>)',
          text: 'rgb(var(--ink-text) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        seal: {
          DEFAULT: 'rgb(var(--seal) / <alpha-value>)',
          soft: 'rgb(var(--seal) / 0.14)',
        },
      },
      fontFamily: {
        display: ['Syne', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        seal: '0 8px 24px rgb(var(--seal) / 0.28)',
      },
    },
  },
  plugins: [],
};
