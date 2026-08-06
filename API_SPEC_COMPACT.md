# API Spec

Base URL: `/api/`. Auth: JWT (`Authorization: Bearer <access>`). Access token: 10 min. Refresh token: 1 day, rotates.

## Response envelope (all endpoints)
Success:
```json
{ "status": "success", "data": { ... } | null, "message": "optional string" }
```
Error (4xx/5xx):
```json
{ "status": "error", "message": "string", "errors": { "field": ["msg"] } }
```

## Pagination
`?page=N&page_size=N` (default size 10, max 2000).
```json
{ "count": 137, "next": "url|null", "previous": "url|null", "results": [ ... ] }
```

## Roles
`profile.role`: `ADMIN` | `CUSTOMER`. Admin-only endpoints require `is_superuser=True` OR `profile.role=="ADMIN"` (except Analytics, which requires Django `is_staff=True`).

Not implemented (no routes exist): search, fare_prediction, comparison, route_optimization, delays, pricing, caching.

---

## Auth — `/api/auth/`

**POST `register/`** — public. Body: `{ username, password, email, first_name, last_name }`.
Password rules: ≥8 chars, ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 special char (`!@#$%^&*()\,.\?":{}|<>`), not common/similar-to-user-attrs/all-numeric.
Always `201` with generic message regardless of duplicate email/username.

**POST `login/`** — public. Body: `{ username, password }`. Response `data`: `{ refresh, access, id, username, email, role }`.

**POST `logout/`** — auth. Body: `{ refresh }`. `200`.

**POST `google-login/`** — public. Body: `{ token }`. Response same shape as login.

**GET/PUT/PATCH `profile/`** — auth. Fields: `id(ro), username, email(ro), first_name(req), last_name(req), role(ro), phone_number, date_of_birth, gender(MALE|FEMALE|OTHER), country, state, city, created_at(ro), updated_at(ro)`. `email` cannot be changed here.

**POST `change-password/`** — auth. Body: `{ old_password, new_password }`. `new_password` must differ from old, must pass password rules.

**POST `password/forgot/`** — public. Body: `{ email }`. Always `200`.

**POST `password/reset/`** — public. Body: `{ email, otp(6-digit), new_password }`.

**POST `email/request-otp/`** — auth. Body: `{ new_email }`.

**POST `email/verify-otp/`** — auth. Body: `{ new_email, otp }`. Response: `{ detail, email }`.

**POST `token/refresh/`** — Body: `{ refresh }` → `{ access, refresh }`.

---

## Flights — `/api/flights/`

### Legacy/public (customer-facing search)

**GET `/api/flights/`** — public, paginated. Lists future flight instances.
Query: `source, destination` (IATA codes), `date` (YYYY-MM-DD), `flight_number` (contains), `airline` (contains), `status`, `min_price`, `max_price`.
Item:
```json
{
  "id": 1, "flight_number": "AI101", "airline": "Air India", "aircraft": "VT-ABC",
  "source_airport": "DEL", "source_airport_name": "...", "source_terminals": ["T3"],
  "destination_airport": "BOM", "destination_airport_name": "...", "destination_terminals": ["T2"],
  "departure_time": "iso", "arrival_time": "iso",
  "base_fare": 4500.0, "total_seats": 180, "available_seats": 142,
  "status": "SCHEDULED", "delay_minutes": 0, "stops": ["City"],
  "baggage_weight_kg": 20.0, "baggage_number_allowed": 1, "handbag_weight_kg": 7.0,
  "fares": {
    "ECONOMY": { "price":4500.0,"currency":"INR","available_seats":120,"fare_code":"Y",
                 "refund_type":"NON_REFUNDABLE","change_fee":500.0,"meal_included":false,"baggage_allowance":null }
  },
  "flight_instance_id": 1
}
```

**GET `/api/flights/<id>/`** — public. Same item shape, single object.

**GET `/api/flights/stats/`** — public. `{ total, scheduled, delayed, cancelled, boarding, departed, arrived }`.

**GET `/api/flights/calendar/`** — public. Query (required): `start_date, end_date`. Optional: `source, destination, cabin_class` (`"Economy"|"Business"|"First"`, Title-case, default `"Economy"`). Response: `{ "2026-08-10": 4500.0, ... }` (date → cheapest price).

**GET `/api/flights/bounds/`** — public. Query: `source, destination, date, cabin_class` (Title-case, optional). Response: `{ "min": 3000, "max": 12000 }`.

### v2 entity CRUD — `/api/flights/v2/...`
Standard REST ViewSets (list/retrieve = public; create/update/delete = admin only; `countries` fully read-only).

