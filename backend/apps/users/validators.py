from django.core.exceptions import ValidationError
import re

class StrongPasswordValidator:
    """Custom validator matching the frontend password rules."""

    def validate(self, password, user=None):
        errors = []
        if len(password) < 8:
            errors.append("Password must be at least 8 characters long.")
        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter.")
        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter.")
        if not re.search(r'[0-9]', password):
            errors.append("Password must contain at least one number.")
        if not re.search(r'[!@#$%^&*()\,.\?":{}|<>]', password):
            errors.append("Password must contain at least one special character (!@#$%^&*).")
        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return (
            "Password must be at least 8 characters long and include "
            "uppercase, lowercase, a number, and a special character."
        )