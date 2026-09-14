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
import { sendAgentMessage } from "@/services/agentService";

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

// ─── Typing Indicator ────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <motion.div
      className="ag-message ag-message--bot"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
    >
      <div className="ag-avatar">✈</div>
      <div className="ag-bubble ag-bubble--bot">
        <div className="ag-typing-dots">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="ag-dot"
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 0.7,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Suggestion Chips ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "I want to see the FIFA World Cup Final 🏆",
  "Take me to the next F1 Grand Prix 🏎️",
  "Book me for Glastonbury Festival 🎵",
  "I want to watch the NBA Finals 🏀",
];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AiChatbot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "bot",
      text: "Hey! 👋 I'm your AI travel assistant. Tell me about an event you want to attend and I'll find you the best flights!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(null);
  const [pendingRedirect, setPendingRedirect] = useState(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const controls = useAnimation();

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setHasNewMessage(false);
    }
  }, [isOpen]);

  // Countdown timer for redirect
  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown === 0 && pendingRedirect) {
      const { destination, departure_date } = pendingRedirect;
      const params = new URLSearchParams();
      if (destination) params.set("dest", destination);
      if (departure_date) params.set("dep_date", departure_date);
      navigate(`/flights?${params.toString()}`);
      return;
    }
    const timer = setTimeout(() => setRedirectCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown, pendingRedirect, navigate]);

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

    // Bubble pulse animation
    controls.start({
      scale: [1, 1.15, 1],
      transition: { duration: 0.4 },
    });

    try {
      const result = await sendAgentMessage(trimmed);

      setIsLoading(false);

      if (result.action === "REDIRECT" && result.redirect_params) {
        // Show particles!
        setShowParticles(true);
        setTimeout(() => setShowParticles(false), 1200);

        addMessage("bot", result.reply_message, {
          isRedirect: true,
          redirectParams: result.redirect_params,
        });

        setPendingRedirect(result.redirect_params);
        setRedirectCountdown(4);
      } else {
        addMessage("bot", result.reply_message || "How can I help you?");
      }
    } catch (err) {
      setIsLoading(false);
      addMessage("bot", `Oops! Something went wrong: ${err.message}. Please try again.`);
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

        /* Floating bubble button — amber/gold brand accent */
        .ag-bubble-btn {
          width: 62px; height: 62px; border-radius: 50%; border: none; cursor: pointer;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 60%, #f97316 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 28px rgba(245,158,11,0.55), 0 2px 8px rgba(0,0,0,0.12);
          position: relative; overflow: visible;
        }
        .ag-bubble-btn:focus { outline: none; }
        .ag-bubble-btn svg { width: 26px; height: 26px; color: white; }
        .ag-bubble-ring {
          position: absolute; inset: -6px; border-radius: 50%;
          border: 2px solid rgba(245,158,11,0.4);
          animation: ag-ring-pulse 2.2s ease-in-out infinite;
        }
        @keyframes ag-ring-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 0; }
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

        /* Chat window — white glassmorphism, matches .glass-card */
        .ag-window {
          position: absolute; bottom: 78px; right: 0;
          width: min(400px, calc(100vw - 32px));
          height: min(560px, calc(100vh - 120px));
          border-radius: 24px; overflow: hidden;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
          display: flex; flex-direction: column;
        }

        /* Header */
        .ag-header {
          padding: 16px 18px 13px;
          background: linear-gradient(135deg, rgba(255,214,0,0.12) 0%, rgba(251,191,36,0.06) 100%);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          display: flex; align-items: center; gap: 11px; flex-shrink: 0;
        }
        .ag-header-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          display: flex; align-items: center; justify-content: center;
          font-size: 19px; box-shadow: 0 4px 12px rgba(245,158,11,0.35);
        }
        .ag-header-title { font-size: 14px; font-weight: 800; color: #1e293b; letter-spacing: -0.3px; }
        .ag-header-sub { font-size: 10.5px; color: #94a3b8; margin-top: 1px; font-weight: 500; }
        .ag-status-dot {
          width: 6px; height: 6px; background: #22c55e; border-radius: 50%;
          display: inline-block; margin-right: 5px;
          box-shadow: 0 0 5px rgba(34,197,94,0.6);
          animation: ag-blink 2s ease-in-out infinite;
        }
        @keyframes ag-blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0.35; }
        }
        .ag-close-btn {
          margin-left: auto; background: rgba(0,0,0,0.05); border: none;
          color: #94a3b8; width: 30px; height: 30px; border-radius: 8px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 15px; transition: all 0.2s;
        }
        .ag-close-btn:hover { background: rgba(0,0,0,0.09); color: #334155; }

        /* Messages area */
        .ag-messages {
          flex: 1; overflow-y: auto; padding: 14px; display: flex;
          flex-direction: column; gap: 10px; scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.1) transparent;
          background: rgba(248,250,252,0.6);
        }
        .ag-messages::-webkit-scrollbar { width: 4px; }
        .ag-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

        /* Individual messages */
        .ag-message { display: flex; align-items: flex-end; gap: 7px; }
        .ag-message--user { flex-direction: row-reverse; }
        .ag-avatar {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; box-shadow: 0 2px 6px rgba(245,158,11,0.3);
        }
        .ag-avatar--user {
          background: linear-gradient(135deg, #334155, #475569);
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .ag-bubble {
          max-width: 80%; padding: 9px 13px; border-radius: 18px;
          font-size: 13px; line-height: 1.55; word-break: break-word;
        }
        .ag-bubble--bot {
          background: white;
          border: 1px solid rgba(0,0,0,0.07);
          border-bottom-left-radius: 4px;
          color: #1e293b;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .ag-bubble--user {
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          border-bottom-right-radius: 4px;
          color: #1c1200;
          font-weight: 600;
          box-shadow: 0 4px 14px rgba(245,158,11,0.3);
        }
        .ag-bubble--redirect {
          background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.05));
          border: 1px solid rgba(34,197,94,0.2);
          color: #1e293b;
        }

        /* Redirect card inside bubble */
        .ag-redirect-card {
          margin-top: 10px; padding: 10px 12px; border-radius: 12px;
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.2);
        }
        .ag-redirect-card-title {
          font-size: 10px; color: #94a3b8; margin-bottom: 5px;
          text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;
        }
        .ag-redirect-card-dest {
          font-size: 26px; font-weight: 900; color: #b45309;
          letter-spacing: -1.5px; line-height: 1;
        }
        .ag-redirect-card-sub { font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 500; }
        .ag-redirect-countdown {
          margin-top: 8px; display: flex; align-items: center; gap: 8px;
        }
        .ag-redirect-timer {
          font-size: 11.5px; color: #b45309; font-weight: 700;
        }
        .ag-cancel-btn {
          font-size: 11px; color: #94a3b8; background: none; border: none;
          cursor: pointer; text-decoration: underline; padding: 0;
        }
        .ag-cancel-btn:hover { color: #475569; }

        /* Typing dots */
        .ag-typing-dots { display: flex; gap: 4px; padding: 4px 2px; align-items: center; }
        .ag-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #cbd5e1; display: block;
        }

        /* Suggestions */
        .ag-suggestions {
          padding: 0 14px 10px; display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
          background: rgba(248,250,252,0.6);
        }
        .ag-chip {
          background: white;
          border: 1px solid rgba(0,0,0,0.09);
          color: #475569; font-size: 11px; padding: 5px 10px;
          border-radius: 20px; cursor: pointer; transition: all 0.2s;
          white-space: nowrap; font-weight: 500;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .ag-chip:hover {
          background: rgba(255,214,0,0.12);
          border-color: rgba(245,158,11,0.35);
          color: #92400e;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(245,158,11,0.12);
        }

        /* Input area */
        .ag-input-area {
          padding: 11px 13px 13px;
          border-top: 1px solid rgba(0,0,0,0.06);
          background: white;
          flex-shrink: 0;
        }
        .ag-input-row {
          display: flex; gap: 8px; align-items: center;
          background: #f8fafc;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 16px; padding: 7px 7px 7px 13px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ag-input-row:focus-within {
          border-color: rgba(245,158,11,0.5);
          box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
          background: white;
        }
        .ag-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: #1e293b; font-size: 13px; font-family: Inter, sans-serif;
        }
        .ag-input::placeholder { color: #cbd5e1; }
        .ag-send-btn {
          width: 34px; height: 34px; border-radius: 11px; border: none; cursor: pointer;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(245,158,11,0.35);
          transition: all 0.2s; flex-shrink: 0;
        }
        .ag-send-btn:hover { transform: scale(1.08); box-shadow: 0 4px 14px rgba(245,158,11,0.5); }
        .ag-send-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
        .ag-send-btn svg { width: 15px; height: 15px; color: white; }

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

        /* Page glow sweep (amber now) */
        .ag-glow-sweep {
          position: fixed; inset: 0; z-index: 9998; pointer-events: none;
          background: radial-gradient(circle at 90% 90%, rgba(245,158,11,0.1) 0%, transparent 55%);
          animation: ag-glow-fade 1.5s ease-out forwards;
        }
        @keyframes ag-glow-fade {
          0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; }
        }
      `}</style>

      {/* ── Widget Container ──────────────────────────────────────── */}
      <div className="ag-widget">

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
                <div className="ag-header-icon">✈️</div>
                <div>
                  <div className="ag-header-title">AI Travel Assistant</div>
                  <div className="ag-header-sub">
                    <span className="ag-status-dot" />
                    Powered by LangGraph + Gemini
                  </div>
                </div>
                <button className="ag-close-btn" onClick={() => setIsOpen(false)}>✕</button>
              </div>

              {/* Messages */}
              <div className="ag-messages">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      className={`ag-message ag-message--${msg.role}`}
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    >
                      {msg.role === "bot" && <div className="ag-avatar">✈</div>}
                      {msg.role === "user" && <div className="ag-avatar ag-avatar--user">👤</div>}

                      <div className={`ag-bubble ag-bubble--${msg.role} ${msg.isRedirect ? "ag-bubble--redirect" : ""}`}>
                        {msg.text}

                        {/* Redirect card */}
                        {msg.isRedirect && msg.redirectParams && (
                          <motion.div
                            className="ag-redirect-card"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                          >
                            <div className="ag-redirect-card-title">NEAREST AIRPORT</div>
                            <div className="ag-redirect-card-dest">{msg.redirectParams.destination}</div>
                            <div className="ag-redirect-card-sub">
                              {msg.redirectParams.airport_name || ""}
                              {msg.redirectParams.departure_date && ` · ${msg.redirectParams.departure_date}`}
                            </div>

                            {redirectCountdown !== null && pendingRedirect && (
                              <div className="ag-redirect-countdown">
                                <motion.div
                                  className="ag-redirect-timer"
                                  key={redirectCountdown}
                                  initial={{ scale: 1.3, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  🚀 Redirecting in {redirectCountdown}s...
                                </motion.div>
                                <button className="ag-cancel-btn" onClick={cancelRedirect}>cancel</button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing indicator */}
                  {isLoading && (
                    <TypingIndicator key="typing" />
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
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
                    placeholder="Tell me an event you want to attend…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                  />
                  <motion.button
                    className="ag-send-btn"
                    id="ag-send-btn"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Bubble Button */}
        <motion.button
          id="ag-chat-bubble"
          className="ag-bubble-btn"
          animate={controls}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen((o) => !o)}
          title="AI Travel Assistant"
        >
          <div className="ag-bubble-ring" />
          {hasNewMessage && <div className="ag-new-badge" />}

          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.svg
                key="close"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </motion.svg>
            ) : (
              <motion.svg
                key="bot"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <circle cx="9" cy="10" r="1" fill="currentColor" />
                <circle cx="12" cy="10" r="1" fill="currentColor" />
                <circle cx="15" cy="10" r="1" fill="currentColor" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
}
