/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Passenger app tokens ──────────────────────────────────────────
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

        // ── Admin panel tokens ──────────────────────────────────────────
        "admin-accent":       "#ffd700",
        "admin-accent-dark":  "#705d00",
        "admin-accent-darker": "#5a4b00",
        "admin-bg":           "#f5f3ee",
        "admin-surface":      "rgba(255,255,255,0.80)",
        "admin-border":       "rgba(0,0,0,0.07)",
        "admin-ink":          "#1a1c1d",
        "admin-muted":        "#888888",

        // Status colours used by admin badge system
        "status-green":          "#059669",
        "status-green-bg":       "#ecfdf5",
        "status-amber":          "#d97706",
        "status-amber-bg":       "#fffbeb",
        "status-red":            "#dc2626",
        "status-red-bg":         "#fef2f2",
        "status-blue":           "#2563eb",
        "status-blue-bg":        "#eff6ff",
        "status-gray":           "#6b7280",
        "status-gray-bg":        "#f3f4f6",
        "status-purple":         "#7c3aed",
        "status-purple-bg":      "#f5f3ff",
      },

      borderRadius: {
        "admin-sm": "10px",
        "admin-md": "14px",
        "admin-lg": "20px",
        "admin-xl": "24px",
      },

      fontFamily: {
        ui: ["'Plus Jakarta Sans'", "Inter", "system-ui", "sans-serif"],
      },

      fontSize: {
        "admin-xs":   "11px",
        "admin-sm":   "13px",
        "admin-base": "14px",
        "admin-md":   "16px",
        "admin-lg":   "20px",
        "admin-xl":   "24px",
        "admin-2xl":  "28px",
        // Shorthand aliases used directly in admin.css
        "md": "16px",
      },

      boxShadow: {
        admin:    "0 4px 24px rgba(0,0,0,0.07)",
        "admin-lg": "0 12px 40px rgba(0,0,0,0.12)",
      },

      keyframes: {
        // Passenger app
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Admin panel
        shimmer: {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },

      animation: {
        "fade-in":      "fade-in 0.22s ease-out forwards",
        shimmer:        "shimmer 1.4s infinite",
        "spin-slow":    "spin 0.75s linear infinite",
        "spin-slow-sm": "spin 0.7s linear infinite",
        "fade-in-fast": "fadeIn 0.08s ease",
        "slide-up":     "slideUp 0.11s ease",
      },
    },
  },
  plugins: [],
}

