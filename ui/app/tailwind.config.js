/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media',
  theme: {
    fontFamily: {
      sans: ['DM Sans', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        brand: {
          bg: 'var(--bg)',
          card: 'var(--card-bg)',
          border: 'var(--card-border)',
          text: 'var(--text-primary)',
          muted: 'var(--text-muted)',
          accent: 'var(--accent)',
          accentHover: 'var(--accent-hover)',
          accentFocus: 'var(--accent-focus)',
        },
      },
      borderRadius: {
        card: '16px',
        cardSm: '12px',
        button: '8px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 10px 25px rgba(15, 23, 42, 0.35)',
        subtle: '0 4px 12px rgba(15, 23, 42, 0.15)',
      },
      spacing: {
        'safe-nav': 'max(0.5rem, env(safe-area-inset-bottom))',
      },
    },
  },
  plugins: [],
}

