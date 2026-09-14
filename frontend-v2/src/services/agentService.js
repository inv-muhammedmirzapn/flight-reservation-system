/**
 * agentService.js
 * ================
 * API helper for communicating with the LangGraph travel agent backend.
 *
 * NOTE: The Django backend wraps all responses in a standardized envelope:
 *   { "status": "success", "data": { ...actual payload... } }
 * So we unwrap the .data field before returning.
 */

// Use the same env variable the rest of the app uses (VITE_API_BASE_URL=/api)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

/**
 * Sends a user message to the LangGraph travel agent.
 *
 * @param {string} message - The user's natural language query.
 * @returns {Promise<{action: string, reply_message: string, redirect_params?: object}>}
 */
export async function sendAgentMessage(message) {
  const response = await fetch(`${API_BASE}/flights/agent/chat/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  const envelope = await response.json().catch(() => ({
    status: "error",
    data: {
      action: "ERROR",
      reply_message: `Server returned status ${response.status}. Check the backend logs.`,
    },
  }));

  if (!response.ok) {
    const msg =
      envelope?.data?.reply_message ||
      envelope?.message ||
      `Server error: ${response.status}`;
    throw new Error(msg);
  }

  // Unwrap the standardized envelope: { status, data: { action, reply_message, ... } }
  return envelope?.data ?? envelope;
}
