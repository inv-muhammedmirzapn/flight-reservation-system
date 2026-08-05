from django.urls import path
from .views import BulkImportView

urlpatterns = [
    path("import/", BulkImportView.as_view(), name="bulk-import"),
]