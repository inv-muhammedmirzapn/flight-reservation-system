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
        <img src="/ai-logo.jpg" alt="AI" style={{width: '100%', height: '100%', borderRadius: '50%'}} />
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
                    {step}
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
  "Find me flights to New York for this weekend",
  "Take me to the upcoming tech conference in Dubai",
  "I want to visit Tokyo next week",
  "Show me upcoming flights to Paris",
];

const DEFAULT_MESSAGE = {
  id: 1,
  role: "bot",
  text: "Hey! I'm Nova AI, your intelligent travel assistant ✈️ Tell me about an event you want to attend and I'll find you the best flights!",
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AiChatbot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_chat_messages");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
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
    setLoadingSteps(["Initializing AI travel agent..."]);

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
        setLoadingSteps(prev => {
          if (prev[prev.length - 1] !== step) return [...prev, step];
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
          flightOptions: result.redirect_params?.flight_options || [],
        });
      } else {
        addMessage("bot", result.reply_message || "How can I help you?");
      }
    } catch (err) {
      setIsLoading(false);
      setLoadingSteps([]);
      abortControllerRef.current = null;
      if (err.name === "AbortError") {
        addMessage("bot", "Stopped. Let me know if you'd like to try a different search.");
      } else {
        addMessage("bot", `Oops! Something went wrong: ${err.message}. Please try again.`);
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
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2a1a 100%);
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
          width: 48px; height: 48px; border-radius: 14px;
          overflow: hidden; flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(255,215,0,0.35);
        }
        .ag-header-icon img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          border-radius: 14px;
        }
        .ag-header-title { font-size: 14.5px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; }
        .ag-header-sub { font-size: 10.5px; color: rgba(255,255,255,0.55); margin-top: 2px; font-weight: 500; display: flex; align-items: center; gap: 5px; }
        .ag-status-dot {
          width: 6px; height: 6px; background: #22c55e; border-radius: 50%;
          display: inline-block; margin-right: 5px;
          box-shadow: 0 0 5px rgba(34,197,94,0.6);
          animation: ag-blink 2s ease-in-out infinite;
        }
        @keyframes ag-blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0.35; }
        }
        .ag-clear-btn {
          display: flex; align-items: center; gap: 5px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.14);
          color: rgba(255,255,255,0.55);
          font-size: 11px; font-weight: 600; letter-spacing: 0.3px;
          padding: 5px 10px; border-radius: 20px;
          cursor: pointer; transition: all 0.2s; font-family: Inter, sans-serif;
          margin-right: 6px;
        }
        .ag-clear-btn:hover {
          background: rgba(255,215,0,0.12);
          border-color: rgba(255,215,0,0.45);
          color: #ffd700;
        }
        .ag-close-btn {
          margin-left: auto; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 15px; transition: all 0.2s;
        }
        .ag-close-btn:hover { background: rgba(255,215,0,0.15); border-color: rgba(255,215,0,0.4); color: #ffd700; }

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
          padding: 12px 14px; display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 1px solid rgba(15,23,42,0.06);
        }
        .ag-flight-options-title-main { font-size: 14px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px; }
        .ag-flight-options-title-sub { font-size: 11.5px; color: #64748b; font-weight: 500; margin-top: 4px; }
        .ag-flight-options-view-all { font-size: 12px; color: #ffd700; background: #0f172a; padding: 4px 8px; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 2px; transition: opacity 0.2s; }
        .ag-flight-options-view-all:hover { opacity: 0.9; }
        
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
        .ag-flight-airline { font-size: 13px; color: #0f172a; font-weight: 700; display: flex; align-items: center; gap: 6px; }
        
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
                  <img src="/ai-logo.jpg" alt="Nova AI" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ag-header-title">Nova AI</div>
                  <div className="ag-header-sub">
                    <span style={{ color: '#ffd700', fontWeight: '700', fontSize: '10.5px' }}>
                      Intelligent Flight Companion
                    </span>
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
                          <img src="/ai-logo.jpg" alt="AI" style={{width: '100%', height: '100%', borderRadius: '50%'}} />
                        </div>
                      )}
                      {msg.role === "user" && (
                        <div className="ag-avatar ag-avatar--user">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                          </svg>
                        </div>
                      )}

                      <div className={`ag-bubble ag-bubble--${msg.role} ${msg.isRedirect ? "ag-bubble--redirect" : ""}`}>
                        {msg.text}

                        {/* Redirect card */}
                        {msg.isRedirect && msg.redirectParams && (
                          <motion.div
                            className="ag-redirect-card"
                             onClick={() => {
                               const params = new URLSearchParams();
                               if (msg.redirectParams.destination) params.set("to", msg.redirectParams.destination);
                               if (msg.redirectParams.departure_date) params.set("depDate", msg.redirectParams.departure_date);
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
                              <div>
                                <div className="ag-flight-options-title-main">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L2.6 8l7.4 3.1-3 3L4.5 14c-.4 0-.8.3-1 .6L2.6 16l4.6 1.4 1.4 4.6 1.4-1c.3-.2.6-.6.6-1l-.1-2.5 3-3 3.1 7.4c.1.4.5.6.8.5l1.2-1.1c.4-.2.7-.6.6-1.1z"/></svg>
                                  {msg.flightOptions[0].source} → {msg.flightOptions[0].destination}
                                </div>
                                <div className="ag-flight-options-title-sub">
                                  {msg.flightOptions[0].date} | 1 Adult
                                </div>
                              </div>
                              <div 
                                className="ag-flight-options-view-all"
                                onClick={() => {
                                  const params = new URLSearchParams();
                                  params.set("from", msg.flightOptions[0].source);
                                  params.set("to", msg.flightOptions[0].destination);
                                  params.set("depDate", msg.flightOptions[0].date);
                                  navigate(`/flights?${params.toString()}`);
                                }}
                              >
                                View all
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                              </div>
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
                                      navigate(`/flights?${params.toString()}`);
                                    }
                                  }}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  <div className="ag-flight-airline">
                                    {flight.airline}
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
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
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
                    placeholder="Tell me an event you want to attend…"
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
            Plan your next trip with Nova AI
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
                src="/ai-logo.jpg"
                alt="AI"
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
