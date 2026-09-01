"""
ticket_pdf.py
─────────────
Server-side boarding-pass PDF generator.
Uses ReportLab (pure Python, no browser / chromium dependency).
"""
import io
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Spacer, Table, TableStyle,
    Paragraph, HRFlowable, KeepTogether, PageBreak
)
from reportlab.graphics.shapes import Drawing, Circle, Line, Polygon

# ── Palette ────────────────────────────────────────────────────────────────────
DARK   = colors.HexColor('#111827')
DARK2  = colors.HexColor('#1f2937')
ACCENT = colors.HexColor('#1e3a5f')   # single restrained navy-blue accent
GOLD   = ACCENT                        # alias — legacy refs now render navy
LGOLD  = colors.HexColor('#dbeafe')   # very light blue tint (was warm gold)
WHITE  = colors.white
OFF_W  = colors.HexColor('#f8f9fa')
LIGHT  = colors.HexColor('#f1f3f5')
MID    = colors.HexColor('#dee2e6')
SUBTXT = colors.HexColor('#6b7280')
GREEN  = colors.HexColor('#16a34a')
RED    = colors.HexColor('#dc2626')
WARN   = colors.HexColor('#eff6ff')
WARNB  = colors.HexColor('#1e3a5f')

A4W, A4H = A4

HDR_H   = 48          # tighter header
HDR_BOT = A4H - HDR_H

LM = 16 * mm
RM = 16 * mm
TM = HDR_H + 8 * mm
BM = 14 * mm


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmt_time(dt):
    if not dt: return '—'
    if isinstance(dt, str):
        try: dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        except Exception: return str(dt)
    from django.utils import timezone
    dt = timezone.localtime(dt)
    return dt.strftime('%H:%M')

def _fmt_date(dt):
    if not dt: return '—'
    if isinstance(dt, str):
        try: dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        except Exception: return str(dt)
    from django.utils import timezone
    dt = timezone.localtime(dt)
    return dt.strftime('%a, %d %b %Y')

