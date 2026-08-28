"""
ticket_pdf.py
─────────────
Server-side electronic ticket & invoice PDF generator.
Uses ReportLab to generate a clean, modern, currency-aware PDF ticket.
"""
import io
import os
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Spacer, Table, TableStyle,
    Paragraph, HRFlowable
)
from reportlab.graphics.shapes import Drawing, Circle, Line, Polygon

from apps.pricing.services_currency import CurrencyService

# ── Color Palette ──────────────────────────────────────────────────────────────
DARK      = colors.HexColor('#0f172a')  # Slate-900
DARK2     = colors.HexColor('#1e293b')  # Slate-800
AMBER     = colors.HexColor('#d97706')  # Amber-600
AMBER_BG  = colors.HexColor('#fef3c7')  # Amber-100
WHITE     = colors.white
BG_CARD   = colors.HexColor('#f8fafc')  # Slate-50
BORDER    = colors.HexColor('#e2e8f0')  # Slate-200
SUBTXT    = colors.HexColor('#64748b')  # Slate-500
GREEN_TXT = colors.HexColor('#166534')  # Emerald-800
GREEN_BG  = colors.HexColor('#dcfce7')  # Emerald-100
RED_TXT   = colors.HexColor('#991b1b')  # Red-800
RED_BG    = colors.HexColor('#fee2e2')  # Red-100

A4W, A4H = A4

LM = 14 * mm
RM = 14 * mm
TM = 14 * mm
BM = 14 * mm


# ── Currency Helper ────────────────────────────────────────────────────────────

CURRENCY_SYMBOLS = {
    'INR': 'Rs. ',
    'USD': '$',
    'EUR': 'EUR ',
    'GBP': '£',
    'AED': 'AED ',
    'SAR': 'SAR ',
    'CAD': 'CA$',
    'AUD': 'A$',
    'SGD': 'S$',
    'JPY': '¥',
}

def format_currency_val(amount, currency_code='INR'):
    code = (currency_code or 'INR').upper()
    sym = CURRENCY_SYMBOLS.get(code, f"{code} ")
    try:
        val = float(amount)
        return f"{sym}{val:,.2f}"
    except Exception:
        return f"{sym}0.00"


# ── Vector Drawing Helpers ─────────────────────────────────────────────────────

def _icon_plane_route():
    """Vector route graphic with origin circle, plane, and destination circle."""
    d = Drawing(100, 20)
    # Origin point
    d.add(Circle(8, 10, 3, fillColor=WHITE, strokeColor=AMBER, strokeWidth=1.5))
    # Line to plane
    d.add(Line(14, 10, 42, 10, strokeColor=AMBER, strokeWidth=1, strokeDashArray=[2, 2]))
    
    # Plane (centered at x=50)
    d.add(Polygon([44, 9, 54, 9, 56, 10, 54, 11, 44, 11], fillColor=AMBER, strokeColor=None))
    d.add(Polygon([48, 11, 46, 17, 48, 17, 52, 11], fillColor=AMBER, strokeColor=None))
    d.add(Polygon([48, 9, 46, 3, 48, 3, 52, 9], fillColor=AMBER, strokeColor=None))
    d.add(Polygon([44.5, 11, 43.5, 14, 44.5, 14, 46.5, 11], fillColor=AMBER, strokeColor=None))
    d.add(Polygon([44.5, 9, 43.5, 6, 44.5, 6, 46.5, 9], fillColor=AMBER, strokeColor=None))

    # Line to destination
    d.add(Line(58, 10, 86, 10, strokeColor=AMBER, strokeWidth=1, strokeDashArray=[2, 2]))
    # Destination point
    d.add(Circle(92, 10, 3, fillColor=AMBER, strokeColor=None))
    return d


# ── Main Generator ─────────────────────────────────────────────────────────────

