/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Forest + volcanic ridge palette, matching the mobile app.
        moss: {
          50: '#f2f7f1',
          100: '#e0ebdd',
          200: '#c2d8bd',
          300: '#98bd91',
          400: '#6d9e64',
          500: '#4d8145',
          600: '#3a6734',
          700: '#2f522b',
          800: '#274224',
          900: '#21371f',
        },
        ember: {
          50: '#fff5ed',
          100: '#ffe8d4',
          400: '#fb923c',
          500: '#f2761b',
          600: '#e35c0d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
