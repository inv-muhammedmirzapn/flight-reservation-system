# Generated manually for PassengerMeal model

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0006_legacy_flight_to_flightinstance'),
        ('flights', '0010_flightmeal_price'),
    ]

    operations = [
        migrations.CreateModel(
            name='PassengerMeal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField(default=1)),
                ('unit_price', models.DecimalField(decimal_places=2, help_text='Price snapshot at booking time', max_digits=10)),
                ('flight_leg', models.ForeignKey(blank=True, help_text='Specific leg for multi-leg flights', null=True, on_delete=django.db.models.deletion.PROTECT, to='flights.flightleg')),
                ('flight_meal', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='flights.flightmeal')),
                ('food_item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='flights.fooditem')),
                ('passenger', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='selected_meals', to='bookings.passenger')),
            ],
        ),
    ]