def generate_booking_pdf(booking, target_currency=None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=LM,
        rightMargin=RM,
        topMargin=TM,
        bottomMargin=BM,
    )

    story = []

    def P(txt, size=9, color=DARK, bold=False, align=0, leading=None):
        return Paragraph(str(txt), ParagraphStyle(
            'CustomStyle',
            fontName='Helvetica-Bold' if bold else 'Helvetica',
            fontSize=size,
            textColor=color,
            alignment=align,
            leading=leading or (size * 1.3),
            spaceAfter=0,
        ))

    cw_total = A4W - LM - RM

    # 1. Target Currency Determination
    user_curr = target_currency or CurrencyService.get_user_currency(user=booking.user)
    fmt_curr = lambda amt: format_currency_val(amt, user_curr)

    ref_code = str(booking.id).replace('-', '').upper()[:8]
    passengers = list(booking.passengers.all())
    seat_count = booking.seat_count or len(passengers) or 1
    cabin_code = (booking.cabin_class or "ECONOMY").upper()
    cabin_label = {"ECONOMY": "Economy", "BUSINESS": "Business", "FIRST": "First Class"}.get(cabin_code, cabin_code.capitalize())
    bk_status = str(booking.status or "CONFIRMED").upper()

    # Dates & Times
    fi = booking.flight
    flight_route = fi.flight
    legs = list(flight_route.legs.order_by('leg_order'))
    first_leg = legs[0] if legs else None
    last_leg = legs[-1] if legs else None

    dep_dt = timezone.localtime(fi.scheduled_departure) if fi.scheduled_departure else None
    arr_dt = timezone.localtime(fi.scheduled_arrival) if fi.scheduled_arrival else None
    created_dt = timezone.localtime(booking.created_at) if booking.created_at else None

    dep_time_str = dep_dt.strftime('%H:%M') if dep_dt else "—"
    dep_date_str = dep_dt.strftime('%a, %d %b %Y') if dep_dt else "—"
    arr_time_str = arr_dt.strftime('%H:%M') if arr_dt else "—"
    arr_date_str = arr_dt.strftime('%a, %d %b %Y') if arr_dt else "—"
    booked_at_str = created_dt.strftime('%H:%M on %d %b %Y') if created_dt else ""

    duration_str = "—"
    if dep_dt and arr_dt:
        delta_sec = (arr_dt - dep_dt).total_seconds()
        if delta_sec > 0:
            h = int(delta_sec // 3600)
            m = int((delta_sec % 3600) // 60)
            duration_str = f"{h}h {m}m"

    num_stops = len(legs) - 1
    stop_label = "Non-stop" if num_stops <= 0 else f"{num_stops} stop{'s' if num_stops > 1 else ''}"

    # Airports
    dep_ap = first_leg.departure_airport if first_leg else None
    arr_ap = last_leg.arrival_airport if last_leg else None
    origin_code = dep_ap.iata_code if dep_ap else "N/A"
    dest_code = arr_ap.iata_code if arr_ap else "N/A"
    origin_name = f"{dep_ap.city or origin_code}, {dep_ap.airport_name}" if dep_ap else "Origin Airport"
    dest_name = f"{arr_ap.city or dest_code}, {arr_ap.airport_name}" if arr_ap else "Destination Airport"

    # Flight Details
    flight_no = flight_route.flight_no
    airline_name = flight_route.airline.airline_name if flight_route.airline else "Airline"
    aircraft_name = "Airbus A320"
    if fi.aircraft and fi.aircraft.aircraft_model:
        mfg = fi.aircraft.aircraft_model.manufacturer or ""
        mdl = fi.aircraft.aircraft_model.model_name or ""
        aircraft_name = mdl if mdl.lower().startswith(mfg.lower()) else f"{mfg} {mdl}".strip()

    # ── 1. Document Header (Flat 2-row x 2-col Table) ───────────────────────────
    status_color_hex = GREEN_TXT.hexval() if bk_status == 'CONFIRMED' else (RED_TXT.hexval() if bk_status == 'CANCELLED' else DARK.hexval())

    hdr_rows = [
        [
            P("PASSENGER", size=18, color=DARK, bold=True),
            P(f"Booking Reference: <b>#{ref_code}</b>", size=10, color=DARK, align=2)
        ],
        [
            P(f"Booked at {booked_at_str}" if booked_at_str else "Electronic Ticket & Tax Invoice", size=8.5, color=SUBTXT),
            P(f"Class: <b>{cabin_label}</b> &nbsp;|&nbsp; Status: <font color='{status_color_hex}'><b>{bk_status}</b></font>", size=9.5, align=2)
        ]
    ]

    hdr_tbl = Table(hdr_rows, colWidths=[cw_total * 0.52, cw_total * 0.48])
    hdr_tbl.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(hdr_tbl)
    story.append(Spacer(1, 2 * mm))
    story.append(HRFlowable(width='100%', thickness=1, color=BORDER, spaceBefore=2, spaceAfter=8))

    # ── 2. Flight Itinerary / Route Card ───────────────────────────────────────
    col_w3 = cw_total / 3.0

    dep_cell = [
        P(dep_time_str, size=24, bold=True, color=DARK),
        Spacer(1, 1 * mm),
        P(origin_code, size=14, bold=True, color=DARK),
        P(origin_name, size=7.5, color=SUBTXT),
        Spacer(1, 2 * mm),
        P(dep_date_str, size=8.5, bold=True, color=AMBER),
    ]

    mid_cell = [
        P(f"<b>{airline_name}</b> • {flight_no}", size=9, bold=True, color=DARK, align=1),
        P(aircraft_name, size=7.5, color=SUBTXT, align=1),
        Spacer(1, 2 * mm),
        _icon_plane_route(),
        Spacer(1, 1 * mm),
        P(f"{duration_str} • {stop_label}", size=8, bold=True, color=SUBTXT, align=1),
    ]

    arr_cell = [
        P(arr_time_str, size=24, bold=True, color=DARK, align=2),
        Spacer(1, 1 * mm),
        P(dest_code, size=14, bold=True, color=DARK, align=2),
        P(dest_name, size=7.5, color=SUBTXT, align=2),
        Spacer(1, 2 * mm),
        P(arr_date_str, size=8.5, bold=True, color=AMBER, align=2),
    ]

    route_tbl = Table([[dep_cell, mid_cell, arr_cell]], colWidths=[col_w3, col_w3, col_w3])
    route_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('ROUNDEDCORNERS', [6]),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,0), 'CENTER'),
    ]))
    story.append(route_tbl)
    story.append(Spacer(1, 6 * mm))

    # ── 3. Transit Stops (if multi-leg) ────────────────────────────────────────
    if len(legs) > 1:
        transit_rows = []
        for i, leg in enumerate(legs[:-1]):
            next_leg = legs[i + 1]
            arr_ap_transit = leg.arrival_airport
            lm = int(next_leg.layover_duration_minutes or 0)
            layover_dur = f"{lm // 60}h {lm % 60}m" if lm > 0 else "Connection"
            t_code = arr_ap_transit.iata_code if arr_ap_transit else "—"
            t_city = arr_ap_transit.city or t_code if arr_ap_transit else "—"
            transit_rows.append([
                P("LAYOVER", size=7, bold=True, color=AMBER),
                P(f"{t_code} — {t_city}", size=8, bold=True, color=DARK),
                P(f"{layover_dur} connection time", size=7.5, color=SUBTXT, align=2),
            ])
        transit_tbl = Table(transit_rows, colWidths=[20 * mm, cw_total - 60 * mm, 40 * mm])
        transit_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), AMBER_BG),
            ('BOX', (0,0), (-1,-1), 0.5, AMBER),
            ('ROUNDEDCORNERS', [4]),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(transit_tbl)
        story.append(Spacer(1, 4 * mm))

    # ── 4. Passenger Details & Services Table ──────────────────────────────────
    story.append(P("PASSENGER DETAILS & SERVICES", size=9, bold=True, color=DARK))
    story.append(Spacer(1, 2 * mm))

    fare_obj = fi.fares.filter(cabin_class=cabin_code).first()
    default_checked_kg = float(fare_obj.effective_baggage_allowance_kg) if fare_obj else 15.0
    default_handbag_kg = float(fare_obj.effective_handbag_allowance_kg) if fare_obj else 7.0

    p_hdr = ['#', 'Passenger Name & Details', 'Seat', 'Included Baggage', 'Add-Ons (Meals & Extra Baggage)']
    p_rows = [p_hdr]

    gender_map = {'M': 'Male', 'F': 'Female', 'O': 'Other'}

    for p_idx, p in enumerate(passengers, 1):
        p_gender = gender_map.get(p.gender, p.gender or "Male")
        p_details = f"<b>{p.name}</b><br/><font color='{SUBTXT.hexval()}'>{p_gender}, {p.age} yrs {f'• {p.phone_number}' if p.phone_number else ''}</font>"

        seat_str = p.seat_number or "Unassigned"

        checked_kg = float(p.free_baggage_allowance_kg or default_checked_kg)
        handbag_kg = float(p.free_handbag_allowance_kg or default_handbag_kg)
        baggage_str = f"<b>{checked_kg:g} kg</b> Checked<br/><font color='{SUBTXT.hexval()}'>{handbag_kg:g} kg Handbag</font>"

        # Itemized Add-ons (Extra baggage & Meals)
        addons_list = []
        extra_kg = float(p.extra_baggage_kg or 0)
        extra_cost = float(p.extra_baggage_cost or 0)
        if extra_kg > 0:
            converted_bag_cost = float(CurrencyService.convert_amount(extra_cost, 'INR', user_curr))
            addons_list.append(f"+{extra_kg:g} kg Baggage ({fmt_curr(converted_bag_cost)})")

        for m in p.selected_meals.all():
            m_name = m.food_item.name if m.food_item else (m.flight_meal.name if m.flight_meal else "In-Flight Meal")
            m_qty = m.quantity or 1
            m_unit_price = float(m.unit_price or 0)
            if m_unit_price > 0:
                m_total_curr = float(CurrencyService.convert_amount(m_unit_price * m_qty, 'INR', user_curr))
                addons_list.append(f"{m_name} x{m_qty} ({fmt_curr(m_total_curr)})")
            else:
                addons_list.append(f"{m_name} (Complimentary)")

        if not addons_list:
            addons_str = "<font color='" + SUBTXT.hexval() + "'>No extra add-ons</font>"
        else:
            addons_str = "<br/>".join(addons_list)

        p_rows.append([
            str(p_idx),
            P(p_details, size=8, color=DARK),
            P(f"<b>{seat_str}</b>", size=8.5, color=GREEN_TXT if p.seat_number else SUBTXT, align=1),
            P(baggage_str, size=8, color=DARK),
            P(addons_str, size=8, color=DARK),
        ])

    p_col_widths = [6 * mm, 52 * mm, 18 * mm, 38 * mm, cw_total - 114 * mm]
    p_tbl = Table(p_rows, colWidths=p_col_widths)
    p_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_CARD),
        ('TEXTCOLOR', (0,0), (-1,0), DARK),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('LINEBELOW', (0,0), (-1,0), 1, BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(p_tbl)
    story.append(Spacer(1, 6 * mm))

    # ── 5. Payment Summary Breakdown (Flat 3-Column Table) ────────────────────
    grand_total_inr = Decimal(str(booking.total_price or 0))
    grand_total_curr = CurrencyService.convert_amount(grand_total_inr, 'INR', user_curr)

    # Convert meal total & extra baggage total
    meal_total_inr = Decimal('0.00')
    baggage_total_inr = Decimal('0.00')

    for p in passengers:
        baggage_total_inr += Decimal(str(p.extra_baggage_cost or 0))
        for m in p.selected_meals.all():
            qty = Decimal(str(m.quantity or 1))
            u_price = Decimal(str(m.unit_price or 0))
            meal_total_inr += (qty * u_price)

    meal_total_curr = CurrencyService.convert_amount(meal_total_inr, 'INR', user_curr)
    baggage_total_curr = CurrencyService.convert_amount(baggage_total_inr, 'INR', user_curr)

    # Compute subtotal and base fare
    subtotal_curr = (grand_total_curr / Decimal('1.12')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if grand_total_curr > 0 else Decimal('0.00')
    base_fare_curr = max(Decimal('0.00'), subtotal_curr - meal_total_curr - baggage_total_curr)
    taxes_curr = max(Decimal('0.00'), grand_total_curr - (base_fare_curr + meal_total_curr + baggage_total_curr))

    left_col_w = cw_total - 105 * mm
    label_w = 65 * mm
    val_w = 40 * mm

    pay_rows = [
        [
            P("<b>PAYMENT SUMMARY</b>", size=9, bold=True, color=DARK),
            P(f"Base Fare ({seat_count} seat{'s' if seat_count > 1 else ''})", size=8, color=SUBTXT),
            P(fmt_curr(base_fare_curr), size=8, bold=True, color=DARK, align=2)
        ]
    ]

    if meal_total_curr > 0:
        pay_rows.append([
            "",
            P("In-Flight Meals", size=8, color=AMBER),
            P(fmt_curr(meal_total_curr), size=8, bold=True, color=AMBER, align=2)
        ])

    if baggage_total_curr > 0:
        pay_rows.append([
            "",
            P("Extra Luggage", size=8, color=DARK2),
            P(fmt_curr(baggage_total_curr), size=8, bold=True, color=DARK2, align=2)
        ])

    pay_rows.append([
        "",
        P("Taxes & Service Charges (12%)", size=8, color=SUBTXT),
        P(fmt_curr(taxes_curr), size=8, bold=True, color=DARK, align=2)
    ])

    pay_rows.append([
        "",
        P("Total Amount Paid", size=10, bold=True, color=DARK),
        P(fmt_curr(grand_total_curr), size=11, bold=True, color=DARK, align=2)
    ])

    pay_tbl = Table(pay_rows, colWidths=[left_col_w, label_w, val_w])
    pay_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('ROUNDEDCORNERS', [6]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('LINEABOVE', (1,-1), (-1,-1), 1, DARK),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(pay_tbl)
    story.append(Spacer(1, 6 * mm))

    # ── 6. Terms & Travel Guidelines Section ───────────────────────────────────
    guidelines_content = [
        P("<b>IMPORTANT TRAVEL INFORMATION & GUIDELINES</b>", size=8.5, bold=True, color=DARK),
        Spacer(1, 2 * mm),
        P("• <b>Check-In & Gate Closing:</b> Check-in counters close 45 mins prior to departure for domestic flights and 60 mins for international flights. Boarding gates close strictly 20 mins before departure.", size=7.5, color=SUBTXT, leading=10),
        Spacer(1, 1 * mm),
        P("• <b>Baggage & Dangerous Goods:</b> Lighters, power banks, e-cigarettes, and flammable liquids are strictly prohibited in checked baggage. Ensure hand baggage limits are respected.", size=7.5, color=SUBTXT, leading=10),
        Spacer(1, 1 * mm),
        P("• <b>Identification:</b> A valid government-issued photo ID (Passport, Driving License, National ID) matching the ticket passenger name is required for airport entry and check-in.", size=7.5, color=SUBTXT, leading=10),
        Spacer(1, 1 * mm),
        P("• <b>Customer Support:</b> For cancellations or date changes, contact Passenger Support at <b>support@passenger.com</b> or call <b>+91 98765 43210</b>.", size=7.5, color=SUBTXT, leading=10),
    ]

    guidelines_tbl = Table([[guidelines_content]], colWidths=[cw_total])
    guidelines_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('ROUNDEDCORNERS', [4]),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(guidelines_tbl)

    # Chrome Footer callback
    def _draw_footer(canvas, doc):
        canvas.saveState()
        now_str = datetime.now().strftime('%d %b %Y, %H:%M')
        canvas.setFillColor(SUBTXT)
        canvas.setFont('Helvetica', 7)
        canvas.drawCentredString(
            A4W / 2.0, 8 * mm,
            f"© Passenger Flight Reservation System  •  Generated {now_str}  •  Page {doc.page}"
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
    return buf.getvalue()