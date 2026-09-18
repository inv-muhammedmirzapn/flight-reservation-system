/**
 * AiChatbot.jsx
 * =============
 * A premium, animated floating AI travel assistant widget.
 * 
 * Features:
 * - Framer Motion animations throughout (bubble, window, messages, particles)
 * - Typing indicator with pulsing dots
 * - Particle burst animation when a flight is found
 * - Smooth page-exit animation on redirect
 * - Glassmorphism design with dark gradient
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { sendAgentMessage } from "@/services/agentService";

function formatMarkdownText(text) {
  if (!text) return "";
  // 1. Convert inline dashed bullets (e.g. ": - **", ". - **", " - **") into proper newlined bullets
  let res = text.replace(/([:.]|[a-zA-Z0-9])\s+-\s+\*\*/g, "$1\n- **");
  res = res.replace(/([:.]|[a-zA-Z0-9])\s+-\s+([A-Z])/g, "$1\n- $2");
  // 2. If a sentence after a bullet list starts without a bullet, e.g., ". If you have...", give it a paragraph break
  res = res.replace(/(\.)\s+(If you have|Please let me know|Feel free to|Let me know)\b/gi, "$1\n\n$2");
  return res;
}

// ─── Particle Burst Component ────────────────────────────────────────────────
function ParticleBurst({ active }) {
  const particles = Array.from({ length: 18 }, (_, i) => i);
  const colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#f43f5e", "#06b6d4"];

  return (
    <AnimatePresence>
      {active && (
        <div className="ag-particle-container">
          {particles.map((i) => {
            const angle = (i / particles.length) * 360;
            const distance = 60 + Math.random() * 80;
            const color = colors[i % colors.length];
            const x = Math.cos((angle * Math.PI) / 180) * distance;
            const y = Math.sin((angle * Math.PI) / 180) * distance;
            return (
              <motion.div
                key={i}
                className="ag-particle"
                style={{ backgroundColor: color }}
                initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                animate={{
                  x,
                  y,
                  scale: 0,
                  opacity: 0,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.02 }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Status Step Sanitizer (Defense-in-depth) ──────────────────────────────────
function formatWorkingStep(step) {
  if (!step || typeof step !== "string") return "Working on your request...";
  const lower = step.toLowerCase();

  if (lower.includes("find_nearest_airport") || (lower.includes("airport") && lower.includes("tool"))) {
    return "Locating nearest international airports...";
  }
  if (lower.includes("airport") && (lower.includes("result") || lower.includes("found") || lower.includes("identified") || lower.includes("database"))) {
    return "Airport options identified...";
  }
  if (lower.includes("search_upcoming_flights") || (lower.includes("flight") && lower.includes("tool"))) {
    return "Searching available flights & live fares...";
  }
  if (lower.includes("flight") && (lower.includes("result") || lower.includes("found") || lower.includes("database") || lower.includes("review"))) {
    return "Reviewing flight schedules...";
  }
  if (lower.includes("search_event") || (lower.includes("event") && lower.includes("tool"))) {
    return "Looking up event schedule & venue...";
  }
  if (lower.includes("event") && (lower.includes("result") || lower.includes("found") || lower.includes("confirmed"))) {
    return "Event information confirmed...";
  }
  // Booking & cancellation tool steps
  if (lower.includes("get_user_recent_bookings") || lower.includes("reservation history")) {
    return "Retrieving your reservation history...";
  }
  if (lower.includes("get_booking_by_pnr") || lower.includes("reservation details")) {
    return "Looking up reservation details...";
  }
  if (lower.includes("check_cancellation_policy") || lower.includes("cancellation") || lower.includes("refund polic")) {
    return "Checking cancellation & refund policies...";
  }
  if (lower.includes("booking") && (lower.includes("result") || lower.includes("loaded") || lower.includes("verified"))) {
    return "Reservation details verified...";
  }
  if (lower.includes("tool:") || lower.includes("using tool")) {
    return "Finding the best travel options...";
  }
  if (lower.includes("database results") || lower.includes("processing database")) {
    return "Comparing travel options...";
  }
  if (lower.includes("thinking")) {
    return "Preparing your recommendations...";
  }
  return step;
}

// ─── Booking Card Component ──────────────────────────────────────────────────
function BookingCard({ booking, showCancelAction, navigate }) {
  const statusColors = {
    CONFIRMED: { bg: "#ecfdf5", text: "#059669", border: "#a7f3d0" },
    CANCELLED: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
    WAITLIST: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  };
  const refundColors = {
    REFUNDABLE: { bg: "#ecfdf5", text: "#059669" },
    PARTIAL: { bg: "#fffbeb", text: "#d97706" },
    NON_REFUNDABLE: { bg: "#fef2f2", text: "#dc2626" },
  };
  const sc = statusColors[booking.status] || statusColors.CONFIRMED;
  const rc = refundColors[booking.refund_type] || refundColors.NON_REFUNDABLE;
  const refundLabel = booking.refund_type === "PARTIAL" ? "Partial Refund" : booking.refund_type === "REFUNDABLE" ? "Refundable" : "Non-Refundable";

  return (
    <motion.div
      className={`ag-booking-card ${!showCancelAction ? 'ag-booking-card-clickable' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={!showCancelAction ? () => navigate(booking.detail_url || `/my-bookings/ticket/${booking.id}`) : undefined}
      style={!showCancelAction ? { cursor: 'pointer' } : undefined}
    >
      {/* Header */}
      <div className="ag-booking-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L2.6 8l7.4 3.1-3 3L4.5 14c-.4 0-.8.3-1 .6L2.6 16l4.6 1.4 1.4 4.6 1.4-1c.3-.2.6-.6.6-1l-.1-2.5 3-3 3.1 7.4c.1.4.5.6.8.5l1.2-1.1c.4-.2.7-.6.6-1.1z" /></svg>
          <span style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a" }}>{booking.flight_no}</span>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "500" }}>{booking.airline}</span>
        </div>
        <div style={{
          fontSize: "10px", fontWeight: "700", textTransform: "uppercase",
          padding: "3px 8px", borderRadius: "6px", letterSpacing: "0.4px",
          background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`
        }}>
          {booking.status}
        </div>
      </div>

      {/* Route */}
      <div style={{ fontSize: "13px", color: "#334155", fontWeight: "600" }}>
        {booking.route || `${booking.origin_iata} → ${booking.destination_iata}`}
      </div>

      {/* Details row */}
      <div className="ag-booking-card-details">
        <div className="ag-booking-detail-item">
          <span className="ag-booking-detail-label">Travel Date</span>
          <span className="ag-booking-detail-value">{booking.travel_date}</span>
        </div>
        <div className="ag-booking-detail-item">
          <span className="ag-booking-detail-label">Departure</span>
          <span className="ag-booking-detail-value">{booking.departure_time || "—"}</span>
        </div>
        <div className="ag-booking-detail-item">
          <span className="ag-booking-detail-label">Class</span>
          <span className="ag-booking-detail-value">{booking.cabin_class}</span>
        </div>
        {booking.seat_numbers && booking.seat_numbers.length > 0 && (
          <div className="ag-booking-detail-item">
            <span className="ag-booking-detail-label">Seats</span>
            <span className="ag-booking-detail-value">{booking.seat_numbers.join(", ")}</span>
          </div>
        )}
      </div>

      {/* Price & refund badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
        <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>₹{booking.total_price}</span>
        <span style={{
          fontSize: "10px", fontWeight: "600", padding: "2px 7px", borderRadius: "4px",
          background: rc.bg, color: rc.text
        }}>
          {refundLabel}
        </span>
      </div>

      {/* Cancellation details (only when cancel context) */}
      {showCancelAction && booking.cancellation_fee !== undefined && (
        <div style={{
          marginTop: "6px", padding: "8px 10px", borderRadius: "8px",
          background: "#fffbeb", border: "1px solid #fde68a", fontSize: "11.5px", color: "#92400e"
        }}>
          <div style={{ fontWeight: "700", marginBottom: "3px" }}>Cancellation Summary</div>
          <div>Fee: ₹{booking.cancellation_fee} · Estimated Refund: ₹{booking.estimated_refund}</div>
          {booking.policy_explanation && <div style={{ marginTop: "2px", opacity: 0.85 }}>{booking.policy_explanation}</div>}
        </div>
      )}

      {/* Cancel action - only shown in cancel context */}
      {showCancelAction && booking.status === "CONFIRMED" && (
        <div className="ag-booking-card-actions">
          <button
            className="ag-booking-action-btn ag-booking-action-cancel"
            onClick={(e) => { e.stopPropagation(); navigate(booking.cancel_url || `/my-bookings/cancel/${booking.id}`); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></svg>
            Proceed to Cancel
          </button>
        </div>
      )}

      {/* Clickable hint for non-cancel cards */}
      {!showCancelAction && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px",
          marginTop: "2px", fontSize: "10.5px", color: "#94a3b8", fontWeight: "500"
        }}>
          Tap to view details
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </div>
      )}
    </motion.div>
  );
}

// ─── Agent Working Indicator ───────────────────────────────────────────────────
function AgentWorkingIndicator({ steps }) {
  return (
    <motion.div
      className="ag-message ag-message--bot"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
    >
      <div className="ag-avatar">
        <img src="/robot-avatar.jpg" alt="Aero AI" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
      </div>
      <div className="ag-bubble ag-bubble--bot" style={{ minWidth: '220px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            style={{ display: 'flex' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
            </svg>
          </motion.div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Working on your request...</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <AnimatePresence>
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              const displayText = formatWorkingStep(step);
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
                >
                  <div style={{
                    marginTop: '4px', width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: isLast ? '#3b82f6' : '#cbd5e1', flexShrink: 0,
                    boxShadow: isLast ? '0 0 4px rgba(59,130,246,0.6)' : 'none'
                  }} />
                  <span style={{
                    fontSize: '11.5px',
                    color: isLast ? '#334155' : '#94a3b8',
                    fontWeight: isLast ? '500' : '400',
                    lineHeight: '1.4'
                  }}>
                    {displayText}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Suggestion Chips ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Find me flights to New York",
  "What is the status of my bookings?",
  "Show me upcoming flights to Paris",
  "What is your cancellation & refund policy?",
];

const DEFAULT_MESSAGE = {
  id: 1,
  role: "bot",
  text: "Hey! I'm Aero, your intelligent flight assistant ✈️ I can help you find flights, check your booking status, and assist with cancellations. How can I help?",
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AiChatbot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_chat_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m) =>
            m.id === 1 && m.text.includes("Nova") ? DEFAULT_MESSAGE : m
          );
        }
      }
    } catch (e) { }
    return [DEFAULT_MESSAGE];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState([]);
  const [showParticles, setShowParticles] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(null);
  const [pendingRedirect, setPendingRedirect] = useState(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const widgetRef = useRef(null);
  const abortControllerRef = useRef(null);
  const controls = useAnimation();

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, loadingSteps]);

  // Re-scroll when animated content (loading steps) expands in height
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    localStorage.setItem("ai_chat_messages", JSON.stringify(messages));
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setHasNewMessage(false);
    }
  }, [isOpen]);

  // Auto-redirect removed per user request. Users will click flight cards to navigate.

  const addMessage = (role, text, extra = {}) => {
    const newMsg = { id: Date.now(), role, text, ...extra };
    setMessages((prev) => [...prev, newMsg]);
    if (role === "bot" && !isOpen) setHasNewMessage(true);
    return newMsg;
  };

  const handleSend = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    addMessage("user", trimmed);
    setIsLoading(true);
    setLoadingSteps(["Initializing travel assistant..."]);

    // Create a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Bubble pulse animation
    controls.start({
      scale: [1, 1.15, 1],
      transition: { duration: 0.4 },
    });

    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      const nearestAirport = localStorage.getItem("user_nearest_airport");
      const nearestCity = localStorage.getItem("user_nearest_city");

      const result = await sendAgentMessage(trimmed, history, (step) => {
        const safeStep = formatWorkingStep(step);
        setLoadingSteps(prev => {
          if (prev[prev.length - 1] !== safeStep) return [...prev, safeStep];
          return prev;
        });
      }, nearestAirport, nearestCity, controller.signal);

      setIsLoading(false);
      setLoadingSteps([]);
      abortControllerRef.current = null;

      if (result.action === "REDIRECT" && result.redirect_params) {
        setShowParticles(true);
        setTimeout(() => setShowParticles(false), 1200);
        addMessage("bot", result.reply_message, {
          isRedirect: true,
          redirectParams: result.redirect_params,
          flightOptions: result.redirect_params?.flight_options || result.flight_options || [],
        });
      } else if (result.booking_cards && result.booking_cards.length > 0) {
        // Determine if user asked about cancellation
        const lowerInput = trimmed.toLowerCase();
        const isCancelContext = lowerInput.includes("cancel") || lowerInput.includes("refund") || lowerInput.includes("cancellation");
        addMessage("bot", result.reply_message || "Here are your booking details:", {
          bookingCards: result.booking_cards,
          showCancelAction: isCancelContext,
        });
      } else {
        // Check if there are flight options even without REDIRECT action
        const flightOpts = result.flight_options || result.redirect_params?.flight_options || [];
        if (flightOpts.length > 0) {
          setShowParticles(true);
          setTimeout(() => setShowParticles(false), 1200);
          addMessage("bot", result.reply_message, {
            isRedirect: true,
            redirectParams: result.redirect_params || {},
            flightOptions: flightOpts,
          });
        } else {
          addMessage("bot", result.reply_message || "How can I help you?");
        }
      }
    } catch (err) {
      setIsLoading(false);
      setLoadingSteps([]);
      abortControllerRef.current = null;
      if (err.name === "AbortError") {
        addMessage("bot", "Stopped. Let me know if you'd like to try a different search.");
      } else {
        addMessage("bot", "Oops! We encountered an issue while searching. Please try again in a moment.");
      }
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const cancelRedirect = () => {
    setRedirectCountdown(null);
    setPendingRedirect(null);
    addMessage("bot", "No problem! Let me know if you'd like to search for something else.");
  };

  return (
    <>
      {/* ── Global styles injected inline ─────────────────────────── */}
      <style>{`
        .ag-widget { position: fixed; bottom: 28px; right: 28px; z-index: 9999; font-family: Inter, sans-serif; }

        /* Floating bubble button */
        .ag-bubble-btn {
          width: 62px; height: 62px; border-radius: 50%; border: none; cursor: pointer;
          background: #ffffff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 28px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);
          position: relative; overflow: visible; padding: 0;
        }
        .ag-bubble-btn:focus { outline: none; }
        .ag-bubble-ring {
          position: absolute; inset: -6px; border-radius: 50%;
          border: 2px solid rgba(255,215,0,0.5);
          animation: ag-ring-pulse 2.2s ease-in-out infinite;
        }
        @keyframes ag-ring-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 0; }
        }
        .ag-new-badge {
          position: absolute; top: -2px; right: -2px; width: 14px; height: 14px;
          background: #ef4444; border-radius: 50%; border: 2px solid white;
          animation: ag-badge-pulse 1.5s ease-in-out infinite;
        }
        @keyframes ag-badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.35); }
        }

        /* Chat window */
        .ag-window {
          position: absolute; bottom: 78px; right: 0;
          width: min(400px, calc(100vw - 32px));
          height: min(560px, calc(100vh - 120px));
          border-radius: 24px; overflow: hidden;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 20px 60px rgba(15,23,42,0.12), 0 4px 16px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.9);
          display: flex; flex-direction: column;
        }

        /* Header */
        .ag-header {
          padding: 16px 18px 14px;
          background: linear-gradient(135deg, #081426 0%, #0f2347 50%, #173567 100%);
          border-bottom: 3px solid #ffd700;
          display: flex; align-items: center; gap: 13px; flex-shrink: 0;
          position: relative;
        }
        .ag-header::after {
          content: '';
          position: absolute;
          bottom: -3px; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #ffd700, #facc15, #fbbf24, #ffd700);
          background-size: 200% 100%;
          animation: ag-shimmer 2.5s linear infinite;
        }
        @keyframes ag-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .ag-header-icon {
          width: 48px; height: 48px; border-radius: 15px;
          overflow: hidden; flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), 0 0 10px rgba(255,215,0,0.35);
          border: 2px solid rgba(255, 215, 0, 0.5);
          background: #ffffff;
        }
        .ag-header-icon img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          border-radius: 13px;
        }
        .ag-header-title { font-size: 15px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; }
        .ag-header-sub { font-size: 11px; color: #facc15; margin-top: 2px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
        .ag-status-dot {
          width: 7px; height: 7px; background: #22c55e; border-radius: 50%;
          display: inline-block; margin-right: 5px;
          box-shadow: 0 0 8px rgba(34,197,94,0.8);
          animation: ag-blink 2s ease-in-out infinite;
        }
        @keyframes ag-blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0.35; }
        }
        .ag-clear-btn {
          display: flex; align-items: center; gap: 5px;
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.18);
          color: rgba(255,255,255,0.85);
          font-size: 11px; font-weight: 600; letter-spacing: 0.3px;
          padding: 5px 12px; border-radius: 20px;
          cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); font-family: Inter, sans-serif;
          margin-right: 6px;
          backdrop-filter: blur(8px);
        }
        .ag-clear-btn:hover {
          background: rgba(255,215,0,0.2);
          border-color: #ffd700;
          color: #ffd700;
          transform: translateY(-1px);
        }
        .ag-close-btn {
          margin-left: auto; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18);
          color: rgba(255,255,255,0.85); width: 32px; height: 32px; border-radius: 10px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 14px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
        }
        .ag-close-btn:hover { background: rgba(239, 68, 68, 0.25); border-color: rgba(239, 68, 68, 0.5); color: #fca5a5; transform: scale(1.05); }

        /* Messages area */
        .ag-messages {
          flex: 1; overflow-y: auto; padding: 14px; padding-bottom: 6px; display: flex;
          flex-direction: column; gap: 10px; scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.1) transparent;
          background: rgba(248,250,252,0.8);
        }
        .ag-messages::-webkit-scrollbar { width: 4px; }
        .ag-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

        /* Individual messages */
        .ag-message { display: flex; align-items: flex-end; gap: 7px; }
        .ag-message--user { flex-direction: row-reverse; }
        .ag-avatar {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: white; border: 1px solid rgba(0,0,0,0.05);
        }
        .ag-avatar--user {
          background: linear-gradient(135deg, #0f172a, #1e293b);
          border: none;
        }
        .ag-bubble {
          max-width: 80%; padding: 10px 14px; border-radius: 18px;
          font-size: 13px; line-height: 1.55; word-break: break-word;
        }
        .ag-bubble--bot {
          background: white;
          border: 1px solid rgba(0,0,0,0.06);
          border-bottom-left-radius: 4px;
          color: #1e293b;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        }
        .ag-bubble--user {
          background: linear-gradient(135deg, #0f172a, #1e293b);
          border-bottom-right-radius: 4px;
          color: white;
          font-weight: 500;
          box-shadow: 0 4px 14px rgba(15,23,42,0.2);
        }
        .ag-bubble--redirect {
          background: rgba(15,23,42,0.03);
          border: 1px solid rgba(15,23,42,0.1);
          color: #0f172a;
        }

        /* Markdown formatting inside bubbles */
        .ag-bubble p { margin: 0 0 8px 0; }
        .ag-bubble p:last-child { margin-bottom: 0; }
        .ag-bubble strong { font-weight: 700; color: #0f172a; }
        .ag-bubble--user strong { color: #ffffff; }
        .ag-bubble ul, .ag-bubble ol { margin: 6px 0 8px 0; padding-left: 18px; }
        .ag-bubble li { margin-bottom: 4px; line-height: 1.5; }
        .ag-bubble li:last-child { margin-bottom: 0; }
        .ag-bubble code {
          background: rgba(15,23,42,0.06); padding: 2px 5px; border-radius: 4px;
          font-size: 12px; font-family: monospace;
        }
        .ag-bubble--user code {
          background: rgba(255,255,255,0.2); color: #ffffff;
        }

        /* Redirect card inside bubble */
        .ag-redirect-card {
          margin-top: 10px; padding: 10px 14px; border-radius: 8px;
          background: #f8fafc; border: 1px solid rgba(15,23,42,0.08);
          display: flex; flex-direction: column; gap: 3px; cursor: pointer;
        }
        .ag-redirect-card:hover { border-color: rgba(15,23,42,0.15); background: white; }
        .ag-redirect-card-title {
          font-size: 10px; color: #64748b; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .ag-redirect-card-sub { font-size: 13px; color: #0f172a; font-weight: 700; }

        /* Typing dots */
        .ag-typing-dots { display: flex; gap: 4px; padding: 4px 2px; align-items: center; }
        .ag-dot { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; display: block; }

        /* Suggestions */
        .ag-suggestions {
          padding: 0 14px 10px; display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
          background: rgba(248,250,252,0.8);
        }
        .ag-chip {
          background: white;
          border: 1px solid rgba(0,0,0,0.09);
          color: #475569; font-size: 12px; padding: 6px 12px;
          border-radius: 20px; cursor: pointer; transition: all 0.2s;
          white-space: nowrap; font-weight: 500;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .ag-chip:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0,0,0,0.06);
        }

        /* Input area */
        .ag-input-area {
          padding: 12px 14px 14px;
          border-top: 1px solid rgba(0,0,0,0.06);
          background: white;
          flex-shrink: 0;
        }
        .ag-input-row {
          display: flex; gap: 8px; align-items: center;
          background: #f8fafc;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 20px; padding: 6px 6px 6px 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ag-input-row:focus-within {
          border-color: #ffd700;
          box-shadow: 0 0 0 3px rgba(255,215,0,0.15);
          background: white;
        }
        .ag-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: #1e293b; font-size: 13.5px; font-family: Inter, sans-serif;
        }
        .ag-input::placeholder { color: #cbd5e1; }
        .ag-send-btn {
          width: 36px; height: 36px; border-radius: 14px; border: none; cursor: pointer;
          background: #ffd700;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; flex-shrink: 0;
        }
        .ag-send-btn:hover { transform: scale(1.05); background: #facc15; }
        .ag-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; background: #e2e8f0; }
        .ag-send-btn svg { width: 16px; height: 16px; color: #0f172a; stroke-width: 2.5px; }

        .ag-stop-btn {
          width: 36px; height: 36px; border-radius: 14px; border: none; cursor: pointer;
          background: #ef4444;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; flex-shrink: 0;
          animation: ag-stop-pulse 1.4s ease-in-out infinite;
          box-shadow: 0 0 0 0 rgba(239,68,68,0.4);
        }
        .ag-stop-btn:hover { background: #dc2626; transform: scale(1.05); }
        @keyframes ag-stop-pulse {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          70% { box-shadow: 0 0 0 7px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }

        /* Particles */
        .ag-particle-container {
          position: absolute; bottom: 90px; right: 31px;
          width: 62px; height: 62px; z-index: 10000;
          pointer-events: none;
        }
        .ag-particle {
          position: absolute; top: 50%; left: 50%;
          width: 8px; height: 8px; border-radius: 50%;
          transform: translate(-50%, -50%);
        }

        /* Page glow sweep */
        .ag-glow-sweep {
          position: fixed; inset: 0; z-index: 9998; pointer-events: none;
          background: radial-gradient(circle at 90% 90%, rgba(255,215,0,0.15) 0%, transparent 55%);
          animation: ag-glow-fade 1.5s ease-out forwards;
        }
        @keyframes ag-glow-fade {
          0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; }
        }

        /* Flight Options */
        .ag-flight-options-wrapper {
          background: white; border: 1px solid rgba(15,23,42,0.1); border-radius: 12px;
          margin-top: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .ag-flight-options-header {
          padding: 11px 13px; display: flex; justify-content: space-between; align-items: center;
          gap: 10px; border-bottom: 1px solid rgba(15,23,42,0.06); background: #ffffff;
        }
        .ag-flight-options-header-left { flex: 1; min-width: 0; }
        .ag-flight-options-title-main { font-size: 13.5px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px; }
        .ag-flight-options-title-sub {
          font-size: 11px; color: #64748b; font-weight: 500; margin-top: 3px;
          display: flex; align-items: center; gap: 4px; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .ag-bullet-dot { color: #cbd5e1; font-size: 9px; }
        .ag-flight-options-view-all {
          font-size: 11.5px; color: #ffd700; background: #0f172a; border: none;
          padding: 6px 12px; border-radius: 18px; font-weight: 700; cursor: pointer;
          display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
          flex-shrink: 0; line-height: 1; box-shadow: 0 2px 6px rgba(15,23,42,0.14);
          transition: all 0.2s ease;
        }
        .ag-flight-options-view-all:hover {
          background: #1e293b; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(15,23,42,0.22);
        }
        
        .ag-flight-options {
          display: flex; gap: 12px; overflow-x: auto; padding: 14px; padding-bottom: 20px;
          overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch;
        }
        /* Style the scrollbar so it's visible but subtle */
        .ag-flight-options::-webkit-scrollbar { height: 6px; }
        .ag-flight-options::-webkit-scrollbar-track { background: transparent; }
        .ag-flight-options::-webkit-scrollbar-thumb { background: rgba(15,23,42,0.15); border-radius: 10px; }
        .ag-flight-options::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,0.25); }
        
        .ag-flight-card {
          flex: 0 0 auto; background: #f8fafc; border: 1px solid rgba(15,23,42,0.06);
          border-radius: 12px; padding: 14px; width: 220px; cursor: pointer;
          display: flex; flex-direction: column; gap: 10px;
          transition: all 0.2s;
        }
        .ag-flight-card:hover { border-color: #ffd700; background: white; box-shadow: 0 4px 12px rgba(15,23,42,0.1); }
        .ag-flight-airline { font-size: 13px; color: #0f172a; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .ag-cabin-pill {
          font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
          padding: 2px 6px; border-radius: 4px; background: rgba(15,23,42,0.06); color: #475569;
        }
        .ag-cabin-pill--business { background: rgba(147, 51, 234, 0.12); color: #7e22ce; }
        .ag-cabin-pill--first { background: rgba(217, 119, 6, 0.14); color: #b45309; }
        
        .ag-flight-route { display: flex; flex-direction: column; position: relative; padding-left: 16px; margin: 4px 0; }
        .ag-flight-route-line { position: absolute; left: 3px; top: 8px; bottom: 8px; width: 2px; border-left: 2px dotted #cbd5e1; }
        .ag-flight-route-dot { position: absolute; left: -1px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 1.5px #cbd5e1; background: white; }
        .ag-flight-route-dot.top { top: 0; }
        .ag-flight-route-dot.bottom { bottom: 0; background: #0f172a; box-shadow: 0 0 0 1.5px #0f172a; }
        
        .ag-flight-time-row { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
        .ag-flight-time { font-size: 14px; font-weight: 800; color: #0f172a; }
        .ag-flight-city { font-size: 12px; color: #475569; font-weight: 500; }
        
        .ag-flight-duration { font-size: 11px; color: #64748b; font-weight: 600; padding: 6px 0; }
        
        .ag-flight-price-btn {
          margin-top: 4px; border-top: 1px solid rgba(15,23,42,0.06); padding-top: 12px;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 12.5px; color: #0f172a; font-weight: 800;
        }
        
        /* Booking Cards */
        .ag-booking-cards-wrapper {
          display: flex; flex-direction: column; gap: 10px; margin-top: 12px;
        }
        .ag-booking-card {
          background: white; border: 1px solid rgba(15,23,42,0.08); border-radius: 12px;
          padding: 14px; display: flex; flex-direction: column; gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.2s;
        }
        .ag-booking-card:hover {
          border-color: rgba(15,23,42,0.15); box-shadow: 0 4px 14px rgba(0,0,0,0.07);
        }
        .ag-booking-card-clickable:hover {
          border-color: #ffd700; box-shadow: 0 4px 14px rgba(255,215,0,0.15);
          transform: translateY(-1px);
        }
        .ag-booking-card-header {
          display: flex; justify-content: space-between; align-items: center;
        }
        .ag-booking-card-details {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px;
          padding: 8px 0; border-top: 1px solid rgba(15,23,42,0.05);
          border-bottom: 1px solid rgba(15,23,42,0.05);
        }
        .ag-booking-detail-item { display: flex; flex-direction: column; gap: 1px; }
        .ag-booking-detail-label { font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
        .ag-booking-detail-value { font-size: 12px; color: #1e293b; font-weight: 600; }
        .ag-booking-card-actions {
          display: flex; gap: 8px; margin-top: 4px;
        }
        .ag-booking-action-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
          padding: 8px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 700;
          border: none; cursor: pointer; transition: all 0.2s;
          font-family: Inter, sans-serif; letter-spacing: 0.2px;
        }
        .ag-booking-action-view {
          background: #0f172a; color: #ffd700;
        }
        .ag-booking-action-view:hover { opacity: 0.9; }
        .ag-booking-action-cancel {
          background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
        }
        .ag-booking-action-cancel:hover { background: #fee2e2; }

        /* Floating Quote */
        .ag-floating-quote {
          position: absolute; bottom: 78px; right: 0;
          background: white; padding: 12px 18px; border-radius: 24px;
          border-bottom-right-radius: 4px; font-size: 13px; font-weight: 600;
          color: #0f172a; box-shadow: 0 8px 24px rgba(15,23,42,0.12);
          border: 1px solid rgba(0,0,0,0.05); white-space: nowrap;
          pointer-events: none;
          display: flex; align-items: center; gap: 8px;
        }
      `}</style>

      {/* ── Widget Container ──────────────────────────────────────── */}
      <div className="ag-widget" ref={widgetRef}>

        {/* Particle burst */}
        <ParticleBurst active={showParticles} />

        {/* Page glow effect */}
        <AnimatePresence>
          {showParticles && <div key="glow" className="ag-glow-sweep" />}
        </AnimatePresence>

        {/* Chat Window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="ag-window"
              key="ag-window"
              initial={{ opacity: 0, scale: 0.88, y: 20, transformOrigin: "bottom right" }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              {/* Header */}
              <div className="ag-header">
                <div className="ag-header-icon">
                  <img src="/robot-avatar.jpg" alt="Aero AI" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ag-header-title">Aero AI</div>
                  <div className="ag-header-sub">
                    <span className="ag-status-dot" />
                    <span>Intelligent Flight Companion</span>
                  </div>
                </div>
                <button
                  className="ag-clear-btn"
                  onClick={() => setMessages([DEFAULT_MESSAGE])}
                  title="Clear chat history"
                >
                  Clear
                </button>
                <button className="ag-close-btn" onClick={() => setIsOpen(false)}>✕</button>
              </div>

              {/* Messages */}
              <div className="ag-messages" ref={messagesContainerRef}>
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      className={`ag-message ag-message--${msg.role}`}
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    >
                      {msg.role === "bot" && (
                        <div className="ag-avatar">
                          <img src="/robot-avatar.jpg" alt="Aero" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                        </div>
                      )}
                      {msg.role === "user" && (
                        <div className="ag-avatar ag-avatar--user">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                      )}

                      <div className={`ag-bubble ag-bubble--${msg.role} ${msg.isRedirect ? "ag-bubble--redirect" : ""}`}>
                        <ReactMarkdown>{formatMarkdownText(msg.text)}</ReactMarkdown>

                        {/* Redirect card - only shown when there are NO flight options cards and destination is valid */}
                        {msg.isRedirect && msg.redirectParams && (!msg.flightOptions || msg.flightOptions.length === 0) && (msg.redirectParams.airport_name || msg.redirectParams.destination) && (
                          <motion.div
                            className="ag-redirect-card"
                            onClick={() => {
                              const params = new URLSearchParams();
                              if (msg.redirectParams.destination) params.set("to", msg.redirectParams.destination);
                              if (msg.redirectParams.departure_date) params.set("depDate", msg.redirectParams.departure_date);
                              if (msg.redirectParams.cabin_class) params.set("cabinClass", msg.redirectParams.cabin_class);
                              navigate(`/flights?${params.toString()}`);
                            }}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="ag-redirect-card-title">Target Destination</div>
                            <div className="ag-redirect-card-sub">
                              {msg.redirectParams.airport_name || msg.redirectParams.destination}
                              {msg.redirectParams.departure_date && ` • ${msg.redirectParams.departure_date}`}
                              {msg.redirectParams.cabin_class && ` • ${msg.redirectParams.cabin_class}`}
                            </div>
                          </motion.div>
                        )}

                        {/* Flight Options */}
                        {msg.flightOptions && msg.flightOptions.length > 0 && (
                          <motion.div
                            className="ag-flight-options-wrapper"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                          >
                            <div className="ag-flight-options-header">
                              <div className="ag-flight-options-header-left">
                                <div className="ag-flight-options-title-main">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L2.6 8l7.4 3.1-3 3L4.5 14c-.4 0-.8.3-1 .6L2.6 16l4.6 1.4 1.4 4.6 1.4-1c.3-.2.6-.6.6-1l-.1-2.5 3-3 3.1 7.4c.1.4.5.6.8.5l1.2-1.1c.4-.2.7-.6.6-1.1z" /></svg>
                                  <span>{msg.flightOptions[0].source} → {msg.flightOptions[0].destination}</span>
                                </div>
                                <div className="ag-flight-options-title-sub">
                                  <span>{msg.flightOptions[0].date}</span>
                                  <span className="ag-bullet-dot">•</span>
                                  <span>{msg.flightOptions[0].cabin_class || msg.redirectParams?.cabin_class || "Economy"}</span>
                                  <span className="ag-bullet-dot">•</span>
                                  <span>1 Adult</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="ag-flight-options-view-all"
                                onClick={() => {
                                  const params = new URLSearchParams();
                                  params.set("from", msg.flightOptions[0].source);
                                  params.set("to", msg.flightOptions[0].destination);
                                  params.set("depDate", msg.flightOptions[0].date);
                                  const cabin = msg.flightOptions[0].cabin_class || msg.redirectParams?.cabin_class || "Economy";
                                  params.set("cabinClass", cabin);
                                  navigate(`/flights?${params.toString()}`);
                                }}
                              >
                                <span>View all</span>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                              </button>
                            </div>

                            <div className="ag-flight-options">
                              {msg.flightOptions.map((flight, idx) => (
                                <motion.div
                                  key={idx}
                                  className="ag-flight-card"
                                  onClick={() => {
                                    if (flight.id) {
                                      navigate(`/flights/${flight.id}`);
                                    } else {
                                      const params = new URLSearchParams();
                                      if (flight.source) params.set("from", flight.source);
                                      if (flight.destination) params.set("to", flight.destination);
                                      if (flight.date) params.set("depDate", flight.date);
                                      const cabin = flight.cabin_class || msg.redirectParams?.cabin_class || "Economy";
                                      params.set("cabinClass", cabin);
                                      navigate(`/flights?${params.toString()}`);
                                    }
                                  }}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  <div className="ag-flight-airline">
                                    <span>{flight.airline}</span>
                                    {flight.cabin_class && (
                                      <span className={`ag-cabin-pill ag-cabin-pill--${flight.cabin_class.toLowerCase()}`}>
                                        {flight.cabin_class}
                                      </span>
                                    )}
                                  </div>

                                  <div className="ag-flight-route">
                                    <div className="ag-flight-route-line" />
                                    <div className="ag-flight-route-dot top" />
                                    <div className="ag-flight-time-row">
                                      <span className="ag-flight-time">{flight.time}</span>
                                      <span className="ag-flight-city">{flight.source}</span>
                                    </div>
                                    <div className="ag-flight-duration">
                                      {flight.duration || "Unknown duration"} · {flight.stops !== undefined ? (flight.stops === 0 ? "Direct flight" : flight.stops === 1 ? "1 stop" : `${flight.stops} stops`) : "Direct flight"}
                                    </div>
                                    <div className="ag-flight-route-dot bottom" />
                                    <div className="ag-flight-time-row">
                                      <span className="ag-flight-time">{flight.arrival_time || "Arrive"}</span>
                                      <span className="ag-flight-city">{flight.destination}</span>
                                    </div>
                                  </div>

                                  <div className="ag-flight-price-btn">
                                    <span>Starting at ₹{flight.price}/adult</span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* Booking Cards */}
                        {msg.bookingCards && msg.bookingCards.length > 0 && (
                          <motion.div
                            className="ag-booking-cards-wrapper"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                          >
                            {msg.bookingCards.map((booking, bIdx) => (
                              <BookingCard
                                key={booking.id || bIdx}
                                booking={booking}
                                showCancelAction={!!msg.showCancelAction}
                                navigate={navigate}
                              />
                            ))}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing / Working indicator */}
                  {isLoading && (
                    <AgentWorkingIndicator steps={loadingSteps} key="working" />
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} style={{ height: '12px', flexShrink: 0 }} />
              </div>

              {/* Suggestion chips (only shown before any user message) */}
              {messages.length === 1 && (
                <motion.div
                  className="ag-suggestions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="ag-chip"
                      onClick={() => handleSend(s)}
                    >
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* Input */}
              <div className="ag-input-area">
                <div className="ag-input-row">
                  <input
                    ref={inputRef}
                    id="ag-chat-input"
                    className="ag-input"
                    placeholder="Ask about flights, bookings, or events…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                  />
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.button
                        key="stop-btn"
                        className="ag-stop-btn"
                        id="ag-stop-btn"
                        onClick={handleStop}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        title="Stop agent"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                      </motion.button>
                    ) : (
                      <motion.button
                        key="send-btn"
                        className="ag-send-btn"
                        id="ag-send-btn"
                        onClick={() => handleSend()}
                        disabled={!input.trim()}
                        whileTap={{ scale: 0.9 }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Quote */}
        {!isOpen && (
          <motion.div
            className="ag-floating-quote"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 0.6, repeat: Infinity, repeatType: "reverse", repeatDelay: 4 }}
          >
            Plan your next trip with Aero AI
          </motion.div>
        )}

        {/* Floating Action Button */}
        <motion.button
          className="ag-bubble-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="ag-bubble-ring" />
          {hasNewMessage && !isOpen && <div className="ag-new-badge" />}

          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.svg
                key="close"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.2 }}
                viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ width: '22px', height: '22px' }}
              >
                <path d="M6 9l6 6 6-6" />
              </motion.svg>
            ) : (
              <motion.img
                key="open"
                src="/robot-avatar.jpg"
                alt="Aero AI"
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
}
