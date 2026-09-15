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

from langchain_groq import ChatGroq
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
    flight_options: list


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
                "iata_code": airport.iata_code,
                "airport_name": airport.airport_name,
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

@tool
def search_upcoming_flights(destination_iata: str, travel_date: str = None) -> str:
    """
    Searches the application database for actual available upcoming flights to a destination.
    Args:
        destination_iata: The IATA code of the destination airport.
        travel_date: Optional travel date (YYYY-MM-DD). If omitted, returns upcoming flights from today.
    """
    try:
        from .models import FlightInstance
        from django.utils import timezone
        
        qs = FlightInstance.objects.filter(
            flight__legs__arrival_airport__iata_code=destination_iata,
            status="SCHEDULED"
        )
        if travel_date:
            qs = qs.filter(date=travel_date)
        else:
            qs = qs.filter(scheduled_departure__gte=timezone.now())
            
        qs = qs.order_by("scheduled_departure")[:3]
        
        if not qs.exists():
            return json.dumps({"note": "No available flights found in the database for this date and destination."})
            
        results = []
        for fi in qs:
            fares = fi.fares.all()
            min_fare = min([f.price for f in fares]) if fares else 0
            
            # get the source iata from the first leg
            first_leg = fi.flight.legs.order_by('leg_order').first()
            source_iata = first_leg.departure_airport.iata_code if first_leg else ""
            
            stops = max(0, fi.flight.legs.count() - 1)
            if fi.scheduled_arrival and fi.scheduled_departure:
                duration_td = fi.scheduled_arrival - fi.scheduled_departure
                total_minutes = int(duration_td.total_seconds() // 60)
                hours = total_minutes // 60
                minutes = total_minutes % 60
                duration_str = f"{hours}h {minutes}m"
                arrival_time = fi.scheduled_arrival.strftime('%H:%M')
            else:
                duration_str = "Unknown"
                arrival_time = "Unknown"
            
            results.append({
                "id": fi.id,
                "flight_no": fi.flight.flight_no,
                "date": str(fi.date),
                "time": fi.scheduled_departure.strftime('%H:%M'),
                "arrival_time": arrival_time,
                "duration": duration_str,
                "stops": stops,
                "price": float(min_fare),
                "source": source_iata,
                "destination": destination_iata,
                "airline": fi.flight.airline.airline_name,
            })
        return json.dumps({"flights": results})
    except Exception as e:
        return json.dumps({"error": f"Error searching flights: {e}"})


# ─── LLM Initialization ────────────────────────────────────────────────────────

def _get_llm_with_tools():
    """Initialize Groq LLM with bound tools."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY is not set. Please add it to your backend/.env file."
        )

    tools = [search_event_details, find_nearest_airport_to_city, search_upcoming_flights]

    llm = ChatGroq(
        model="qwen/qwen3.8-27b",
        api_key=api_key,
        temperature=0.1,
        max_tokens=800,
        max_retries=0,
    )
    return llm.bind_tools(tools), tools


# ─── Graph Nodes ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a smart travel assistant for a flight reservation system.
Your job is to help users find flights. Users may ask for flights to events (concerts, sports, festivals) or they may ask for direct flights between cities.

When a user asks for flights:
1. If they mention an event, call search_event_details to find the event's location/date, then find_nearest_airport_to_city, then search_upcoming_flights.
2. If they just ask for flights between cities (e.g. "flights from Kochi to Hamburg this Sunday"), directly call find_nearest_airport_to_city for the destination (and source if needed), then call search_upcoming_flights.
3. After getting flight results, you MUST respond with a precise JSON object (and ONLY that JSON, no markdown, no other text):

{
  "action": "REDIRECT",
  "event_name": "<name of the event, or null if none>",
  "event_date": "<YYYY-MM-DD, or null>",
  "event_city": "<city, or null>",
  "event_country": "<country, or null>",
  "airport_iata": "<destination IATA code>",
  "airport_name": "<destination airport name>",
  "suggested_travel_date": "<YYYY-MM-DD>",
  "flight_options": [
      {
         "id": <flight instance ID numeric>,
         "flight_no": "<flight number>",
         "date": "<YYYY-MM-DD>",
         "time": "<HH:MM>",
         "arrival_time": "<HH:MM>",
         "duration": "<e.g. 2h 45m>",
         "stops": <integer>,
         "price": <price numeric>,
         "source": "<source IATA>",
         "destination": "<destination IATA>",
         "airline": "<airline name>"
      }
  ],
  "reply_message": "<A short, friendly message summarizing the flights you found. E.g. 'I found some great flights from Kochi to Hamburg this Sunday. Click an option below to book!'>"
}

If you cannot find flights, or the user's request is unclear, respond with:
{
  "action": "ASK",
  "reply_message": "<friendly follow-up question to clarify their travel plans>"
}

CRITICAL: Do NOT output any plain text outside the JSON. Your final response must be ONLY valid JSON.
Remember to use previous conversation history to understand context.
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
        "search_upcoming_flights": search_upcoming_flights,
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
            "flight_options": parsed.get("flight_options", []),
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

def run_travel_agent(user_message: str, history: list = None) -> dict:
    """
    Entry point called by the Django view.
    
    Args:
        user_message: The raw natural language message from the user.
        history: List of previous messages from the chat.
    
    Returns:
        A dictionary with:
          - action: "REDIRECT" | "ASK" | "ERROR"
          - reply_message: A friendly string to display in the chat
          - redirect_params: (only if action == "REDIRECT") dict with
            destination, departure_date, etc.
    """
    try:
        graph = get_agent_graph()
        
        messages = [SystemMessage(content=SYSTEM_PROMPT)]
        if history:
            for msg in history:
                role = msg.get("role")
                text = msg.get("text", "")
                if role == "user":
                    messages.append(HumanMessage(content=text))
                elif role == "bot":
                    messages.append(AIMessage(content=text))
                    
        # Append the new user message that triggered this turn
        messages.append(HumanMessage(content=user_message))
                    
        initial_state: AgentState = {
            "user_message": user_message,
            "messages": messages,
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
                "flight_options": final_state.get("flight_options", []),
            }

        return result

    except Exception as e:
        logger.exception(f"Travel agent failed: {e}")
        return {
            "action": "ERROR",
            "reply_message": f"Sorry, I ran into a problem: {str(e)}. Please try again.",
        }

def run_travel_agent_stream(user_message: str, history: list = None):
    history = history or []
    try:
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
        yield {"type": "update", "step": "Initializing AI travel agent..."}
        
        graph = get_agent_graph()
        
        messages = [SystemMessage(content=SYSTEM_PROMPT)]
        if history:
            for msg in history:
                role = msg.get("role")
                text = msg.get("text", "")
                if role == "user":
                    messages.append(HumanMessage(content=text))
                elif role == "bot":
                    messages.append(AIMessage(content=text))
                    
        messages.append(HumanMessage(content=user_message))
        
        initial_state = {
            "user_message": user_message,
            "messages": messages,
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
            "flight_options": []
        }

        yield {"type": "update", "step": "Analyzing your request..."}
        
        final_state = None
        for state in graph.stream(initial_state, stream_mode="values"):
            final_state = state
            
            messages_list = state.get("messages", [])
            if messages_list:
                last_msg = messages_list[-1]
                if getattr(last_msg, "type", "") == "ai" and getattr(last_msg, "tool_calls", None):
                    yield {"type": "update", "step": f"Using tool: {last_msg.tool_calls[0]['name']}..."}
                elif getattr(last_msg, "type", "") == "tool":
                    yield {"type": "update", "step": "Processing database results..."}
                elif getattr(last_msg, "type", "") == "ai":
                    yield {"type": "update", "step": "Thinking..."}
                    
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
                "flight_options": final_state.get("flight_options", []),
            }
            
        yield {"type": "final", "data": result}
        
    except Exception as e:
        logger.exception(f"Travel agent stream failed: {e}")
        yield {"type": "final", "data": {
            "action": "ERROR",
            "reply_message": f"Sorry, I ran into a problem: {str(e)}. Please try again.",
        }}