def _diff_hm(dep, arr):
    try:
        if isinstance(dep, str):
            dep = datetime.fromisoformat(dep.replace('Z', '+00:00'))
        if isinstance(arr, str):
            arr = datetime.fromisoformat(arr.replace('Z', '+00:00'))
        delta = arr - dep
        if delta.total_seconds() < 0: return '—'
        h = int(delta.total_seconds() // 3600)
        m = int((delta.total_seconds() % 3600) // 60)
        return f'{h}h {m}m'
    except Exception:
        return '—'

def _layover_hm(arr_time, next_dep_time):
    """Return a human-readable layover duration string between two leg times."""
    return _diff_hm(arr_time, next_dep_time)

def _logo_path():
    from django.conf import settings
    base = str(settings.BASE_DIR)
    candidates = [
        os.path.join(base, '..', 'frontend', 'public', 'updated logo.png'),
        os.path.join(base, '..', 'frontend', 'public', 'mainlogo.png'),
        os.path.join(base, '..', 'frontend-v2', 'public', 'updated logo.png'),
        os.path.join(base, '..', 'frontend-v2', 'public', 'mainlogo.png'),
    ]
    for c in candidates:
        p = os.path.normpath(c)
        if os.path.isfile(p): return p
    return None


# ── Vector icons (no font-glyph dependency — avoids tofu/black-box rendering) ──

def _icon_plane_arrow():
    """Beautiful flight illustration for the center of the route card:
    Shows an origin point, dashed line, airplane, and destination point."""
    YELLOW = colors.HexColor('#d4a017')
    d = Drawing(80, 20)
    # Origin circle
    d.add(Circle(6, 10, 2, fillColor=WHITE, strokeColor=YELLOW, strokeWidth=1))
    # Path to plane
    d.add(Line(12, 10, 32, 10, strokeColor=YELLOW, strokeWidth=1, strokeDashArray=[2, 2]))
    
    # Plane (centered at x=40)
    # Fuselage
    d.add(Polygon([34,9, 44,9, 46,10, 44,11, 34,11], fillColor=YELLOW, strokeColor=None))
    # Wings
    d.add(Polygon([38,11, 36,18, 38,18, 42,11], fillColor=YELLOW, strokeColor=None))
    d.add(Polygon([38,9, 36,2, 38,2, 42,9], fillColor=YELLOW, strokeColor=None))
    # Tail
    d.add(Polygon([34.5,11, 33.5,15, 34.5,15, 36.5,11], fillColor=YELLOW, strokeColor=None))
    d.add(Polygon([34.5,9, 33.5,5, 34.5,5, 36.5,9], fillColor=YELLOW, strokeColor=None))

    # Path to destination
    d.add(Line(48, 10, 68, 10, strokeColor=YELLOW, strokeWidth=1, strokeDashArray=[2, 2]))
    # Destination circle
    d.add(Circle(74, 10, 2, fillColor=YELLOW, strokeColor=None))
    return d

def _icon_prohibited():
    """Red 'no entry' circle — universally recognizable, pure vector."""
    d = Drawing(14, 14)
    d.add(Circle(7, 7, 6, fillColor=RED, strokeColor=None))
    d.add(Line(3.2, 3.2, 10.8, 10.8, strokeColor=WHITE, strokeWidth=1.6))
    return d

def _icon_allowed():
    """Gold circle with a checkmark — pure vector."""
    d = Drawing(14, 14)
    d.add(Circle(7, 7, 6, fillColor=GOLD, strokeColor=None))
    d.add(Line(3.3, 6.8, 6, 4, strokeColor=WHITE, strokeWidth=1.6))
    d.add(Line(6, 4, 10.8, 10, strokeColor=WHITE, strokeWidth=1.6))
    return d

def _make_chip(icon_drawing, text_str, bg_color, chip_width, P):
    icon_col = 16
    text_col = max(chip_width - icon_col - 6, 20)
    t = Table([[icon_drawing, P(text_str, size=7, color=DARK)]],
              colWidths=[icon_col, text_col], rowHeights=[16])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('ROUNDEDCORNERS', [4]),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (0, 0), 4),
        ('RIGHTPADDING', (1, 0), (1, 0), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return t

def _flow_chips(labels, bg_color, icon_fn, section_width, max_cols, P):
    """Lay out chips in a fixed-width grid so nested-table auto-sizing
    (the previous cause of chips collapsing/rendering wrong) can't happen."""
    col_w = section_width / max_cols
    chips = [_make_chip(icon_fn(), label, bg_color, col_w - 4, P) for label in labels]
    rows = []
    for i in range(0, len(chips), max_cols):
        row = chips[i:i + max_cols]
        while len(row) < max_cols:
            row.append('')
        rows.append(row)
    return Table(rows, colWidths=[col_w] * max_cols, hAlign='LEFT')


# ── Chrome Drawer ─────────────────────────────────────────────────────────────

def _draw_chrome(canvas, doc):
    canvas.saveState()
    w, h = A4

    # Background
    canvas.setFillColor(OFF_W)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)

    # Header — white/light, navy removed. Navy rule marks the boundary.
    canvas.setFillColor(WHITE)
    canvas.rect(0, HDR_BOT, w, HDR_H, fill=1, stroke=0)

    # Logo
    logo_h = 36
    logo_y = HDR_BOT + (HDR_H - logo_h) / 2
    lp = _logo_path()
    if lp:
        try:
            canvas.drawImage(
                lp, LM, logo_y,
                width=100, height=logo_h,
                mask='auto', preserveAspectRatio=True
            )
        except Exception:
            canvas.setFillColor(DARK)
            canvas.setFont('Helvetica-Bold', 14)
            canvas.drawString(LM, HDR_BOT + HDR_H / 2 - 5, 'Passenger')
    else:
        canvas.setFillColor(DARK)
        canvas.setFont('Helvetica-Bold', 16)
        canvas.drawString(LM, HDR_BOT + 18, 'Passenger')

    # Label — dark text now (was gold-on-navy, needs contrast on white)
    canvas.setFillColor(DARK)
    canvas.setFont('Helvetica-Bold', 10)
    canvas.drawRightString(w - RM, HDR_BOT + 28, 'ELECTRONIC TICKET')
    canvas.setFillColor(SUBTXT)
    canvas.setFont('Helvetica', 7)
    canvas.drawRightString(w - RM, HDR_BOT + 15, 'Travel Itinerary & Receipt')

    # Footer — white/light, navy removed. Navy rule marks the boundary.
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, w, 28, fill=1, stroke=0)

    now_str = datetime.now().strftime('%d %b %Y, %H:%M')
    canvas.setFillColor(SUBTXT)
    canvas.setFont('Helvetica', 6.5)
    canvas.drawCentredString(
        w / 2, 10,
        f'© Passenger Flight Reservation System  •  Generated {now_str}  •  Page {doc.page}'
    )
    canvas.restoreState()


