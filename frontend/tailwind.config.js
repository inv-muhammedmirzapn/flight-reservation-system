/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          accent: '#ffd700',
          'accent-dark': '#705d00',
          bg: '#f5f3ee',
        },
        status: {
          green: '#059669',
          'green-bg': '#ecfdf5',
          amber: '#d97706',
          'amber-bg': '#fffbeb',
          red: '#dc2626',
          'red-bg': '#fef2f2',
          blue: '#2563eb',
          'blue-bg': '#eff6ff',
          gray: '#6b7280',
          'gray-bg': '#f3f4f6',
          purple: '#7c3aed',
          'purple-bg': '#f5f3ff',
        },
      },
      borderRadius: {
        'admin-sm': '10px',
        'admin-md': '14px',
        'admin-lg': '20px',
        'admin-xl': '24px',
      },
      boxShadow: {
        admin: '0 4px 24px rgba(0,0,0,0.07)',
        'admin-lg': '0 12px 40px rgba(0,0,0,0.12)',
      },
      fontFamily: {
        ui: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'admin-xs': '11px',
        'admin-sm': '13px',
        'admin-base': '14px',
        'admin-md': '16px',
        'admin-lg': '20px',
        'admin-xl': '24px',
        'admin-2xl': '28px',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.15s ease',
        slideUp: 'slideUp 0.2s ease',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};
