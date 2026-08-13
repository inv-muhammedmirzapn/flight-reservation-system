import logging
import csv
import io
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.db import IntegrityError
from django.db.models.deletion import ProtectedError, RestrictedError
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
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, InstanceStatus,
    Seat, SeatStatus, CabinClass,
    Fare, FoodItem, FlightMeal, FlightMealItem,
    SeatPriceTemplate,
)
from .serializers import (
    CountrySerializer, AirportSerializer, AirlineSerializer,
    AircraftModelSerializer, AircraftSerializer,
    FlightRouteSerializer, FlightLegSerializer,
    FlightInstanceSerializer,
    SeatSerializer, FareSerializer,
    FoodItemSerializer, FlightMealSerializer,
    SeatPriceTemplateSerializer,
)
from .permissions import IsAdminOrSuperuser
from .pagination import StandardPagination
from .services import (
    import_airports_from_csv,
    generate_seats_for_instance,
    apply_premium_pricing,
    bulk_price_seats,
    sync_seat_availability_on_status_change,
    sync_seat_availability_on_destroy,
    trigger_waitlist_if_seats_freed,
)

logger = logging.getLogger(__name__)

class AdminModelViewSet(viewsets.ModelViewSet):
    """Base viewset: list/retrieve require authentication, write actions admin-only."""
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
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

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except (IntegrityError, ProtectedError, RestrictedError) as exc:
            return Response(
                {"detail": "Cannot delete this item because it is referenced by existing related records (such as flights, aircraft, or food items)."},
                status=status.HTTP_400_BAD_REQUEST
            )


# ─── Legacy Flight views ────────────────────────────────────────────────────────

class FlightPagination(PageNumberPagination):
    """Return 10 flights per page. Clients pass ?page=N."""
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 2000
    page_query_param = "page"



class FlightListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAdminOrSuperuser()]

    @extend_schema(responses=FlightInstanceSerializer(many=True))
    def get(self, request, *args, **kwargs) -> Response:
        from django.utils import timezone
        qs = FlightInstance.objects.select_related('flight', 'flight__airline', 'aircraft').filter(
            scheduled_departure__gte=timezone.now()
        ).order_by("scheduled_departure")
        
        # Filtering
        source = request.query_params.get("source", "").strip().upper()
        if source:
            qs = qs.filter(flight__legs__departure_airport__iata_code=source, flight__legs__leg_order=1)

        destination = request.query_params.get("destination", "").strip().upper()
        if destination:
            from django.db.models import Max, F
            route_ids = FlightLeg.objects.values('flight').annotate(max_order=Max('leg_order')).filter(
                arrival_airport__iata_code__iexact=destination,
                leg_order=F('max_order')
            ).values_list('flight_id', flat=True)
            qs = qs.filter(flight_id__in=route_ids)

        date = request.query_params.get("date", "").strip()
        if date:
            qs = qs.filter(date=date)

        flight_number = request.query_params.get("flight_number", "").strip().upper()
        if flight_number:
            qs = qs.filter(flight__flight_no__icontains=flight_number)

        airline_param = request.query_params.get("airline", request.query_params.get("airlines", "")).strip()
        if airline_param:
            airline_list = [a.strip() for a in airline_param.split(",") if a.strip()]
            if len(airline_list) == 1:
                qs = qs.filter(flight__airline__airline_name__icontains=airline_list[0])
            elif len(airline_list) > 1:
                airline_q = Q()
                for a in airline_list:
                    airline_q |= Q(flight__airline__airline_name__icontains=a)
                qs = qs.filter(airline_q)

        status_filter = request.query_params.get("status", "").strip()
        if status_filter:
            qs = qs.filter(status__iexact=status_filter)

        min_price = request.query_params.get("min_fare", request.query_params.get("min_price", "")).strip()
        if min_price:
            try:
                qs = qs.filter(fares__price__gte=float(min_price))
            except ValueError:
                pass
        
        max_price = request.query_params.get("max_fare", request.query_params.get("max_price", "")).strip()
        if max_price:
            try:
                qs = qs.filter(fares__price__lte=float(max_price))
            except ValueError:
                pass

        # Stops filtering (0 stops = 1 leg, 1 stop = 2 legs, 2+ stops = >=3 legs)
        stops_param = request.query_params.get("stops", "").strip()
        if stops_param != "":
            try:
                stops_num = int(stops_param)
                from django.db.models import OuterRef, Subquery, IntegerField
                total_legs_subquery = Subquery(
                    FlightLeg.objects.filter(flight_id=OuterRef("flight_id"))
                    .values("flight_id")
                    .annotate(cnt=Count("id"))
                    .values("cnt")[:1],
                    output_field=IntegerField()
                )
                qs = qs.annotate(total_legs=total_legs_subquery)
                if stops_num == 0:
                    qs = qs.filter(total_legs=1)
                elif stops_num == 1:
                    qs = qs.filter(total_legs=2)
                elif stops_num >= 2:
                    qs = qs.filter(total_legs__gte=3)
            except ValueError:
                pass

        # Waitlist mode filtering
        cabin_param = request.query_params.get("cabin_class", "").strip().upper()
        if "BUSINESS" in cabin_param:
            class_key = "BUSINESS"
        elif "FIRST" in cabin_param:
            class_key = "FIRST"
        elif "ECONOMY" in cabin_param:
            class_key = "ECONOMY"
        else:
            class_key = None

        waitlist_mode = request.query_params.get("waitlist_mode", request.query_params.get("waitlistMode", "")).strip()
        if waitlist_mode in ["available_only", "waitlisted_only"]:
            from django.db.models import Exists, OuterRef
            has_any_seats = Exists(Seat.objects.filter(flight_instance=OuterRef('pk')))
            
            if class_key:
                has_avail_class_seats = Exists(
                    Seat.objects.filter(flight_instance=OuterRef('pk'), seat_class=class_key, status="AVAILABLE")
                )
                fare_gt_zero = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), cabin_class=class_key, available_seats__gt=0)
                )
                fare_lte_zero = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), cabin_class=class_key, available_seats__lte=0)
                )
                has_fare = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), cabin_class=class_key)
                )

                if waitlist_mode == "available_only":
                    avail_q = has_avail_class_seats | (~has_any_seats & fare_gt_zero)
                    qs = qs.filter(has_fare & avail_q)
                elif waitlist_mode == "waitlisted_only":
                    waitlist_q = (has_any_seats & ~has_avail_class_seats) | (~has_any_seats & fare_lte_zero)
                    qs = qs.filter(has_fare & waitlist_q)
            else:
                has_any_avail_seats = Exists(
                    Seat.objects.filter(flight_instance=OuterRef('pk'), status="AVAILABLE")
                )
                any_fare_gt_zero = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), available_seats__gt=0)
                )
                any_fare_lte_zero = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), available_seats__lte=0)
                )

                if waitlist_mode == "available_only":
                    qs = qs.filter(has_any_avail_seats | (~has_any_seats & any_fare_gt_zero))
                elif waitlist_mode == "waitlisted_only":
                    qs = qs.filter((has_any_seats & ~has_any_avail_seats) | (~has_any_seats & any_fare_lte_zero))

        qs = qs.distinct()

        # Ordering / Sorting
        ordering = request.query_params.get("ordering", request.query_params.get("sort_by", "")).strip()
        if ordering == "base_fare" or ordering == "price":
            from django.db.models import Min
            qs = qs.annotate(min_fare=Min("fares__price")).order_by("min_fare")
        elif ordering == "-base_fare" or ordering == "-price":
            from django.db.models import Min
            qs = qs.annotate(min_fare=Min("fares__price")).order_by("-min_fare")
        elif ordering == "departure_time":
            qs = qs.order_by("scheduled_departure")
        elif ordering == "-departure_time":
            qs = qs.order_by("-scheduled_departure")
        elif ordering == "duration":
            from django.db.models import F, ExpressionWrapper, DurationField
            qs = qs.annotate(
                calc_duration=ExpressionWrapper(
                    F("scheduled_arrival") - F("scheduled_departure"),
                    output_field=DurationField()
                )
            ).order_by("calc_duration")
        elif ordering == "-duration":
            from django.db.models import F, ExpressionWrapper, DurationField
            qs = qs.annotate(
                calc_duration=ExpressionWrapper(
                    F("scheduled_arrival") - F("scheduled_departure"),
                    output_field=DurationField()
                )
            ).order_by("-calc_duration")
        else:
            qs = qs.order_by("scheduled_departure")

        paginator = FlightPagination()
        page = paginator.paginate_queryset(qs, request)
        from .serializers import FrontendFlightInstanceSerializer
        serializer = FrontendFlightInstanceSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class FlightDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAdminOrSuperuser()]

    @extend_schema(responses=FlightInstanceSerializer)
    def get(self, request, id, *args, **kwargs) -> Response:
        from .serializers import FrontendFlightInstanceSerializer
        instance = get_object_or_404(FlightInstance, id=int(id))
        serializer = FrontendFlightInstanceSerializer(instance)
        return Response(serializer.data)


# ─── New entity ViewSets ────────────────────────────────────────────────────────

class CountryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Country.objects.all().order_by("name")
    serializer_class = CountrySerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "iso_code"]
    ordering_fields = ["id", "name", "iso_code"]


class AirportViewSet(AdminModelViewSet):
    queryset = Airport.objects.select_related("country").all()
    serializer_class = AirportSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["iata_code", "airport_name", "city"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return super().get_permissions()

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
        import requests as http_requests

        overwrite = request.query_params.get("overwrite", "false").lower() == "true"
        limit = request.query_params.get("limit")
        if limit:
            try:
                limit = int(limit)
            except ValueError:
                limit = None

        countries_param = request.query_params.get("countries", "").strip()
        filter_countries = [
            c.strip().lower() for c in countries_param.split(",") if c.strip()
        ] if countries_param else []

        csv_file = request.FILES.get("file")
        csv_content = ""

        if csv_file:
            try:
                csv_content = csv_file.read().decode("utf-8", errors="ignore")
            except Exception as e:
                logger.exception("Failed to read uploaded file in OpenFlights import")
                return Response(
                    {"detail": f"Failed to read uploaded file: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            url = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat"
            try:
                resp = http_requests.get(url, timeout=15)
                if resp.status_code == 200:
                    csv_content = resp.text
                else:
                    return Response(
                        {"detail": f"Failed to download OpenFlights data: HTTP {resp.status_code}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except Exception as e:
                logger.exception("Failed to connect to OpenFlights")
                return Response(
                    {"detail": f"Failed to connect to OpenFlights: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        result = import_airports_from_csv(
            csv_content=csv_content,
            overwrite=overwrite,
            limit=limit,
            filter_countries=filter_countries or None,
        )
        return Response(
            {
                "detail": (
                    f"OpenFlights import completed. "
                    f"Created {result['created_count']}, "
                    f"updated {result['updated_count']}, "
                    f"skipped {result['skipped_count']}."
                ),
                **result,
            },
            status=status.HTTP_200_OK,
        )


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

    def destroy(self, request, *args, **kwargs):
        """Fast delete: bulk-wipe all seats under every instance before cascade."""
        try:
            route = self.get_object()
            # Drop all seats in one SQL DELETE — avoids thousands of per-row Python calls
            Seat.objects.filter(flight_instance__flight=route).delete()
            route.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (IntegrityError, ProtectedError, RestrictedError) as exc:
            return Response(
                {"detail": "Cannot delete this flight route because it is referenced by existing related records (such as bookings or meals)."},
                status=status.HTTP_400_BAD_REQUEST
            )


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

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status__iexact=status_filter)

        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(date=date)

        arrival_date = self.request.query_params.get("arrival_date")
        if arrival_date:
            qs = qs.filter(scheduled_arrival__date=arrival_date)

        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(flight__legs__departure_airport__iata_code__iexact=source, flight__legs__leg_order=1)

        destination = self.request.query_params.get("destination")
        if destination:
            from django.db.models import Max, F
            route_ids = FlightLeg.objects.values('flight').annotate(max_order=Max('leg_order')).filter(
                arrival_airport__iata_code__iexact=destination,
                leg_order=F('max_order')
            ).values_list('flight_id', flat=True)
            qs = qs.filter(flight_id__in=route_ids)

        return qs

    def destroy(self, request, *args, **kwargs):
        """Fast delete: bulk-wipe all seats before deleting the instance."""
        try:
            instance = self.get_object()
            # Drop all seats in one SQL DELETE — avoids per-row Python sync callbacks
            Seat.objects.filter(flight_instance=instance).delete()
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (IntegrityError, ProtectedError, RestrictedError) as exc:
            return Response(
                {"detail": "Cannot delete this flight instance because it is referenced by existing related records (such as bookings or meals)."},
                status=status.HTTP_400_BAD_REQUEST
            )

    def perform_update(self, serializer):
        """Fire delay/status notifications when a flight instance is updated."""
        old_instance = self.get_object()
        old_status = old_instance.status
        old_delay = old_instance.delay_minutes

        instance = serializer.save()

        new_status = instance.status
        new_delay = instance.delay_minutes

        try:
            from apps.notifications.services import NotificationService
            from datetime import timedelta

            if new_status == 'DELAYED' and (
                old_status != 'DELAYED' or old_delay != new_delay
            ):
                # Compute the new estimated departure for the notification
                delayed_dep = instance.scheduled_departure + timedelta(minutes=new_delay)
                NotificationService.send_flight_delay(instance, delayed_dep)
            elif old_status != new_status:
                NotificationService.send_flight_status_notification(instance, old_status, new_status)
        except Exception:
            logger.exception("Failed to send flight status notification after update")

    def perform_create(self, serializer):
        """Auto-generate seats immediately after a new flight instance is saved."""
        instance = serializer.save()
        generate_seats_for_instance(instance)

    @action(detail=True, methods=["post"], url_path="generate-seats",
            permission_classes=[IsAdminOrSuperuser])
    def generate_seats(self, request, pk=None):
        """
        POST /api/v2/flight-instances/{id}/generate-seats/
        Auto-creates Seat rows. Skips if seats already exist.
        """
        instance = self.get_object()
        if instance.seats.exists():
            return Response(
                {"detail": "Seats have already been generated for this flight instance."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        generate_seats_for_instance(instance)
        # Refresh fare available_seats counts
        for fare in instance.fares.all():
            fare.available_seats = instance.seats.filter(
                seat_class=fare.cabin_class, status=SeatStatus.AVAILABLE
            ).count()
            fare.save(update_fields=["available_seats"])
        count = instance.seats.count()
        return Response(
            {"detail": f"{count} seats generated.", "count": count},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="apply-premium-pricing", permission_classes=[IsAdminOrSuperuser])
    def apply_premium_pricing(self, request, pk=None):
        instance = self.get_object()

        window_fee = request.data.get("window_fee")
        legroom_fee = request.data.get("legroom_fee")

        if window_fee is not None:
            try:
                window_fee = float(window_fee)
            except ValueError:
                return Response({"detail": "window_fee must be a number"}, status=status.HTTP_400_BAD_REQUEST)

        if legroom_fee is not None:
            try:
                legroom_fee = float(legroom_fee)
            except ValueError:
                return Response({"detail": "legroom_fee must be a number"}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = apply_premium_pricing(instance, window_fee, legroom_fee)
        return Response({
            "detail": f"Updated pricing for {updated_count} seats.",
            "updated_count": updated_count,
        })


class SeatViewSet(AdminModelViewSet):
    queryset = Seat.objects.select_related("flight_instance").all()
    serializer_class = SeatSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["seat_number", "seat_class", "status"]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        instance_id = self.request.query_params.get("flight_instance")
        if instance_id:
            qs = qs.filter(flight_instance_id=instance_id)
        return qs

    def list(self, request, *args, **kwargs):
        """Run lazy expiry before returning the seat map so stale holds are cleared."""
        instance_id = request.query_params.get("flight_instance")
        if instance_id:
            try:
                from apps.bookings.services import expire_stale_holds
                from .models import FlightInstance
                fi = FlightInstance.objects.get(pk=instance_id)
                expire_stale_holds(fi)
            except FlightInstance.DoesNotExist:
                pass
        return super().list(request, *args, **kwargs)

    def perform_update(self, serializer):
        old_status = self.get_object().status
        new_status = serializer.validated_data.get("status", old_status)
        seat = serializer.save()
        sync_seat_availability_on_status_change(seat, old_status, new_status)

    def perform_destroy(self, instance):
        sync_seat_availability_on_destroy(instance)
        instance.delete()

    @action(detail=False, methods=["post"], url_path="bulk-price",
            permission_classes=[IsAdminOrSuperuser])
    def bulk_price(self, request):
        """
        POST /api/v2/seats/bulk-price/
        Body: {"seat_ids": [1, 2, 3], "price": 250, "rule_label": "window"}
        Sets seat_fee = price and last_rule_applied = rule_label for all listed seats.
        Returns counts and any conflict warnings (seats that already had a different rule).
        """
        seat_ids = request.data.get("seat_ids", [])
        price = request.data.get("price")
        rule_label = request.data.get("rule_label", "")

        if not seat_ids or price is None:
            return Response(
                {"detail": "seat_ids and price are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            price = float(price)
            if price < 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {"detail": "price must be a non-negative number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = bulk_price_seats(seat_ids, price, rule_label)
        return Response({
            "updated_count": result["updated_count"],
            "conflict_seat_ids": result["conflict_seat_ids"],
            "detail": f"Price \u20b9{price} applied to {result['updated_count']} seats.",
        }, status=status.HTTP_200_OK)


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


class SeatPriceTemplateViewSet(AdminModelViewSet):
    """
    CRUD for attribute→price rule templates keyed by aircraft model.
    GET  /api/v2/seat-price-templates/?aircraft_model=<id>
    POST /api/v2/seat-price-templates/  {name, aircraft_model, rules:[{attribute, price}]}
    """
    queryset = SeatPriceTemplate.objects.select_related("aircraft_model").all()
    serializer_class = SeatPriceTemplateSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        aircraft_model_id = self.request.query_params.get("aircraft_model")
        if aircraft_model_id:
            qs = qs.filter(aircraft_model_id=aircraft_model_id)
        return qs