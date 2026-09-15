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
    Use this when the user asks about attending an event (e.g., a sports match, concert, festival).
    If the user asks for the "next" or "latest" instance of a recurring event (like "next F1 race"), pass that exact phrase as the query rather than asking the user for clarification.
    
    Args:
        event_query: The name of the event or phrase to search for (e.g., "next F1 race").
    """
    # This tool is intercepted by the researcher_node.
    pass


def researcher_node(state: AgentState) -> AgentState:
    """A specialized node using Gemini to perform deep web research."""
    messages = state["messages"]
    last_message = messages[-1]
    tool_messages = []
    
    api_key = os.environ.get("GROQ_API_KEY", "")
    
    for tool_call in last_message.tool_calls:
        if tool_call["name"] == "search_event_details":
            if not api_key:
                err_msg = json.dumps({"error": "GROQ_API_KEY is missing. Cannot perform web research."})
                tool_messages.append(ToolMessage(content=err_msg, tool_call_id=tool_call["id"]))
                continue
                
            query = tool_call["args"].get("event_query", "")
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                from langchain_community.tools.tavily_search import TavilySearchResults
                
                # 1. Search the web
                search = TavilySearchResults(max_results=3)
                current_date = datetime.now().strftime("%Y-%m-%d")
                raw_results = search.invoke(f"When and where is {query} taking place? Today is {current_date}")
                
                # 2. Use Groq to extract structured data
                groq_llm = ChatGroq(model="openai/gpt-oss-20b", api_key=api_key, temperature=0)
                prompt = f"Today is {current_date}. Web search results for '{query}':\n{raw_results}\n\nExtract the event_name, event_date (YYYY-MM-DD), city, and country for the most immediate upcoming instance of this event. Return ONLY a valid JSON object."
                groq_res = groq_llm.invoke(prompt)
                
                tool_messages.append(ToolMessage(content=groq_res.content, tool_call_id=tool_call["id"]))
            except Exception as e:
                tool_messages.append(ToolMessage(content=json.dumps({"error": str(e)}), tool_call_id=tool_call["id"]))
        else:
            # Handle any other stray tool calls just in case
            tools_map = {
                "find_nearest_airport_to_city": find_nearest_airport_to_city,
                "search_upcoming_flights": search_upcoming_flights,
            }
            tool_fn = tools_map.get(tool_call["name"])
            if tool_fn:
                res = tool_fn.invoke(tool_call["args"])
                tool_messages.append(ToolMessage(content=str(res), tool_call_id=tool_call["id"]))

    return {**state, "messages": messages + tool_messages}


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
def search_upcoming_flights(source_iata: str, destination_iata: str, travel_date: Optional[str] = None) -> str:
    """
    Searches the application database for actual available upcoming flights between two airports.
    Args:
        source_iata: The IATA code of the departure airport.
        destination_iata: The IATA code of the destination airport.
        travel_date: Optional travel date (YYYY-MM-DD). If omitted, returns upcoming flights from today.
    """
    try:
        from .models import FlightInstance
        from django.utils import timezone
        
        qs = FlightInstance.objects.filter(
            flight__legs__departure_airport__iata_code__iexact=source_iata
        ).filter(
            flight__legs__arrival_airport__iata_code__iexact=destination_iata
        ).filter(
            status="SCHEDULED"
        ).distinct()
        
        if travel_date:
            try:
                from datetime import datetime
                parsed_date = datetime.strptime(travel_date, "%Y-%m-%d").date()
                if parsed_date < timezone.now().date():
                    return json.dumps({"note": f"The travel date {travel_date} is in the past. Tell the user that the event has already passed, and no flights can be booked."})
            except ValueError:
                pass
            qs = qs.filter(date=travel_date)
            # Also ensure we only return flights that haven't departed yet even if it's today
            qs = qs.filter(scheduled_departure__gte=timezone.now())
        else:
            qs = qs.filter(scheduled_departure__gte=timezone.now())
            
        qs = qs.order_by("scheduled_departure")[:2]
        
        if not qs.exists():
            return json.dumps({"note": f"No available flights found from {source_iata} to {destination_iata}. Reply to the user that no flights are available from their source airport, and ask if they want to mention any other departure airports (like Delhi, for example)."})
            
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
    """Initialize Gemini LLM with bound tools to avoid Groq rate limits."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set. Please add it to your backend/.env file."
        )

    tools = [search_event_details, find_nearest_airport_to_city, search_upcoming_flights]

    from langchain_google_genai import ChatGoogleGenerativeAI
    llm = ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite",
        api_key=api_key,
        temperature=0.1,
    )
    return llm.bind_tools(tools), tools


