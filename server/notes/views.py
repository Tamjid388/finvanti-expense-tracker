from django.db import transaction
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status, viewsets
from rest_framework.response import Response

from .models import Note
from .serializers import NoteSerializer

PATH_ID_PARAM = OpenApiParameter(
    name="id",
    type=OpenApiTypes.INT,
    location=OpenApiParameter.PATH,
    required=True,
    description="Note id.",
)


@extend_schema_view(
    list=extend_schema(
        summary="List my notes",
        description="Owner-scoped, ordered by (-updated_at, -id).",
    ),
    create=extend_schema(
        summary="Create a note", description="Owner set from the JWT. 201 on success."
    ),
    retrieve=extend_schema(summary="Retrieve my note", parameters=[PATH_ID_PARAM]),
    partial_update=extend_schema(
        summary="Partially update my note",
        description="PATCH only.",
        parameters=[PATH_ID_PARAM],
    ),
    destroy=extend_schema(
        summary="Delete my note",
        description="204 on success.",
        parameters=[PATH_ID_PARAM],
    ),
)
class NoteViewSet(viewsets.ModelViewSet):
    """User-owned standalone note CRUD."""

    serializer_class = NoteSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Note.objects.filter(owner=self.request.user).order_by(
            "-updated_at", "-id"
        )

    def perform_create(self, serializer):
        with transaction.atomic():
            serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        with transaction.atomic():
            serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
