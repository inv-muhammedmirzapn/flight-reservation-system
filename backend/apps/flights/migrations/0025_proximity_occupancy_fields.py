"""
Migration: Add proximity-occupancy pricing fields to DynamicPricingConfig
         and audit fields to DynamicPriceLog.

Generated manually — equivalent to running:
  python manage.py makemigrations flights --name proximity_occupancy_fields
"""
import decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('flights', '0024_alter_dynamicpricingconfig_weekend_multiplier_and_more'),
    ]

    operations = [
        # ── DynamicPricingConfig: Proximity + Occupancy Settings ──────────────
        migrations.AddField(
            model_name='dynamicpricingconfig',
            name='proximity_pricing_enabled',
            field=models.BooleanField(
                default=True,
                help_text='Enable proximity-occupancy pricing within the departure window',
            ),
        ),
        migrations.AddField(
            model_name='dynamicpricingconfig',
            name='proximity_window_days',
            field=models.PositiveIntegerField(
                default=3,
                help_text='Days before departure to activate the proximity multiplier',
            ),
        ),
        migrations.AddField(
            model_name='dynamicpricingconfig',
            name='occupancy_threshold_percent',
            field=models.DecimalField(
                default=decimal.Decimal('60.00'),
                max_digits=5, decimal_places=2,
                help_text='Seat occupancy % threshold: above = premium surge, below = discount',
            ),
        ),
        migrations.AddField(
            model_name='dynamicpricingconfig',
            name='max_proximity_premium_percent',
            field=models.DecimalField(
                default=decimal.Decimal('30.00'),
                max_digits=5, decimal_places=2,
                help_text='Max price increase % at departure day when occupancy is high',
            ),
        ),
        migrations.AddField(
            model_name='dynamicpricingconfig',
            name='max_proximity_discount_percent',
            field=models.DecimalField(
                default=decimal.Decimal('20.00'),
                max_digits=5, decimal_places=2,
                help_text='Max price decrease % at departure day when occupancy is low',
            ),
        ),
        # ── DynamicPricingConfig: Floor / Ceiling Clamps ──────────────────────
        migrations.AddField(
            model_name='dynamicpricingconfig',
            name='price_floor_percent',
            field=models.DecimalField(
                default=decimal.Decimal('80.00'),
                max_digits=5, decimal_places=2,
                help_text='Minimum combined price as % of base price (e.g. 80 = never below 80%)',
            ),
        ),
        migrations.AddField(
            model_name='dynamicpricingconfig',
            name='price_ceiling_percent',
            field=models.DecimalField(
                default=decimal.Decimal('150.00'),
                max_digits=5, decimal_places=2,
                help_text='Maximum combined price as % of base price (e.g. 150 = never above 150%)',
            ),
        ),
        # ── DynamicPriceLog: Proximity + Occupancy Audit Fields ───────────────
        migrations.AddField(
            model_name='dynamicpricelog',
            name='occupancy_percent',
            field=models.DecimalField(
                default=decimal.Decimal('0.00'),
                max_digits=5, decimal_places=2,
                help_text='Cabin seat occupancy % at time of calculation',
            ),
        ),
        migrations.AddField(
            model_name='dynamicpricelog',
            name='days_until_departure',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Days from calculation time to departure',
            ),
        ),
        migrations.AddField(
            model_name='dynamicpricelog',
            name='proximity_multiplier',
            field=models.DecimalField(
                default=decimal.Decimal('1.0000'),
                max_digits=6, decimal_places=4,
                help_text='Proximity-occupancy multiplier applied (1.0000 = no effect)',
            ),
        ),
    ]
