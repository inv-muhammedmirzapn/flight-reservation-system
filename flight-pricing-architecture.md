# Flight Route, Instance & Pricing Architecture

## Context / Requirements

- A `FlightRoute` can sell any subset of cabin classes — all-economy, all-first-class,
  or a full economy/business/first mix. Base prices must not be hardcoded columns
  (`economy_price`, `business_price`, ...) on any model.
- `FlightInstance` rows (specific dated occurrences of a route) are generated on a
  **rolling 3-month horizon** — e.g. in August, instances exist and are bookable for
  every operating day up to the following November. The horizon advances daily.
- Prices on a `FlightInstance`'s fares are derived from the route's base prices at
  generation time. Today they're a flat copy; the next feature will vary them by
  season/events — the design must support swapping in that logic without reworking
  generation or booking code.
- When a route's base price changes, **unsold fares on already-generated future
  instances are re-priced immediately**. Already-booked tickets must be unaffected —
  they hold their own price snapshot from time of purchase.
- Must fix, from the original design:
  1. Price snapshotting at booking time (no live FK dependency on mutable price).
  2. Seat/inventory concurrency safety under simultaneous bookings.
  3. Fare versioning (route base price changes shouldn't retroactively corrupt
     historical bookings).
  4. Audit logging on price changes.
  5. (Deferred, not yet needed) generalized ancillary/add-on pattern for seat fees,
     meals, and future extras — revisit once a third ancillary type appears.

---

## 1. Models

### 1.1 Route — base prices as rows, not columns

```python
class FlightRoute(models.Model):
    route_code = models.CharField(max_length=10, unique=True)  # e.g. "AI202"
    airline = models.ForeignKey(Airline, on_delete=models.PROTECT)
    origin_airport = models.ForeignKey(Airport, related_name="+", on_delete=models.PROTECT)
    destination_airport = models.ForeignKey(Airport, related_name="+", on_delete=models.PROTECT)

    # recurrence, needed for instance generation
    operates_on_days = models.CharField(
        max_length=13, help_text="Comma-separated ISO weekdays, e.g. '1,2,3,4,5'"
    )
    valid_from = models.DateField()
    valid_until = models.DateField(null=True, blank=True)  # null = indefinite
    is_active = models.BooleanField(default=True)


class RouteFareClass(models.Model):
    """
    Defines which cabins a route sells and their BASE price.
    One row per cabin per route/fare_code. A route with only FIRST class
    just has one row here — no NULL economy/business columns anywhere.
    """
    route = models.ForeignKey(FlightRoute, related_name="fare_classes", on_delete=models.CASCADE)
    cabin_class = models.CharField(max_length=10, choices=CabinClass.choices)
    fare_code = models.CharField(max_length=20)          # e.g. "ECO-SAVER"
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    refund_type = models.CharField(max_length=15, choices=RefundType.choices)
    change_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    meal_included = models.BooleanField(default=False)
    baggage_weight_allowed_kg = models.PositiveIntegerField(default=15)
    extra_baggage_price_per_kg = models.DecimalField(max_digits=6, decimal_places=2)

    class Meta:
        unique_together = ("route", "cabin_class", "fare_code")
```

### 1.2 Instance & per-instance fare snapshot

`FlightInstance` stays as originally designed (date, scheduled/actual times, aircraft,
status, delay/gate/terminal fields) — no price columns on it. `Fare` stays as
originally designed (per-instance cabin/fare_code price row) — the fix is in *how*
it gets created and updated, not its shape.

```python
class Fare(models.Model):
    flight_instance = models.ForeignKey(FlightInstance, related_name="fares", on_delete=models.CASCADE)
    cabin_class = models.CharField(max_length=10, choices=CabinClass.choices)
    fare_code = models.CharField(max_length=20)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3)
    available_seats = models.PositiveIntegerField()
    refund_type = models.CharField(max_length=15, choices=RefundType.choices)
    change_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    meal_included = models.BooleanField(default=False)
    baggage_weight_allowed_kg = models.PositiveIntegerField()
    extra_baggage_price_per_kg = models.DecimalField(max_digits=6, decimal_places=2)

    class Meta:
        unique_together = ("flight_instance", "cabin_class", "fare_code")
```

### 1.3 Booking snapshot (fix #1: price snapshotting)

```python
class Ticket(models.Model):
    booking = models.ForeignKey(Booking, related_name="tickets", on_delete=models.CASCADE)
    flight_instance = models.ForeignKey(FlightInstance, on_delete=models.PROTECT)
    fare = models.ForeignKey(Fare, on_delete=models.PROTECT)  # traceability only, never read for price

    # snapshot — this is what the customer actually paid, immutable regardless
    # of later changes to `fare.price`
    price_paid = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3)
    fare_code = models.CharField(max_length=20)
    cabin_class = models.CharField(max_length=10)
    refund_type = models.CharField(max_length=15)
    seat = models.ForeignKey(Seat, on_delete=models.PROTECT)
```

