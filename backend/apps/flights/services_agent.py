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
    cabin_class: Optional[str]
    action: Optional[str]              # "REDIRECT" | "ASK" | "ERROR" | "BOOKING_INFO"
    reply_message: Optional[str]
    error: Optional[str]
    flight_options: list
    booking_cards: list


# ─── Tool Status Display Mappings ──────────────────────────────────────────────

TOOL_STATUS_MAPPINGS = {
    "search_event_details": {
        "calling": "Looking up event schedule & venue...",
        "result": "Event information confirmed...",
    },
    "find_nearest_airport_to_city": {
        "calling": "Locating nearest international airports...",
        "result": "Airport options identified...",
    },
    "search_upcoming_flights": {
        "calling": "Searching available flights & live fares...",
        "result": "Reviewing flight schedules...",
    },
    "get_user_recent_bookings": {
        "calling": "Retrieving your reservation history...",
        "result": "Reservation history loaded...",
    },
    "get_booking_by_pnr": {
        "calling": "Looking up reservation details...",
        "result": "Reservation details verified...",
    },
    "check_cancellation_policy": {
        "calling": "Checking cancellation & refund policies...",
        "result": "Policy details verified...",
    },
}


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
                tool_messages.append(ToolMessage(content=err_msg, tool_call_id=tool_call["id"], name=tool_call["name"]))
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
                
                tool_messages.append(ToolMessage(content=groq_res.content, tool_call_id=tool_call["id"], name=tool_call["name"]))
            except Exception as e:
                tool_messages.append(ToolMessage(content=json.dumps({"error": str(e)}), tool_call_id=tool_call["id"], name=tool_call["name"]))
        else:
            # Handle any other stray tool calls just in case
            tools_map = {
                "find_nearest_airport_to_city": find_nearest_airport_to_city,
                "search_upcoming_flights": search_upcoming_flights,
                "get_user_recent_bookings": get_user_recent_bookings,
                "get_booking_by_pnr": get_booking_by_pnr,
                "check_cancellation_policy": check_cancellation_policy,
            }
            tool_fn = tools_map.get(tool_call["name"])
            if tool_fn:
                res = tool_fn.invoke(tool_call["args"])
                tool_messages.append(ToolMessage(content=str(res), tool_call_id=tool_call["id"], name=tool_call["name"]))

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
def search_upcoming_flights(
    source_iata: str,
    destination_iata: str,
    travel_date: Optional[str] = None,
    sort_by: Optional[str] = "price",
    cabin_class: Optional[str] = None,
) -> str:
    """
    Searches the application database for actual available upcoming flights between two airports.
    Args:
        source_iata: The IATA code of the departure airport.
        destination_iata: The IATA code of the destination airport.
        travel_date: Optional travel date (YYYY-MM-DD). If omitted, returns upcoming flights from today.
        sort_by: Sorting preference: 'price' for cheapest flights first (default), or 'departure_time' for earliest departure.
        cabin_class: Optional cabin class ('ECONOMY', 'BUSINESS', or 'FIRST'). If omitted, searches all cabins.
    """
    try:
        from .models import FlightInstance
        from django.utils import timezone
        from django.db.models import Min, Q
        
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
                qs = qs.filter(date=travel_date)
                if parsed_date == timezone.now().date():
                    qs = qs.filter(scheduled_departure__gte=timezone.now())
            except ValueError:
                qs = qs.filter(date=travel_date)
        else:
            qs = qs.filter(scheduled_departure__gte=timezone.now())
            
        clean_cabin = cabin_class.strip().upper() if cabin_class else None
        if clean_cabin and clean_cabin in ["ECONOMY", "BUSINESS", "FIRST"]:
            qs = qs.filter(fares__cabin_class__iexact=clean_cabin)
            qs = qs.annotate(min_fare=Min("fares__price", filter=Q(fares__cabin_class__iexact=clean_cabin)))
        else:
            clean_cabin = None
            qs = qs.annotate(min_fare=Min("fares__price"))

        if sort_by == "departure_time":
            qs = qs.order_by("scheduled_departure")[:4]
        else:
            qs = qs.order_by("min_fare", "scheduled_departure")[:4]
        
        if not qs.exists():
            cabin_msg = f" in {clean_cabin.capitalize()} class" if clean_cabin else ""
            return json.dumps({"note": f"No available flights found from {source_iata} to {destination_iata}{cabin_msg}. Reply to the user that no flights are available from their source airport, and ask if they want to mention any other departure airports (like Delhi, for example)."})
            
        results = []
        for fi in qs:
            if clean_cabin:
                fares = fi.fares.filter(cabin_class__iexact=clean_cabin)
            else:
                fares = fi.fares.all()

            if fares.exists():
                lowest_fare = min(fares, key=lambda f: f.price)
                min_fare = lowest_fare.price
                resolved_cabin = lowest_fare.cabin_class
            else:
                min_fare = 0
                resolved_cabin = clean_cabin or "ECONOMY"
            
            # get the source and destination iata from the legs
            first_leg = fi.flight.legs.order_by('leg_order').first()
            actual_source = first_leg.departure_airport.iata_code if first_leg else source_iata
            last_leg = fi.flight.legs.order_by('leg_order').last()
            actual_dest = last_leg.arrival_airport.iata_code if last_leg else destination_iata
            
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
                "cabin_class": resolved_cabin.capitalize(),
                "source": actual_source,
                "destination": actual_dest,
                "airline": fi.flight.airline.airline_name,
            })
        return json.dumps({"flights": results})
    except Exception as e:
        return json.dumps({"error": f"Error searching flights: {e}"})


