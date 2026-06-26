/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'page-bg': '#f8fafc',
        'card-bg': 'rgba(255, 255, 255, 0.8)',
        'brand-blue': '#2563eb',
        'brand-blue-hover': '#1d4ed8',
        'brand-blue-light': '#eff6ff',
        'success-green': '#10b981',
        'success-green-light': '#ecfdf5',
        'warning-orange': '#f97316',
        'warning-orange-light': '#fff7ed',
        'danger-red': '#ef4444',
        'danger-red-light': '#fef2f2',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        headline: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        wordmark: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Fira Code"', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      boxShadow: {
        'premium': '0 10px 30px -10px rgba(148, 163, 184, 0.12), 0 1px 3px rgba(148, 163, 184, 0.06)',
        'premium-hover': '0 20px 40px -15px rgba(148, 163, 184, 0.2), 0 1px 5px rgba(148, 163, 184, 0.1)',
      }
    },
  },
  plugins: [],
}
