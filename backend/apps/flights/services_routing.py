import math
import heapq
from collections import deque
from typing import Dict, Any, List
from datetime import timedelta

from apps.flights.models import Airport, FlightLeg, FlightRoute


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance in kilometers between two points
    on the earth (specified in decimal degrees).
    """
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r


class FlightGraph:
    """
    Graph representation for cities (Airports) and flight connections (FlightLegs).
    """

    def __init__(self):
        # adjacency list: {airport_iata: {destination_iata: {'distance': float, 'legs': [FlightLeg, ...]}}}
        self.adj_list: Dict[str, Dict[str, Any]] = {}
        self.airports: Dict[str, Airport] = {}

    def build_graph(self):
        """
        Builds the directed graph from active flight routes and legs.
        Nodes are Airport IATA codes.
        Edges are flight legs between airports.
        """
        self.adj_list = {}
        self.airports = {}

        # Load all airports to memory for quick access
        airports_qs = Airport.objects.all()
        for airport in airports_qs:
            self.airports[airport.iata_code] = airport
            self.adj_list[airport.iata_code] = {}

        # Load active flight legs
        active_routes = FlightRoute.objects.filter(is_active=True)
        # Select related to avoid N+1 problem and prefetch fare_classes for pricing algorithms
        legs = FlightLeg.objects.filter(flight__in=active_routes).select_related(
            "departure_airport", "arrival_airport", "flight"
        ).prefetch_related("flight__fare_classes")

        for leg in legs:
            dep_code = leg.departure_airport.iata_code
            arr_code = leg.arrival_airport.iata_code

            lat1, lon1 = leg.departure_airport.latitude, leg.departure_airport.longitude
            lat2, lon2 = leg.arrival_airport.latitude, leg.arrival_airport.longitude

            # Skip legs between airports without valid coordinates
            if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
                continue

            # Calculate distance using Haversine formula
            distance = haversine(float(lat1), float(lon1), float(lat2), float(lon2))

            # Add to adjacency list
            if arr_code not in self.adj_list[dep_code]:
                self.adj_list[dep_code][arr_code] = {
                    "distance": distance,
                    "legs": [],
                }

            self.adj_list[dep_code][arr_code]["legs"].append(leg)


class RouteOptimizer:
    """
    Route optimization service applying graph algorithms.
    """

    def __init__(self):
        self.graph = FlightGraph()
        self.graph.build_graph()

    def shortest_distance_dijkstra(self, source_iata: str, dest_iata: str) -> Dict[str, Any]:
        """
        Find the route with the minimum travel distance (in km) using Dijkstra's algorithm.
        """
        source_iata = source_iata.upper()
        dest_iata = dest_iata.upper()

        if source_iata not in self.graph.adj_list or dest_iata not in self.graph.adj_list:
            return {"error": "Source or destination airport not found in the active network."}

        # min-heap priority queue
        # stores tuples of (total_distance, current_airport, path_taken)
        pq = [(0.0, source_iata, [])]

        # Keep track of shortest distances to avoid revisiting
        shortest_distances = {airport: float("inf") for airport in self.graph.adj_list}
        shortest_distances[source_iata] = 0.0

        while pq:
            current_dist, current_node, path = heapq.heappop(pq)

            # Check if we reached the destination
            if current_node == dest_iata:
                # Reconstruct the optimal path response
                total_distance = current_dist
                formatted_path = []
                
                for hop in path:
                    # Pick the first available leg for this specific hop segment
                    leg = hop["legs"][0]
                    formatted_path.append(
                        {
                            "flight_no": leg.flight.flight_no,
                            "departure_airport": leg.departure_airport.iata_code,
                            "arrival_airport": leg.arrival_airport.iata_code,
                            "distance_km": round(hop["distance"], 2),
                        }
                    )

                return {
                    "source": source_iata,
                    "destination": dest_iata,
                    "total_distance_km": round(total_distance, 2),
                    "route": formatted_path,
                }

            # If we found a shorter path previously, ignore
            if current_dist > shortest_distances[current_node]:
                continue

            # Traverse neighbors
            for neighbor, data in self.graph.adj_list[current_node].items():
                distance = data["distance"]
                new_dist = current_dist + distance

                if new_dist < shortest_distances[neighbor]:
                    shortest_distances[neighbor] = new_dist
                    
                    new_path = list(path)
                    new_path.append(
                        {
                            "legs": data["legs"],
                            "distance": distance,
                        }
                    )
                    heapq.heappush(pq, (new_dist, neighbor, new_path))

        return {"error": f"No active route found between {source_iata} and {dest_iata}."}

    def minimum_stops_bfs(self, source_iata: str, dest_iata: str) -> Dict[str, Any]:
        """
        Find the route with the fewest flight connections using BFS.
        """
        source_iata = source_iata.upper()
        dest_iata = dest_iata.upper()

        if source_iata not in self.graph.adj_list or dest_iata not in self.graph.adj_list:
            return {"error": "Source or destination airport not found in the active network."}

        # Queue stores tuples of (current_airport, path_taken)
        queue = deque([(source_iata, [])])
        visited = set([source_iata])

        while queue:
            current_node, path = queue.popleft()

            if current_node == dest_iata:
                formatted_path = []
                for hop in path:
                    leg = hop["legs"][0]
                    formatted_path.append(
                        {
                            "flight_no": leg.flight.flight_no,
                            "departure_airport": leg.departure_airport.iata_code,
                            "arrival_airport": leg.arrival_airport.iata_code,
                        }
                    )

                return {
                    "source": source_iata,
                    "destination": dest_iata,
                    "total_stops": len(formatted_path) - 1 if formatted_path else 0,
                    "route": formatted_path,
                }

            for neighbor, data in self.graph.adj_list[current_node].items():
                if neighbor not in visited:
                    visited.add(neighbor)
                    new_path = list(path)
                    new_path.append({"legs": data["legs"]})
                    queue.append((neighbor, new_path))
                    
        return {"error": f"No active route found between {source_iata} and {dest_iata}."}

    def fastest_route_dijkstra(self, source_iata: str, dest_iata: str) -> Dict[str, Any]:
        """
        Find the route with the minimum travel time using Dijkstra's algorithm.
        """
        source_iata = source_iata.upper()
        dest_iata = dest_iata.upper()

        if source_iata not in self.graph.adj_list or dest_iata not in self.graph.adj_list:
            return {"error": "Source or destination airport not found in the active network."}

        # min-heap priority queue
        # stores tuples of (total_time, current_airport, path_taken)
        pq = [(0, source_iata, [])]

        # Keep track of shortest times
        shortest_times = {airport: float("inf") for airport in self.graph.adj_list}
        shortest_times[source_iata] = 0

        while pq:
            current_time, current_node, path = heapq.heappop(pq)

            if current_node == dest_iata:
                formatted_path = []
                for hop in path:
                    leg = hop["leg"]
                    formatted_path.append(
                        {
                            "flight_no": leg.flight.flight_no,
                            "departure_airport": leg.departure_airport.iata_code,
                            "arrival_airport": leg.arrival_airport.iata_code,
                            "duration_minutes": hop["duration"],
                        }
                    )

                return {
                    "source": source_iata,
                    "destination": dest_iata,
                    "total_duration_minutes": current_time,
                    "route": formatted_path,
                }

            if current_time > shortest_times[current_node]:
                continue

            for neighbor, data in self.graph.adj_list[current_node].items():
                # Find the leg with the minimum duration
                best_leg = min(data["legs"], key=lambda l: l.flight_duration_minutes + l.layover_duration_minutes)
                
                # Standard duration calculation
                duration = best_leg.flight_duration_minutes + best_leg.layover_duration_minutes
                
                new_time = current_time + duration

                if new_time < shortest_times[neighbor]:
                    shortest_times[neighbor] = new_time
                    new_path = list(path)
                    new_path.append(
                        {
                            "leg": best_leg,
                            "duration": duration,
                        }
                    )
                    heapq.heappush(pq, (new_time, neighbor, new_path))

        return {"error": f"No active route found between {source_iata} and {dest_iata}."}

    def cheapest_route_dijkstra(self, source_iata: str, dest_iata: str) -> Dict[str, Any]:
        """
        Find the route with the minimum total ticket price using Dijkstra's algorithm.
        """
        source_iata = source_iata.upper()
        dest_iata = dest_iata.upper()

        if source_iata not in self.graph.adj_list or dest_iata not in self.graph.adj_list:
            return {"error": "Source or destination airport not found in the active network."}

        # min-heap priority queue
        # stores tuples of (total_price, current_airport, path_taken)
        pq = [(0, source_iata, [])]

        # Keep track of cheapest prices
        cheapest_prices = {airport: float("inf") for airport in self.graph.adj_list}
        cheapest_prices[source_iata] = 0

        while pq:
            current_price, current_node, path = heapq.heappop(pq)

            if current_node == dest_iata:
                formatted_path = []
                for hop in path:
                    leg = hop["leg"]
                    formatted_path.append(
                        {
                            "flight_no": leg.flight.flight_no,
                            "departure_airport": leg.departure_airport.iata_code,
                            "arrival_airport": leg.arrival_airport.iata_code,
                            "price": float(hop["price"]),
                        }
                    )

                return {
                    "source": source_iata,
                    "destination": dest_iata,
                    "total_price": float(current_price),
                    "route": formatted_path,
                }

            if current_price > cheapest_prices[current_node]:
                continue

            for neighbor, data in self.graph.adj_list[current_node].items():
                # We need to find the leg with the minimum price
                best_leg = None
                min_price = float('inf')
                
                for leg in data["legs"]:
                    # Find economy base price
                    fare_class = next((fc for fc in leg.flight.fare_classes.all() if fc.cabin_class == "ECONOMY"), None)
                    price = float(fare_class.base_price) if fare_class else float('inf')
                    if price < min_price:
                        min_price = price
                        best_leg = leg
                
                if not best_leg or min_price == float('inf'):
                    continue

                new_price = current_price + min_price

                if new_price < cheapest_prices[neighbor]:
                    cheapest_prices[neighbor] = new_price
                    new_path = list(path)
                    new_path.append(
                        {
                            "leg": best_leg,
                            "price": min_price,
                        }
                    )
                    heapq.heappush(pq, (new_price, neighbor, new_path))

        return {"error": f"No active route found between {source_iata} and {dest_iata}."}

    def recommend_routes(self, source_iata: str, dest_iata: str, k: int = 3) -> Dict[str, Any]:
        """
        Suggest the best connecting routes if a direct flight is unavailable.
        Returns the top `k` routes based on minimum stops and minimum time.
        """
        source_iata = source_iata.upper()
        dest_iata = dest_iata.upper()

        if source_iata not in self.graph.adj_list or dest_iata not in self.graph.adj_list:
            return {"error": "Source or destination airport not found in the active network."}

        # BFS approach to collect paths up to a certain depth (e.g., max 4 hops)
        queue = deque([(source_iata, [])])
        valid_routes = []
        max_hops = 4

        while queue:
            current_node, path = queue.popleft()

            if len(path) > max_hops:
                continue

            if current_node == dest_iata:
                if len(path) > 0:
                    valid_routes.append(path)
                    # Once we have enough candidate routes, we can stop searching.
                    # 5 * k is an arbitrary buffer to ensure we have enough paths to sort for duration.
                    if len(valid_routes) >= k * 5:
                        break
                continue

            for neighbor, data in self.graph.adj_list[current_node].items():
                if neighbor == source_iata:
                    continue

                # Cycle detection: don't visit an airport already in the current path
                already_visited = False
                for hop in path:
                    if hop.get("dest") == neighbor:
                        already_visited = True
                        break
                
                if already_visited:
                    continue

                new_path = list(path)
                new_path.append({
                    "dest": neighbor,
                    "legs": data["legs"]
                })
                queue.append((neighbor, new_path))

        formatted_routes = []
        for route_path in valid_routes:
            formatted_path = []
            total_duration = 0
            
            # Keep track of the arrival time of the previous leg to ensure valid connections
            previous_arrival_time = None
            is_valid_time_route = True
            
            for hop in route_path:
                valid_legs = hop["legs"]
                
                # Filter legs: the next flight must depart at least 1 hour after we land
                if previous_arrival_time:
                    min_departure_time = previous_arrival_time + timedelta(hours=1)
                    valid_legs = [l for l in valid_legs if l.scheduled_departure and l.scheduled_departure >= min_departure_time]
                
                if not valid_legs:
                    # If no flights are leaving after we land, this route is physically impossible
                    is_valid_time_route = False
                    break
                
                # Pick the leg with the minimum duration from the physically VALID legs
                best_leg = min(valid_legs, key=lambda l: l.flight_duration_minutes + l.layover_duration_minutes)
                
                # Update our arrival time for the next hop's calculation
                previous_arrival_time = best_leg.scheduled_arrival
                
                formatted_path.append(
                    {
                        "flight_no": best_leg.flight.flight_no,
                        "departure_airport": best_leg.departure_airport.iata_code,
                        "arrival_airport": best_leg.arrival_airport.iata_code,
                        "duration_minutes": best_leg.flight_duration_minutes + best_leg.layover_duration_minutes
                    }
                )
                total_duration += best_leg.flight_duration_minutes + best_leg.layover_duration_minutes

            # Only add this route to our final list if ALL connecting flights had valid timings
            if is_valid_time_route:
                formatted_routes.append({
                    "route": formatted_path,
                    "total_stops": len(formatted_path) - 1,
                    "total_duration_minutes": total_duration
                })

        # Sort by fewest stops, then by shortest duration
        formatted_routes.sort(key=lambda x: (x["total_stops"], x["total_duration_minutes"]))

        if not formatted_routes:
             return {"error": f"No valid routes found between {source_iata} and {dest_iata}."}

        return {
            "source": source_iata,
            "destination": dest_iata,
            "recommended_routes": formatted_routes[:k]
        }