| Resource | Path | Filters |
|---|---|---|
| Countries (RO) | `v2/countries/` | `?search=` |
| Airports | `v2/airports/` | `?country=<id>`, `?q=<prefix>`, `?search=<contains>` |
| Airlines | `v2/airlines/` | `?search=` |
| Aircraft Models | `v2/aircraft-models/` | `?search=` |
| Aircraft | `v2/aircraft/` | `?airline=<id>` |
| Flight Routes | `v2/flight-routes/` | `?airline=<id>` |
| Flight Instances | `v2/flight-instances/` | `?flight=<id>`, `?date_from=`, `?date_to=` |
| Seats | `v2/seats/` | `?flight_instance=<id>` |
| Fares | `v2/fares/` | `?flight_instance=<id>` |
| Food Items | `v2/food-items/` | `?airline=<id>` |
| Flight Meals | `v2/flight-meals/` | `?flight_instance=<id>` |
| Seat Price Templates | `v2/seat-price-templates/` | `?aircraft_model=<id>` |

**Country**: `{ id, name, iso_code }`. `name`≥2 chars. `iso_code`: 2-3 alpha, auto-uppercased.

**Airport**: `{ id, iata_code, airport_name, city, timezone, latitude, longitude, country(FK), country_name(ro), terminals }`.
`iata_code`: exactly 3 alpha, unique. `airport_name`≥3 chars. `city`≥2 chars. `latitude`∈[-90,90]. `longitude`∈[-180,180]. `terminals`: array of strings.
Extra: **POST `v2/airports/import-openflights/`** (admin) — multipart `file` optional; query `?overwrite=true|false`, `?limit=N`, `?countries=csv`. Returns `{ created_count, updated_count, skipped_count, detail }`.

**Airline**: `{ id, iata_airline_code, airline_name }`. Code: exactly 2 alphanumeric, unique. Name≥2 chars.

**Aircraft Model**: `{ id, manufacturer, model_name }`. Both≥2 chars. Unique together.

**Aircraft**: `{ id, registration, airline(FK), airline_name(ro), aircraft_model(FK), model_display(ro), economy_capacity, business_capacity, first_class_capacity }`. `registration`: `^[A-Z0-9\-]+$`, unique. Capacities ≥0.

**Flight Route** (nested legs): `{ id, flight_no, airline(FK), airline_name(ro), baggage_weight_allowed_per_person, baggage_number_allowed_per_person, handbag_weight_allowed_per_person, legs:[...], created_at(ro), updated_at(ro) }`.
Leg: `{ id, leg_order, departure_airport(FK), departure_airport_iata(ro), arrival_airport(FK), arrival_airport_iata(ro), flight_duration_minutes, layover_duration_minutes, scheduled_departure, scheduled_arrival, actual_departure, actual_arrival }`.
`flight_no` unique. `legs` required (≥1) on create; `leg_order` auto-assigned. On update, sending `legs` replaces all existing legs. `departure_airport != arrival_airport`. `flight_duration_minutes>0`. `layover_duration_minutes>=0`. Baggage weights ≥0.

**Flight Instance**: `{ id, flight(FK), flight_no(ro), flight_number(ro), date, aircraft(FK), aircraft_registration(ro), total_capacity(ro), route(ro), status, delay_minutes, scheduled_departure, scheduled_arrival, actual_departure, actual_arrival, checkin_open, boarding_time, boarding_gate, departure_terminal, arrival_terminal, created_at(ro), updated_at(ro) }`.
`status`: `SCHEDULED|DELAYED|CANCELLED|BOARDING|DEPARTED|ARRIVED`. If `scheduled_arrival` omitted on create, auto-computed from route leg durations. `scheduled_arrival` must be after `scheduled_departure`. Setting `delay_minutes>0` without explicit `status` auto-sets `status="DELAYED"`. Seats auto-generated on create.
Extra: **POST `{id}/generate-seats/`** (admin) — `400` if seats exist. Returns `{ detail, count }`, `201`.
**POST `{id}/apply-premium-pricing/`** (admin) — body `{ window_fee, legroom_fee }` (nullable). Returns `{ detail, updated_count }`.

