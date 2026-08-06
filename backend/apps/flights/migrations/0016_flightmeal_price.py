# Generated manually for FlightMeal price field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('flights', '0015_alter_aircraft_aircraft_model_alter_aircraft_airline_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='flightmeal',
            name='price',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=8),
        ),
    ]
