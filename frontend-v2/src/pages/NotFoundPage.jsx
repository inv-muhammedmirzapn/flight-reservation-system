import { useLocation } from "react-router-dom";

export default function NotFoundPage() {
  const location = useLocation();

  /*
   * SVG — viewBox 500 × 200
   *
   * 404 text:   x=250  y=158 (baseline)  fontSize=108px  weight=900
   * Cap-height ≈ 78px  → visual midline ≈ y = 158 - 78/2 = 119
   *
   * Orbit ellipse tightly wrapping the digits:
   *   cx=250  cy=119  rx=155  ry=19
   *   Tips: left=(95,119)  right=(405,119)
   *
   * Genuine 3-D depth — proper SVG layer ordering:
   *   [1] Back dashed arc      (lighter, drawn first)
   *   [2] BACK PLANE           (yellow, clipBack, drawn BEFORE <text>)
   *   [3] 404 <text>           (middle layer — occludes the back plane)
   *   [4] Front dashed arc     (slightly darker, drawn after text)
   *   [5] FRONT PLANE          (yellow, clipFront, drawn AFTER <text>)
   *
   * clipBack  = rect(0, 0,   500, 119)   ← upper half only
   * clipFront = rect(0, 119, 500,  81)   ← lower half only
   *
   * Both plane instances share the identical <mpath> + dur → they move
   * in perfect sync and appear as one continuous plane going around.
   */

  const PLANE =
    "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";

  return (
    <div className="flex-1 flex flex-col items-center justify-start min-h-[calc(100vh-80px)] px-4 pt-16 sm:pt-24 pb-20 bg-slate-50 relative overflow-hidden">

      {/* Ambient yellow glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 540,
          height: 540,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(234,179,8,0.07) 0%, transparent 68%)",
          top: -60,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">

        {/* ── SVG illustration ── */}
        <div className="w-full max-w-[500px] h-[200px]">
          <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible" fill="none">
            <defs>
              {/*
                Orbit: cx=250 cy=119 rx=155 ry=19
                CW sweep (sweep-flag=1) from LEFT TIP (95,119):
                  →  9 o'clock CW → 12 (top, y=100) → 3 o'clock  = 0-50%  BACK arc  (behind 404)
                  →  3 o'clock CW →  6 (btm, y=138) → 9 o'clock  = 50-100% FRONT arc (in front)
              */}
              <path
                id="orbit"
                d="M 95 119 a 155 19 0 0 1 310 0 a 155 19 0 0 1 -310 0"
              />
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="3.5"
                  floodColor="#facc15" floodOpacity="0.8" />
              </filter>
            </defs>

            {/*
              ── [1] BACK arc (TOP half, behind 404) — drawn BEFORE text ──────
              Path: left tip → CW through TOP → right tip
              Lighter/thinner — sits visually behind the 404 digits.
            */}
            <path
              d="M 95 119 a 155 19 0 0 1 310 0"
              stroke="#94a3b8"
              strokeWidth="1.8"
              strokeDasharray="6 7"
              strokeLinecap="round"
              fill="none"
              opacity="0.5"
            />

            {/* ── [2] 404 TEXT — middle layer ── */}
            <text
              x="250"
              y="158"
              textAnchor="middle"
              fill="#1e293b"
              style={{
                fontSize: "108px",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                fontFamily: "Inter, system-ui, sans-serif",
                filter: "drop-shadow(0 4px 16px rgba(15,23,42,0.07))",
              }}
            >
              404
            </text>

            {/*
              ── [3] FRONT arc (BOTTOM half, in front of 404) — drawn AFTER text ──
              Path: right tip → CW through BOTTOM → left tip
              Darker/thicker — renders on top of 404, gives the "in front" look.
            */}
            <path
              d="M 405 119 a 155 19 0 0 1 -310 0"
              stroke="#475569"
              strokeWidth="2.2"
              strokeDasharray="6 7"
              strokeLinecap="round"
              fill="none"
              opacity="0.75"
            />

            {/*
              ── [4] SINGLE YELLOW PLANE ──────────────────────────────────────
              Drawn last → always paints on top when opacity > 0.

              Orbit timing:
                0–50%   = BACK arc (top, behind 404) → opacity = 0 (hidden)
                50–100% = FRONT arc (bottom, in front) → opacity = 1 (visible)

              keyTimes:
                0→47%   opacity=0  (on back arc, hidden behind 404)
                47→53%  fade to 1  (crossing right tip, emerging to front)
                53→97%  opacity=1  (on front/bottom arc, visible)
                97→100% fade to 0  (crossing left tip, going back behind 404)
            */}
            <g>
              <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
                <mpath href="#orbit" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;0;1;1;0"
                keyTimes="0;0.47;0.53;0.97;1"
                calcMode="linear"
                dur="6s"
                repeatCount="indefinite"
              />
              <g transform="translate(-12,-12) scale(1.1) rotate(90 12 12)" filter="url(#glow)">
                <path d={PLANE} fill="#facc15" />
              </g>
            </g>
          </svg>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold tracking-widest uppercase bg-yellow-50 text-yellow-700 border border-yellow-300 mt-2 mb-3 select-none">
          <span className="material-symbols-outlined text-sm text-yellow-500">flight_takeoff</span>
          Route Not Found
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
          Lost in the clouds
        </h1>

        {/* Subtext */}
        <p className="text-sm text-slate-500 font-medium max-w-sm leading-relaxed mb-5">
          The flight route you are looking for doesn&apos;t exist, was rescheduled, or has taken off to an unknown destination.
        </p>

        {/* URL Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono text-slate-400 bg-slate-100 border border-slate-200 select-none">
          <span className="material-symbols-outlined text-xs text-slate-400">link_off</span>
          {location.pathname}
        </div>

      </div>
    </div>
  );
}