@tool
def get_user_recent_bookings(user_id: Optional[str] = None) -> str:
    """
    Retrieves recent bookings for the currently authenticated user.
    Use this when the user asks to see their bookings, trips, tickets, or reservations.

    Args:
        user_id: Optional string representation of the user ID (provided in system prompt if logged in).
    """
    try:
        from apps.bookings.models import Booking
        if not user_id:
            return json.dumps({
                "note": "The user is not logged in or no user ID was provided. Politely ask the user to log in to see their personal bookings, or provide their Booking ID / PNR reference."
            })
        
        bookings = Booking.objects.filter(user_id=user_id).select_related(
            "flight__flight__airline",
            "flight__flight",
        ).prefetch_related("flight__flight__legs", "passengers", "flight__fares").order_by("-created_at")[:5]

        if not bookings.exists():
            return json.dumps({
                "note": "No bookings found for this account. Inform the user that they do not have any active or past reservations."
            })

        results = []
        for b in bookings:
            fi = b.flight
            first_leg = fi.flight.legs.order_by("leg_order").first()
            last_leg = fi.flight.legs.order_by("leg_order").last()
            dep_iata = first_leg.departure_airport.iata_code if first_leg else ""
            dep_city = first_leg.departure_airport.city if first_leg else ""
            arr_iata = last_leg.arrival_airport.iata_code if last_leg else ""
            arr_city = last_leg.arrival_airport.city if last_leg else ""

            fare_obj = fi.fares.filter(cabin_class=b.cabin_class).first()
            refund_type = fare_obj.refund_type if fare_obj else "NON_REFUNDABLE"

            passengers_info = [
                {"name": p.name, "seat": p.seat_number or "Unassigned", "meal": p.meal_preference}
                for p in b.passengers.all()
            ]

            results.append({
                "id": str(b.id),
                "pnr": str(b.id)[:8].upper(),
                "flight_no": fi.flight.flight_no,
                "airline": fi.flight.airline.airline_name,
                "route": f"{dep_city} ({dep_iata}) → {arr_city} ({arr_iata})",
                "origin_iata": dep_iata,
                "destination_iata": arr_iata,
                "travel_date": str(fi.date),
                "departure_time": fi.scheduled_departure.strftime("%H:%M") if fi.scheduled_departure else "",
                "status": b.status,
                "cabin_class": b.cabin_class or "ECONOMY",
                "seat_count": b.seat_count,
                "seat_numbers": [p.seat_number for p in b.passengers.all() if p.seat_number],
                "total_price": float(b.total_price),
                "refund_type": refund_type,
                "passengers": passengers_info,
                "cancel_url": f"/my-bookings/cancel/{b.id}",
                "detail_url": f"/my-bookings/ticket/{b.id}",
            })

        return json.dumps({"bookings": results})
    except Exception as e:
        logger.exception(f"Error fetching user bookings: {e}")
        return json.dumps({"error": f"Failed to retrieve bookings: {e}"})


