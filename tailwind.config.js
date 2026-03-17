/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        surface: '#f8fafc',
        'surface-2': '#f1f5f9',
        'surface-3': '#e2e8f0',
        border: '#cbd5e1',
        accent: '#818cf8',
      }
    }
  },
  plugins: []
}
