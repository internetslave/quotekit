import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        serif: ['"New York"', 'Georgia', 'serif'],
      },
      colors: {
        ink: {
          50: '#f7f7f5',
          100: '#eeeeea',
          200: '#d8d8d0',
          300: '#b6b6a8',
          400: '#8c8c7d',
          500: '#5e5e52',
          600: '#3f3f38',
          700: '#2a2a26',
          800: '#1a1a17',
          900: '#0e0e0c',
        },
        accent: {
          DEFAULT: '#ff8a3d',
          dark: '#e6712a',
        },
      },
    },
  },
  plugins: [],
};
export default config;
