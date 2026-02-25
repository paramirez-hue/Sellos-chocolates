/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./constants.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'custom-blue': 'var(--color-primary, #003594)',
        'custom-blue-dark': 'var(--color-primary-dark, #002566)',
        'custom-blue-light': 'var(--color-primary-light, #0048cc)',
      }
    },
  },
  plugins: [],
}
