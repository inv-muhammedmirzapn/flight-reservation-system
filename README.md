# Flight Reservation & Route Optimization System

Backend: Django
Frontend: React
Database: SQLite (Phase 1), PostgreSQL (Phase 2)

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+ & npm/yarn

### 1. Backend Initialization (Django)
Open a terminal in the root of the project and run the following commands:
```bash
cd backend

# Create a virtual environment:
python3 -m venv venv

# Activate the virtual environment:
# On Linux/macOS:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies:
pip install -r requirements.txt

# Create a copy of the environment variables file:
cp .env.example .env

# Run database migrations (SQLite for now):
python manage.py migrate

# Start the development server:
python manage.py runserver
```
The backend server will run at `http://127.0.0.1:8000/`.

### 2. Frontend Initialization (React)
Open a new terminal window in the root of the project and run:
```bash
cd frontend

# Install Node modules:
npm install

# Start the React development server:
npm start
```
The frontend application will start at `http://localhost:3000/`.

## Git Strategy
We follow a standard Git branching strategy:
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical fixes in production
- `release/*` - Release preparation
## Project Modules Overview
- **User Management**: users app
- **Flight Management**: flights app
- **Flight Search & Booking**: bookings app
- **Route Optimization System**: route_optimization app
- **Dynamic Ticket Pricing**: pricing app
- **Waiting List Management**: waitlist app
- **Booking Analytics Dashboard**: analytics app
- **Flight Delay Management**: delays app
- **Notifications**: notifications app
- **Flight Comparison**: comparison app
- **Fare Prediction**: fare_prediction app
- **Advanced Search & Filtering**: search app
- **Popular Searches & Caching**: caching app
- **Bulk Flight Upload**: bulk_upload app
