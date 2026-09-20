/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd3ff",
          300: "#8eb6ff",
          400: "#598cff",
          500: "#3563eb",
          600: "#2447d6",
          700: "#1e39ad",
          800: "#1f338a",
          900: "#1f306e",
        },
        cardinal: {
          DEFAULT: "#8C1515",
          dark: "#6B1010",
          light: "#B83A3A",
        },
        stone: {
          ink: "#2E2D29",
          mute: "#5F574F",
          sand: "#F7F4EF",
        },
      },
      fontFamily: {
        sans: ["Source Sans 3", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Source Serif 4", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
