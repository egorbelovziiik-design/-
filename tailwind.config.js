/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme-mode="dark"]'],
  theme: {
    extend: {
      colors: {
        wincode: {
          bg: 'var(--wc-bg)',
          panel: 'var(--wc-panel)',
          editor: 'var(--wc-editor)',
          accent: 'var(--wc-accent)',
          neon: 'var(--wc-neon)',
          text: 'var(--wc-text)',
          muted: 'var(--wc-muted)',
          border: 'var(--wc-border)',
          danger: '#EF4444',
          warn: '#F59E0B',
          ok: '#22C55E',
        },
      },
      fontFamily: {
        ui: ['"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Code"', 'Consolas', '"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 18px rgba(168, 85, 247, 0.35)',
        panel: '0 8px 32px rgba(0,0,0,0.45)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
