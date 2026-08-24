# SkyFlow — Flight Management & Reservation System

SkyFlow is a modern, full-stack flight management and reservation platform featuring a **Template-Driven Flight Pricing Architecture**, rolling instance generation, seat map holding, ticket snapshotting, cabin-specific waitlisting, and HTTP-only cookie authentication.

---

## Key Features

### ✈️ Flight & Route Management
- **Route Templates**: Define flight numbers, origin/destination legs, aircraft assignments, and operating schedules (`operates_on_days`).
- **Rolling Instance Generator**: Automated generation of `FlightInstance`, `Seat`, and `Fare` rows across a rolling 90-day horizon (`python manage.py generate_instances`).

### 💰 Template-Driven Flight Pricing Architecture
- **Route Fare Classes**: Cabin-specific base prices, refund policies (`REFUNDABLE`, `PARTIAL`, `NON_REFUNDABLE`), change fees, and baggage allowances attached as templates to routes (`RouteFareClass`).
- **Pluggable Pricing Strategies**: Decoupled pricing logic via strategy pattern (`PricingStrategy` / `FlatPricingStrategy`).
- **Atomic Repricing & Audit Logging**: Dynamic updates to unsold future fares with atomic database row locks (`.select_for_update()`) and audit tracking (`FarePriceChangeLog`).
- **Immutable Ticket Snapshots**: Historical tickets (`Ticket`) snapshot `price_paid`, `fare_code`, and `cabin_class` at booking time, isolating past purchases from base price updates.

### 💺 Seat Selection & Holding
- **Interactive Seat Map**: Real-time availability by cabin class (`ECONOMY`, `BUSINESS`, `FIRST`).
- **10-Minute Seat Holds**: Temporary `SeatHold` locks seat selections for 10 minutes during checkout to prevent double-booking.

### 📋 Waitlist Management
- **Cabin-Class Specific Waitlist**: Join waitlists for fully booked flights on a per-cabin-class basis.
- **Auto-Allocation**: Automatic queue allocation when booked seats are canceled.

### 🔒 Cookie-Based JWT Authentication
- HTTP-Only cookie-based token storage for access and refresh tokens.
- Role-based permissions (`ADMIN`, `CUSTOMER`).

### 🔔 Notifications & Deep Linking
- Real-time in-app notifications triggered by booking updates or flight status changes.
- Direct navigation links to ticket detail views.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: Python 3.12, Django 5.x, Django REST Framework
- **Authentication**: SimpleJWT with HTTP-Only Cookies
- **Database**: SQLite (Development) / PostgreSQL (Production)
- **Caching**: Django Database Cache (`createcachetable`) for API throttling & session management

### Frontend (`frontend-v2`)
- **Framework**: React 18, Vite
- **Styling**: Modern Glassmorphic Aesthetic, Vanilla CSS / Tailwind CSS, Lucide Icons
- **State Management**: Redux Toolkit & RTK Query
- **Routing**: React Router v6

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & `npm`

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate   # Linux/macOS
# venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create database cache table (Required for throttling)
python manage.py createcachetable

# Seed base static data (Airlines, Airports, Aircraft, Routes & Fare Templates)
python manage.py seed_db

# Generate upcoming flight instances for a 90-day horizon
python manage.py generate_instances --days 90

# Run development server
python manage.py runserver
```
The backend API will run at `http://127.0.0.1:8000/`.

---

### 2. Frontend Setup

Open a new terminal window:

```bash
# Navigate to frontend directory
cd frontend-v2

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
The frontend application will start at `http://localhost:5173/`.

---

## 🔑 Default Credentials

The `seed_db` command creates two pre-configured user accounts:

| Role | Username | Password | Email |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | `admin@skyflow.com` |
| **Customer** | `customer` | `customer123` | `customer@gmail.com` |

---

## 🛠️ Useful Management Commands

| Command | Description |
| :--- | :--- |
| `python manage.py seed_db` | Seeds static reference data (Airports, Airlines, Aircraft, Routes, Food Items, Users). |
| `python manage.py generate_instances --days 90` | Generates upcoming flight instances, seats, and fares for the next N days. |
| `python manage.py createcachetable` | Creates the `cache_table` required for DB caching and API throttling. |
| `python manage.py test apps.flights.tests.test_pricing` | Runs the automated test suite for pricing architecture and repricing logic. |

---

## 📁 Repository Structure

```
flight-reservation-system/
├── backend/
│   ├── apps/
│   │   ├── users/            # Authentication & Profile management
│   │   ├── flights/          # Routes, Fares, Instances, Aircraft, Seat maps
│   │   ├── bookings/         # Booking processing, Seats holds & Ticket snapshots
│   │   ├── waitlist/         # Cabin-specific waiting lists
│   │   └── notifications/    # User notification system
│   ├── config/               # Django project settings & URLs
│   └── media/                # Airline logos & uploaded assets
├── frontend-v2/              # React + Vite UI application
│   ├── src/
│   │   ├── components/       # UI components & Glassmorphic cards
│   │   ├── pages/            # Flight Search, Ticket Details, Notifications
│   │   ├── store/            # Redux slices & RTK Query APIs
│   │   └── styles/           # CSS design system & utility tokens
└── flight-pricing-architecture.md  # Architectural specification document
```
