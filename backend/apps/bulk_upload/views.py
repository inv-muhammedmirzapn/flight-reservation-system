"""
Bulk Import API
POST /api/bulk-upload/import/

Accepts a multipart form with:
  - entity: one of the entity keys, or "all"
  - file: .csv, .xls, or .xlsx (or .zip when entity == "all")

Returns an import report:
  {
    "total": N,
    "success": N,
    "created": N,
    "updated": N,
    "failed": N,
    "errors": [
      { "row": 2, "data": {...}, "errors": {...} },
      ...
    ]
  }
"""

import logging
import zipfile

from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from drf_spectacular.utils import extend_schema, inline_serializer

from apps.flights.permissions import IsAdminOrSuperuser
from .repositories import ENTITY_IMPORTERS
from .services import import_single_entity, import_from_zip

logger = logging.getLogger(__name__)

class BulkImportView(APIView):
    """
    POST /api/bulk-upload/import/
    Multipart form fields:
      - entity  (string): one of ENTITY_IMPORTERS keys, or "all"
      - file    (file):   .csv / .xls / .xlsx  — or .zip when entity is "all"
    """
    permission_classes = [IsAdminOrSuperuser]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request=inline_serializer(
            name="BulkImportRequest",
            fields={
                "entity": serializers.ChoiceField(choices=["all"] + list(ENTITY_IMPORTERS.keys())),
                "file": serializers.FileField(),
            }
        ),
        responses={
            200: inline_serializer(
                name="BulkImportResponse",
                fields={
                    "total": serializers.IntegerField(),
                    "success": serializers.IntegerField(),
                    "created": serializers.IntegerField(),
                    "updated": serializers.IntegerField(),
                    "failed": serializers.IntegerField(),
                    "errors": serializers.ListField(
                        child=serializers.DictField()
                    ),
                }
            )
        }
    )
    def post(self, request, *args, **kwargs):
        entity        = request.data.get("entity", "").strip().lower()
        uploaded_file = request.FILES.get("file")

        if not entity:
            raise ValidationError({"detail": "The 'entity' field is required."})
        if not uploaded_file:
            raise ValidationError({"detail": "No file uploaded."})

        # ── ZIP / all-tables import ───────────────────────────────────────────
        if entity == "all":
            if not uploaded_file.name.lower().endswith(".zip"):
                raise ValidationError(
                    {"detail": "To import all tables, please upload a single .zip file "
                               "containing your CSV/Excel files."}
                )
            try:
                report = import_from_zip(uploaded_file)
                return Response(report, status=status.HTTP_200_OK)
            except (ValueError, zipfile.BadZipFile) as exc:
                raise ValidationError({"detail": str(exc)})
            except Exception as exc:
                logger.exception("Failed to parse ZIP archive")
                raise ValidationError({"detail": f"Failed to parse ZIP archive: {exc}"})

        # ── Single-entity import ──────────────────────────────────────────────
        try:
            report = import_single_entity(entity, uploaded_file)
            return Response(report, status=status.HTTP_200_OK)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)})
        except RuntimeError as exc:
            raise ValidationError({"detail": str(exc)})
        except Exception as exc:
            logger.exception("Failed to parse file")
            raise ValidationError({"detail": f"Failed to parse file: {exc}"})