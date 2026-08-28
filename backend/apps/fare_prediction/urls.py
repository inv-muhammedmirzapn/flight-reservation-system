from django.urls import path
from .views import FarePredictionView

urlpatterns = [
    path('<int:flight_instance_id>/', FarePredictionView.as_view(), name='fare-prediction'),
]