**Seat**: `{ id, flight_instance(FK), seat_number, seat_class, position, status, exit_row, extra_legroom, seat_fee, currency, last_rule_applied, attributes(ro) }`.
`seat_class`: `ECONOMY|BUSINESS|FIRST`. `position`: `window|aisle|middle|""`. `status`: `AVAILABLE|HELD|BOOKED|BLOCKED`. `attributes`: derived array. `seat_fee`≥0. `(flight_instance, seat_number)` unique.
Extra: **POST `v2/seats/bulk-price/`** (admin) — body `{ seat_ids:[...], price, rule_label }`. Returns `{ updated_count, conflict_seat_ids, detail }`.

**Fare**: `{ id, flight_instance(FK), fare_code, cabin_class, price, currency, available_seats(ro), refund_type, change_fee, meal_included, baggage_allowance }`.
`refund_type`: `REFUNDABLE|NON_REFUNDABLE|PARTIAL`. `price`,`change_fee`≥0. `available_seats` computed live, read-only.

**Food Item**: `{ id, airline(FK), airline_name(ro), name, price, currency, is_veg, is_halal, is_vegan, image, image_url(ro) }`. Multipart upload for `image`. `name`≥2 chars. `price`≥0.

**Flight Meal** (nested items): `{ id, flight_instance(FK), name, items:[{id, food_item(FK), food_item_name(ro), quantity}] }`. `items` fully replaced on update.

**Seat Price Template**: `{ id, aircraft_model(FK), aircraft_model_display(ro), name, rules:[{attribute, price}], created_at(ro), updated_at(ro) }`. `attribute`∈`window|aisle|middle|exit_row|extra_legroom`. `(aircraft_model, name)` unique.

---

## Bookings — `/api/bookings/` (auth required, UUID ids)

**GET `/`** — paginated. Own bookings (staff/superuser see all). Query: `?pnr=<uuid substring>`, `?status=CONFIRMED|CANCELLED`.
```json
{
  "id": "uuid",
  "flight_detail": { "id":1,"flight_number":"AI101","airline":"Air India","source_airport":"DEL",
                      "destination_airport":"BOM","scheduled_departure":"iso","scheduled_arrival":"iso","status":"SCHEDULED" },
  "cabin_class": "ECONOMY", "status": "CONFIRMED", "seat_count": 2, "total_price": 9000.0,
  "created_at": "iso",
  "passengers": [ { "id":1,"booking":"uuid","name":"John Doe","full_name":"John Doe","age":30,"gender":"M","phone_number":"","seat_number":"12A" } ]
}
```

**POST `/`** — body:
```json
{ "flight": 1, "cabin_class": "ECONOMY", "passengers": [ { "name":"John Doe","age":30,"gender":"M","phone_number":"9999999999" } ] }
```
`flight`: integer FlightInstance id. `cabin_class` optional, must be `ECONOMY|BUSINESS|FIRST` if given. `passengers`: ≥1; per-passenger `name`≥2 chars required, `age` 1-120 required, `gender` `M|F|O` required, `phone_number` optional.
Rejects (`400`, message string) if: flight is `CANCELLED|DEPARTED|ARRIVED|BOARDING`; flight already departed; insufficient available seats; user already has a confirmed booking on this flight.
`201` returns full booking object with auto-assigned `seat_number`s and computed `total_price`.

**POST `/{id}/cancel/`** — cancels own `CONFIRMED` booking. `400` if already cancelled. Frees seats, restores fare availability, triggers waitlist auto-allocation. Returns `{ detail, status }`.

**GET `passengers/`** — own passengers (staff see all). `?search=<name contains>`.

**GET `passengers/{id}/`** — single passenger.

---

## Waitlist — `/api/waitlist/` (auth required, UUID ids)

**POST `join/`** — body: `{ "flight": <int>, "cabin_class": "ECONOMY"|null, "passengers": [...] }` (same passenger rules as bookings).
`seat_count` (passenger count) must be 1-9. Flight must not have departed. **Only allowed if flight is actually full for the class** (else `400`). One pending entry per user per flight. `price` computed server-side. `404` if flight not found.

**GET `/`** — own entries (admin: all, filterable `?flight=<id>`). Auto-expires departed-flight pending entries on read.
```json
{
  "id":"uuid","user":1,"username":"johnd","flight":1,"flight_detail":{...same as booking flight_detail...},
  "seat_count":2,"cabin_class":"ECONOMY","price":9000.0,"status":"PENDING","booking":null,
  "queue_position":3,
  "passengers":[{"id":1,"name":"...","age":30,"gender":"M","phone_number":""}],
  "created_at":"iso","updated_at":"iso"
}
```
`status`: `PENDING|CONFIRMED|CANCELLED|EXPIRED`. `queue_position`: 1-based, null when not pending.

**GET `{id}/`** — owner/admin only.

