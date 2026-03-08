/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#6b7280',
        surface: '#1e2130',
        'surface-2': '#252836',
        'surface-3': '#2d3148',
        border: '#374151',
        accent: '#818cf8',
      }
    }
  },
  plugins: []
}
