import django
from django.conf import settings
import os

settings.configure(
    EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend',
)
django.setup()

from django.core.mail import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage

subject = "Test MIME"
plain_text = "Plain text"
html_with_cid = "<html><body><img src='cid:passenger_logo'></body></html>"
from_email = "test@example.com"
user_email = "user@example.com"

# Create root message
msg = EmailMessage(subject, '', from_email, [user_email])

# We need the root to be multipart/mixed if there are attachments, 
# but Django handles this automatically if we attach files.

# Create multipart/alternative
alt = MIMEMultipart('alternative')
alt.attach(MIMEText(plain_text, 'plain'))

# Create multipart/related for the HTML and inline image
rel = MIMEMultipart('related')
rel.attach(MIMEText(html_with_cid, 'html'))

img = MIMEImage(b"fakeimagebytes", _subtype='png')
img.add_header('Content-ID', '<passenger_logo>')
img.add_header('Content-Disposition', 'inline')
rel.attach(img)

alt.attach(rel)

# How to set alt as the main body of msg?
# Django's EmailMessage doesn't easily allow setting a MIMEMultipart as the main body,
# except if we just construct the email.message.Message ourselves.
# Actually, if we do msg.attach(alt), it will be inside multipart/mixed.
# Let's see what msg.message() produces if we set body to empty.

msg.attach(alt)
msg.attach('ticket.pdf', b'fake_pdf_bytes', 'application/pdf')

print(msg.message().as_string())
