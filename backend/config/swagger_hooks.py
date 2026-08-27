def categorize_tags_hook(result, generator, request=None, public=True):
    """
    Postprocessing hook for drf-spectacular to group OpenAPI tags into:
    [Admin] ... and [Customer] ... sections.
    """
    paths = result.get('paths', {})

    for path, methods in paths.items():
        for method, operation in methods.items():
            if not isinstance(operation, dict) or 'tags' not in operation:
                continue

            existing_tags = operation.get('tags', [])
            new_tags = []

            # ─── ADMIN ENDPOINTS ───────────────────────────────────────────────
            if path.startswith('/api/analytics/'):
                new_tags.append('[Admin] Analytics')
            elif path.startswith('/api/bulk-upload/'):
                new_tags.append('[Admin] Bulk Data Import')
            elif '/v2/countries' in path:
                new_tags.append('[Admin] Master Data - Countries')
            elif '/v2/airports' in path:
                new_tags.append('[Admin] Master Data - Airports')
            elif '/v2/airlines' in path:
                new_tags.append('[Admin] Master Data - Airlines')
            elif '/v2/aircraft-models' in path:
                new_tags.append('[Admin] Fleet - Aircraft Models')
            elif '/v2/aircraft' in path:
                new_tags.append('[Admin] Fleet - Aircraft')
            elif '/v2/flight-routes' in path:
                new_tags.append('[Admin] Operations - Flight Routes')
            elif '/v2/flight-instances' in path:
                new_tags.append('[Admin] Operations - Flight Instances')
            elif '/v2/seats' in path:
                new_tags.append('[Admin] Operations - Seats')
            elif '/v2/fares' in path:
                new_tags.append('[Admin] Pricing - Fares')
            elif '/v2/seat-price-templates' in path:
                new_tags.append('[Admin] Pricing - Seat Price Templates')
            elif '/v2/food-items' in path:
                new_tags.append('[Admin] Meals - Food Items')
            elif '/v2/flight-meals' in path:
                new_tags.append('[Admin] Meals - Flight Meals')
            elif path.startswith('/api/flights/stats/'):
                new_tags.append('[Admin] Analytics - Flight Stats')
            elif '/promote/' in path:
                new_tags.append('[Admin] Waitlist Management')

            # ─── CUSTOMER ENDPOINTS ────────────────────────────────────────────
            elif path.startswith('/api/auth/'):
                new_tags.append('[Customer] Authentication & Profile')
            elif path.startswith('/api/bookings/'):
                new_tags.append('[Customer] Bookings & Passengers')
            elif path.startswith('/api/notifications/'):
                new_tags.append('[Customer] Notifications')
            elif path.startswith('/api/waitlist/'):
                new_tags.append('[Customer] Waitlist')
            elif path.startswith('/api/flights/calendar/') or path.startswith('/api/flights/bounds/'):
                new_tags.append('[Customer] Flight Fares & Calendar')
            elif path.startswith('/api/flights/route-optimization/'):
                new_tags.append('[Customer] Route Optimization')
            elif path.startswith('/api/flights/'):
                new_tags.append('[Customer] Flight Search & Listings')

            # Fallback for unhandled endpoints
            if not new_tags:
                for tag in existing_tags:
                    if any(kw in tag.lower() for kw in ['admin', 'analytics', 'import', 'stats']):
                        new_tags.append(f'[Admin] {tag.title()}')
                    else:
                        new_tags.append(f'[Customer] {tag.title()}')

            operation['tags'] = new_tags

    return result
