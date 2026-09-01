from decimal import Decimal
from django.db import models
from django.core.exceptions import ValidationError


class DynamicPricingConfig(models.Model):
    name = models.CharField(max_length=100, default="Global Dynamic Pricing Settings")
    is_active = models.BooleanField(default=True)

    # Weekend Settings
    weekend_surge_enabled = models.BooleanField(default=True)
    weekend_days = models.CharField(
        max_length=15, default="6,7", help_text="Comma-separated ISO weekdays (6=Saturday, 7=Sunday)"
    )
    weekend_multiplier = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("1.15"), help_text="e.g. 1.15 = +15% surge"
    )

    # Demand Velocity Surge Settings
    demand_surge_enabled = models.BooleanField(default=True)
    rolling_window_days = models.PositiveIntegerField(
        default=7, help_text="Lookback window in days for booking count"
    )
    initial_booking_threshold = models.PositiveIntegerField(
        default=50, help_text="Number of recent bookings to trigger initial surge"
    )
    initial_surge_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("10.00"), help_text="Initial surge % at threshold"
    )
    booking_step_size = models.PositiveIntegerField(
        default=10, help_text="Additional bookings per incremental step"
    )
    step_surge_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("2.00"), help_text="Additional surge % per step"
    )
    max_demand_surge_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("50.00"), help_text="Maximum allowed demand surge cap %"
    )

    # Proximity + Occupancy Settings
    proximity_pricing_enabled = models.BooleanField(
        default=True, help_text="Enable proximity-occupancy pricing within the departure window"
    )
    proximity_window_days = models.PositiveIntegerField(
        default=3, help_text="Days before departure to activate the proximity multiplier"
    )
    occupancy_threshold_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("60.00"),
        help_text="Seat occupancy % threshold: above = premium surge, below = discount"
    )
    max_proximity_premium_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("30.00"),
        help_text="Max price increase % at departure day when occupancy is high"
    )
    max_proximity_discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("20.00"),
        help_text="Max price decrease % at departure day when occupancy is low"
    )

    # Global Floor / Ceiling Clamps
    price_floor_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("80.00"),
        help_text="Minimum combined price as % of base price (e.g. 80 = never below 80% of base)"
    )
    price_ceiling_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("150.00"),
        help_text="Maximum combined price as % of base price (e.g. 150 = never above 150% of base)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'flights'
        db_table = "flights_dynamicpricingconfig"
        ordering = ["-updated_at"]

    def clean(self):
        errors = {}

        def to_dec(val):
            if val is None or val == "":
                return None
            try:
                return Decimal(str(val))
            except Exception:
                return None

        weekend_mult = to_dec(self.weekend_multiplier)
        initial_surge = to_dec(self.initial_surge_percent)
        step_surge = to_dec(self.step_surge_percent)
        max_demand_surge = to_dec(self.max_demand_surge_percent)
        occupancy_thresh = to_dec(self.occupancy_threshold_percent)
        max_prox_prem = to_dec(self.max_proximity_premium_percent)
        max_prox_disc = to_dec(self.max_proximity_discount_percent)
        price_floor = to_dec(self.price_floor_percent)
        price_ceiling = to_dec(self.price_ceiling_percent)

        if weekend_mult is not None and weekend_mult < Decimal("1.00"):
            errors["weekend_multiplier"] = "Weekend multiplier cannot be less than 1.00."
        if initial_surge is not None and initial_surge < Decimal("0.00"):
            errors["initial_surge_percent"] = "Initial surge percentage cannot be negative."
        if step_surge is not None and step_surge < Decimal("0.00"):
            errors["step_surge_percent"] = "Step surge percentage cannot be negative."
        if max_demand_surge is not None and max_demand_surge < Decimal("0.00"):
            errors["max_demand_surge_percent"] = "Max demand surge percentage cannot be negative."
        # Proximity + occupancy validations
        if occupancy_thresh is not None and not (Decimal("0") <= occupancy_thresh <= Decimal("100")):
            errors["occupancy_threshold_percent"] = "Occupancy threshold must be between 0 and 100."
        if max_prox_prem is not None and max_prox_prem < Decimal("0"):
            errors["max_proximity_premium_percent"] = "Max proximity premium percent cannot be negative."
        if max_prox_disc is not None and max_prox_disc < Decimal("0"):
            errors["max_proximity_discount_percent"] = "Max proximity discount percent cannot be negative."
        if price_floor is not None and price_floor <= Decimal("0"):
            errors["price_floor_percent"] = "Price floor percent must be greater than 0."
        if (
            price_floor is not None
            and price_ceiling is not None
            and price_ceiling <= price_floor
        ):
            errors["price_ceiling_percent"] = "Price ceiling must be greater than the price floor."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Inactive'})"


class HolidayEvent(models.Model):
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    surge_multiplier = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("1.20"), help_text="e.g. 1.20 = +20% surge"
    )
    is_global = models.BooleanField(
        default=False, help_text="If true, applies to all flights globally regardless of region"
    )
    applicable_countries = models.JSONField(
        default=list, blank=True, help_text="List of country names, e.g. ['India', 'United States']"
    )
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'flights'
        db_table = "flights_holidayevent"
        ordering = ["start_date", "name"]

    def clean(self):
        errors = {}
        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "End date cannot be before start date."
        if self.surge_multiplier is not None and self.surge_multiplier < Decimal("1.00"):
            errors["surge_multiplier"] = "Surge multiplier cannot be less than 1.00."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.start_date} to {self.end_date}) - {self.surge_multiplier}x"


class DynamicPriceLog(models.Model):
    fare = models.ForeignKey("flights.Fare", on_delete=models.CASCADE, related_name="dynamic_price_logs", null=True, blank=True)
    flight_instance = models.ForeignKey("flights.FlightInstance", on_delete=models.CASCADE, related_name="dynamic_price_logs")
    cabin_class = models.CharField(max_length=10)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    weekend_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    holiday_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    holiday_applied = models.CharField(max_length=100, blank=True, default="")
    demand_surge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    recent_booking_count = models.PositiveIntegerField(default=0)
    # Proximity + Occupancy audit fields
    occupancy_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"),
        help_text="Cabin seat occupancy % at time of calculation")
    days_until_departure = models.PositiveIntegerField(default=0,
        help_text="Days from calculation time to departure")
    proximity_multiplier = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("1.0000"),
        help_text="Proximity-occupancy multiplier applied (1.0000 = no effect)")
    final_calculated_price = models.DecimalField(max_digits=10, decimal_places=2)
    calculated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'flights'
        db_table = "flights_dynamicpricelog"
        ordering = ["-calculated_at"]

    def __str__(self):
        return f"Dynamic Price log for {self.flight_instance} [{self.cabin_class}]: {self.final_calculated_price}"