@tool
def get_booking_by_pnr(pnr_query: str) -> str:
    """
    Searches for a specific booking by its PNR or Booking ID reference (UUID or UUID prefix).
    Use this when a user asks about a specific booking code or reference.

    Args:
        pnr_query: The booking reference code or UUID string.
    """
    try:
        from apps.bookings.models import Booking
        cleaned = pnr_query.strip()
        booking = Booking.objects.filter(id__icontains=cleaned).select_related(
            "flight__flight__airline",
            "flight__flight",
        ).prefetch_related("flight__flight__legs", "passengers", "flight__fares").first()

        if not booking:
            return json.dumps({
                "note": f"No booking found matching reference '{cleaned}'. Please ask the user to double-check their booking ID."
            })

        fi = booking.flight
        first_leg = fi.flight.legs.order_by("leg_order").first()
        last_leg = fi.flight.legs.order_by("leg_order").last()
        dep_iata = first_leg.departure_airport.iata_code if first_leg else ""
        dep_city = first_leg.departure_airport.city if first_leg else ""
        arr_iata = last_leg.arrival_airport.iata_code if last_leg else ""
        arr_city = last_leg.arrival_airport.city if last_leg else ""

        fare_obj = fi.fares.filter(cabin_class=booking.cabin_class).first()
        refund_type = fare_obj.refund_type if fare_obj else "NON_REFUNDABLE"

        passengers_info = [
            {"name": p.name, "seat": p.seat_number or "Unassigned", "meal": p.meal_preference}
            for p in booking.passengers.all()
        ]

        b_data = {
            "id": str(booking.id),
            "pnr": str(booking.id)[:8].upper(),
            "flight_no": fi.flight.flight_no,
            "airline": fi.flight.airline.airline_name,
            "route": f"{dep_city} ({dep_iata}) → {arr_city} ({arr_iata})",
            "origin_iata": dep_iata,
            "destination_iata": arr_iata,
            "travel_date": str(fi.date),
            "departure_time": fi.scheduled_departure.strftime("%H:%M") if fi.scheduled_departure else "",
            "status": booking.status,
            "cabin_class": booking.cabin_class or "ECONOMY",
            "seat_count": booking.seat_count,
            "seat_numbers": [p.seat_number for p in booking.passengers.all() if p.seat_number],
            "total_price": float(booking.total_price),
            "refund_type": refund_type,
            "passengers": passengers_info,
            "cancel_url": f"/my-bookings/cancel/{booking.id}",
            "detail_url": f"/my-bookings/ticket/{booking.id}",
        }
        return json.dumps({"booking": b_data})
    except Exception as e:
        logger.exception(f"Error looking up booking by PNR: {e}")
        return json.dumps({"error": f"Failed to find booking: {e}"})


