/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#705d00",
        "primary-container": "#ffd700",
        "on-primary": "#ffffff",
        "on-primary-container": "#705e00",
        surface: "#f4f4f6",
        "surface-variant": "#e8e8ea",
        "on-surface": "#1a1c1d",
        "on-surface-variant": "#5a5446",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        outline: "#7e775f",
        "outline-variant": "#d0c6ab",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
}
