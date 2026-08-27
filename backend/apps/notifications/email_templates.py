import base64
import os

_LOGO_URL = (
    "https://raw.githubusercontent.com/inv-muhammedmirzapn/flight-reservation-system"
    "/develop/frontend/public/mainlogo.png"
)

# Build an inline base64 data URI so the logo renders in all email clients
# regardless of image-blocking policies.
def _build_logo_src() -> str:
    try:
        from django.conf import settings
        # BASE_DIR is the backend/ directory; logo lives in ../frontend/public/
        logo_path = os.path.normpath(
            os.path.join(str(settings.BASE_DIR), "..", "frontend", "public", "updated logo.png")
        )
        if os.path.isfile(logo_path):
            with open(logo_path, "rb") as f:
                encoded = base64.b64encode(f.read()).decode("ascii")
            return f"data:image/png;base64,{encoded}"
    except Exception:
        pass
    # Fallback to hosted URL if logo file not accessible
    return _LOGO_URL

_LOGO_SRC = _build_logo_src()


# ─── Shell ────────────────────────────────────────────────────────────────────

def _wrap(inner_html: str, preview_text: str = "") -> str:
    preview_span = (
        f'<span style="display:none;max-height:0;overflow:hidden;">{preview_text}</span>'
        if preview_text else ""
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1c1d;">
{preview_span}

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:40px 16px;">
  <tr>
    <td align="center">
      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border-radius:4px;overflow:hidden;">

        <!-- Letterhead -->
        <tr>
          <td style="background:#1a1c1d;padding:28px 32px 24px;border-bottom:3px solid #c9aa2e;text-align:center;">
            <img src="{_LOGO_SRC}" alt="Passenger"
                 width="200"
                 style="display:inline-block;max-width:200px;width:100%;height:auto;" />
            <div style="font-size:10px;color:#888888;letter-spacing:1.5px;text-transform:uppercase;margin-top:10px;">Flight Reservation</div>
          </td>
        </tr>

        <!-- Content -->
        {inner_html}

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #e8e8e8;">
            <p style="margin:0;font-size:11px;color:#a0a0a0;line-height:1.6;">
              This is an automated message from Passenger Flight Reservation.<br>
              Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
      <!-- End Card -->
    </td>
  </tr>
</table>

</body>
</html>"""


# ─── Inner building blocks ─────────────────────────────────────────────────────

def _heading(title: str, subtitle: str = "") -> str:
    sub = f'<p style="margin:6px 0 0;font-size:13px;color:#666666;">{subtitle}</p>' if subtitle else ""
    return f"""
    <tr>
      <td style="padding:32px 32px 0;">
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#1a1c1d;letter-spacing:-0.4px;">{title}</h1>
        {sub}
      </td>
    </tr>"""


def _divider() -> str:
    return """
    <tr>
      <td style="padding:20px 32px 0;">
        <div style="height:1px;background:#e8e8e8;"></div>
      </td>
    </tr>"""


def _body_text(html: str) -> str:
    return f"""
    <tr>
      <td style="padding:20px 32px 0;">
        <p style="margin:0;font-size:14px;color:#444444;line-height:1.7;">{html}</p>
      </td>
    </tr>"""


def _flight_info_table(flight_number: str, origin: str, destination: str,
                        extra_rows: str = "") -> str:
    return f"""
    <tr>
      <td style="padding:20px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e8e8e8;border-radius:4px;overflow:hidden;font-size:13px;">
          <!-- Label row -->
          <tr>
            <td colspan="3"
                style="background:#1a1c1d;padding:8px 16px;
                       font-size:10px;font-weight:600;color:#c9aa2e;
                       letter-spacing:1.5px;text-transform:uppercase;">
              Flight Details
            </td>
          </tr>
          <!-- Flight number -->
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;width:40%;">Flight</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{flight_number}</td>
          </tr>
          <!-- Route -->
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Route</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{origin} &rarr; {destination}</td>
          </tr>
          {extra_rows}
        </table>
      </td>
    </tr>"""


def _otp_box(otp_code: str) -> str:
    return """
    <tr>
      <td style="padding:24px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e8e8e8;border-radius:4px;overflow:hidden;">
          <tr>
            <td style="background:#1a1c1d;padding:8px 16px;
                       font-size:10px;font-weight:600;color:#c9aa2e;
                       letter-spacing:1.5px;text-transform:uppercase;">
              Verification Code
            </td>
          </tr>
          <tr>
            <td style="padding:28px;text-align:center;">
              <span style="font-size:38px;font-weight:700;color:#1a1c1d;
                           letter-spacing:14px;font-variant-numeric:tabular-nums;">""" + otp_code + """</span>
              <p style="margin:14px 0 0;font-size:12px;color:#888888;">
                This code expires in <strong>5 minutes</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>"""


def _spacer(px: int = 32) -> str:
    return f"""
    <tr>
      <td style="padding:{px}px 0 0;"></td>
    </tr>"""


# ─── Public template functions ─────────────────────────────────────────────────

def booking_confirmation(user_name: str, passenger_name: str,
                         flight_number: str, origin: str, destination: str,
                         seat_count: int, total_price: float,
                         cabin_class: str = "N/A",
                         seat_numbers: str = "Unassigned",
                         baggage_info: str = "N/A") -> tuple[str, str]:
    subject = f"Booking Confirmed — Flight {flight_number}"
    extra = f"""
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Passenger(s)</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{passenger_name}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Cabin Class</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{cabin_class}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Seat(s)</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{seat_numbers}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Baggage Allowance</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;line-height:1.4;"
                colspan="2">{baggage_info}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Seats Count</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{seat_count}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#888888;">Total Amount</td>
            <td style="padding:12px 16px;font-weight:700;color:#1a1c1d;font-size:15px;"
                colspan="2">&#8377;{total_price:,.2f}</td>
          </tr>"""
    html = _wrap(
        _heading("Booking Confirmed",
                 "Your reservation has been successfully processed.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   "Thank you for booking with Passenger. Your flight reservation is confirmed. "
                   "Please find the summary of your booking below.") +
        _flight_info_table(flight_number, origin, destination, extra) +
        f"""
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9; border-left:4px solid #c9aa2e; border-radius:4px;">
              <tr>
                <td style="padding:16px;">
                  <strong style="color:#1a1c1d; font-size:14px;">&#128196; Your E-Ticket is Attached</strong><br>
                  <p style="margin:6px 0 0; font-size:13px; color:#666; line-height:1.5;">
                    Please find your official e-ticket attached to this email as a PDF document. You must present this document (printed or on your mobile device) along with a valid Government-issued photo ID at the airport.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        """ +
        _body_text("We recommend arriving at least 2 hours before your scheduled departure time to ensure a smooth check-in process.") +
        _spacer(),
        preview_text=f"Your booking for flight {flight_number} is confirmed."
    )
    return subject, html


def booking_cancellation(user_name: str, flight_number: str,
                          origin: str, destination: str,
                          passenger_name: str = "",
                          seat_count: int = 0,
                          total_price: float = 0.0,
                          cabin_class: str = "N/A",
                          seat_numbers: str = "Unassigned",
                          baggage_info: str = "N/A") -> tuple[str, str]:
    subject = f"Booking Cancellation — Flight {flight_number}"
    
    extra = f"""
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Passenger(s)</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{passenger_name}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Cabin Class</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{cabin_class}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Seat(s)</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{seat_numbers}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Baggage Allowance</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;line-height:1.4;"
                colspan="2">{baggage_info}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Refund Amount</td>
            <td style="padding:12px 16px;font-weight:700;color:#1a1c1d;font-size:15px;"
                colspan="2">&#8377;{total_price:,.2f}</td>
          </tr>"""

    html = _wrap(
        _heading("Booking Cancelled",
                 "Your reservation has been cancelled as requested.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   "Your booking has been successfully cancelled. "
                   "If you did not request this cancellation, please contact our support team immediately.") +
        _flight_info_table(flight_number, origin, destination, extra) +
        _body_text("Refunds, if applicable, will be processed within 5 to 7 business days "
                   "to your original payment method.") +
        _spacer(),
        preview_text=f"Your booking for flight {flight_number} has been cancelled."
    )
    return subject, html


def admin_booking_cancellation(user_name: str, flight_number: str,
                               origin: str, destination: str,
                               passenger_name: str = "",
                               seat_count: int = 0,
                               total_price: float = 0.0,
                               cabin_class: str = "N/A",
                               seat_numbers: str = "Unassigned",
                               baggage_info: str = "N/A") -> tuple[str, str]:
    subject = f"Booking Cancellation by Admin — Flight {flight_number}"
    
    extra = f"""
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Passenger(s)</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{passenger_name}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Cabin Class</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{cabin_class}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Seat(s)</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{seat_numbers}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Baggage Allowance</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;line-height:1.4;"
                colspan="2">{baggage_info}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Refund Amount</td>
            <td style="padding:12px 16px;font-weight:700;color:#1a1c1d;font-size:15px;"
                colspan="2">&#8377;{total_price:,.2f}</td>
          </tr>"""

    html = _wrap(
        _heading("Booking Cancelled by Administrator",
                 "Your reservation has been cancelled by our administration team.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   "We regret to inform you that your booking has been cancelled by our administration side. "
                   "We sincerely apologise for any inconvenience this may have caused.") +
        _flight_info_table(flight_number, origin, destination, extra) +
        _body_text("A full refund of the amount paid for this booking has been initiated. "
                   "The full amount will be processed within 5 to 7 business days to your original payment method.") +
        _spacer(),
        preview_text=f"Your booking for flight {flight_number} has been cancelled by our administration."
    )
    return subject, html


def waitlist_confirmed(user_name: str, flight_number: str,
                       origin: str, destination: str,
                       seat_count: int) -> tuple[str, str]:
    subject = f"Waitlist Confirmed — Flight {flight_number}"
    extra = f"""
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Seats Allocated</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;"
                colspan="2">{seat_count}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#888888;">Status</td>
            <td style="padding:12px 16px;font-weight:700;color:#1a1c1d;" colspan="2">Confirmed</td>
          </tr>"""
    html = _wrap(
        _heading("Seat Allocated from Waitlist",
                 "A seat became available and your waitlist entry has been upgraded.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   "We are pleased to inform you that a seat has become available on your waitlisted flight. "
                   "Your reservation has been automatically confirmed.") +
        _flight_info_table(flight_number, origin, destination, extra) +
        _body_text("Please carry a valid photo ID at the airport.") +
        _spacer(),
        preview_text=f"Your waitlist for flight {flight_number} is now confirmed."
    )
    return subject, html


def flight_delayed(user_name: str, flight_number: str,
                   origin: str, destination: str,
                   new_departure_time: str) -> tuple[str, str]:
    subject = f"Flight Delay Notice — {flight_number}"
    extra = f"""
          <tr>
            <td style="padding:12px 16px;color:#888888;">Revised Departure</td>
            <td style="padding:12px 16px;font-weight:700;color:#1a1c1d;" colspan="2">{new_departure_time}</td>
          </tr>"""
    html = _wrap(
        _heading("Flight Delay Notice",
                 "An important update regarding your upcoming flight.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   "We regret to inform you that your flight has been delayed. "
                   "We apologise for any inconvenience this may cause.") +
        _flight_info_table(flight_number, origin, destination, extra) +
        _body_text("Please monitor official communications for further updates. "
                   "We recommend checking in at the airport no earlier than 2 hours before the revised departure time.") +
        _spacer(),
        preview_text=f"Your flight {flight_number} has been delayed. New departure: {new_departure_time}."
    )
    return subject, html


def flight_gate_terminal_updated(user_name: str, flight_number: str,
                                 origin: str, destination: str,
                                 boarding_gate: str, departure_terminal: str, arrival_terminal: str) -> tuple[str, str]:
    subject = f"Gate/Terminal Update — Flight {flight_number}"
    
    gate_display = boarding_gate if boarding_gate else "Not assigned"
    dep_term_display = departure_terminal if departure_terminal else "Not assigned"
    arr_term_display = arrival_terminal if arrival_terminal else "Not assigned"
    
    extra = f"""
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Departure Terminal</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;" colspan="2">{dep_term_display}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#888888;">Boarding Gate</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1a1c1d;" colspan="2">{gate_display}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#888888;">Arrival Terminal</td>
            <td style="padding:12px 16px;font-weight:600;color:#1a1c1d;" colspan="2">{arr_term_display}</td>
          </tr>"""
          
    html = _wrap(
        _heading("Gate / Terminal Update",
                 "Important updates to your boarding and arrival details.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   "There has been an update to the boarding gate or terminal for your upcoming flight. "
                   "Please review the new details below.") +
        _flight_info_table(flight_number, origin, destination, extra) +
        _body_text("We recommend checking the airport information screens upon arrival for any further last-minute changes.") +
        _spacer(),
        preview_text=f"Your gate/terminal information for flight {flight_number} has been updated."
    )
    return subject, html


def flight_cancelled(user_name: str, flight_number: str,
                     origin: str, destination: str) -> tuple[str, str]:
    subject = f"Flight Cancelled — {flight_number}"
    html = _wrap(
        _heading("Flight Cancellation Notice",
                 "Your flight has been cancelled by the airline.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   "We regret to inform you that your upcoming flight has been cancelled. "
                   "We sincerely apologise for the disruption to your travel plans.") +
        _flight_info_table(flight_number, origin, destination) +
        _body_text("Please contact our support team at your earliest convenience "
                   "for rebooking assistance or to arrange a full refund.") +
        _spacer(),
        preview_text=f"Flight {flight_number} has been cancelled."
    )
    return subject, html


def flight_boarding(user_name: str, flight_number: str,
                    origin: str, destination: str) -> tuple[str, str]:
    subject = f"Boarding Now — Flight {flight_number}"
    html = _wrap(
        _heading("Boarding in Progress",
                 "Your flight is now boarding. Please proceed to the gate.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   "This is a reminder that your flight is currently boarding. "
                   "Please make your way to the departure gate immediately with your boarding pass and photo ID.") +
        _flight_info_table(flight_number, origin, destination) +
        _spacer(),
        preview_text=f"Flight {flight_number} is now boarding."
    )
    return subject, html


def flight_departed(user_name: str, flight_number: str,
                    origin: str, destination: str) -> tuple[str, str]:
    subject = f"Flight {flight_number} Has Departed"
    html = _wrap(
        _heading("Flight Departed",
                 "Your flight has taken off.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   f"Flight <strong>{flight_number}</strong> has departed from <strong>{origin}</strong>. "
                   "Thank you for choosing Passenger. We hope you have a comfortable journey.") +
        _flight_info_table(flight_number, origin, destination) +
        _spacer(),
        preview_text=f"Flight {flight_number} has departed from {origin}."
    )
    return subject, html


def flight_arrived(user_name: str, flight_number: str,
                   origin: str, destination: str) -> tuple[str, str]:
    subject = f"Flight {flight_number} Has Arrived"
    html = _wrap(
        _heading("Flight Arrived",
                 "Your flight has landed successfully.") +
        _divider() +
        _body_text(f"Dear <strong>{user_name}</strong>,<br><br>"
                   f"Flight <strong>{flight_number}</strong> has arrived at <strong>{destination}</strong>. "
                   "We hope you had a pleasant journey and look forward to serving you again.") +
        _flight_info_table(flight_number, origin, destination) +
        _spacer(),
        preview_text=f"Flight {flight_number} has arrived at {destination}."
    )
    return subject, html


def password_reset_otp(otp_code: str) -> tuple[str, str]:
    subject = "Password Reset — Verification Code"
    html = _wrap(
        _heading("Password Reset Request",
                 "A one-time password has been generated for your account.") +
        _divider() +
        _body_text("We received a request to reset the password for your Passenger account. "
                   "Use the verification code below to proceed.") +
        _otp_box(otp_code) +
        _body_text("If you did not request a password reset, please disregard this email. "
                   "Your account remains secure and no changes have been made.") +
        _spacer(),
        preview_text="Your Passenger password reset code is ready."
    )
    return subject, html


def email_change_otp(otp_code: str, new_email: str) -> tuple[str, str]:
    subject = "Email Change — Verification Code"
    html = _wrap(
        _heading("Email Address Change",
                 "A verification code has been sent to confirm your new email address.") +
        _divider() +
        _body_text(f"We received a request to change your Passenger account email to "
                   f"<strong>{new_email}</strong>. "
                   "Use the verification code below to confirm this change.") +
        _otp_box(otp_code) +
        _body_text("If you did not request this change, please ignore this email. "
                   "Your current email address will remain unchanged.") +
        _spacer(),
        preview_text="Your Passenger email change verification code is ready."
    )
    return subject, html


def welcome_email(first_name: str, last_name: str) -> tuple[str, str]:
    subject = "Welcome to Passenger Flight Reservation!"
    full_name = f"{first_name} {last_name}".strip() or "Customer"
    html = _wrap(
        _heading("Welcome to Passenger",
                 "Your account has been successfully created.") +
        _divider() +
        _body_text(f"Dear <strong>{full_name}</strong>,<br><br>"
                   "Welcome to Passenger! We are thrilled to have you on board. "
                   "With your new account, you can easily search for flights, book tickets, "
                   "and manage all your reservations in one place.") +
        _body_text("Get ready to explore the world with our seamless booking experience. "
                   "If you have any questions or need assistance, our support team is always here to help.") +
        _spacer(),
        preview_text="Welcome to Passenger! Your account is ready."
    )
    return subject, html

