import csv
import io
from django.http import Http404
from django.db import IntegrityError
from django.db.models import Count, Q
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as rf_serializers

from .models import (
    Flight,
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance,
    Seat, SeatStatus, CabinClass,
    Fare, FoodItem, FlightMeal, FlightMealItem,
)
from .serializers import (
    FlightSerializer,
    CountrySerializer, AirportSerializer, AirlineSerializer,
    AircraftModelSerializer, AircraftSerializer,
    FlightRouteSerializer, FlightLegSerializer,
    FlightInstanceSerializer,
    SeatSerializer, FareSerializer,
    FoodItemSerializer, FlightMealSerializer,
)
from .permissions import IsAdminOrSuperuser


from .pagination import StandardPagination


class AdminModelViewSet(viewsets.ModelViewSet):
    """Base viewset: list/retrieve public, write actions admin-only."""
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminOrSuperuser()]

    def perform_create(self, serializer):
        try:
            serializer.save()
        except DjangoValidationError as exc:
            # Convert Django ValidationError (from model.full_clean()) to DRF 400
            from rest_framework.exceptions import ValidationError as DRFValidationError
            if hasattr(exc, 'message_dict'):
                raise DRFValidationError(exc.message_dict)
            raise DRFValidationError(exc.messages)

    def perform_update(self, serializer):
        try:
            serializer.save()
        except DjangoValidationError as exc:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            if hasattr(exc, 'message_dict'):
                raise DRFValidationError(exc.message_dict)
            raise DRFValidationError(exc.messages)


# ─── Legacy Flight views (UNCHANGED) ───────────────────────────────────────────

class FlightPagination(PageNumberPagination):
    """Return 10 flights per page. Clients pass ?page=N."""
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 2000
    page_query_param = "page"


class FlightStatsView(APIView):
    """
    GET /api/flights/stats/
    Returns aggregate flight counts by status.
    """
    permission_classes = [AllowAny]

    @extend_schema(responses={200: inline_serializer("FlightStatsResponse", {
        "total": rf_serializers.IntegerField(),
        "scheduled": rf_serializers.IntegerField(),
        "delayed": rf_serializers.IntegerField(),
        "cancelled": rf_serializers.IntegerField(),
        "boarding": rf_serializers.IntegerField(),
        "departed": rf_serializers.IntegerField(),
        "arrived": rf_serializers.IntegerField(),
    })})
    def get(self, request, *args, **kwargs) -> Response:
        rows = Flight.objects.values("status").annotate(count=Count("id"))
        stats = {"total": Flight.objects.count(), "scheduled": 0, "delayed": 0,
                 "cancelled": 0, "boarding": 0, "departed": 0, "arrived": 0}
        for row in rows:
            key = row["status"].lower()
            if key in stats:
                stats[key] = row["count"]
        return Response(stats, status=status.HTTP_200_OK)


class FlightListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAdminOrSuperuser()]

    @extend_schema(responses=FlightSerializer(many=True))
    def get(self, request, *args, **kwargs) -> Response:
        ordering = request.query_params.get("ordering", "").strip()
        allowed_orderings = [
            "departure_time", "-departure_time", "arrival_time", "-arrival_time",
            "base_fare", "-base_fare", "flight_number", "-flight_number",
            "status", "-status", "airline", "-airline"
        ]
        qs = (
            Flight.objects.all().order_by(ordering)
            if ordering in allowed_orderings
            else Flight.objects.all().order_by("-departure_time")
        )

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(flight_number__icontains=search) | Q(airline__icontains=search) |
                Q(source_airport__icontains=search) | Q(destination_airport__icontains=search)
            )
        status_filter = request.query_params.get("status", "").strip().upper()
        if status_filter:
            qs = qs.filter(status=status_filter)
        source = request.query_params.get("source", "").strip()
        if source:
            qs = qs.filter(source_airport__icontains=source)
        destination = request.query_params.get("destination", "").strip()
        if destination:
            qs = qs.filter(destination_airport__icontains=destination)
        date = request.query_params.get("date", "").strip()
        if date:
            qs = qs.filter(departure_time__date=date)
        arrival_date = request.query_params.get("arrival_date", "").strip()
        if arrival_date:
            qs = qs.filter(arrival_time__date=arrival_date)
        min_fare = request.query_params.get("min_fare")
        if min_fare is not None:
            try:
                qs = qs.filter(base_fare__gte=float(min_fare))
            except ValueError:
                pass
        max_fare = request.query_params.get("max_fare")
        if max_fare is not None:
            try:
                qs = qs.filter(base_fare__lte=float(max_fare))
            except ValueError:
                pass
        stops = request.query_params.get("stops")
        if stops:
            try:
                stop_counts = [int(s.strip()) for s in stops.split(",")]
                q_objects = Q()
                for count in stop_counts:
                    if count >= 2:
                        q_objects |= Q(stops__len__gte=2)
                    else:
                        q_objects |= Q(stops__len=count)
                qs = qs.filter(q_objects)
            except ValueError:
                pass
        passengers = request.query_params.get("passengers")
        if passengers:
            try:
                p_count = int(passengers)
                qs = qs.filter(Q(available_seats__gte=p_count) | Q(available_seats=0))
            except ValueError:
                pass

        # Cabin class filter — find legacy flights that have a Fare for the given class
        cabin_class = request.query_params.get("class", "").strip()
        if cabin_class:
            # Map display names to model values
            class_map = {
                "Economy": "ECONOMY",
                "Business": "BUSINESS",
                "First": "FIRST",
                "ECONOMY": "ECONOMY",
                "BUSINESS": "BUSINESS",
                "FIRST": "FIRST",
            }
            cabin_value = class_map.get(cabin_class)
            if cabin_value:
                from .models import FlightInstance, Fare
                # Find flight_numbers that have an instance with a fare for this class
                matching_flight_nos = (
                    Fare.objects
                    .filter(cabin_class=cabin_value)
                    .values_list('flight_instance__flight__flight_no', flat=True)
                    .distinct()
                )
                qs = qs.filter(flight_number__in=list(matching_flight_nos))

        paginator = FlightPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = FlightSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(request=FlightSerializer, responses={201: FlightSerializer})
    def post(self, request, *args, **kwargs) -> Response:
        serializer = FlightSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except (IntegrityError, DjangoValidationError) as exc:
            return Response({"non_field_errors": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)


class FlightDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAdminOrSuperuser()]

    def get_object(self, pk):
        try:
            return Flight.objects.get(pk=pk)
        except (Flight.DoesNotExist, ValueError, DjangoValidationError):
            raise Http404

    @extend_schema(responses=FlightSerializer)
    def get(self, request, id, *args, **kwargs) -> Response:
        flight = self.get_object(id)
        return Response(FlightSerializer(flight).data, status=status.HTTP_200_OK)

    @extend_schema(responses={204: None})
    def delete(self, request, id, *args, **kwargs) -> Response:
        self.get_object(id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FlightUpdateView(APIView):
    permission_classes = [IsAdminOrSuperuser]

    def get_object(self, pk):
        try:
            return Flight.objects.get(pk=pk)
        except (Flight.DoesNotExist, ValueError, DjangoValidationError):
            raise Http404

    @extend_schema(request=FlightSerializer, responses={200: FlightSerializer})
    def put(self, request, id, *args, **kwargs) -> Response:
        flight = self.get_object(id)
        old_available = flight.available_seats
        serializer = FlightSerializer(flight, data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            flight = serializer.save()
            if flight.available_seats > old_available:
                from apps.waitlist.services import process_waitlist_allocations
                process_waitlist_allocations(flight)
                flight.refresh_from_db()
            return Response(FlightSerializer(flight).data, status=status.HTTP_200_OK)
        except (IntegrityError, DjangoValidationError) as exc:
            return Response({"non_field_errors": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(request=FlightSerializer, responses={200: FlightSerializer})
    def patch(self, request, id, *args, **kwargs) -> Response:
        flight = self.get_object(id)
        old_available = flight.available_seats
        serializer = FlightSerializer(flight, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            flight = serializer.save()
            if flight.available_seats > old_available:
                from apps.waitlist.services import process_waitlist_allocations
                process_waitlist_allocations(flight)
                flight.refresh_from_db()
            return Response(FlightSerializer(flight).data, status=status.HTTP_200_OK)
        except (IntegrityError, DjangoValidationError) as exc:
            return Response({"non_field_errors": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)


def _process_flight_records(records):
    created_flights, errors = [], []
    for index, item in enumerate(records):
        flight_number = item.get("flight_number", f"Item #{index + 1}")
        serializer = FlightSerializer(data=item)
        if serializer.is_valid():
            try:
                serializer.save()
                created_flights.append(serializer.data)
            except (IntegrityError, DjangoValidationError) as exc:
                errors.append({"flight_number": flight_number, "errors": {"non_field_errors": [str(exc)]}})
        else:
            errors.append({"flight_number": flight_number, "errors": serializer.errors})
    return created_flights, errors


class FlightBulkImportView(APIView):
    permission_classes = [IsAdminOrSuperuser]

    @extend_schema(
        request=inline_serializer("FlightBulkImportRequest", {
            "flights": rf_serializers.ListField(child=FlightSerializer(), required=False),
            "file": rf_serializers.FileField(required=False),
        }),
        responses={200: inline_serializer("FlightBulkImportResponse", {
            "created_count": rf_serializers.IntegerField(),
            "created_flights": rf_serializers.ListField(child=FlightSerializer()),
            "errors": rf_serializers.ListField(child=rf_serializers.DictField()),
        })}
    )
    def post(self, request, *args, **kwargs) -> Response:
        csv_file = request.FILES.get("file")
        if csv_file is not None:
            if not csv_file.name.lower().endswith(".csv"):
                return Response({"detail": "Uploaded file must have a .csv extension."},
                                status=status.HTTP_400_BAD_REQUEST)
            try:
                text = csv_file.read().decode("utf-8-sig")
                reader = csv.DictReader(io.StringIO(text))
                records = [dict(row) for row in reader]
            except Exception as exc:
                return Response({"detail": f"Failed to parse CSV file: {exc}"},
                                status=status.HTTP_400_BAD_REQUEST)
            if not records:
                return Response({"detail": "CSV file is empty or has no data rows."},
                                status=status.HTTP_400_BAD_REQUEST)
            created_flights, errors = _process_flight_records(records)
            return Response({"created_count": len(created_flights), "created_flights": created_flights,
                             "errors": errors}, status=status.HTTP_200_OK)

        data = request.data
        if isinstance(data, dict):
            data = data.get("flights", [])
        if not isinstance(data, list):
            return Response({"detail": "Invalid format. Expected a JSON array of flights or a CSV file upload."},
                            status=status.HTTP_400_BAD_REQUEST)
        created_flights, errors = _process_flight_records(data)
        return Response({"created_count": len(created_flights), "created_flights": created_flights,
                         "errors": errors}, status=status.HTTP_200_OK)


# ─── New entity ViewSets ────────────────────────────────────────────────────────

class CountryViewSet(AdminModelViewSet):
    queryset = Country.objects.all().order_by("id")
    serializer_class = CountrySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "iso_code"]
    ordering_fields = ["id", "name", "iso_code"]

    @action(detail=False, methods=["post"], url_path="populate-presets")
    def populate_presets(self, request):
        """
        POST /api/v2/countries/populate-presets/
        Populate standard ISO countries using pycountry.
        """
        import pycountry
        created_count = 0
        updated_count = 0
        for c in pycountry.countries:
            iso_code = c.alpha_2.upper()
            name = c.name
            country_obj = Country.objects.filter(iso_code=iso_code).first()
            if country_obj:
                if country_obj.name != name:
                    country_obj.name = name
                    country_obj.save()
                    updated_count += 1
            else:
                Country.objects.create(name=name, iso_code=iso_code)
                created_count += 1
        return Response({
            "detail": f"Successfully populated countries. Created {created_count}, updated {updated_count}.",
            "created_count": created_count,
            "updated_count": updated_count
        }, status=status.HTTP_200_OK)


class AirportViewSet(AdminModelViewSet):
    queryset = Airport.objects.select_related("country").all()
    serializer_class = AirportSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["iata_code", "airport_name", "city"]

    def get_queryset(self):
        qs = super().get_queryset()
        country_id = self.request.query_params.get("country")
        if country_id:
            qs = qs.filter(country_id=country_id)
        # ?q= does prefix search (startswith) across city, iata_code, airport_name, country
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(city__istartswith=q) |
                Q(iata_code__istartswith=q) |
                Q(airport_name__istartswith=q) |
                Q(country__name__istartswith=q)
            )
        # fallback: ?search= still works (contains) for admin pages
        search = self.request.query_params.get("search", "").strip()
        if search and not q:
            qs = qs.filter(
                Q(city__icontains=search) |
                Q(iata_code__icontains=search) |
                Q(airport_name__icontains=search) |
                Q(country__name__icontains=search)
            )
        return qs.order_by("city")

    @action(detail=False, methods=["post"], url_path="import-openflights")
    def import_openflights(self, request):
        """
        POST /api/v2/airports/import-openflights/
        Import airport data from OpenFlights.
        Accepts:
          - A file upload (in form-data request.FILES['file'])
          - Or if no file is uploaded, fetches automatically from OpenFlights URL.
          - ?overwrite=true query param to overwrite existing records.
          - ?limit=N to limit the number of imported records.
        """
        from decimal import Decimal
        import requests
        import csv
        import io
        import pycountry

        overwrite = request.query_params.get("overwrite", "false").lower() == "true"
        limit = request.query_params.get("limit")
        if limit:
            try:
                limit = int(limit)
            except ValueError:
                limit = None

        countries_param = request.query_params.get("countries", "").strip()
        filter_countries = []
        if countries_param:
            filter_countries = [c.strip().lower() for c in countries_param.split(",") if c.strip()]

        csv_file = request.FILES.get("file")
        csv_content = ""

        if csv_file:
            try:
                csv_content = csv_file.read().decode("utf-8", errors="ignore")
            except Exception as e:
                return Response({"detail": f"Failed to read uploaded file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            url = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat"
            try:
                response = requests.get(url, timeout=15)
                if response.status_code == 200:
                    csv_content = response.text
                else:
                    return Response({"detail": f"Failed to download OpenFlights data: HTTP {response.status_code}"}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({"detail": f"Failed to connect to OpenFlights: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Parse the CSV contents
        reader = csv.reader(io.StringIO(csv_content))
        created_count = 0
        updated_count = 0
        skipped_count = 0

        # Cache countries in memory to speed up lookups
        country_cache = {c.name.lower(): c for c in Country.objects.all()}
        country_iso_cache = {c.iso_code.upper(): c for c in Country.objects.all()}

        for row in reader:
            if not row or len(row) < 8:
                continue

            # If we reached the limit, stop
            if limit and (created_count + updated_count) >= limit:
                break

            iata_code = row[4].strip().upper()
            if not iata_code or len(iata_code) != 3 or iata_code == "\\N":
                skipped_count += 1
                continue

            airport_name = row[1].strip()[:200]
            if not airport_name or airport_name == "\\N":
                airport_name = "Unknown Airport"

            city = row[2].strip()[:100]
            if not city or city == "\\N":
                city = "Unknown"

            country_name = row[3].strip()

            # Filter by country if specified
            if filter_countries and country_name.lower() not in filter_countries:
                continue

            # Find or create country
            country_obj = country_cache.get(country_name.lower())
            if not country_obj:
                # Try finding by fuzzy pycountry lookup
                try:
                    res = pycountry.countries.search_fuzzy(country_name)
                    if res:
                        iso_2 = res[0].alpha_2.upper()
                        # check if ISO code already in DB
                        country_obj = country_iso_cache.get(iso_2)
                        if not country_obj:
                            country_obj = Country.objects.create(name=res[0].name, iso_code=iso_2)
                            # update cache
                            country_cache[country_name.lower()] = country_obj
                            country_iso_cache[iso_2] = country_obj
                except Exception:
                    pass

            if not country_obj:
                # Generate a unique fallback ISO code
                try:
                    fallback_iso = country_name[:2].upper()
                    suffix = 1
                    while Country.objects.filter(iso_code=fallback_iso).exists() or fallback_iso in country_iso_cache:
                        # limit suffix to make sure fallback_iso is max 3 chars
                        fallback_iso = f"{country_name[:2].upper()[:2]}{suffix}"[:3]
                        suffix += 1
                    country_obj = Country.objects.create(name=country_name, iso_code=fallback_iso)
                    country_cache[country_name.lower()] = country_obj
                    country_iso_cache[fallback_iso] = country_obj
                except Exception:
                    # if country creation fails, skip this row
                    skipped_count += 1
                    continue

            # Coordinates
            try:
                latitude = round(Decimal(row[6].strip()), 6)
            except Exception:
                latitude = None
            try:
                longitude = round(Decimal(row[7].strip()), 6)
            except Exception:
                longitude = None

            timezone_str = row[11].strip()
            if not timezone_str or timezone_str == "\\N":
                timezone_str = "UTC"

            try:
                # Check existing
                ap = Airport.objects.filter(iata_code=iata_code).first()
                if ap:
                    if overwrite:
                        ap.airport_name = airport_name
                        ap.city = city
                        ap.timezone = timezone_str
                        ap.latitude = latitude
                        ap.longitude = longitude
                        ap.country = country_obj
                        ap.save()
                        updated_count += 1
                    else:
                        skipped_count += 1
                else:
                    Airport.objects.create(
                        iata_code=iata_code,
                        airport_name=airport_name,
                        city=city,
                        timezone=timezone_str,
                        latitude=latitude,
                        longitude=longitude,
                        country=country_obj,
                        terminals=["T1", "T2", "T3"]
                    )
                    created_count += 1
            except Exception:
                skipped_count += 1

        return Response({
            "detail": f"OpenFlights import completed. Created {created_count}, updated {updated_count}, skipped {skipped_count}.",
            "created_count": created_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count
        }, status=status.HTTP_200_OK)


class AirlineViewSet(AdminModelViewSet):
    queryset = Airline.objects.all().order_by("airline_name")
    serializer_class = AirlineSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["iata_airline_code", "airline_name"]
    ordering_fields = ["airline_name", "iata_airline_code"]


class AircraftModelViewSet(AdminModelViewSet):
    queryset = AircraftModel.objects.all()
    serializer_class = AircraftModelSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["manufacturer", "model_name"]
    ordering_fields = ["manufacturer", "model_name"]


class AircraftViewSet(AdminModelViewSet):
    queryset = Aircraft.objects.select_related("airline", "aircraft_model").all()
    serializer_class = AircraftSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["registration"]
    ordering_fields = ["registration"]

    def get_queryset(self):
        qs = super().get_queryset()
        airline_id = self.request.query_params.get("airline")
        if airline_id:
            qs = qs.filter(airline_id=airline_id)
        return qs


class FlightRouteViewSet(AdminModelViewSet):
    queryset = FlightRoute.objects.select_related("airline").prefetch_related("legs").all()
    serializer_class = FlightRouteSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["flight_no"]
    ordering_fields = ["flight_no"]

    def get_queryset(self):
        qs = super().get_queryset()
        airline_id = self.request.query_params.get("airline")
        if airline_id:
            qs = qs.filter(airline_id=airline_id)
        return qs


class FlightInstanceViewSet(AdminModelViewSet):
    queryset = FlightInstance.objects.select_related("flight", "aircraft").all()
    serializer_class = FlightInstanceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["flight__flight_no"]
    ordering_fields = ["date", "scheduled_departure"]

    def get_queryset(self):
        qs = super().get_queryset()
        flight_id = self.request.query_params.get("flight")
        if flight_id:
            qs = qs.filter(flight_id=flight_id)
        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    @action(detail=True, methods=["post"], url_path="generate-seats",
            permission_classes=[IsAdminOrSuperuser])
    def generate_seats(self, request, pk=None):
        """
        POST /api/v2/flight-instances/{id}/generate-seats/
        Auto-creates Seat rows from the linked aircraft's capacity fields.
        Skips if seats already exist.
        """
        instance = self.get_object()
        aircraft = instance.aircraft

        if instance.seats.exists():
            return Response(
                {"detail": "Seats have already been generated for this flight instance."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        seats_to_create = []

        def _make_seats(count, cabin_class, prefix, positions):
            for i in range(1, count + 1):
                pos_index = (i - 1) % len(positions)
                seats_to_create.append(
                    Seat(
                        flight_instance=instance,
                        seat_number=f"{prefix}{i}",
                        seat_class=cabin_class,
                        position=positions[pos_index],
                        status=SeatStatus.AVAILABLE,
                    )
                )

        _make_seats(
            aircraft.first_class_capacity, CabinClass.FIRST, "F",
            ["window", "aisle"]
        )
        _make_seats(
            aircraft.business_capacity, CabinClass.BUSINESS, "B",
            ["window", "middle", "aisle"]
        )
        _make_seats(
            aircraft.economy_capacity, CabinClass.ECONOMY, "E",
            ["window", "middle", "aisle"]
        )

        Seat.objects.bulk_create(seats_to_create)

        # Refresh fare available_seats counts
        for fare in instance.fares.all():
            fare.available_seats = instance.seats.filter(
                seat_class=fare.cabin_class, status=SeatStatus.AVAILABLE
            ).count()
            fare.save(update_fields=["available_seats"])

        return Response(
            {"detail": f"{len(seats_to_create)} seats generated.", "count": len(seats_to_create)},
            status=status.HTTP_201_CREATED,
        )


class SeatViewSet(AdminModelViewSet):
    queryset = Seat.objects.select_related("flight_instance").all()
    serializer_class = SeatSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["seat_number", "seat_class", "status"]

    def get_queryset(self):
        qs = super().get_queryset()
        instance_id = self.request.query_params.get("flight_instance")
        if instance_id:
            qs = qs.filter(flight_instance_id=instance_id)
        return qs

    def perform_update(self, serializer):
        old_status = self.get_object().status
        new_status = serializer.validated_data.get('status', old_status)
        
        seat = serializer.save()
        
        if old_status != new_status:
            from .models import Fare, SeatStatus, Flight as LegacyFlight
            fare = Fare.objects.filter(
                flight_instance=seat.flight_instance,
                cabin_class=seat.seat_class
            ).first()
            
            flight_no = seat.flight_instance.flight.flight_no
            legacy_flight = LegacyFlight.objects.filter(flight_number=flight_no).first()

            if new_status == SeatStatus.AVAILABLE and old_status != SeatStatus.AVAILABLE:
                if fare:
                    total_physical = seat.flight_instance.seats.filter(seat_class=seat.seat_class).count()
                    fare.available_seats = min(fare.available_seats + 1, total_physical)
                    fare.save(update_fields=["available_seats"])
                if legacy_flight:
                    legacy_flight.available_seats = min(legacy_flight.available_seats + 1, legacy_flight.total_seats)
                    legacy_flight.save(update_fields=["available_seats"])
                
                # Trigger waitlist auto-allocation for the freed cabin class
                if legacy_flight:
                    try:
                        from apps.waitlist.services import process_waitlist_allocations
                        process_waitlist_allocations(legacy_flight, cancelled_cabin_class=seat.seat_class)
                    except Exception:
                        pass
                        
            elif old_status == SeatStatus.AVAILABLE and new_status != SeatStatus.AVAILABLE:
                if fare:
                    fare.available_seats = max(fare.available_seats - 1, 0)
                    fare.save(update_fields=["available_seats"])
                if legacy_flight:
                    legacy_flight.available_seats = max(legacy_flight.available_seats - 1, 0)
                    legacy_flight.save(update_fields=["available_seats"])

    def perform_destroy(self, instance):
        from .models import Fare, SeatStatus, Flight as LegacyFlight
        if instance.status == SeatStatus.AVAILABLE:
            fare = Fare.objects.filter(
                flight_instance=instance.flight_instance,
                cabin_class=instance.seat_class
            ).first()
            if fare:
                fare.available_seats = max(fare.available_seats - 1, 0)
                fare.save(update_fields=["available_seats"])
            
            flight_no = instance.flight_instance.flight.flight_no
            legacy_flight = LegacyFlight.objects.filter(flight_number=flight_no).first()
            if legacy_flight:
                legacy_flight.available_seats = max(legacy_flight.available_seats - 1, 0)
                legacy_flight.save(update_fields=["available_seats"])
        instance.delete()

class FareViewSet(AdminModelViewSet):
    queryset = Fare.objects.select_related("flight_instance").all()
    serializer_class = FareSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["cabin_class", "price"]

    def get_queryset(self):
        qs = super().get_queryset()
        instance_id = self.request.query_params.get("flight_instance")
        if instance_id:
            qs = qs.filter(flight_instance_id=instance_id)
        return qs


class FoodItemViewSet(AdminModelViewSet):
    queryset = FoodItem.objects.select_related("airline").all()
    serializer_class = FoodItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name", "price"]

    def get_queryset(self):
        qs = super().get_queryset()
        airline_id = self.request.query_params.get("airline")
        if airline_id:
            qs = qs.filter(airline_id=airline_id)
        return qs


class FlightMealViewSet(AdminModelViewSet):
    queryset = FlightMeal.objects.select_related("flight_instance").prefetch_related("items__food_item").all()
    serializer_class = FlightMealSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        instance_id = self.request.query_params.get("flight_instance")
        if instance_id:
            qs = qs.filter(flight_instance_id=instance_id)
        return qs