# Changes needed: bring `fixed` up to date with develop's latest commit

Scope: only the 6 items that are genuinely new in this develop update and missing from
`fixed`. Everything else (meal-ordering, flight-search filters, `stops` shape, `Airline.logo`,
migration chain, FK `on_delete` choices) is already correct in `fixed` — do not touch it.

---

## 1. `apps/flights/permissions.py` — enforce object-level checks too

**File:** `apps/flights/permissions.py`
**Change:** replace the whole file.

```python
from rest_framework.permissions import BasePermission


class IsAdminOrSuperuser(BasePermission):
    """
    Grants access only to authenticated users who are either:
      - Django superusers (is_superuser=True), OR
      - Users with a Profile whose role is 'ADMIN'.

    Both view-level and object-level checks enforce the same rule,
    so check_object_permissions() is never silently bypassed.
    """

    message = "You do not have permission to perform this action."

    def _is_admin(self, user) -> bool:
        """Shared helper used by both permission check methods."""
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return hasattr(user, "profile") and user.profile.role == "ADMIN"

    def has_permission(self, request, view):
        return self._is_admin(request.user)

    def has_object_permission(self, request, view, obj):
        """Object-level: same admin/superuser requirement."""
        return self._is_admin(request.user)
```

**Why:** previously only `has_permission` (view-level) was overridden. DRF's default
`has_object_permission` returns `True`, so object-level checks (retrieve/update/delete by PK)
were effectively unguarded for any authenticated user who got past the view-level check. This
closes that gap. No functional impact on legitimate admin/superuser flows.

---

## 2. `apps/flights/views.py` — `AdminModelViewSet`: require auth for list/retrieve

**File:** `apps/flights/views.py`

```diff
 class AdminModelViewSet(viewsets.ModelViewSet):
     """Base viewset: list/retrieve public, write actions admin-only."""
     pagination_class = StandardPagination

     def get_permissions(self):
         if self.action in ("list", "retrieve"):
-            return [AllowAny()]
+            return [IsAuthenticated()]
         return [IsAdminOrSuperuser()]
```

Also update the docstring on the line above (`"""Base viewset: list/retrieve public, ...`) since
it's no longer accurate — list/retrieve are now auth-required, not public.

**Affects every v2 entity endpoint** built on this base class: `countries`, `airports`,
`airlines`, `aircraft-models`, `aircraft`, `flight-routes`, `flight-instances`, `seats`, `fares`,
`food-items`, `flight-meals`, `seat-price-templates`. All of their `GET` (list/detail) actions now
require a logged-in user, not just writes.

**Verify `IsAuthenticated` is imported** in `apps/flights/views.py` (it should already be, since
`AllowAny` is imported from the same `rest_framework.permissions` module).

**Compatibility check (already done, documented for reference):** the client frontend does not
call any `/flights/v2/...` `GET` endpoints anonymously — it only touches `v2/` for authenticated
admin-style writes (which already required auth). Safe to apply as-is.

---

## 3. `apps/flights/views.py` + `apps/flights/urls.py` — decide on `FlightStatsView`

develop removed `FlightStatsView` and its `stats/` route entirely. Two options:

**Option A — match develop (recommended):** delete `FlightStatsView` from `views.py` and remove
the import + URL line from `urls.py`:

```diff
 from .views import (
     FlightListCreateView, FlightDetailView,
-    FlightStatsView,
     CountryViewSet, AirportViewSet, AirlineViewSet,
     ...
 )
```
```diff
 urlpatterns = [
     path("", FlightListCreateView.as_view(), name="flight-list-create"),
-    path("stats/", FlightStatsView.as_view(), name="flight-stats"),
     path("calendar/", FlightFaresCalendarView.as_view(), name="flight-calendar"),
     ...
```

**Option B — keep it.** Since the frontend's `flightsAPI.stats()` already points at a
non-existent URL (`/flights/v2/stats/`) and is unused dead code either way, keeping
`FlightStatsView` around doesn't hurt anything live. But note this will re-surface as a diff on
every future merge from develop until reconciled either way.

Pick one and stick with it — flag the decision to whoever owns the develop branch if you want to
understand why it was removed there (possibly moved into `analytics`, worth asking).

---

## 4. `apps/bookings/` — bring in `AdminBookingViewSet`

