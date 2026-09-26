/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: '#023957',
          secondary: '#145d7c',
          accent: '#fcc40f',
        },
      },
    },
    plugins: [],
  }