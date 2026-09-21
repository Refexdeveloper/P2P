import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        pm: {
          bg: '#F3F6FB',
          accent: '#EEF4FF',
          primary: '#1E88E5',
          secondary: '#1565C0',
          link: '#1E62F0',
          text: '#0F172A',
          muted: '#64748B',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