@tool
def check_cancellation_policy(booking_id_or_pnr: Optional[str] = None) -> str:
    """
    Checks cancellation and refund policy details.
    If a booking ID or PNR is supplied, inspects that specific reservation's fare rules, fees, and refund estimate.
    If omitted, returns the airline's general cancellation guidelines.

    Args:
        booking_id_or_pnr: Optional booking ID or PNR code.
    """
    try:
        from apps.bookings.models import Booking
        if booking_id_or_pnr:
            cleaned = booking_id_or_pnr.strip()
            booking = Booking.objects.filter(id__icontains=cleaned).select_related(
                "flight__flight__airline",
                "flight__flight",
            ).prefetch_related("flight__fares").first()

            if booking:
                fare_obj = booking.flight.fares.filter(cabin_class=booking.cabin_class).first()
                refund_type = fare_obj.refund_type if fare_obj else "NON_REFUNDABLE"
                total_price = float(booking.total_price)
                
                if refund_type == "REFUNDABLE":
                    fee_amount = 0.0
                    estimated_refund = total_price
                    policy_explanation = "This booking has a Fully Refundable fare (0% cancellation fee). Full price will be refunded."
                elif refund_type == "PARTIAL":
                    fee_amount = round(total_price * 0.10, 2)
                    estimated_refund = max(0.0, round(total_price - fee_amount, 2))
                    policy_explanation = "This booking has a Partial Refund fare (10% standard cancellation fee). 90% of the total will be refunded."
                else:
                    fee_amount = total_price
                    estimated_refund = 0.0
                    policy_explanation = "This is a Non-Refundable fare. The base fare cannot be refunded upon voluntary cancellation."

                return json.dumps({
                    "booking": {
                        "id": str(booking.id),
                        "pnr": str(booking.id)[:8].upper(),
                        "flight_no": booking.flight.flight.flight_no,
                        "status": booking.status,
                        "refund_type": refund_type,
                        "total_price": total_price,
                        "cancellation_fee": fee_amount,
                        "estimated_refund": estimated_refund,
                        "policy_explanation": policy_explanation,
                        "can_cancel": booking.status == "CONFIRMED",
                        "cancel_url": f"/my-bookings/cancel/{booking.id}",
                        "detail_url": f"/my-bookings/ticket/{booking.id}",
                    },
                    "instruction": "Explain the refund policy clearly, include booking_cards with cancel_url, and inform the user they can click 'Proceed to Cancel' to complete the cancellation on the cancellation page."
                })

        return json.dumps({
            "general_policy": {
                "refundable_fares": "100% refund returned to the original payment method.",
                "partial_refund_fares": "Eligible for refund minus a 10% cancellation fee.",
                "non_refundable_fares": "Base fare is non-refundable; mandatory government airport taxes may be returned.",
                "waitlist_bookings": "100% free cancellation with zero penalty prior to seat allocation.",
                "how_to_cancel": "Users can view and cancel any confirmed booking under My Bookings (/my-bookings) by clicking Cancel Ticket."
            }
        })
    except Exception as e:
        logger.exception(f"Error checking cancellation policy: {e}")
        return json.dumps({"error": f"Failed to check cancellation policy: {e}"})


# ─── LLM Initialization ────────────────────────────────────────────────────────

