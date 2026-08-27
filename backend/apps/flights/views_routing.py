from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.flights.services_routing import RouteOptimizer


class ShortestDistanceRouteView(APIView):
    """
    API endpoint to find the shortest distance route between two airports
    using Dijkstra's algorithm.
    """

    @extend_schema(
        parameters=[
            OpenApiParameter(name="source", description="Source Airport IATA Code", required=True, type=str),
            OpenApiParameter(name="destination", description="Destination Airport IATA Code", required=True, type=str),
        ],
        responses={200: dict, 400: dict, 404: dict}
    )
    def get(self, request, *args, **kwargs):
        source_iata = request.query_params.get("source")
        dest_iata = request.query_params.get("destination")

        if not source_iata or not dest_iata:
            return Response(
                {"error": "Both 'source' and 'destination' query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        optimizer = RouteOptimizer()
        result = optimizer.shortest_distance_dijkstra(source_iata, dest_iata)

        if "error" in result:
            return Response(result, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)


class MinimumStopsRouteView(APIView):
    """
    API endpoint to find the route with the fewest flight connections using BFS.
    """

    @extend_schema(
        parameters=[
            OpenApiParameter(name="source", description="Source Airport IATA Code", required=True, type=str),
            OpenApiParameter(name="destination", description="Destination Airport IATA Code", required=True, type=str),
        ],
        responses={200: dict, 400: dict, 404: dict}
    )
    def get(self, request, *args, **kwargs):
        source_iata = request.query_params.get("source")
        dest_iata = request.query_params.get("destination")

        if not source_iata or not dest_iata:
            return Response(
                {"error": "Both 'source' and 'destination' query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        optimizer = RouteOptimizer()
        result = optimizer.minimum_stops_bfs(source_iata, dest_iata)

        if "error" in result:
            return Response(result, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)


class FastestRouteView(APIView):
    """
    API endpoint to find the route with the minimum travel time using Dijkstra.
    """

    @extend_schema(
        parameters=[
            OpenApiParameter(name="source", description="Source Airport IATA Code", required=True, type=str),
            OpenApiParameter(name="destination", description="Destination Airport IATA Code", required=True, type=str),
        ],
        responses={200: dict, 400: dict, 404: dict}
    )
    def get(self, request, *args, **kwargs):
        source_iata = request.query_params.get("source")
        dest_iata = request.query_params.get("destination")

        if not source_iata or not dest_iata:
            return Response(
                {"error": "Both 'source' and 'destination' query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        optimizer = RouteOptimizer()
        result = optimizer.fastest_route_dijkstra(source_iata, dest_iata)

        if "error" in result:
            return Response(result, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)


class RecommendRoutesView(APIView):
    """
    API endpoint to suggest the top 3 best connecting routes if a direct flight
    is unavailable.
    """

    @extend_schema(
        parameters=[
            OpenApiParameter(name="source", description="Source Airport IATA Code", required=True, type=str),
            OpenApiParameter(name="destination", description="Destination Airport IATA Code", required=True, type=str),
        ],
        responses={200: dict, 400: dict, 404: dict}
    )
    def get(self, request, *args, **kwargs):
        source_iata = request.query_params.get("source")
        dest_iata = request.query_params.get("destination")

        if not source_iata or not dest_iata:
            return Response(
                {"error": "Both 'source' and 'destination' query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        optimizer = RouteOptimizer()
        # Default K is 3 as per requirements
        result = optimizer.recommend_routes(source_iata, dest_iata, k=3)

        if "error" in result:
            return Response(result, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)