### 4a. `apps/bookings/views.py` — add imports and the new class

At the top of the file, add:
```diff
 from rest_framework.permissions import IsAuthenticated
 from django.core.exceptions import ValidationError as DjangoValidationError
-from rest_framework.exceptions import ValidationError
+from rest_framework.exceptions import ValidationError, PermissionDenied
 from drf_spectacular.utils import extend_schema, inline_serializer
 from rest_framework import serializers as rf_serializers
 from .models import Booking, Passenger
 from .serializers import BookingSerializer, PassengerSerializer
 from .services import cancel_booking, create_booking
+from apps.flights.permissions import IsAdminOrSuperuser
```
(`PermissionDenied` is imported but not directly used in the new code below — keep it only if you
want parity with develop; otherwise it's safe to drop and just add `IsAdminOrSuperuser`.)

At the end of the file, add the new viewset:

```python
class AdminBookingViewSet(mixins.ListModelMixin,
                          mixins.RetrieveModelMixin,
                          viewsets.GenericViewSet):
    """
    Admin-only ViewSet for managing all bookings across all users.
    Provides:
      - GET  /api/admin/bookings/          — list all bookings with optional filters
      - GET  /api/admin/bookings/<pk>/     — retrieve any booking
      - POST /api/admin/bookings/<pk>/force-cancel/ — cancel any booking regardless of owner
    """
    serializer_class = BookingSerializer
    permission_classes = [IsAdminOrSuperuser]

    def get_queryset(self):
        qs = Booking.objects.select_related('flight', 'user').order_by('-created_at')

        # Optional filters
        pnr = self.request.query_params.get('pnr')
        if pnr:
            qs = qs.filter(id__icontains=pnr)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)

        flight_id = self.request.query_params.get('flight_id')
        if flight_id:
            qs = qs.filter(flight_id=flight_id)

        return qs

    @extend_schema(
        summary="Force-cancel any booking (admin)",
        description="Allows admins to cancel any booking regardless of ownership. Triggers waitlist allocation.",
        request=None,
        responses={200: inline_serializer('AdminForceCancelResponse', {
            'detail': rf_serializers.CharField(),
            'status': rf_serializers.CharField(),
        })},
        tags=["Admin — Bookings"],
    )
    @action(detail=True, methods=['post'], url_path='force-cancel',
            permission_classes=[IsAdminOrSuperuser])
    def force_cancel(self, request, pk=None):
        """
        POST /api/admin/bookings/<pk>/force-cancel/
        Cancel a booking as an admin, bypassing ownership checks.
        """
        try:
            # Pass the booking's own user so service-layer ownership logic passes
            booking = Booking.objects.get(pk=pk)
            booking = cancel_booking(booking_id=pk, user=booking.user)
            return Response(
                {
                    "detail": "Booking force-cancelled by admin. Waitlist allocation triggered (if applicable).",
                    "status": booking.status,
                },
                status=status.HTTP_200_OK,
            )
        except Booking.DoesNotExist:
            return Response({'detail': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)
        except DjangoValidationError as e:
            raise ValidationError({'detail': str(e)})
```

### 4b. `apps/bookings/urls.py` — wire up the admin router

```diff
 from django.urls import path, include
 from rest_framework.routers import DefaultRouter
-from .views import BookingViewSet, PassengerViewSet
+from .views import BookingViewSet, PassengerViewSet, AdminBookingViewSet

+# User-facing booking router
 router = DefaultRouter()
 router.register(r'', BookingViewSet, basename='booking')

+# Admin-only booking router
+admin_router = DefaultRouter()
+admin_router.register(r'bookings', AdminBookingViewSet, basename='admin-booking')
+
 app_name = 'bookings'

 urlpatterns = [
     path('passengers/', PassengerViewSet.as_view({'get': 'list'}), name='passenger-list'),
     path('passengers/<int:pk>/', PassengerViewSet.as_view({'get': 'retrieve'}), name='passenger-detail'),
     path('', include(router.urls)),
+    # Admin-only routes: /api/admin/bookings/
+    path('admin/', include(admin_router.urls)),
 ]
```

Resulting full path (since `bookings.urls` is mounted at `api/bookings/` in `config/urls.py`):
`/api/bookings/admin/bookings/` and `/api/bookings/admin/bookings/<pk>/force-cancel/`.

**Pure addition** — doesn't touch `BookingViewSet`, the class your client app's `bookingAPI`
actually calls. No conflict risk.

---

## 5. `apps/analytics/views.py` — swap `IsAdminUser` → `IsAdminOrSuperuser`

```diff
-from rest_framework.permissions import IsAdminUser
 from rest_framework.response import Response
 from rest_framework.views import APIView
+from apps.flights.permissions import IsAdminOrSuperuser
```

Then, in each of the 7 view classes, replace:
```diff
-    permission_classes = [IsAdminUser]
+    permission_classes = [IsAdminOrSuperuser]
```

Classes to update: `AnalyticsSummaryView`, `MonthlyRevenueView`, `PopularRoutesView`,
`FlightOccupancyView`, `PeakBookingHoursView`, `AirlinePerformanceView`,
`AircraftUtilizationView`.

**Why:** switches from Django's built-in `is_staff` check to the project's custom
superuser-or-`profile.role == 'ADMIN'` check, matching the definition of "admin" used everywhere
else in the app (`IsAdminOrSuperuser` is already used in `flights` and `waitlist`). Still
admin-only either way — no impact on regular users, and no impact on the client app (these
endpoints aren't called there).

---

## 6. `config/settings/base.py` — global permission default + throttle

```diff
+# Development: allow all origins. In production, set CORS_ALLOWED_ORIGINS instead.
 CORS_ALLOW_ALL_ORIGINS = True
+# Production (uncomment and populate):
+# CORS_ALLOW_ALL_ORIGINS = False
+# CORS_ALLOWED_ORIGINS = [
+#     "https://your-frontend-domain.com",
+# ]

 REST_FRAMEWORK = {
     'DEFAULT_AUTHENTICATION_CLASSES': (
         'rest_framework_simplejwt.authentication.JWTAuthentication',
     ),
+    # Fallback: any view that omits permission_classes requires authentication.
+    # Individual views override this with AllowAny or IsAdminOrSuperuser as needed.
+    'DEFAULT_PERMISSION_CLASSES': (
+        'rest_framework.permissions.IsAuthenticated',
+    ),
     'DEFAULT_PAGINATION_CLASS': 'apps.flights.pagination.StandardPagination',
     'PAGE_SIZE': 10,
     'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
     ...
     'DEFAULT_THROTTLE_RATES': {
-        'anon': '10000/day',
+        'anon': '500/day',    # Tightened from 10,000 — public read-only is fine, abuse is not
         'user': '100000/day',
         'login': '60/minute',
     }
 }
```

**Before applying `DEFAULT_PERMISSION_CLASSES`, sanity-check:** every view in your branch that
should stay public must explicitly declare `permission_classes = [AllowAny]` (or return
`[AllowAny()]` from `get_permissions`). Already confirmed explicit on all client-facing views:
`FlightListCreateView`, `FlightDetailView` (GET), `FlightFaresCalendarView`,
`FlightFareBoundsView`, `FlightMealsView`, `WaitlistFlightCountView`, and the `users` auth views
(`RegisterView`, `GoogleLoginView`, `ForgotPasswordView`, `ResetPasswordView`, plus simplejwt's
`CustomTokenObtainPairView`/`TokenRefreshView`, which set `AllowAny` internally in the library).
No changes needed there — just re-verify after merging in case your branch added any new public
view since this check was done.

**CORS comment block and DB dict formatting in `production.py`** are cosmetic only — safe to take
or leave, no functional difference.

---

## After applying

Run:
```bash
python manage.py makemigrations --check --dry-run   # no model changes here, should say "No changes detected"
python manage.py check
```
Then manually re-test (or have your test suite cover):
- Anonymous `GET /api/flights/` and `/api/flights/<id>/` still work (client search/detail flow).
- Anonymous `GET /api/flights/v2/airlines/` (or any v2 list) now returns `401`.
- Admin login → `GET /api/bookings/admin/bookings/` returns all users' bookings; non-admin gets `403`.
- `GET /api/analytics/summary/` still requires admin (now via `IsAdminOrSuperuser` instead of `is_staff`) — if your admin users are only marked via `profile.role == 'ADMIN'` and not Django's `is_staff`, this actually *fixes* an access gap rather than introducing one.
