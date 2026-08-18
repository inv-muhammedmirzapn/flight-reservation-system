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


# ── Chrome Drawer ─────────────────────────────────────────────────────────────

def _draw_chrome(canvas, doc):
    canvas.saveState()
    w, h = A4

    # Background
    canvas.setFillColor(OFF_W)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)

    # Header
    canvas.setFillColor(DARK)
    canvas.rect(0, HDR_BOT, w, HDR_H, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, HDR_BOT - 3, w, 3, fill=1, stroke=0)

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
            canvas.setFillColor(WHITE)
            canvas.setFont('Helvetica-Bold', 14)
            canvas.drawString(LM, HDR_BOT + HDR_H / 2 - 5, 'Passenger')
    else:
        canvas.setFillColor(GOLD)
        canvas.setFont('Helvetica-Bold', 16)
        canvas.drawString(LM, HDR_BOT + 18, 'Passenger')

    # Label
    canvas.setFillColor(GOLD)
    canvas.setFont('Helvetica-Bold', 10)
    canvas.drawRightString(w - RM, HDR_BOT + 28, 'ELECTRONIC TICKET')
    canvas.setFillColor(colors.HexColor('#9ca3af'))
    canvas.setFont('Helvetica', 7)
    canvas.drawRightString(w - RM, HDR_BOT + 15, 'Travel Itinerary & Receipt')

    # Footer
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, w, 28, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, 27, w, 2, fill=1, stroke=0)

    now_str = datetime.now().strftime('%d %b %Y, %H:%M')
    canvas.setFillColor(colors.HexColor('#9ca3af'))
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

    # Gather data
    fi         = booking.flight
    first_leg  = fi.flight.legs.order_by('leg_order').first()
    last_leg   = fi.flight.legs.order_by('leg_order').last()
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
    cabin       = booking.get_cabin_class_display() if booking.cabin_class else 'Economy'
    ref         = str(booking.id).replace('-', '').upper()[:8]
    user        = booking.user
    user_name   = user.get_full_name() or user.email
    bk_status   = booking.status
    total       = float(booking.total_price)
    passengers  = list(booking.passengers.all())
    num_stops   = fi.flight.legs.count() - 1
    stop_label  = 'Non-stop' if num_stops == 0 else f'{num_stops} stop{"s" if num_stops > 1 else ""}'

    def P(txt, size=10, color=DARK, bold=False, align=0, leading=None):
        return Paragraph(txt, ParagraphStyle(
            'x', fontName='Helvetica-Bold' if bold else 'Helvetica',
            fontSize=size, textColor=color, alignment=align,
            leading=leading or size * 1.35, spaceAfter=0,
        ))

    def sp(h=3):
        return Spacer(1, h * mm)

    # 1. Reference + Status
    status_bg = GREEN if bk_status == 'CONFIRMED' else (RED if bk_status == 'CANCELLED' else SUBTXT)
    cw_total = A4W - LM - RM
    ref_tbl = Table([[
        P(f'#{ref}', size=20, bold=True, color=DARK),
        P(bk_status, size=8, bold=True, color=WHITE, align=1),
    ]], colWidths=[cw_total - 40 * mm, 38 * mm])
    ref_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), LIGHT),
        ('BACKGROUND', (1, 0), (1, 0), status_bg),
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

    # 2. Route Card
    dep_t, arr_t = _fmt_time(dep_time), _fmt_time(arr_time)
    dep_d, arr_d = _fmt_date(dep_time), _fmt_date(arr_time)
    col3 = cw_total / 3

    route_tbl = Table([[
        [P(dep_t, size=30, bold=True, color=WHITE), P(origin, size=15, bold=True, color=WHITE), P(origin_city, size=8, color=colors.HexColor('#9ca3af'))],
        [P('✈', size=20, color=GOLD, align=1), P(duration, size=8, color=colors.HexColor('#d1d5db'), align=1), P(stop_label, size=7, color=colors.HexColor('#9ca3af'), align=1)],
        [P(arr_t, size=30, bold=True, color=WHITE, align=2), P(dest, size=15, bold=True, color=WHITE, align=2), P(dest_city, size=8, color=colors.HexColor('#9ca3af'), align=2)],
    ]], colWidths=[col3, col3, col3])
    route_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), DARK),
        ('TOPPADDING', (0, 0), (-1, -1), 16),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
        ('LEFTPADDING', (0, 0), (0, 0), 16),
        ('RIGHTPADDING', (2, 0), (2, 0), 16),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(route_tbl)
    story.append(HRFlowable(width='100%', thickness=3, color=GOLD, spaceBefore=0, spaceAfter=0))

    date_tbl = Table([[
        P(dep_d, size=8, color=SUBTXT),
        P(arr_d, size=8, color=SUBTXT, align=2),
    ]], colWidths=[cw_total / 2, cw_total / 2])
    date_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), DARK2),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (0, 0), 14),
        ('RIGHTPADDING', (1, 0), (1, 0), 14),
    ]))
    story.append(date_tbl)
    story.append(sp(5))

    # 3. Info Grid
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
    story.append(sp(5))

    # 4. Passenger Details
    story.append(HRFlowable(width='100%', thickness=1, color=MID, dash=(5, 5), spaceBefore=2*mm, spaceAfter=3*mm))
    story.append(P('PASSENGER DETAILS', size=8, bold=True, color=GOLD))
    story.append(sp(2))

    if passengers:
        gender_map = {'M': 'Male', 'F': 'Female', 'O': 'Other'}
        hdr = ['#', 'Name & Contact', 'Seat', 'Age', 'Gender', 'Meal Pref', 'Baggage (Check/Cabin)']
        rows = [hdr]
        for idx, p in enumerate(passengers, 1):
            checked = float(p.free_baggage_allowance_kg or 0) + float(p.extra_baggage_kg or 0)
            cabin_b = float(p.free_handbag_allowance_kg or 0)
            meal = getattr(p, 'meal_preference', 'None')
            if hasattr(p, 'meal') and p.meal:
                meal = p.meal.food_item.name
            
            contact = f"{p.name}\n{p.phone_number or ''}"

            rows.append([
                str(idx),
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
            ('BACKGROUND', (0, 0), (-1, 0), DARK),
            ('TEXTCOLOR', (0, 0), (-1, 0), GOLD),
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

    story.append(sp(6))

    # 5. Page Break for T&C
    story.append(PageBreak())

    # 6. Terms & Conditions
    story.append(P('TERMS & CONDITIONS', size=14, bold=True, color=DARK))
    story.append(sp(2))
    story.append(HRFlowable(width='100%', thickness=2, color=GOLD, spaceBefore=0, spaceAfter=0))
    story.append(sp(5))

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

    # Build PDF
    doc.build(story, onFirstPage=_draw_chrome, onLaterPages=_draw_chrome)
    return buf.getvalue()
