/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f1115',
        surface: '#181b21',
        primary: '#6366f1',
        'primary-hover': '#4f46e5',
        accent: '#f43f5e',
        'accent-hover': '#e11d48',
        border: '#272a30',
        text: '#f8fafc',
        'text-muted': '#94a3b8'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
