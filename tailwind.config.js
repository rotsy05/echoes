/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        space:   '#050810',
        deep:    '#0a1020',
        surface: '#111827',
        blue:    '#4f8ef7',
        teal:    '#2dd4a0',
        amber:   '#f0a952',
        danger:  '#f87171',
        text:    '#e8eeff',
        muted:   '#6b7fa3',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        mono:    ['DM Mono', 'monospace'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
