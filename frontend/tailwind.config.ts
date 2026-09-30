import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cool blue-charcoal surfaces. One consistent gray family, tinted toward navy.
        ink: {
          950: '#070a11',
          900: '#0c111d',
          850: '#101728',
          800: '#151d31',
          700: '#1d273f',
          600: '#293450',
          500: '#3a4767',
        },
        // Single considered accent — a slightly desaturated emerald, not a neon green.
        accent: {
          DEFAULT: '#34d399',
          soft: '#6ee7b7',
          deep: '#059669',
          dim: '#0f2f26',
        },
        // Supporting hues used only for state, never as second accents.
        signal: {
          info: '#38bdf8',
          warn: '#fbbf24',
          bad: '#fb7185',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'ui-sans-serif', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        // Tinted shadows carry the background hue instead of pure black.
        card: '0 1px 2px rgba(4, 8, 16, 0.4), 0 12px 32px -12px rgba(4, 8, 16, 0.6)',
        lift: '0 2px 4px rgba(4, 8, 16, 0.4), 0 24px 48px -16px rgba(4, 8, 16, 0.7)',
        glow: '0 0 0 1px rgba(52, 211, 153, 0.25), 0 12px 40px -12px rgba(52, 211, 153, 0.35)',
        inset: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(56, 189, 248, 0.5)' },
          '70%': { boxShadow: '0 0 0 8px rgba(56, 189, 248, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(56, 189, 248, 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.66, 0, 0, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
