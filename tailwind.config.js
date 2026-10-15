/** @type {import('tailwindcss').Config} */
// OneChatting design tokens. The `indigo` scale is remapped to the OneChatting
// brand violet so every existing screen picks up the brand automatically.
// Violet-tinted neutrals: replaces Tailwind's gray/slate so every screen shares one palette.
const neutral = {
  50: '#FAFAFD',
  100: '#F3F2F8',
  200: '#E7E5F0',
  300: '#D5D2E2',
  400: '#9A96AE',
  500: '#6F6B85',
  600: '#57536D',
  700: '#3D3954',
  800: '#26223A',
  900: '#171426',
  950: '#0E0C1A',
};

const brand = {
  50: '#F4F2FE',
  100: '#EBE8FC',
  200: '#D9D3FA',
  300: '#BDB3F6',
  400: '#9C8FF0',
  500: '#7F6FEA',
  600: '#6C5CE7',
  700: '#5847D6',
  800: '#4A3BC4',
  900: '#2F2390',
  950: '#1E1660',
};

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand,
        indigo: brand,
        gray: neutral,
        slate: neutral,
        ink: { DEFAULT: '#171426', 900: '#120F26', 700: '#3D3954', 500: '#5E5A75', 400: '#7A7690' },
        surface: { DEFAULT: '#FFFFFF', soft: '#FAFAFD', ground: '#F6F5FA' },
        line: { DEFAULT: '#E7E5F0', soft: '#F0EEF6', strong: '#DCD9E8' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,20,38,0.04)',
        pop: '0 12px 32px -8px rgba(23,20,38,0.18)',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide')
  ],
  darkMode: 'class',
}