# ── Main Generator ─────────────────────────────────────────────────────────────

def generate_booking_pdf(booking) -> bytes:
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

    def P(txt, size=10, color=DARK, bold=False, align=0, leading=None):
        return Paragraph(txt, ParagraphStyle(
            'x', fontName='Helvetica-Bold' if bold else 'Helvetica',
            fontSize=size, textColor=color, alignment=align,
            leading=leading or size * 1.35, spaceAfter=0,
        ))

    def sp(h=3):
        return Spacer(1, h * mm)

    cw_total = A4W - LM - RM
    ref = str(booking.id).replace('-', '').upper()[:8]
    user = booking.user
    user_name = user.get_full_name() or user.email
    bk_status = booking.status
    from apps.pricing.services_currency import CurrencyService
    base_currency = booking.tickets.first().currency if booking.tickets.exists() else 'INR'
    currency = CurrencyService.get_user_currency(booking.user)
    
    raw_total = float(booking.total_price)
    total = float(CurrencyService.convert_amount(raw_total, base_currency, currency))

    passengers = list(booking.passengers.all())
    cabin = booking.get_cabin_class_display() if booking.cabin_class else 'Economy'

    # 1. Reference + Status (Document Header)
    status_bg = GREEN if bk_status == 'CONFIRMED' else (RED if bk_status == 'CANCELLED' else SUBTXT)
    ref_tbl = Table([[
        P(f'#{ref}', size=20, bold=True, color=DARK),
        P(bk_status, size=8, bold=True, color=WHITE, align=1),
    ]], colWidths=[cw_total - 40 * mm, 38 * mm])
    ref_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), LIGHT),
        ('BACKGROUND', (1, 0), (1, 0), status_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, MID),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (0, 0), 14),
        ('LEFTPADDING', (1, 0), (1, 0), 6),
        ('RIGHTPADDING', (1, 0), (1, 0), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [5]),
    ]))
    story.append(ref_tbl)
    story.append(sp(1))
    story.append(P(f'Booked by: <b>{user_name}</b>  •  Cabin: <b>{cabin}</b>  •  {booking.seat_count} seat(s)', size=8, color=SUBTXT))
    story.append(sp(3))

    # Sectors: currently one flight per booking; structured for future multi-sector support.
    sectors = [booking.flight]

    for idx, fi in enumerate(sectors):
        legs        = list(fi.flight.legs.order_by('leg_order'))
        first_leg   = legs[0] if legs else None
        last_leg    = legs[-1] if legs else None
        flight_no  = fi.flight.flight_no
        airline    = (fi.flight.airline.airline_name
                      if hasattr(fi.flight, 'airline') and fi.flight.airline else '—')
        aircraft   = (
            f"{fi.aircraft.aircraft_model.manufacturer} {fi.aircraft.aircraft_model.model_name}"
            if fi.aircraft and getattr(fi.aircraft, 'aircraft_model', None)
            else (fi.aircraft.registration if fi.aircraft else '—')
        )
        dep_ap      = first_leg.departure_airport if first_leg else None
        arr_ap      = last_leg.arrival_airport    if last_leg  else None
        origin      = dep_ap.iata_code if dep_ap else '—'
        dest        = arr_ap.iata_code if arr_ap else '—'
        origin_city = (dep_ap.city or dep_ap.iata_code) if dep_ap else '—'
        dest_city   = (arr_ap.city or arr_ap.iata_code) if arr_ap else '—'
        dep_time    = fi.scheduled_departure
        arr_time    = fi.scheduled_arrival
        duration    = _diff_hm(dep_time, arr_time)
        num_stops   = fi.flight.legs.count() - 1
        stop_label  = 'Non-stop' if num_stops == 0 else f'{num_stops} stop{"s" if num_stops > 1 else ""}'

        dep_t, arr_t = _fmt_time(dep_time), _fmt_time(arr_time)
        dep_d, arr_d = _fmt_date(dep_time), _fmt_date(arr_time)



        # Sector Header
        sector_title = f"{origin_city} → {dest_city}"
        sector_sub = f"{dep_d} • {stop_label} • {duration} duration"
        story.append(P(sector_title, size=14, bold=True, color=DARK))
        story.append(sp(1))
        story.append(P(sector_sub, size=9, color=SUBTXT))
        story.append(sp(3))

        # Route Card
        col3 = cw_total / 3
        route_tbl = Table([[
            [P(dep_t, size=28, bold=True, color=DARK), sp(3), P(origin, size=13, bold=True, color=DARK)],
            [_icon_plane_arrow(), sp(3), P(duration, size=8, color=SUBTXT, align=1), P(stop_label, size=7, color=SUBTXT, align=1)],
            [P(arr_t, size=28, bold=True, color=DARK, align=2), sp(3), P(dest, size=13, bold=True, color=DARK, align=2)],
        ]], colWidths=[col3, col3, col3])
        route_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), WHITE),
            ('BOX', (0, 0), (-1, -1), 0.8, MID),
            ('LINEABOVE', (0, 0), (-1, 0), 2.5, colors.HexColor('#d4a017')),
            ('ROUNDEDCORNERS', [3]),
            ('LINEBEFORE', (1, 0), (1, -1), 0.4, MID),
            ('LINEAFTER', (1, 0), (1, -1), 0.4, MID),
            ('TOPPADDING', (0, 0), (-1, -1), 14),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
            ('LEFTPADDING', (0, 0), (0, 0), 16),
            ('RIGHTPADDING', (2, 0), (2, 0), 16),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ]))
        story.append(route_tbl)
        story.append(sp(2))

        # ── Transit Stop Strip (only shown when there are intermediate stops) ──
        if len(legs) > 1:
            transit_rows = []
            for i, leg in enumerate(legs[:-1]):
                next_leg = legs[i + 1]
                arr_airport = leg.arrival_airport

                # next_leg.layover_duration_minutes = layover *before* the next leg starts
                # That is exactly the connection time we want to display here.
                lm = int(next_leg.layover_duration_minutes or 0)
                if lm > 0:
                    layover_dur = f'{lm // 60}h {lm % 60}m'
                elif leg.scheduled_arrival and next_leg.scheduled_departure:
                    layover_dur = _diff_hm(leg.scheduled_arrival, next_leg.scheduled_departure)
                else:
                    layover_dur = 'Check airline'

                iata = arr_airport.iata_code if arr_airport else '—'
                city = (arr_airport.city or iata) if arr_airport else '—'
                transit_rows.append([
                    P('LAYOVER', size=6, bold=True, color=GOLD),
                    P(f'{iata}  •  {city}', size=8, bold=True, color=DARK),
                    P(f'{layover_dur} connection time', size=7, color=SUBTXT, align=2),
                ])

            transit_tbl = Table(
                transit_rows,
                colWidths=[18 * mm, cw_total - 18 * mm - 38 * mm, 38 * mm],
            )
            transit_tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), LGOLD),
                ('BOX', (0, 0), (-1, -1), 0.5, MID),
                ('LINEBELOW', (0, 0), (-1, -2), 0.3, MID),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (0, -1), 10),
                ('LEFTPADDING', (1, 0), (1, -1), 8),
                ('RIGHTPADDING', (2, 0), (2, -1), 10),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(transit_tbl)
            story.append(sp(2))

        date_tbl = Table([[
            P(dep_d, size=8, color=DARK),
            P(arr_d, size=8, color=DARK, align=2),
        ]], colWidths=[cw_total / 2, cw_total / 2])
        date_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.4, MID),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (0, 0), 16),
            ('RIGHTPADDING', (1, 0), (1, 0), 16),
        ]))
        story.append(date_tbl)
        story.append(sp(3))

        # ── Airline logo (for info grid header row) ───────────────────────────
        from reportlab.platypus import Image as RLImage
        airline_logo_path = None
        try:
            al_obj = fi.flight.airline
            if al_obj and al_obj.logo:
                candidate = al_obj.logo.path
                if os.path.isfile(candidate):
                    airline_logo_path = candidate
        except Exception:
            pass

        # Info Grid — 3 columns x 2 rows
        # AIRLINE cell: logo + name inline on the same row
        if airline_logo_path:
            try:
                al_img = RLImage(airline_logo_path, width=20, height=14, kind='proportional')
                airline_inner = Table(
                    [[P(airline, size=9, bold=True, color=DARK), al_img]],
                    hAlign='LEFT',
                )
                airline_inner.setStyle(TableStyle([
                    ('TOPPADDING', (0,0), (-1,-1), 0),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                    ('LEFTPADDING', (0,0), (-1,-1), 0),
                    ('RIGHTPADDING', (0,0), (0,0), 6),
                    ('RIGHTPADDING', (1,0), (1,0), 0),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ]))
                airline_cell = [P('AIRLINE', size=7, color=SUBTXT, bold=True), airline_inner]
            except Exception:
                airline_cell = [P('AIRLINE', size=7, color=SUBTXT, bold=True), P(airline, size=10, bold=True, color=DARK)]
        else:
            airline_cell = [P('AIRLINE', size=7, color=SUBTXT, bold=True), P(airline, size=10, bold=True, color=DARK)]

        def _info_cell(label, value):
            return [P(label, size=7, color=SUBTXT, bold=True), P(value, size=10, bold=True, color=DARK)]

        info_rows = [
            [_info_cell('FLIGHT NO.', flight_no), airline_cell, _info_cell('AIRCRAFT', aircraft)],
            [_info_cell('CABIN', cabin), _info_cell('PASSENGERS', str(booking.seat_count)), _info_cell('TOTAL FARE', f'{currency} {total:,.2f}')],
        ]

        info_tbl = Table(info_rows, colWidths=[col3, col3, col3])
        info_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 0.4, MID),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(info_tbl)
        story.append(sp(2))

        # Fare type & baggage summary
        bag_summary_html = f"<font color='{SUBTXT.hexval()}'>■</font> <b>CABIN:</b> {cabin} &nbsp;&nbsp;&nbsp;&nbsp; "
        if passengers:
            checked = float(passengers[0].free_baggage_allowance_kg or 0) + float(passengers[0].extra_baggage_kg or 0)
            cabin_b = float(passengers[0].free_handbag_allowance_kg or 0)
            bag_summary_html += f"<font color='{SUBTXT.hexval()}'>■</font> <b>CHECK-IN:</b> {checked:g} kg &nbsp;&nbsp;&nbsp;&nbsp; "
            bag_summary_html += f"<font color='{SUBTXT.hexval()}'>■</font> <b>CABIN BAG:</b> {cabin_b:g} kg"
        story.append(P(bag_summary_html, size=8, color=DARK2, align=0))
        story.append(sp(4))

        # Passenger Details
        story.append(HRFlowable(width='100%', thickness=0.5, color=MID, spaceBefore=2*mm, spaceAfter=2*mm))
        story.append(P('PASSENGER DETAILS', size=7, bold=True, color=SUBTXT))
        story.append(sp(1))

        if passengers:
            gender_map = {'M': 'Male', 'F': 'Female', 'O': 'Other'}
            hdr = ['#', 'Name & Contact', 'Seat', 'Age', 'Gender', 'Meal Pref', 'Baggage (Check/Cabin)']
            rows = [hdr]
            for p_idx, p in enumerate(passengers, 1):
                checked = float(p.free_baggage_allowance_kg or 0) + float(p.extra_baggage_kg or 0)
                cabin_b = float(p.free_handbag_allowance_kg or 0)
                meal = getattr(p, 'meal_preference', 'None')
                if hasattr(p, 'meal') and p.meal:
                    meal = p.meal.food_item.name

                contact = f"{p.name}\n{p.phone_number or ''}"

                rows.append([
                    str(p_idx),
                    contact,
                    p.seat_number or '—',
                    str(p.age),
                    gender_map.get(p.gender, p.gender or '—'),
                    meal,
                    f'{checked:g}kg / {cabin_b:g}kg'
                ])

            col_ws = [8*mm, 44*mm, 18*mm, 12*mm, 18*mm, 36*mm, 42*mm]
            p_tbl = Table(rows, colWidths=col_ws, repeatRows=1)
            p_tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), LIGHT),
                ('TEXTCOLOR', (0, 0), (-1, 0), DARK),
                ('LINEBELOW', (0, 0), (-1, 0), 1, DARK),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 7),
                ('TOPPADDING', (0, 0), (-1, 0), 7),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
                ('LEFTPADDING', (0, 0), (-1, 0), 6),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                ('LEFTPADDING', (0, 1), (-1, -1), 6),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT]),
                ('TEXTCOLOR', (2, 1), (2, -1), GREEN),
                ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.4, MID),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(p_tbl)
        else:
            story.append(P('No passenger details on record.', size=9, color=SUBTXT))

        story.append(sp(5))

    # ── PAYMENT SUMMARY ───────────────────────────────────────────────────────
    story.append(sp(3))

    # --- Compute itemised breakdown (all in display currency) ---
    from decimal import Decimal as _Dec

    fi = booking.flight
    fare_obj = fi.fares.filter(cabin_class=booking.cabin_class).first() if booking.cabin_class else fi.fares.first()
    base_per_pax_inr = fare_obj.price if fare_obj else (_Dec(str(booking.total_price)) / booking.seat_count)

    total_seat_fee_inr = _Dec("0")
    for p in passengers:
        seat_obj = fi.seats.filter(seat_number=p.seat_number).first() if p.seat_number else None
        if seat_obj:
            total_seat_fee_inr += _Dec(str(seat_obj.seat_fee or 0))

    total_extra_bag_inr = sum(_Dec(str(p.extra_baggage_cost or 0)) for p in passengers)

    from apps.bookings.models import PassengerMeal
    total_meal_inr = sum(
        _Dec(str(pm.unit_price or 0)) * pm.quantity
        for p in passengers
        for pm in p.selected_meals.all()
    )

    def _conv(amount_inr):
        return float(CurrencyService.convert_amount(_Dec(str(amount_inr)), base_currency, currency))

    base_fare_display = _conv(base_per_pax_inr * booking.seat_count)
    seat_fee_display  = _conv(total_seat_fee_inr)
    extra_bag_display = _conv(total_extra_bag_inr)
    meal_display      = _conv(total_meal_inr)

    subtotal_display = base_fare_display + seat_fee_display + extra_bag_display + meal_display
    tax_display      = max(0.0, total - subtotal_display)
    tax_pct          = round((tax_display / total * 100)) if total > 0 else 12

    # ── PAYMENT SUMMARY — flat single table, no nested inner table ────────────
    # Rows: [left-label col | item-label col | amount col]
    # First data row spans left column for all item rows, then bold total row.
    GOLD_Y = colors.HexColor('#d4a017')
    lw2  = cw_total * 0.28
    ilw2 = cw_total * 0.48
    ivw2 = cw_total * 0.24

    pay_rows = []
    pay_rows.append([
        P('<b>PAYMENT\nSUMMARY</b>', size=9, bold=True, color=DARK),
        P(f'Base Fare ({booking.seat_count} seat{"s" if booking.seat_count > 1 else ""})', size=9, color=SUBTXT),
        P(f'{currency} {base_fare_display:,.2f}', size=9, color=DARK, align=2),
    ])
    if seat_fee_display > 0.005:
        pay_rows.append(['', P('Seat Fee', size=9, color=SUBTXT), P(f'{currency} {seat_fee_display:,.2f}', size=9, color=DARK, align=2)])
    if extra_bag_display > 0.005:
        pay_rows.append(['', P('Extra Luggage', size=9, color=SUBTXT), P(f'{currency} {extra_bag_display:,.2f}', size=9, color=DARK, align=2)])
    if meal_display > 0.005:
        pay_rows.append(['', P('In-Flight Meals', size=9, color=SUBTXT), P(f'{currency} {meal_display:,.2f}', size=9, color=DARK, align=2)])
    if tax_display > 0.005:
        pay_rows.append(['', P(f'Taxes & Service Charges ({tax_pct}%)', size=9, color=SUBTXT), P(f'{currency} {tax_display:,.2f}', size=9, color=DARK, align=2)])
    total_row_idx = len(pay_rows)
    pay_rows.append(['', P('<b>Total Amount Paid</b>', size=10, color=DARK), P(f'<b>{currency} {total:,.2f}</b>', size=10, color=DARK, align=2)])

    summary_tbl = Table(pay_rows, colWidths=[lw2, ilw2, ivw2])
    pay_style = [
        ('BOX',           (0, 0), (-1, -1), 0.6, MID),
        ('BACKGROUND',    (0, 0), (-1, -1), LIGHT),
        # Left label column divider
        ('LINEAFTER',     (0, 0), (0, -1), 0.5, MID),
        # Left label cell: span all rows, vertically centred
        ('SPAN',          (0, 0), (0, total_row_idx)),
        ('VALIGN',        (0, 0), (0, -1), 'MIDDLE'),
        ('ALIGN',         (0, 0), (0, -1), 'LEFT'),
        # Padding
        ('TOPPADDING',    (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (0, -1), 14),
        ('LEFTPADDING',   (1, 0), (1, -1), 16),
        ('RIGHTPADDING',  (2, 0), (2, -1), 14),
        # Thin separator between item rows
        ('LINEBELOW',     (1, 0), (2, total_row_idx - 1), 0.3, MID),
        # Bold separator above Total row
        ('LINEABOVE',     (1, total_row_idx), (2, total_row_idx), 1.0, DARK),
        ('VALIGN',        (1, 0), (-1, -1), 'MIDDLE'),
    ]
    summary_tbl.setStyle(TableStyle(pay_style))
    story.append(summary_tbl)
    story.append(sp(3))

    # 5. Page Break — T&C page
    story.append(PageBreak())

    # 6. Terms & Conditions — IMPORTANT banner is the page header
    story.append(P('IMPORTANT TRAVEL INFORMATION & GUIDELINES', size=11, bold=True, color=DARK))
    story.append(sp(1))
    story.append(HRFlowable(width='100%', thickness=2, color=DARK, spaceBefore=0, spaceAfter=0))
    story.append(sp(3))
    story.append(P('Prohibited Items & Baggage Rules', size=11, bold=True, color=DARK))
    story.append(sp(2))

    not_allowed = [
        "Lighters", "Flammable Liquids", "Toxic", "Corrosives", "Pepper Spray",
        "Flammable Gas", "E-Cigarettes", "Infectious Substances", "Radioactive Materials", "Explosives"
    ]
    hand_only = ["Lithium Batteries", "Power Banks"]

    red_tint = colors.HexColor('#fee2e2')
    gold_tint = colors.HexColor('#fef3c7')

    na_section_w = cw_total * 0.65 - 16
    ho_section_w = cw_total * 0.35 - 16

    na_tbl = _flow_chips(not_allowed, red_tint, _icon_prohibited, na_section_w, 4, P)
    ho_tbl = _flow_chips(hand_only, gold_tint, _icon_allowed, ho_section_w, 2, P)

    proh_tbl = Table([
        [P('<b>NOT ALLOWED IN AIRCRAFT</b>', size=8, color=WHITE), P('<b>ONLY IN HAND BAGGAGE</b>', size=8, color=WHITE)],
        [na_tbl, ho_tbl],
    ], colWidths=[cw_total * 0.65, cw_total * 0.35])
    proh_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), RED),
        ('BACKGROUND', (1,0), (1,0), DARK),
        ('BACKGROUND', (0,1), (-1,1), OFF_W),
        ('BOX', (0,0), (-1,-1), 0.5, MID),
        ('GRID', (0,0), (-1,-1), 0.5, MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(proh_tbl)
    story.append(sp(5))

    # Cancellation & Date-Change charges
    story.append(P('CHANGE IN PLANS?', size=11, bold=True, color=DARK))
    story.append(sp(1))
    story.append(HRFlowable(width='100%', thickness=1, color=MID, spaceBefore=0, spaceAfter=0))
    story.append(sp(3))

    for fi in sectors:
        first_leg = fi.flight.legs.order_by('leg_order').first()
        last_leg = fi.flight.legs.order_by('leg_order').last()
        o_city = (first_leg.departure_airport.city or first_leg.departure_airport.iata_code) if first_leg else '—'
        d_city = (last_leg.arrival_airport.city or last_leg.arrival_airport.iata_code) if last_leg else '—'

        story.append(P(f'{o_city} → {d_city}', size=10, bold=True, color=DARK))
        story.append(sp(2))

        fee_tbl = Table([
            [P('<b>Cancellation Charges</b>', size=9, color=DARK), '', P('<b>Date Change Charges</b>', size=9, color=DARK), ''],
            [P('Time Before Departure', size=8, color=SUBTXT), P('Fee (per pax)', size=8, color=SUBTXT),
             P('Time Before Departure', size=8, color=SUBTXT), P('Fee (per pax)', size=8, color=SUBTXT)],
            [P('< 24 hours / No-show', size=8, color=DARK), P('Non-Refundable', size=8, color=RED),
             P('< 24 hours / No-show', size=8, color=DARK), P('Non-Changeable', size=8, color=RED)],
        ], colWidths=[cw_total*0.3, cw_total*0.2, cw_total*0.3, cw_total*0.2])

        fee_tbl.setStyle(TableStyle([
            ('SPAN', (0,0), (1,0)),
            ('SPAN', (2,0), (3,0)),
            ('BACKGROUND', (0,0), (-1,0), LIGHT),
            ('GRID', (0,0), (-1,-1), 0.5, MID),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(fee_tbl)
        story.append(sp(2))
        story.append(P('For cancellations or date changes made more than 24 hours before departure, contact Passenger Support for applicable options.', size=8, color=SUBTXT))
        story.append(sp(4))

    # Standard Policy Sections
    story.append(P('1. Check-In & Boarding', size=11, bold=True, color=DARK))
    story.append(sp(1))
    story.append(P(
        "• Passengers are requested to report at the airport at least 2 hours prior to the scheduled departure.<br/>"
        "• Check-in counters close 45 minutes before departure for domestic flights and 60 minutes for international flights.<br/>"
        "• Boarding gates close 20 minutes prior to departure. Passengers arriving late will not be permitted to board and will be considered 'No-Show'.",
        size=9, color=SUBTXT, leading=14
    ))
    story.append(sp(4))

    story.append(P('2. Baggage Policy', size=11, bold=True, color=DARK))
    story.append(sp(1))
    story.append(P(
        "• Cabin Baggage: One piece of hand baggage up to the allowed weight (typically 7 kg) is permitted per passenger.<br/>"
        "• Checked Baggage: Free allowance is stated on your ticket. Excess baggage will be charged at applicable airport rates.<br/>"
        "• Hazardous items including power banks, e-cigarettes, and flammable liquids are strictly prohibited in checked baggage.",
        size=9, color=SUBTXT, leading=14
    ))
    story.append(sp(4))

    story.append(P('3. Cancellations & Refunds', size=11, bold=True, color=DARK))
    story.append(sp(1))
    story.append(P(
        "• Tickets cancelled more than 24 hours prior to departure are eligible for a partial refund subject to cancellation fees.<br/>"
        "• Cancellations made within 24 hours of departure or 'No-Show' scenarios are generally non-refundable, except for applicable taxes.<br/>"
        "• Refunds, if applicable, will be processed to the original mode of payment within 7-10 business days.",
        size=9, color=SUBTXT, leading=14
    ))
    story.append(sp(4))

    story.append(P('4. Flight Changes & Delays', size=11, bold=True, color=DARK))
    story.append(sp(1))
    story.append(P(
        "• The airline reserves the right to change flight schedules without prior notice due to weather, operational, or safety reasons.<br/>"
        "• In the event of a significant delay or cancellation by the airline, passengers will be offered an alternative flight or a full refund.<br/>"
        "• Date or route modifications requested by the passenger will incur change fees plus any fare difference.",
        size=9, color=SUBTXT, leading=14
    ))
    story.append(sp(4))

    story.append(P('5. Identification Requirements', size=11, bold=True, color=DARK))
    story.append(sp(1))
    story.append(P(
        "• A valid government-issued photo ID (Passport, Driving License, National ID) is mandatory for airport entry and check-in.<br/>"
        "• For international travel, passengers are responsible for holding valid passports and necessary visas. The airline is not liable for entry denial.",
        size=9, color=SUBTXT, leading=14
    ))
    story.append(sp(6))

    # Refund / Support Contact block
    support_tbl = Table([[
        P('<b>Need help with cancellations or refunds?</b><br/>Our agents will initiate the process and this might take up to 30 days.', size=9, color=DARK, leading=12),
        P('Contact Passenger Support:<br/><b>+91 98765 43210 / support@passenger.com</b>', size=9, color=DARK, leading=12, align=2)
    ]], colWidths=[cw_total/2, cw_total/2])
    support_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, MID),
        ('PADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(support_tbl)

    # Build PDF
    doc.build(story, onFirstPage=_draw_chrome, onLaterPages=_draw_chrome)
    return buf.getvalue()