def _get_llm_with_tools():
    """Initialize Gemini LLM with bound tools to avoid Groq rate limits."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set. Please add it to your backend/.env file."
        )

    tools = [
        search_event_details,
        find_nearest_airport_to_city,
        search_upcoming_flights,
        get_user_recent_bookings,
        get_booking_by_pnr,
        check_cancellation_policy,
    ]

    from langchain_google_genai import ChatGoogleGenerativeAI
    llm = ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite",
        api_key=api_key,
        temperature=0.1,
    )
    return llm.bind_tools(tools), tools


# ─── Graph Nodes ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a flight reservation and travel assistant.
You can help users with:
1. Finding flights to events or cities:
   - Event: call search_event_details, then find_nearest_airport_to_city, then search_upcoming_flights.
   - Cities: call find_nearest_airport_to_city, then search_upcoming_flights.
   - CRITICAL: If a user mentions ANY event (e.g., "next F1 race"), NEVER ask for clarification about date or location. IMMEDIATELY call search_event_details.
   - search_upcoming_flights automatically sorts flights by price ascending (cheapest first). If the user asks for the cheapest flight, always recommend the flight with the lowest price among the results.
   - Cabin Class: If the user mentions a cabin class (such as 'business class', 'first class', or 'economy'), pass cabin_class to search_upcoming_flights ('BUSINESS', 'FIRST', or 'ECONOMY').
2. Managing Bookings & Checking Status:
   - When a user asks about their bookings or trips ("my bookings", "show my flights", "what's my flight status"), call get_user_recent_bookings.
   - When a user provides a booking reference or PNR ("check booking 5f3a", "status of #123"), call get_booking_by_pnr.
3. Cancellation, Refunds & Forward-to-Cancel:
   - When a user asks about cancellation policies, refund amounts, or wants to cancel ("can I cancel", "refund policy", "cancel my flight"), call check_cancellation_policy.
   - Explain the exact refund rules and estimated refund amount clearly.
   - Include booking_cards so the user can see their ticket details and click "Proceed to Cancel".
4. Respond ONLY with this exact JSON structure (no markdown/plain text wrapper):
{
  "action": "REDIRECT" or "BOOKING_INFO" or "ASK",
  "event_name": "<name or null>", "event_date": "<YYYY-MM-DD or null>", "event_city": "<city or null>", "event_country": "<country or null>",
  "airport_iata": "<dest IATA or null>", "airport_name": "<dest name or null>",
  "suggested_travel_date": "<YYYY-MM-DD or null>",
  "cabin_class": "<Economy | Business | First or null>",
  "flight_options": [ { "id": "<flight id>", "flight_no": "...", "date": "...", "time": "...", "arrival_time": "...", "duration": "...", "stops": 0, "price": 0.0, "cabin_class": "...", "source": "...", "destination": "...", "airline": "..." } ],
  "booking_cards": [ { "id": "<booking UUID>", "pnr": "<PNR>", "flight_no": "...", "airline": "...", "route": "...", "travel_date": "...", "departure_time": "...", "status": "CONFIRMED/CANCELLED", "cabin_class": "...", "seat_numbers": ["12A"], "total_price": 0.0, "refund_type": "...", "cancel_url": "...", "detail_url": "..." } ],
  "reply_message": "<Friendly, helpful response>"
}

5. GUARDRAIL: If the user asks ANY question unrelated to flights, travel, airports, events, bookings, tickets, or cancellations, you must completely REFUSE to answer the question itself. You must ONLY reply with something like: "I am a flight reservation assistant and can only help you with flights, bookings, and travel." Do NOT provide the answer or code.

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
        "get_user_recent_bookings": get_user_recent_bookings,
        "get_booking_by_pnr": get_booking_by_pnr,
        "check_cancellation_policy": check_cancellation_policy,
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
                ToolMessage(content=str(result), tool_call_id=tool_call["id"], name=tool_name)
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
            "cabin_class": parsed.get("cabin_class"),
            "flight_options": parsed.get("flight_options", []),
            "booking_cards": parsed.get("booking_cards", []),
            "reply_message": parsed.get("reply_message", "I found some flights for you!"),
        }
    except (json.JSONDecodeError, KeyError, IndexError):
        # If JSON parsing fails, treat the content as a plain ask response
        return {
            **state,
            "action": "ASK",
            "booking_cards": [],
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
            "cabin_class": None,
            "action": None,
            "reply_message": None,
            "error": None,
        }

        final_state = graph.invoke(initial_state)

        result = {
            "action": final_state.get("action", "ASK"),
            "reply_message": final_state.get("reply_message", "How can I help you?"),
            "cabin_class": final_state.get("cabin_class"),
        }

        if final_state.get("action") == "REDIRECT":
            result["redirect_params"] = {
                "destination": final_state.get("nearest_airport_iata", ""),
                "departure_date": final_state.get("suggested_travel_date", ""),
                "cabin_class": final_state.get("cabin_class") or "Economy",
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
            "reply_message": "Sorry, I ran into an issue finding flights. Please try again in a moment.",
        }

def run_travel_agent_stream(
    user_message: str,
    history: list = None,
    nearest_airport: str = None,
    nearest_city: str = None,
    user=None,
):
    history = history or []
    try:
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
        yield {"type": "update", "step": "Initializing travel assistant..."}
        
        graph = get_agent_graph()
        
        current_system_prompt = SYSTEM_PROMPT
        if nearest_airport:
            city_str = nearest_city or nearest_airport
            current_system_prompt += f"\n\nNOTE: The user's current nearest airport is {city_str} ({nearest_airport}). If they do not specify an origin city in their request, you MUST use {nearest_airport} (or {city_str}) as the starting location."

        if user and getattr(user, "is_authenticated", False):
            display_name = getattr(user, "first_name", "") or getattr(user, "username", "Traveler")
            current_system_prompt += f"\n\nAUTHENTICATED USER: The user is currently logged in as '{display_name}' (user_id='{user.id}'). When they ask about their bookings, trips, or tickets, call get_user_recent_bookings with user_id='{user.id}'."
        else:
            current_system_prompt += "\n\nANONYMOUS USER: The current user is NOT logged in. If they ask about their personal bookings without providing a PNR or reference, ask them to log in or provide their booking reference (PNR)."

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
            "cabin_class": None,
            "action": None,
            "reply_message": None,
            "error": None,
            "flight_options": [],
            "booking_cards": [],
        }

        yield {"type": "update", "step": "Analyzing your travel request..."}
        
        final_state = None
        for state in graph.stream(initial_state, stream_mode="values"):
            final_state = state
            
            messages_list = state.get("messages", [])
            if messages_list:
                last_msg = messages_list[-1]
                msg_type = getattr(last_msg, "type", "")
                
                if msg_type == "ai" and getattr(last_msg, "tool_calls", None):
                    tool_calls = last_msg.tool_calls
                    primary_tool = tool_calls[0].get("name", "") if tool_calls else ""
                    step_text = TOOL_STATUS_MAPPINGS.get(primary_tool, {}).get(
                        "calling", "Finding the best travel options..."
                    )
                    yield {"type": "update", "step": step_text}
                elif msg_type == "tool":
                    tool_name = getattr(last_msg, "name", None)
                    if not tool_name and hasattr(last_msg, "tool_call_id"):
                        for m in reversed(messages_list[:-1]):
                            if hasattr(m, "tool_calls") and m.tool_calls:
                                for tc in m.tool_calls:
                                    if tc.get("id") == last_msg.tool_call_id:
                                        tool_name = tc.get("name")
                                        break
                            if tool_name:
                                break
                    step_text = TOOL_STATUS_MAPPINGS.get(tool_name, {}).get(
                        "result", "Reviewing travel options..."
                    )
                    yield {"type": "update", "step": step_text}
                elif msg_type == "ai":
                    yield {"type": "update", "step": "Preparing your flight recommendations..."}
                    
        result = {
            "action": final_state.get("action", "ASK"),
            "reply_message": final_state.get("reply_message", "How can I help you?"),
            "booking_cards": final_state.get("booking_cards", []),
            "flight_options": final_state.get("flight_options", []),
            "cabin_class": final_state.get("cabin_class"),
        }

        if final_state.get("action") == "REDIRECT":
            result["redirect_params"] = {
                "destination": final_state.get("nearest_airport_iata", ""),
                "departure_date": final_state.get("suggested_travel_date", ""),
                "cabin_class": final_state.get("cabin_class") or "Economy",
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
            "reply_message": "Sorry, I ran into an issue finding flights. Please try again in a moment.",
        }}

