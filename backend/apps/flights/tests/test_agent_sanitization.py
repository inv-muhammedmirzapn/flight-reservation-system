from django.test import TestCase
from unittest.mock import patch, MagicMock
from apps.flights.services_agent import (
    TOOL_STATUS_MAPPINGS,
    run_travel_agent_stream,
)
from langchain_core.messages import AIMessage, ToolMessage

class AgentStatusSanitizationTest(TestCase):
    def test_tool_status_mappings_coverage(self):
        """Ensure all known tools have friendly calling and result status messages."""
        expected_tools = [
            "search_event_details",
            "find_nearest_airport_to_city",
            "search_upcoming_flights",
        ]
        for tool_name in expected_tools:
            self.assertIn(tool_name, TOOL_STATUS_MAPPINGS)
            mapping = TOOL_STATUS_MAPPINGS[tool_name]
            self.assertIn("calling", mapping)
            self.assertIn("result", mapping)
            # Ensure none contain snake_case, 'Using tool', or 'database'
            for key in ["calling", "result"]:
                text = mapping[key]
                self.assertNotIn("Using tool", text)
                self.assertNotIn("find_nearest", text)
                self.assertNotIn("search_upcoming", text)
                self.assertNotIn("search_event", text)
                self.assertNotIn("database", text.lower())

    @patch("apps.flights.services_agent.get_agent_graph")
    def test_stream_sanitized_updates(self, mock_get_graph):
        """Ensure the SSE stream emits only human-friendly strings and never tool names or database mentions."""
        mock_graph = MagicMock()
        
        # Simulate state sequence from graph
        state1 = {
            "messages": [
                AIMessage(
                    content="",
                    tool_calls=[{"name": "find_nearest_airport_to_city", "args": {"city": "Paris", "country": "France"}, "id": "call_1"}]
                )
            ]
        }
        state2 = {
            "messages": [
                AIMessage(
                    content="",
                    tool_calls=[{"name": "find_nearest_airport_to_city", "args": {"city": "Paris", "country": "France"}, "id": "call_1"}]
                ),
                ToolMessage(content='{"iata_code": "CDG"}', tool_call_id="call_1", name="find_nearest_airport_to_city")
            ]
        }
        state3 = {
            "messages": [
                AIMessage(content='{"action": "ASK", "reply_message": "Flights found"}')
            ],
            "action": "ASK",
            "reply_message": "Flights found"
        }
        mock_graph.stream.return_value = [state1, state2, state3]
        mock_get_graph.return_value = mock_graph

        updates = list(run_travel_agent_stream("Flights to Paris"))

        step_texts = [u.get("step") for u in updates if u.get("type") == "update"]
        
        # Verify initial steps
        self.assertIn("Initializing travel assistant...", step_texts)
        self.assertIn("Analyzing your travel request...", step_texts)

        # Verify tool calling step is human-friendly
        self.assertIn("Locating nearest international airports...", step_texts)

        # Verify tool result step is human-friendly
        self.assertIn("Airport options identified...", step_texts)

        # Verify AI final step is human-friendly
        self.assertIn("Preparing your flight recommendations...", step_texts)

        # Ensure NO internal leakages exist anywhere in the steps
        for step in step_texts:
            self.assertNotIn("Using tool", step)
            self.assertNotIn("find_nearest_airport_to_city", step)
            self.assertNotIn("search_upcoming_flights", step)
            self.assertNotIn("database", step.lower())

    @patch("apps.flights.services_agent.get_agent_graph")
    def test_stream_exception_does_not_leak_internals(self, mock_get_graph):
        """Ensure exceptions don't leak str(e) into the user reply message."""
        mock_get_graph.side_effect = Exception("SECRET_DB_PASSWORD_LEAK or /var/internal/path")

        updates = list(run_travel_agent_stream("test message"))
        final_msg = next(u for u in updates if u.get("type") == "final")
        
        reply = final_msg["data"]["reply_message"]
        self.assertNotIn("SECRET_DB_PASSWORD_LEAK", reply)
        self.assertNotIn("/var/internal/path", reply)
        self.assertEqual(reply, "Sorry, I ran into an issue finding flights. Please try again in a moment.")
