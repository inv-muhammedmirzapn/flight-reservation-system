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
GOLD   = colors.HexColor('#d4a017')
LGOLD  = colors.HexColor('#f5c842')
WHITE  = colors.white
OFF_W  = colors.HexColor('#f9f9f7')
LIGHT  = colors.HexColor('#f3f4f6')
MID    = colors.HexColor('#e5e7eb')
SUBTXT = colors.HexColor('#6b7280')
GREEN  = colors.HexColor('#16a34a')
RED    = colors.HexColor('#dc2626')
WARN   = colors.HexColor('#fffbeb')
WARNB  = colors.HexColor('#92400e')

A4W, A4H = A4

HDR_H   = 56
HDR_BOT = A4H - HDR_H

LM = 18 * mm
RM = 18 * mm
TM = HDR_H + 12 * mm
BM = 18 * mm


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmt_time(dt):
    if not dt: return '—'
    if isinstance(dt, str):
        try: dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        except Exception: return str(dt)
    return dt.strftime('%H:%M')

def _fmt_date(dt):
    if not dt: return '—'
    if isinstance(dt, str):
        try: dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        except Exception: return str(dt)
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
    d = Drawing(80, 20)
    # Origin circle
    d.add(Circle(6, 10, 2, fillColor=WHITE, strokeColor=GOLD, strokeWidth=1))
    # Path to plane
    d.add(Line(12, 10, 32, 10, strokeColor=GOLD, strokeWidth=1, strokeDashArray=[2, 2]))
    
    # Plane (centered at x=40)
    # Fuselage
    d.add(Polygon([34,9, 44,9, 46,10, 44,11, 34,11], fillColor=GOLD, strokeColor=None))
    # Wings
    d.add(Polygon([38,11, 36,18, 38,18, 42,11], fillColor=GOLD, strokeColor=None))
    d.add(Polygon([38,9, 36,2, 38,2, 42,9], fillColor=GOLD, strokeColor=None))
    # Tail
    d.add(Polygon([34.5,11, 33.5,15, 34.5,15, 36.5,11], fillColor=GOLD, strokeColor=None))
    d.add(Polygon([34.5,9, 33.5,5, 34.5,5, 36.5,9], fillColor=GOLD, strokeColor=None))

    # Path to destination
    d.add(Line(48, 10, 68, 10, strokeColor=GOLD, strokeWidth=1, strokeDashArray=[2, 2]))
    # Destination circle
    d.add(Circle(74, 10, 2, fillColor=GOLD, strokeColor=None))
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
    total = float(booking.total_price)
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
    story.append(sp(2))
    story.append(P(f'Booked by: <b>{user_name}</b>  •  Cabin: <b>{cabin}</b>  •  {booking.seat_count} seat(s)', size=8, color=SUBTXT))
    story.append(sp(5))

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

        # Barcode Placeholder
        # TODO: barcode generation not implemented yet — placeholder only
        if passengers:
            barcode_rows = []
            for p in passengers:
                barcode_rows.append([
                    P(f'{p.name}', size=9, bold=True, color=DARK),
                    P('<i>Boarding barcode — Currently unavailable</i>', size=8, color=SUBTXT, align=2)
                ])
            barcode_tbl = Table(barcode_rows, colWidths=[cw_total/2, cw_total/2])
            barcode_tbl.setStyle(TableStyle([
                ('BOX', (0,0), (-1,-1), 0.5, MID),
                ('GRID', (0,0), (-1,-1), 0.5, MID),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('LEFTPADDING', (0,0), (-1,-1), 8),
                ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ]))
            story.append(barcode_tbl)
            story.append(sp(4))

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
            [P(dep_t, size=30, bold=True, color=DARK), sp(6), P(origin, size=15, bold=True, color=DARK), P(origin_city, size=8, color=SUBTXT)],
            [_icon_plane_arrow(), sp(6), P(duration, size=8, color=GOLD, align=1), P(stop_label, size=7, color=GOLD, align=1)],
            [P(arr_t, size=30, bold=True, color=DARK, align=2), sp(6), P(dest, size=15, bold=True, color=DARK, align=2), P(dest_city, size=8, color=SUBTXT, align=2)],
        ]], colWidths=[col3, col3, col3])
        route_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), WHITE),
            ('BOX', (0, 0), (-1, -1), 0.5, MID),
            ('LINEABOVE', (0, 0), (-1, 0), 2, GOLD),
            ('ROUNDEDCORNERS', [4]),
            ('LINEBEFORE', (1, 0), (1, -1), 0.5, MID),
            ('LINEAFTER', (1, 0), (1, -1), 0.5, MID),
            ('TOPPADDING', (0, 0), (-1, -1), 22),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 22),
            ('LEFTPADDING', (0, 0), (0, 0), 20),
            ('RIGHTPADDING', (2, 0), (2, 0), 20),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ]))
        story.append(route_tbl)
        story.append(sp(3))

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
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fffbeb')),
                ('BOX', (0, 0), (-1, -1), 0.5, GOLD),
                ('LINEBELOW', (0, 0), (-1, -2), 0.3, MID),
                ('TOPPADDING', (0, 0), (-1, -1), 7),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
                ('LEFTPADDING', (0, 0), (0, -1), 10),
                ('LEFTPADDING', (1, 0), (1, -1), 8),
                ('RIGHTPADDING', (2, 0), (2, -1), 10),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(transit_tbl)
            story.append(sp(3))

        date_tbl = Table([[
            P(dep_d, size=8, color=DARK),
            P(arr_d, size=8, color=DARK, align=2),
        ]], colWidths=[cw_total / 2, cw_total / 2])
        date_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e5e7eb')),
            ('BOX', (0, 0), (-1, -1), 0.5, MID),
            ('ROUNDEDCORNERS', [4]),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (0, 0), 20),
            ('RIGHTPADDING', (1, 0), (1, 0), 20),
        ]))
        story.append(date_tbl)
        story.append(sp(6))

        # Info Grid
        info_items = [
            ('FLIGHT NO.', flight_no),
            ('AIRLINE', airline),
            ('AIRCRAFT', aircraft),
            ('CABIN', cabin),
            ('PASSENGERS', str(booking.seat_count)),
            ('TOTAL FARE', f'Rs. {total:,.0f}'),
        ]
        info_rows = []
        for i in range(0, len(info_items), 3):
            chunk = info_items[i:i+3]
            while len(chunk) < 3: chunk.append(('', ''))
            info_rows.append([[P(l, size=7, color=GOLD, bold=True), P(v, size=11, bold=True, color=DARK)] for l, v in chunk])

        info_tbl = Table(info_rows, colWidths=[col3, col3, col3])
        info_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('GRID', (0, 0), (-1, -1), 0.5, MID),
        ]))
        story.append(info_tbl)
        story.append(sp(2))

        # Fare type & baggage summary
        bag_summary_html = f"<font color='{GOLD.hexval()}'>■</font> <b>CABIN:</b> {cabin} &nbsp;&nbsp;&nbsp;&nbsp; "
        if passengers:
            checked = float(passengers[0].free_baggage_allowance_kg or 0)
            cabin_b = float(passengers[0].free_handbag_allowance_kg or 0)
            bag_summary_html += f"<font color='{GOLD.hexval()}'>■</font> <b>CHECK-IN:</b> {checked:g} kg (1 piece) &nbsp;&nbsp;&nbsp;&nbsp; "
            bag_summary_html += f"<font color='{GOLD.hexval()}'>■</font> <b>CABIN BAG:</b> {cabin_b:g} kg (1 piece)"
        story.append(P(bag_summary_html, size=8, color=DARK2, align=0))
        story.append(sp(6))

        # Passenger Details
        story.append(HRFlowable(width='100%', thickness=1, color=MID, dash=(5, 5), spaceBefore=2*mm, spaceAfter=3*mm))
        story.append(P('PASSENGER DETAILS', size=8, bold=True, color=GOLD))
        story.append(sp(2))

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

            col_ws = [7*mm, 38*mm, 16*mm, 10*mm, 16*mm, 35*mm, 37.2*mm]
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

        story.append(sp(8))

    # Payment summary block
    payment_tbl = Table([[P(f'You have paid <b>Rs. {total:,.0f}</b>', size=11, color=DARK)]], colWidths=[cw_total])
    payment_tbl.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, MID),
        ('BACKGROUND', (0,0), (-1,-1), LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('ROUNDEDCORNERS', [5]),
    ]))
    story.append(payment_tbl)

    # 5. Page Break for T&C
    story.append(PageBreak())

    # 6. Terms & Conditions
    story.append(P('TERMS & CONDITIONS', size=14, bold=True, color=DARK))
    story.append(sp(2))
    story.append(HRFlowable(width='100%', thickness=2, color=DARK, spaceBefore=0, spaceAfter=0))
    story.append(sp(5))

    # Prohibited Items Grid
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
        ('BACKGROUND', (1,0), (1,0), GOLD),
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