### 1.4 Audit log (fix #4)

```python
class FarePriceChangeLog(models.Model):
    fare = models.ForeignKey(Fare, related_name="price_changes", on_delete=models.CASCADE)
    old_price = models.DecimalField(max_digits=10, decimal_places=2)
    new_price = models.DecimalField(max_digits=10, decimal_places=2)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
```

Written from an explicit service function, not a `post_save` signal — keeps price
changes traceable to one code path instead of implicit/magic side effects.

---

## 2. Rolling instance generation (3-month horizon)

Run as a scheduled job (cron / Celery beat), daily. Must be idempotent — running it
every day should only ever create the newly-exposed day at the far end of the
window, never duplicate existing instances.

```python
# services/instance_generation.py
from datetime import date, timedelta
from django.db import transaction

BOOKING_HORIZON_DAYS = 90

def generate_upcoming_instances(today: date = None) -> int:
    today = today or date.today()
    horizon = today + timedelta(days=BOOKING_HORIZON_DAYS)

    created_count = 0
    active_routes = FlightRoute.objects.filter(
        is_active=True, valid_from__lte=horizon
    ).exclude(valid_until__lt=today)

    for route in active_routes:
        operating_days = {int(d) for d in route.operates_on_days.split(",")}
        for offset in range((horizon - today).days + 1):
            flight_date = today + timedelta(days=offset)
            if flight_date.isoweekday() not in operating_days:
                continue
            if route.valid_until and flight_date > route.valid_until:
                continue

            with transaction.atomic():
                instance, created = FlightInstance.objects.get_or_create(
                    route=route,
                    date=flight_date,
                    defaults=_default_instance_fields(route, flight_date),
                )
                if created:
                    generate_seats_for_instance(instance)
                    generate_fares_for_instance(instance)   # see section 3
                    created_count += 1

    return created_count
```

`get_or_create` on `(route, date)` — the unique constraint that makes this safe to
run daily without duplication.

---

## 3. Pricing strategy (derive instance fares from route base price)

A small strategy interface so today's flat-copy behavior and tomorrow's
seasonal/event pricing share one code path, used by *both* initial generation and
later repricing (section 4) — avoiding two pricing implementations that can drift
apart.

```python
# services/pricing.py
from decimal import Decimal
from datetime import date

class PricingStrategy:
    def calculate_price(self, route_fare: "RouteFareClass", flight_date: date) -> Decimal:
        raise NotImplementedError


class FlatPricingStrategy(PricingStrategy):
    """Current behavior: instance price == route base price."""
    def calculate_price(self, route_fare, flight_date):
        return route_fare.base_price


# Future extension point — drop in without touching generation/repricing logic:
# class SeasonalPricingStrategy(PricingStrategy):
#     def calculate_price(self, route_fare, flight_date):
#         multiplier = SeasonalMultiplier.objects.get_multiplier_for(flight_date)
#         return route_fare.base_price * multiplier


ACTIVE_PRICING_STRATEGY = FlatPricingStrategy()


def generate_fares_for_instance(instance: "FlightInstance"):
    for route_fare in instance.route.fare_classes.all():
        Fare.objects.create(
            flight_instance=instance,
            cabin_class=route_fare.cabin_class,
            fare_code=route_fare.fare_code,
            price=ACTIVE_PRICING_STRATEGY.calculate_price(route_fare, instance.date),
            currency=route_fare.currency,
            refund_type=route_fare.refund_type,
            change_fee=route_fare.change_fee,
            meal_included=route_fare.meal_included,
            baggage_weight_allowed_kg=route_fare.baggage_weight_allowed_kg,
            extra_baggage_price_per_kg=route_fare.extra_baggage_price_per_kg,
        )
```

To activate seasonal pricing later: implement `SeasonalPricingStrategy`, swap
`ACTIVE_PRICING_STRATEGY` (or make it config/env driven). No changes needed to
`generate_upcoming_instances`, `generate_fares_for_instance`, or the repricing
function below.

---

## 4. Repricing on base price change (unsold future fares only)

Decision: **re-price unsold fares on future instances immediately** when a route's
base price changes. Already-booked `Ticket` rows are unaffected — they hold their
own snapshot (section 1.3), so repricing `Fare` never touches historical bookings.

