from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('flights', '0026_alter_dynamicpricingconfig_price_ceiling_percent_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='flightmeal',
            options={'ordering': ['airline', 'cabin_class', 'name']},
        ),
        migrations.RemoveField(
            model_name='flightmeal',
            name='flight_instance',
        ),
        migrations.AddField(
            model_name='flightmeal',
            name='airline',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='meals',
                to='flights.airline'
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='flightmeal',
            name='cabin_class',
            field=models.CharField(
                choices=[('ECONOMY', 'Economy'), ('BUSINESS', 'Business'), ('FIRST', 'First Class')],
                default='ECONOMY',
                max_length=10
            ),
        ),
    ]