# ─── Graph Nodes ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a flight reservation assistant.
Users ask for flights to events or cities.
1. Event: call search_event_details, then find_nearest_airport_to_city, then search_upcoming_flights.
   - CRITICAL RULE: If a user mentions ANY event (e.g., "next F1 race", "World Cup"), you must NEVER ask for clarification about the location, country, or date. IMMEDIATELY call search_event_details with the user's exact phrase. The web search tool is responsible for finding the location, not the user.
2. Cities: call find_nearest_airport_to_city, then search_upcoming_flights.
3. For search_upcoming_flights, you MUST provide a source_iata. If the user explicitly mentions a departure city, use that. If the user does not mention a departure city, use the nearest_airport provided in your system instructions below.
4. Respond ONLY with this exact JSON structure (no markdown/text):
{
  "action": "REDIRECT" or "ASK",
  "event_name": "<name or null>", "event_date": "<YYYY-MM-DD or null>", "event_city": "<city or null>", "event_country": "<country or null>",
  "airport_iata": "<dest IATA>", "airport_name": "<dest name>",
  "suggested_travel_date": "<YYYY-MM-DD>",
  "flight_options": [ { "id": "<real flight id>", "flight_no": "...", "date": "...", "time": "...", "arrival_time": "...", "duration": "...", "stops": "<int>", "price": "<float>", "source": "...", "destination": "...", "airline": "..." } ],
  "reply_message": "<Friendly summary or question>"
}

5. GUARDRAIL: If the user asks ANY question unrelated to flights, travel, airports, or events (e.g., coding, math, general trivia, jokes), you must completely REFUSE to answer the question itself. You must ONLY reply with something like: "I am a flight reservation assistant and can only help you with flights and travel." Do NOT provide the answer or code.

CRITICAL: Output ONLY valid JSON. Use history for context. Today's date: """ + datetime.now().strftime("%Y-%m-%d") + "."


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
        if any(tc["name"] == "search_event_details" for tc in last_message.tool_calls):
            return "researcher"
        return "tools"

    # Otherwise, parse the final text response
    return "parse"


# ─── Graph Assembly ────────────────────────────────────────────────────────────

def build_agent_graph():
    """Assembles and compiles the LangGraph state machine."""
    workflow = StateGraph(AgentState)

    workflow.add_node("agent", agent_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("tools", tools_node_func)
    workflow.add_node("parse", parse_response_node)

    workflow.set_entry_point("agent")

    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "researcher": "researcher",
            "tools": "tools",
            "parse": "parse",
            "end": END,
        }
    )

    # After tools/research run, go back to agent for the next reasoning step
    workflow.add_edge("researcher", "agent")
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

def run_travel_agent_stream(user_message: str, history: list = None, nearest_airport: str = None, nearest_city: str = None):
    history = history or []
    try:
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
        yield {"type": "update", "step": "Initializing AI travel agent..."}
        
        graph = get_agent_graph()
        
        current_system_prompt = SYSTEM_PROMPT
        if nearest_airport:
            city_str = nearest_city or nearest_airport
            current_system_prompt += f"\n\nNOTE: The user's current nearest airport is {city_str} ({nearest_airport}). If they do not specify an origin city in their request, you MUST use {nearest_airport} (or {city_str}) as the starting location."

        messages = [SystemMessage(content=current_system_prompt)]
        if history:
            # Keep only the last 2 messages to heavily save tokens
            history = history[-2:]
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