```python
# services/pricing.py (continued)

def update_route_fare_price(route_fare: "RouteFareClass", new_base_price: Decimal, changed_by: "User") -> int:
    """
    Updates the route's base price, then re-prices unsold fares on all
    future, still-scheduled instances of that route/cabin/fare_code.
    Already-booked tickets are untouched — they hold their own price snapshot.
    Returns the number of Fare rows updated.
    """
    today = date.today()

    with transaction.atomic():
        route_fare.base_price = new_base_price
        route_fare.save(update_fields=["base_price"])

        future_fares = (
            Fare.objects
            .select_for_update()
            .filter(
                flight_instance__route=route_fare.route,
                flight_instance__date__gte=today,
                flight_instance__status=FlightStatus.SCHEDULED,
                cabin_class=route_fare.cabin_class,
                fare_code=route_fare.fare_code,
            )
        )

        change_logs = []
        updated_count = 0
        for fare in future_fares:
            new_price = ACTIVE_PRICING_STRATEGY.calculate_price(route_fare, fare.flight_instance.date)
            if new_price == fare.price:
                continue
            change_logs.append(FarePriceChangeLog(
                fare=fare, old_price=fare.price, new_price=new_price, changed_by=changed_by,
            ))
            fare.price = new_price
            updated_count += 1

        Fare.objects.bulk_update(future_fares, ["price"])
        FarePriceChangeLog.objects.bulk_create(change_logs)

    return updated_count
```

Design notes:

- **`select_for_update()`** locks every affected `Fare` row for the transaction, so a
  concurrent booking can't read a stale price mid-update.
- **Lock ordering matches `book_ticket`** (section 5) — both lock `Fare` before
  `Seat` — which avoids deadlocks between "a booking is happening right now" and
  "an admin just changed the price right now."
- **`flight_instance__status=SCHEDULED`** excludes cancelled/departed/boarding
  instances from repricing.
- **Diff before writing** (`if new_price == fare.price: continue`) keeps the audit
  log meaningful instead of spamming no-op entries.
- This replaces direct field edits in the admin fare wizard: instead of
  `route_fare.base_price = X; route_fare.save()`, the admin view should call
  `update_route_fare_price(route_fare, new_price, request.user)`.

**Open UX question for the admin wizard:** since this can silently reprice many
future flights on save, decide whether to show a confirmation
(`"This will update pricing on 47 upcoming flights"`) before committing, or apply
immediately and rely on the audit log for after-the-fact accountability.

---

## 5. Booking flow (fix #1 + fix #2: snapshotting + concurrency)

```python
# services/booking.py
from django.db import transaction
from django.db.models import F

def book_ticket(fare_id, seat_id, passenger, user):
    with transaction.atomic():
        fare = Fare.objects.select_for_update().get(id=fare_id)
        if fare.available_seats <= 0:
            raise NoSeatsAvailable()

        seat = Seat.objects.select_for_update().get(id=seat_id, flight_instance=fare.flight_instance)
        if seat.is_booked:
            raise SeatAlreadyBooked()

        seat.is_booked = True
        seat.save()
        fare.available_seats = F("available_seats") - 1
        fare.save()

        return Ticket.objects.create(
            fare=fare, seat=seat,
            price_paid=fare.price, currency=fare.currency,
            fare_code=fare.fare_code, cabin_class=fare.cabin_class,
            refund_type=fare.refund_type,
            flight_instance=fare.flight_instance,
        )
```

- `select_for_update()` inside one atomic block prevents two concurrent requests
  from both reading "1 seat left" and both succeeding (fix #2).
- `Ticket` copies price/fare_code/cabin_class/refund_type off `Fare` at the moment
  of booking rather than referencing `fare.price` live later (fix #1) — this is also
  what makes repricing (section 4) safe to run against unsold fares without any
  risk to historical bookings.

---

## 6. Deferred items (not implemented yet, revisit later)

- **Generalized ancillary/add-on pattern.** `Seat.seat_fee` and
  `FoodItem`/`FlightMeal` are left as separate tables for now rather than forcing a
  generic `AddOn` abstraction prematurely. Revisit once a third ancillary type
  (wifi, priority boarding, etc.) is actually needed — generalizing before that
  point costs more readability than it saves.
- **Baggage override precedence.** `RouteFareClass` carries baggage defaults;
  `Fare` carries the per-instance (and, after seasonal pricing, potentially
  per-event) copy. Document precedence explicitly wherever baggage allowance is
  computed for a booking, to avoid it becoming a recurring support question.

---

## 7. Summary of fixes applied vs. original design

| # | Issue | Fix |
|---|-------|-----|
| 1 | Price mutation could retroactively affect past bookings | `Ticket` snapshots price/fare_code/cabin_class/refund_type at booking time |
| 2 | Seat overselling under concurrent requests | `select_for_update()` on `Fare` + `Seat` inside one atomic transaction |
| 3 | No fare versioning | Fares are generated per-instance from the route template, not shared/live; repricing only touches unsold future fares, never past bookings |
| 4 | No audit trail on price edits | `FarePriceChangeLog`, written explicitly from `update_route_fare_price`, not a signal |
| 5 | Ad hoc ancillary tables | Deliberately deferred — documented as a future generalization, not built prematurely |
