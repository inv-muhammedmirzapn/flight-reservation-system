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
 * @returns {Promise<{action: string, reply_message: string, redirect_params?: object}>}
 */
export async function sendAgentMessage(message, history = [], onUpdate = null) {
  const response = await fetch(`${API_BASE}/flights/agent/chat/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let finalData = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    
    for (const line of lines) {
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

  return finalData || { action: "ERROR", reply_message: "Stream ended without final data." };
}
