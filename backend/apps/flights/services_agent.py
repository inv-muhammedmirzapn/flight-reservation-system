"""
services_agent.py
=================
LangGraph-powered AI agent for event-based flight discovery.

Workflow:
  User Query  →  [extract_intent]  →  [search_event]  →  [find_airport]  →  [formulate_response]

The agent accepts a free-text user message like "I want to see the FIFA final",
intelligently extracts the event, finds its location and dates, maps to the
nearest major airport, and returns a structured JSON response that the React
frontend uses to redirect the user to the FlightsPage with pre-filled parameters.
"""

import os
import json
import logging
from typing import TypedDict, Annotated, Optional
from datetime import datetime, timedelta

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from .models import Airport

logger = logging.getLogger(__name__)

# ─── State Schema ──────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    """The state dictionary that flows through every node in the graph."""
    user_message: str
    messages: list          # LangChain message history
    event_name: Optional[str]
    event_date: Optional[str]          # ISO date string YYYY-MM-DD
    event_city: Optional[str]
    event_country: Optional[str]
    nearest_airport_iata: Optional[str]
    nearest_airport_name: Optional[str]
    suggested_travel_date: Optional[str]
    action: Optional[str]              # "REDIRECT" | "ASK" | "ERROR"
    reply_message: Optional[str]
    error: Optional[str]


# ─── Tools ─────────────────────────────────────────────────────────────────────

@tool
def search_event_details(event_query: str) -> str:
    """
    Searches for a real-world event and returns its name, date, city, and country.
    Use this when the user asks about attending a specific event like a sports final,
    concert, or festival.

    Args:
        event_query: The name of the event to search for (e.g. "FIFA World Cup Final 2026")

    Returns:
        JSON string with keys: event_name, event_date (YYYY-MM-DD), city, country.
        If not found, returns an error key.
    """
    # This uses the LLM's embedded world knowledge as the "search".
    # In production you can swap this with a real web-search API (e.g. Tavily, SerpAPI).
    # The LLM tool-caller will fill this in based on its training knowledge.
    return json.dumps({
        "note": "Use your world knowledge to answer this. Return a JSON with keys: event_name, event_date (YYYY-MM-DD), city, country. If unknown, set event_date to a best guess date string."
    })


@tool
def find_nearest_airport_to_city(city: str, country: str) -> str:
    """
    Finds the nearest major international airport to a given city.
    First checks the application's own database, then falls back to common airport knowledge.

    Args:
        city: The city name (e.g. "New York", "London")
        country: The country name (e.g. "USA", "UK")

    Returns:
        JSON string with keys: iata_code, airport_name, city, country.
    """
    try:
        # Try to find an airport in the local DB by city name
        airports = Airport.objects.filter(
            city__icontains=city
        ).order_by('-id')[:5]

        if airports.exists():
            airport = airports.first()
            return json.dumps({
                "iata_code": airport.iata_code or airport.code,
                "airport_name": airport.name,
                "city": airport.city,
                "country": country,
                "source": "database"
            })
    except Exception as db_error:
        logger.warning(f"DB lookup failed for city '{city}': {db_error}")

    # Fallback: return a flag for the LLM to use its knowledge
    return json.dumps({
        "note": f"No DB record found for {city}, {country}. Use your knowledge to provide the most important international airport IATA code for this city. Return JSON: iata_code, airport_name, city, country"
    })


# ─── LLM Initialization ────────────────────────────────────────────────────────

def _get_llm_with_tools():
    """Initialize Gemini Flash with bound tools."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set. Please add it to your backend/.env file. "
            "Get a free key at: https://aistudio.google.com/apikey"
        )

    tools = [search_event_details, find_nearest_airport_to_city]

    llm = ChatGoogleGenerativeAI(
        model="gemini-3.6-flash",
        google_api_key=api_key,
        temperature=0.1,
    )
    return llm.bind_tools(tools), tools


# ─── Graph Nodes ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a smart travel assistant for a flight reservation system.
Your job is to help users find flights to attend events (concerts, sports, festivals, etc.).

When a user mentions an event they want to attend:
1. Call search_event_details to find the event's location and date
2. Call find_nearest_airport_to_city with the event city and country
3. After getting both results, respond with a precise JSON object (and ONLY that JSON, no other text):

{
  "action": "REDIRECT",
  "event_name": "<name of the event>",
  "event_date": "<YYYY-MM-DD>",
  "event_city": "<city>",
  "event_country": "<country>",
  "airport_iata": "<IATA code>",
  "airport_name": "<full airport name>",
  "suggested_travel_date": "<YYYY-MM-DD, one day before event>",
  "reply_message": "<a short, friendly message to the user, e.g. 'Great choice! The FIFA Final is on July 19 in New Jersey. I found Newark Airport (EWR) nearby — let me find flights for you!'>"
}

If the user's request is unclear or not event-related, respond with:
{
  "action": "ASK",
  "reply_message": "<friendly follow-up question to clarify their travel plans>"
}

Always be enthusiastic and helpful. Today's date is """ + datetime.now().strftime("%B %d, %Y") + "."


