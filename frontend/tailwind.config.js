/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          900: '#0f172a',
          950: '#020617',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
        },
        // Semantic aliases
        brand: {
          bg: '#0f172a',
          card: '#1e293b',
          accent: '#34d399',
          'accent-glow': 'rgba(52, 211, 153, 0.3)',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