**POST `{id}/cancel/`** — owner/admin, only if `PENDING`. Returns `{ message, refund_amount, processing_fee, status }` (95% refund / 5% fee split; not an actual payment integration).

**POST `{id}/promote/`** — admin only. Promotes pending entry to confirmed booking if seats available. `{ message }`.

**GET `flight/<flight_id>/`** — public. `{ waitlist_count: N }`. NOTE: route is declared with a UUID path converter but `flight_id` is actually an integer FlightInstance id — currently unreachable as routed; needs backend fix to `<int:flight_id>`.

---

## Analytics — `/api/analytics/` (requires `is_staff=True`, not the same admin check as elsewhere)

**GET `summary/`** — `{ total_bookings, confirmed_bookings, cancelled_bookings, cancellation_rate, total_revenue, total_flights, scheduled_flights, avg_occupancy }`

**GET `monthly-revenue/?months=12`** (1-60) — `[{ month:"2026-07", revenue:105000.0 }]`

**GET `popular-routes/?top=10`** (1-100) — `[{ source, destination, route, bookings }]`

**GET `flight-occupancy/?top=20`** (1-200) — `[{ flight_number, airline, route, total_seats, booked_seats, available_seats, occupancy_rate }]`

**GET `peak-booking-hours/`** — always 24 entries — `[{ hour:0-23, bookings }]` (UTC)

---

## Notifications — `/api/notifications/` (auth required, own notifications only)

**GET `/`** — paginated — `{ id, title, message, notification_type, is_read, created_at }`.
`notification_type`: `BOOKING_CONFIRMED|BOOKING_CANCELLED|WAITLIST_ALLOCATED|FLIGHT_DELAYED|FLIGHT_CANCELLED|FLIGHT_BOARDING|FLIGHT_DEPARTED|FLIGHT_ARRIVED`

**GET `{id}/`** — single.

**PATCH `{id}/read/`** — marks read, idempotent. Returns notification.

**POST `mark-all-read/`** — `{ message }`.

---

## Bulk Upload — `/api/bulk-upload/` (admin only)

**POST `import/`** — multipart: `entity` (one of below, or `"all"`), `file` (.csv/.xls/.xlsx; must be `.zip` if `entity="all"`).
```json
{ "total":50,"success":47,"created":40,"updated":7,"failed":3,
  "errors":[{"row":12,"data":{"iata_code":"XX"},"errors":{"iata_code":"Required: exactly 3-letter IATA code."}}] }
```
Entities and required columns:
| entity | required columns |
|---|---|
| `airlines` | `iata_airline_code`, `airline_name` |
| `airports` | `iata_code`(3 letters), `airport_name`, `city`, `country_iso` |
| `aircraft_models` | `manufacturer`, `model_name` |
| `aircraft` | `registration`, `airline_code`, `manufacturer`, `model_name` |
| `flight_routes` | `flight_no`, `airline_code` |
| `flight_instances` | `flight_no`, `date`, `aircraft_registration`, `scheduled_departure`, `scheduled_arrival` |
| `flight_legs` | `flight_no`, `leg_order`, `departure_airport`, `arrival_airport`, `scheduled_departure`, `scheduled_arrival` |
| `food_items` | `airline_code`, `name` |
| `flight_meals` | `flight_no`, `date`, `meal_name` |
| `fares` | `flight_no`, `date`, `fare_code`, `cabin_class` |

---

## Enums

| Enum | Values |
|---|---|
| Profile role | `ADMIN`, `CUSTOMER` |
| Profile gender | `MALE`, `FEMALE`, `OTHER` |
| Instance status | `SCHEDULED`, `DELAYED`, `CANCELLED`, `BOARDING`, `DEPARTED`, `ARRIVED` |
| Cabin class | `ECONOMY`, `BUSINESS`, `FIRST` |
| Seat position | `window`, `aisle`, `middle` |
| Seat status | `AVAILABLE`, `HELD`, `BOOKED`, `BLOCKED` |
| Refund type | `REFUNDABLE`, `NON_REFUNDABLE`, `PARTIAL` |
| Booking status | `CONFIRMED`, `CANCELLED` |
| Waitlist status | `PENDING`, `CONFIRMED`, `CANCELLED`, `EXPIRED` |
| Passenger gender | `M`, `F`, `O` |
| Notification type | `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `WAITLIST_ALLOCATED`, `FLIGHT_DELAYED`, `FLIGHT_CANCELLED`, `FLIGHT_BOARDING`, `FLIGHT_DEPARTED`, `FLIGHT_ARRIVED` |
