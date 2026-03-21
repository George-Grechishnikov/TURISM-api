/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wine: {
          50: '#fdf4f8',
          100: '#fce7f0',
          200: '#f9d0e2',
          300: '#f4a8c8',
          400: '#e9709e',
          500: '#b83b5f',
          600: '#9e2d52',
          700: '#7c2944',
          800: '#5c2235',
          900: '#451526',
          950: '#2a0d16',
        },
        cream: {
          50: '#fdfcfa',
          100: '#faf7f2',
          200: '#f0ebe3',
          300: '#e3dcd0',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'ui-serif', 'serif'],
      },
      boxShadow: {
        soft: '0 4px 24px -4px rgba(69, 21, 38, 0.1)',
        card: '0 2px 8px rgba(28, 25, 23, 0.05), 0 16px 48px -16px rgba(69, 21, 38, 0.14)',
        'card-lg': '0 8px 32px -8px rgba(28, 25, 23, 0.08), 0 24px 64px -24px rgba(69, 21, 38, 0.2)',
        glow: '0 0 0 1px rgba(255, 255, 255, 0.08), 0 12px 40px -8px rgba(124, 41, 68, 0.25)',
        inset: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
      },
      backgroundImage: {
        'mesh-hero':
          'radial-gradient(900px circle at 15% 10%, rgba(252, 231, 240, 0.95) 0%, transparent 45%), radial-gradient(700px circle at 85% 5%, rgba(254, 243, 199, 0.55) 0%, transparent 40%), radial-gradient(600px circle at 50% 100%, rgba(214, 211, 209, 0.25) 0%, transparent 50%)',
        'mesh-quiz':
          'radial-gradient(800px at 0% 0%, rgba(252, 231, 240, 0.7) 0%, transparent 50%), radial-gradient(600px at 100% 30%, rgba(254, 252, 232, 0.6) 0%, transparent 45%)',
        'bar-warm': 'linear-gradient(90deg, #7c2944 0%, #b45309 48%, #7c2944 100%)',
        'btn-shine':
          'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.22) 50%, transparent 60%)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shine: {
          '0%': { transform: 'translateX(-120%) skewX(-12deg)' },
          '100%': { transform: 'translateX(200%) skewX(-12deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        shine: 'shine 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
