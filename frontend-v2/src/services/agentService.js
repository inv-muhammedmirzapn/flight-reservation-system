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
 * @param {Array} history - Previous message history.
 * @param {Function} onUpdate - Callback for streaming updates.
 * @param {string|null} nearestAirport - Nearest airport code.
 * @param {string|null} nearestCity - Nearest city name.
 * @param {AbortSignal|null} signal - Optional AbortSignal to cancel the request.
 * @returns {Promise<{action: string, reply_message: string, redirect_params?: object}>}
 */
export async function sendAgentMessage(message, history = [], onUpdate = null, nearestAirport = null, nearestCity = null, signal = null) {
  const body = { message, history };
  if (nearestAirport) {
    body.nearest_airport = nearestAirport;
    body.nearest_city = nearestCity;
  }

  const response = await fetch(`${API_BASE}/flights/agent/chat/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let finalData = null;
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // The last element is either an incomplete line or "" (if ended with \n).
      // Retain it in the buffer to be completed by the next TCP chunk.
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'update' && onUpdate) {
              onUpdate(data.step);
            } else if (data.type === 'final') {
              finalData = data.data;
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e);
          }
        }
      }
    }

    // Flush any remaining characters left in the TextDecoder / buffer
    buffer += decoder.decode();
    const remainingLine = buffer.trim();
    if (remainingLine.startsWith('data: ')) {
      try {
        const data = JSON.parse(remainingLine.slice(6));
        if (data.type === 'update' && onUpdate) {
          onUpdate(data.step);
        } else if (data.type === 'final') {
          finalData = data.data;
        }
      } catch (e) {
        console.error("Error parsing trailing stream buffer:", e);
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      reader.cancel().catch(() => {});
      throw err; // re-throw so caller can handle it
    }
    throw err;
  }

  return finalData || { action: "ERROR", reply_message: "Stream ended without final data." };
}
