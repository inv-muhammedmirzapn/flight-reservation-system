import { useLocation, useNavigate, Link } from "react-router-dom";

export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

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
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 py-8 sm:py-12 pt-16 sm:pt-20 relative overflow-hidden">

      {/* Background Image & Overlay (Landing Page Sky) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{ backgroundImage: "url('/hero_sky.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/90" />

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl md:max-w-2xl w-full animate-fade-in">

        {/* ── SVG illustration ── */}
        <div className="w-full max-w-[460px] sm:max-w-[540px] md:max-w-[620px] lg:max-w-[660px] aspect-[5/2]">
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

            {/*
              ── [2] BACK PLANE (drawn BEFORE 404 text) ───────────────────────
              Flies along the upper/behind route.
              Visible on the open path and through the gaps/holes of 404,
              naturally occluded by the solid number glyphs.
            */}
            <g>
              <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
                <mpath href="#orbit" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="1; 1; 0; 0; 1"
                keyTimes="0; 0.499; 0.50; 0.999; 1"
                calcMode="linear"
                dur="6s"
                repeatCount="indefinite"
              />
              <g transform="translate(-12,-12) scale(1.1) rotate(90 12 12)" filter="url(#glow)">
                <path d={PLANE} fill="#facc15" />
              </g>
            </g>

            {/* ── [3] 404 TEXT — middle layer (occludes back plane) ── */}
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
              ── [4] FRONT arc (BOTTOM half, in front of 404) — drawn AFTER text ──
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
              ── [5] FRONT PLANE (drawn AFTER 404 text and front arc) ─────────
              Flies along the front/lower route in front of 404 text.
              Active from 50% to 100% of the orbit loop.
            */}
            <g>
              <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
                <mpath href="#orbit" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0; 0; 1; 1; 0"
                keyTimes="0; 0.499; 0.50; 0.999; 1"
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

        {/* Label */}
        <span className="text-xs sm:text-sm font-bold tracking-widest uppercase text-black mt-3 sm:mt-4 mb-2 select-none">
          Page Not Found
        </span>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2 sm:mb-3">
          Lost in the clouds
        </h1>

        {/* Subtext */}
        <p className="text-sm sm:text-base text-slate-500 font-medium max-w-md sm:max-w-lg leading-relaxed mb-5 sm:mb-6">
          The page you are looking for doesn&apos;t exist, was moved, or has taken off to an unknown destination.
        </p>

        {/* URL Pill */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-mono text-slate-500 bg-white/70 backdrop-blur-md border border-slate-200/80 select-none mb-6 shadow-xs">
          <span className="material-symbols-outlined text-xs sm:text-sm text-slate-400">link_off</span>
          {location.pathname}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white/90 backdrop-blur-md border border-slate-200/80 hover:bg-white active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">arrow_back</span>
            Go Back
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 sm:px-7 sm:py-3 rounded-xl text-xs sm:text-sm font-bold text-slate-950 btn-primary cursor-pointer shadow-lg shadow-yellow-500/25"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">home</span>
            Return Home
          </Link>
        </div>

      </div>
    </div>
  );
}

