# Passenger — Flight Management & Reservation System

[![Python](https://img.shields.io/badge/Python-3.12%2B-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.2-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Django REST Framework](https://img.shields.io/badge/DRF-3.15-red)](https://www.django-rest-framework.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Passenger** is an enterprise-grade, full-stack flight management and reservation platform designed for airlines, passengers, and operations administrators. It combines a **Template-Driven Flight Pricing Architecture**, rolling instance scheduling, atomic seat holds, in-flight meal recipe management, priority cabin waitlisting, geolocated airport search, and role-based HTTP-only cookie authentication.

---

## Table of Contents
- [System Architecture & Core Highlights](#-system-architecture--core-highlights)
  - [Modular Backend Architecture (13 Apps)](#-modular-django-backend-apps-13-services)
- [Comprehensive Feature Overview](#-comprehensive-feature-overview)
  - [Passenger & Booking Experience](#-passenger--booking-experience)
  - [Admin Panel & Airline Operations](#-admin-panel--airline-operations)
  - [Dynamic Pricing & Revenue Management](#-dynamic-pricing--revenue-management)
  - [Security, Authentication & Role Separation](#-security-authentication--role-separation)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#1-backend-setup)
  - [Frontend Setup](#2-frontend-setup)
- [Demo Credentials](#-demo-credentials)
- [Management Commands](#-management-commands)
- [Interactive API Documentation](#-interactive-api-documentation)
- [Repository Structure](#-repository-structure)
- [License](#-license)

---

## 🏛️ System Architecture & Core Highlights

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER (React 18 + Vite)                        │
│  Traveler Web Portal (Glassmorphic UI)  │  Admin Operations & Analytics Hub │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST / Cookie JWT
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                  DJANGO BACKEND ARCHITECTURE (13 APPS)                      │
│                                                                             │
│  [Identity & Infrastructure]                                                │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────┐  │
│  │           apps.users            │   │          apps.caching           │  │
│  │ Cookie JWT Auth & Role Access   │   │ Request Throttling & DB Cache   │  │
│  └────────────────┬────────────────┘   └────────────────┬────────────────┘  │
│                   │                                     │                   │
│  [Flight Core & Search Engine]                          │                   │
│  ┌────────────────▼────────────────┐   ┌────────────────▼────────────────┐  │
│  │          apps.flights           │   │           apps.search           │  │
│  │ Routes, Legs, Instances & Meals │   │ Geolocation & Connecting Graph  │  │
│  └────────────────┬────────────────┘   └────────────────┬────────────────┘  │
│                   │                                     │                   │
│  [Revenue & Dynamic Pricing]                            │                   │
│  ┌────────────────▼────────────────┐   ┌────────────────▼────────────────┐  │
│  │          apps.pricing           │   │      apps.fare_prediction       │  │
│  │ Dynamic Surge, Multi-Currency   │   │ Real-Time Trend Direction Rules │  │
│  └────────────────┬────────────────┘   └────────────────┬────────────────┘  │
│                   │                                     │                   │
│  [Booking & Waitlist Pipeline]                          │                   │
│  ┌────────────────▼────────────────┐   ┌────────────────▼────────────────┐  │
│  │          apps.bookings          │   │          apps.waitlist          │  │
│  │ 10-Min Seat Locks & PDF Passes  │   │ FIFO Priority Cabin Queue       │  │
│  └────────────────┬────────────────┘   └────────────────┬────────────────┘  │
│                   │                                     │                   │
│  [Operations & Traveler Alerts]                         │                   │
│  ┌────────────────▼────────────────┐   ┌────────────────▼────────────────┐  │
│  │           apps.delays           │   │       apps.notifications        │  │
│  │ Milestone Tracking & Gate Ops   │   │ Delay Alerts & Boarding Notices │  │
│  └────────────────┬────────────────┘   └────────────────┬────────────────┘  │
│                   │                                     │                   │
│  [Decision Support & Analytics]                         │                   │
│  ┌────────────────▼────────────────┐   ┌────────────────▼────────────────┐  │
│  │         apps.comparison         │   │         apps.analytics          │  │
│  │ Multi-Flight Spec & Fare Matrix │   │ Load Factors & Revenue Metrics  │  │
│  └────────────────┬────────────────┘   └────────────────┬────────────────┘  │
│                   │                                     │                   │
│  [Master Data Pipeline]                                 │                   │
│  ┌────────────────▼─────────────────────────────────────▼────────────────┐  │
│  │                       apps.bulk_upload                                │  │
│  │ High-Performance CSV/Excel Bulk Ingestion Engine & Validation Reports │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ ORM / Transactions
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        PERSISTENCE & CACHING TIER                           │
│        MYSQL / SQLite Database   │   Database Cache & Throttling       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🧩 Modular Django Backend Apps (13 Services)

| App Module | Domain Category | Key Responsibilities & Capabilities |
| :--- | :--- | :--- |
| **`apps.users`** | Identity & Security | Cookie JWT authentication, role separation (`ADMIN` vs `CUSTOMER`), profile management, OTP verification for password & email changes. |
| **`apps.caching`** | Infrastructure & Caching | Request throttling policies, public/auth API rate limiting, and database-backed cache operations (`createcachetable`). |
| **`apps.flights`** | Flight Core & Master Data | Master entities (Airports, Airlines, Aircraft), Flight Routes & Leg continuity, rolling horizon instance generator, cabin seat maps, and in-flight food/meal recipe builder. |
| **`apps.search`** | Search & Routing | Geolocated airport discovery via Haversine formula, direct flight queries, and multi-segment layover route graphs. |
| **`apps.pricing`** | Revenue & Dynamic Pricing | Reusable `RouteFareClass` templates, dynamic surge curves (occupancy thresholds, booking windows, holiday calendars), atomic bulk repricing (`select_for_update`), and multi-currency engine. |
| **`apps.fare_prediction`** | Price Intelligence | Rule-based price trend forecasting (`INCREASE`, `STABLE`, `DECREASE`) and confidence scoring to inform travelers on optimal booking timing. |
| **`apps.bookings`** | Booking & Fulfillment | Multi-step checkout wizard, 10-minute atomic seat locks (`SeatHold`), passenger manifests (up to 150-char names), meal addons, and ReportLab PDF boarding pass/invoice generation. |
| **`apps.waitlist`** | Capacity Management | Cabin-specific FIFO priority waitlist queues, automatic seat reallocation upon booking cancellations, and instant zero-penalty refunds. |
| **`apps.delays`** | Operations & Milestones | Real-time flight milestone tracking (`SCHEDULED`, `DELAYED`, `BOARDING`, `DEPARTED`, `ARRIVED`, `CANCELLED`), delay management, and gate/terminal updates. |
| **`apps.notifications`** | Traveler Communications | In-app notification center, unread counter badges, flight delay alerts, boarding gate notices, and waitlist promotion alerts with deep linking. |
| **`apps.comparison`** | Decision Support | Side-by-side multi-flight comparison engine evaluating durations, stopovers, baggage allowances, amenities, and cabin fares. |
| **`apps.analytics`** | Business Intelligence | Executive BI analytics: revenue trends, average load factors, passenger volume timelines, route popularity rankings, and cancellation ratios. |
| **`apps.bulk_upload`** | Master Data Pipeline | High-performance CSV & Excel (`.xlsx`, `.xls`) dataset ingestion engine for airports, airlines, aircraft, routes, and schedules with row-by-row validation audit reports. |

### ⚡ Architectural Highlights

1. **Template-Driven Route Pricing**: Routes define reusable `RouteFareClass` templates (base prices, refund policies, change fees, and baggage allowances). Flight instances inherit these templates dynamically, isolating historical ticket snapshots from future pricing changes.
2. **Sequential Leg Continuity**: Multi-leg connecting flights enforce airport path continuity (`leg[i].departure === leg[i-1].arrival`) on both frontend form builders and backend serializers.
3. **Atomic 10-Minute Seat Locks**: Real-time seat reservation engine creates temporary `SeatHold` locks with automatic expiration to eliminate race conditions and double-booking.
4. **Policy-Driven Cancellation & Snapshots**: Tickets maintain immutable snapshots of `price_paid`, `fare_code`, and `cabin_class`. Cancellations calculate dynamic refunds based on fare policy rules, while waitlist cancellations receive instant zero-penalty refunds.

---

## ✨ Comprehensive Feature Overview

### 🛫 Passenger & Booking Experience

- **Geolocated Airport Discovery**:
  - Automatically identifies nearest departure airports using browser geolocation and the **Haversine formula**.
  - Search by city, airport name, or 3-letter IATA code.
- **Flight Search & Route Intelligence**:
  - Direct and connecting flight search with multi-segment layover timeline cards.
  - Interactive filters: airline, stops, departure time blocks, price sliders, cabin class, and baggage allowances.
  - **Fare Prediction Badge**: Real-time trend predictions indicating whether prices are projected to rise, fall, or remain stable.
- **Side-by-Side Flight Comparison**:
  - Compare multiple flights simultaneously across duration, stopovers, baggage limits, amenities, and cabin fares.
- **Multi-Step Booking Wizard**:
  1. **Passenger Details**:
     - Supports up to **150-character passenger names** with live character counters, sanitization, and full-name validation.
     - Validated age inputs (1–130), gender categorization, and international phone numbers.
     - **Duplicate Passenger Detection**: Warns travelers if duplicate passenger identities are entered before proceeding.
  2. **Interactive Seat Selection**:
     - Visual cabin layout (`ECONOMY`, `BUSINESS`, `FIRST`) reflecting actual aircraft configurations (`3-3`, `2-4-2`, `3-3-3`, etc.).
     - Instant seat holding with remaining countdown timer.
  3. **In-Flight Meals & Dietary Menu**:
     - Complimentary meal combo selection linked to fare rules.
     - Paid add-on meal catalog with vegetarian, vegan, and allergen dietary filters.
  4. **Dynamic Baggage Controls**:
     - Clear breakdown of included checked baggage and cabin handbags.
     - Incremental extra baggage weight selector with real-time per-kg fee calculations.
  5. **Review & Payment Confirmation**:
     - Complete itemized breakdown (fare, seat selection fees, extra luggage, meal add-ons).
- **Downloadable PDF Boarding Pass / Ticket Invoice**:
  - High-resolution ReportLab PDF generation with airline branding, scannable QR/barcode placeholders, multi-passenger manifests, flight milestone timelines, and cancellation guidelines.
  - Hardened multi-line word wrapping supporting long (up to 150-character) names without layout clipping.
- **Ticket Management & Cancellation**:
  - Active vs. past booking tabs in user portal.
  - Automated refund calculations based on fare rules (`REFUNDABLE`, `PARTIAL`, `NON_REFUNDABLE`).
  - One-click instant waitlist cancellation with 100% refund.
- **Cabin-Specific Waitlist**:
  - Automatic waitlist placement when cabin classes are sold out.
  - First-In, First-Out (FIFO) queue allocation when cancellations occur.
- **Multi-Currency & Internationalization**:
  - Real-time currency selector supporting **INR, USD, EUR, GBP, AED, JPY**, and more.
  - Multilingual support (English, Japanese) powered by `i18next`.
- **In-App Notification Center**:
  - Unread notification badges, flight delay alerts, boarding notifications, and waitlist clearance alerts with direct deep linking to tickets.

---

### 🎛️ Admin Panel & Airline Operations

- **Operations Dashboard & Flight Overview**:
  - Live status tracking (`SCHEDULED`, `DELAYED`, `BOARDING`, `DEPARTED`, `ARRIVED`, `CANCELLED`).
  - Quick-edit modal for delay adjustments (non-negative validation), terminal assignments, and boarding gate updates with character length constraints.
- **Route & Leg Management**:
  - Single-leg and multi-leg route configuration with intermediate stopovers.
  - Automatic intermediate airport locking to guarantee topological flight path continuity.
  - Route operating day masks (`operates_on_days`).
- **Rolling Instance Generator**:
  - Automated scheduler creating flight instances, seat maps, and fares across a rolling 90-day horizon (`generate_instances`).
- **Dynamic Pricing & Revenue Management**:
  - **Occupancy Surge Curves**: Configurable multiplier based on seat occupancy thresholds.
  - **Booking Window Multipliers**: Dynamic demand adjustments for bookings close to departure date.
  - **Holiday Event Engine**: Global and country-specific holiday calendars with surge percentages and date range validations.
- **Route Fare Class Templates & Bulk Repricing**:
  - Define cabin fare baselines, cancellation refund policies, change fees, and baggage rules.
  - Atomic bulk repricing across unsold future instances with row-level database locks (`select_for_update()`) and audit logs (`FarePriceChangeLog`).
- **Aircraft & Seating Master Data**:
  - Aircraft registration management with automatic uppercase normalization.
  - Layout validation ensuring seating layout codes (e.g., `3-3`, `2-4-2`) match total passenger capacity.
- **Airlines & Airports Master Records**:
  - File upload safeguards enforcing 2MB limits and image MIME verification (`image/jpeg`, `image/png`, `image/webp`).
  - Latitude/longitude validation with coordinate parsing and terminal list sanitation.
- **Food Items & Meal Recipes**:
  - Airline-scoped recipe builder requiring $\ge 1$ item and integer quantities $\ge 1$.
  - Prevention of duplicate food items in meal recipes and cross-airline item linkage.
  - Automatic synchronization of vegetarian flags when vegan is selected.
- **Passenger & Booking Records**:
  - Filterable booking lists with PNR search and status filters.
  - Expandable passenger manifest drawer with word-break protections for long names.
- **Analytics & Reporting Dashboard**:
  - Visual charts powered by Recharts: revenue trends, average load factors, passenger volumes, route popularity rankings, and cancellation ratios.
- **System Data Management (Bulk Import)**:
  - Import CSV and Excel (`.xlsx`, `.xls`) datasets for airports, airlines, aircraft, routes, and schedules.
  - Immediate import report showing processed rows, successes, and line-item validation failures.

---

### 🔒 Security, Authentication & Role Separation

- **HTTP-Only Cookie JWT Authentication**:
  - Access and refresh tokens stored securely in HTTP-only, SameSite cookies to protect against XSS token theft.
  - Automatic token refresh interceptors in frontend API client (`apiClient.js`).
- **Strict Role Separation**:
  - Roles: `ADMIN` and `CUSTOMER`.
  - Permission checks explicitly prevent administrative users from executing passenger bookings, seat holds, or joining waitlists.
- **Protected Foreign Key Deletions**:
  - Catch and format database `ProtectedError` exceptions to prevent accidental cascade deletion of active routes, flights, or bookings.
- **Throttling & API Caching**:
  - Rate limiting on public and authentication endpoints using Django's database cache table.

---

## 🛠️ Technology Stack

### Backend
| Technology | Description |
| :--- | :--- |
| **Python 3.12** | Core programming language |
| **Django 5.2** | Web framework & ORM |
| **Django REST Framework** | RESTful API architecture |
| **SimpleJWT** | Secure JWT authentication with HTTP-Only cookies |
| **ReportLab** | Enterprise PDF generation for boarding passes and invoices |
| **Pandas / OpenPyXL** | High-performance bulk data processing (CSV / Excel) |
| **drf-spectacular** | OpenAPI 3.0 / Swagger schema generation |
| **Pillow** | Image handling and validation |
| **PyCountry** | ISO country and currency code standardization |

### Frontend (`frontend-v2`)
| Technology | Description |
| :--- | :--- |
| **React 18** | UI component architecture |
| **Vite 8** | High-speed frontend build tool and dev server |
| **Redux Toolkit** | Centralized client state management |
| **Tailwind CSS 3.4** | Modern utility-first styling with custom glassmorphism design tokens |
| **React Router v7** | Single Page Application (SPA) client-side routing |
| **Recharts 3** | Interactive data visualization for the admin analytics dashboard |
| **Lucide React** | Consistent iconography |
| **React Hot Toast** | Non-blocking user feedback and validation alerts |
| **i18next** | Internationalization (i18n) framework |

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+** (Python 3.12 recommended)
- **Node.js 18+** & `npm`
- **Git**

---

### 1. Backend Setup

```bash
# Clone repository
git clone https://github.com/your-username/flight-management.git
cd flight-management/backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate       # On Linux / macOS
# venv\Scripts\activate         # On Windows

# Install backend dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Create the cache table required for throttling & session management
python manage.py createcachetable

# Seed initial master data (Airports, Airlines, Aircraft, Routes, Fares, Users)
python manage.py seed_db

# Generate upcoming flight instances across a 90-day horizon
python manage.py generate_instances --days 90

# Start the Django development server
python manage.py runserver
```

Backend API will be live at: **`http://127.0.0.1:8000/`**

---

### 2. Frontend Setup

Open a new terminal window:

```bash
# Navigate to the modern React frontend
cd flight-management/frontend-v2

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

Frontend application will be accessible at: **`http://localhost:5173/`**

To produce a production bundle:
```bash
npm run build
```

---

## 🔑 Demo Credentials

Running `python manage.py seed_db` initializes two default role accounts:

| Role | Username | Password | Email | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | `admin@skyflow.com` | Full access to Admin Panel, Operations, Master Data, Pricing, and Analytics |
| **Customer / Traveler** | `customer` | `customer123` | `customer@gmail.com` | Flight search, booking checkout, seat holding, PDF boarding passes, profile |

---

## 🛠️ Management Commands

| Command | Purpose |
| :--- | :--- |
| `python manage.py seed_db` | Seeds static reference datasets (Airports, Airlines, Aircraft, Routes, Meal Combos, Demo Users). |
| `python manage.py generate_instances --days 90` | Generates upcoming flight instances, seat maps, and fares for the next N days. |
| `python manage.py createcachetable` | Initializes the database cache table required for API rate throttling. |
| `python manage.py check` | Runs full Django system checks across models, settings, and apps. |
| `python manage.py test apps.bookings` | Executes automated tests for bookings, seat holds, role separation, and PDF generation. |
| `python manage.py test apps.flights.tests.test_pricing` | Runs automated tests for pricing architecture, fare class templates, and repricing logic. |

---

## 📖 Interactive API Documentation

Passenger includes automated OpenAPI 3.0 schema generation via `drf-spectacular`:

- **Swagger UI**: `http://127.0.0.1:8000/api/docs/swagger/`
- **ReDoc**: `http://127.0.0.1:8000/api/docs/redoc/`
- **Raw OpenAPI Schema**: `http://127.0.0.1:8000/api/schema/`

---

## 📁 Repository Structure

```
flight-management/
├── backend/
│   ├── apps/
│   │   ├── analytics/        # Business intelligence & performance metrics
│   │   ├── bookings/         # Booking wizard, atomic seat holds, PDF tickets
│   │   ├── bulk_upload/      # CSV/Excel bulk import engine
│   │   ├── caching/          # Request throttling & caching layer
│   │   ├── comparison/       # Flight comparison service
│   │   ├── delays/           # Real-time delay calculation & milestones
│   │   ├── fare_prediction/  # Price trend prediction heuristics
│   │   ├── flights/          # Routes, instances, aircraft models, seat layouts, food & meals
│   │   ├── notifications/    # In-app notification center & alerts
│   │   ├── pricing/          # Template pricing, dynamic surge & currency converter
│   │   ├── search/           # Geolocation proximity & connecting route graph
│   │   ├── users/            # Cookie JWT authentication & profile management
│   │   └── waitlist/         # FIFO cabin-class waitlist queues
│   ├── config/               # Django settings (base, local, prod), URLs, exceptions
│   └── manage.py
├── frontend-v2/              # Modern React + Vite application
│   ├── src/
│   │   ├── admin/            # Admin Panel (Master, Operations, Records, System, Analytics)
│   │   │   ├── _core/        # Shared admin styles, base components, delete hooks
│   │   │   ├── analytics/    # Recharts analytics dashboard
│   │   │   ├── master/       # Aircraft, Airlines, Airports, Food Items
│   │   │   ├── operations/   # Routes, Instances, Fares, Dynamic Pricing, Meals, Seat Map
│   │   │   ├── records/      # Bookings, Passengers, Payment logs
│   │   │   └── system/       # Data management (CSV/Excel import with live reports)
│   │   ├── components/       # Reusable UI cards, inputs, date pickers, modals
│   │   ├── i18n/             # Multi-language translation resources (en, ja)
│   │   ├── pages/            # Landing, Flight Search, Checkout, Tickets, Profile
│   │   ├── services/         # Modular API service wrappers with token refresh
│   │   ├── store/            # Redux Toolkit state slices
│   │   └── utils/            # Currency formatting, error parsers, date helpers
│   ├── package.json
│   └── vite.config.js
├── docs/                     # Architectural documents & guides
└── README.md
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