def agent_node(state: AgentState) -> AgentState:
    """The main LLM reasoning node."""
    try:
        llm_with_tools, _ = _get_llm_with_tools()
    except ValueError as e:
        return {
            **state,
            "action": "ERROR",
            "reply_message": str(e),
            "error": str(e),
        }

    messages = state.get("messages", [])
    if not messages:
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=state["user_message"]),
        ]

    response = llm_with_tools.invoke(messages)
    messages = messages + [response]

    return {**state, "messages": messages}


def tools_node_func(state: AgentState) -> AgentState:
    """Executes tool calls made by the LLM."""
    tools_map = {
        "search_event_details": search_event_details,
        "find_nearest_airport_to_city": find_nearest_airport_to_city,
    }

    messages = state["messages"]
    last_message = messages[-1]
    tool_messages = []

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        tool_fn = tools_map.get(tool_name)

        if tool_fn:
            result = tool_fn.invoke(tool_args)
            tool_messages.append(
                ToolMessage(content=str(result), tool_call_id=tool_call["id"])
            )

    return {**state, "messages": messages + tool_messages}


def parse_response_node(state: AgentState) -> AgentState:
    """Parses the final LLM text response into structured state fields."""
    messages = state["messages"]
    last_message = messages[-1]

    # The last message should be a plain AI text message (no tool calls)
    raw_content = last_message.content if hasattr(last_message, "content") else str(last_message)

    # Gemini 3.x models return content as a list of parts (e.g. [{"type":"text","text":"..."}])
    # Older models return a plain string. Handle both cases.
    if isinstance(raw_content, list):
        text_parts = []
        for part in raw_content:
            if isinstance(part, dict):
                text_parts.append(part.get("text", str(part)))
            elif isinstance(part, str):
                text_parts.append(part)
            else:
                text_parts.append(str(part))
        content = "\n".join(text_parts)
    else:
        content = str(raw_content)

    try:
        # Strip markdown code block if present
        text = content.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        parsed = json.loads(text)
        action = parsed.get("action", "ASK")

        return {
            **state,
            "action": action,
            "event_name": parsed.get("event_name"),
            "event_date": parsed.get("event_date"),
            "event_city": parsed.get("event_city"),
            "event_country": parsed.get("event_country"),
            "nearest_airport_iata": parsed.get("airport_iata"),
            "nearest_airport_name": parsed.get("airport_name"),
            "suggested_travel_date": parsed.get("suggested_travel_date"),
            "reply_message": parsed.get("reply_message", "I found some flights for you!"),
        }
    except (json.JSONDecodeError, KeyError, IndexError):
        # If JSON parsing fails, treat the content as a plain ask response
        return {
            **state,
            "action": "ASK",
            "reply_message": content if content.strip() else "How can I help you plan your trip?",
        }



# ─── Routing Logic ─────────────────────────────────────────────────────────────

def should_continue(state: AgentState) -> str:
    """Decides whether to call tools or finalize the response."""
    if state.get("action") == "ERROR":
        return "end"

    messages = state["messages"]
    last_message = messages[-1]

    # If the LLM returned tool calls, execute them
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"

    # Otherwise, parse the final text response
    return "parse"


# ─── Graph Assembly ────────────────────────────────────────────────────────────

def build_agent_graph():
    """Assembles and compiles the LangGraph state machine."""
    workflow = StateGraph(AgentState)

    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tools_node_func)
    workflow.add_node("parse", parse_response_node)

    workflow.set_entry_point("agent")

    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "parse": "parse",
            "end": END,
        }
    )

    # After tools run, go back to agent for the next reasoning step
    workflow.add_edge("tools", "agent")
    # After parsing, we are done
    workflow.add_edge("parse", END)

    return workflow.compile()


# Cache the compiled graph (compile once, reuse on all requests)
_compiled_graph = None


def get_agent_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_agent_graph()
    return _compiled_graph


# ─── Public API ────────────────────────────────────────────────────────────────

def run_travel_agent(user_message: str) -> dict:
    """
    Entry point called by the Django view.
    
    Args:
        user_message: The raw natural language message from the user.
    
    Returns:
        A dictionary with:
          - action: "REDIRECT" | "ASK" | "ERROR"
          - reply_message: A friendly string to display in the chat
          - redirect_params: (only if action == "REDIRECT") dict with
            destination, departure_date, etc.
    """
    try:
        graph = get_agent_graph()
        initial_state: AgentState = {
            "user_message": user_message,
            "messages": [],
            "event_name": None,
            "event_date": None,
            "event_city": None,
            "event_country": None,
            "nearest_airport_iata": None,
            "nearest_airport_name": None,
            "suggested_travel_date": None,
            "action": None,
            "reply_message": None,
            "error": None,
        }

        final_state = graph.invoke(initial_state)

        result = {
            "action": final_state.get("action", "ASK"),
            "reply_message": final_state.get("reply_message", "How can I help you?"),
        }

        if final_state.get("action") == "REDIRECT":
            result["redirect_params"] = {
                "destination": final_state.get("nearest_airport_iata", ""),
                "departure_date": final_state.get("suggested_travel_date", ""),
                "event_name": final_state.get("event_name", ""),
                "event_date": final_state.get("event_date", ""),
                "event_city": final_state.get("event_city", ""),
                "airport_name": final_state.get("nearest_airport_name", ""),
            }

        return result

    except Exception as e:
        logger.exception(f"Travel agent failed: {e}")
        return {
            "action": "ERROR",
            "reply_message": f"Sorry, I ran into a problem: {str(e)}. Please try again.",
        }
