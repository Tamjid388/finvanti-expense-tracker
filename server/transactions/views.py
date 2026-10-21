import re
from datetime import date

from django.db import transaction
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import TYPE_EXPENSE, TYPE_INCOME, Transaction
from .serializers import TransactionSerializer

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

PATH_ID_PARAM = OpenApiParameter(
    name="id",
    type=OpenApiTypes.INT,
    location=OpenApiParameter.PATH,
    required=True,
    description="Transaction id.",
)

FILTER_PARAMS = [
    OpenApiParameter(name="type", type=str, location=OpenApiParameter.QUERY,
                     required=False, enum=[TYPE_INCOME, TYPE_EXPENSE]),
    OpenApiParameter(name="category_id", type=int, location=OpenApiParameter.QUERY,
                     required=False, description="Filter by own category id."),
    OpenApiParameter(name="start_date", type=str, location=OpenApiParameter.QUERY,
                     required=False, description="ISO date YYYY-MM-DD (inclusive)."),
    OpenApiParameter(name="end_date", type=str, location=OpenApiParameter.QUERY,
                     required=False, description="ISO date YYYY-MM-DD (inclusive)."),
]


class TransactionPagination(PageNumberPagination):
    """Project keeps DRF defaults globally; transactions paginate explicitly
    per server/AGENTS.md guardrail ("paginate transaction lists"). Page size 20."""

    page_size = 20


def _parse_iso_date(raw: str, field: str) -> date:
    if not _DATE_RE.match(raw):
        raise ValidationError({field: ["Invalid date. Use YYYY-MM-DD."]})
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise ValidationError({field: ["Invalid calendar date."]}, ) from exc


@extend_schema_view(
    list=extend_schema(
        summary="List my transactions",
        description=("Owner-scoped, ordered by (-date, -id), paginated "
                     "(page size 20). Filters combine."),
        parameters=FILTER_PARAMS,
    ),
    create=extend_schema(
        summary="Create a transaction",
        description="Owner set from the JWT. Category must be owned and type-matched.",
    ),
    retrieve=extend_schema(summary="Retrieve my transaction", parameters=[PATH_ID_PARAM]),
    partial_update=extend_schema(
        summary="Partially update my transaction",
        description=("PATCH only. Category ownership and category/transaction "
                     "type match are re-validated jointly on partial input."),
        parameters=[PATH_ID_PARAM],
    ),
    destroy=extend_schema(
        summary="Delete my transaction", parameters=[PATH_ID_PARAM]
    ),
)
class TransactionViewSet(viewsets.ModelViewSet):
    """User-owned transaction CRUD with combined filters (T2/T3)."""

    serializer_class = TransactionSerializer
    pagination_class = TransactionPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Transaction.objects.filter(user=self.request.user)
            .select_related("category")
            .order_by("-date", "-id")
        )

    def filter_queryset(self, queryset):
        """List-only filtering (retrieve paths are unaffected). Bad filter
        values raise DRF ValidationError -> 400 with `fields` (never silent)."""
        queryset = super().filter_queryset(queryset)
        params = self.request.query_params

        type_param = params.get("type")
        if type_param is not None:
            if type_param not in (TYPE_INCOME, TYPE_EXPENSE):
                raise ValidationError({"type": ["Must be income or expense."]})
            queryset = queryset.filter(type=type_param)

        category_param = params.get("category_id")
        if category_param is not None:
            try:
                category_id = int(category_param)
            except (TypeError, ValueError):
                raise ValidationError(
                    {"category_id": ["Must be an integer."]}
                ) from None
            queryset = queryset.filter(category_id=category_id)

        start_raw, end_raw = params.get("start_date"), params.get("end_date")
        start = _parse_iso_date(start_raw, "start_date") if start_raw is not None else None
        end = _parse_iso_date(end_raw, "end_date") if end_raw is not None else None
        if start is not None and end is not None and start > end:
            raise ValidationError(
                {"start_date": ["start_date must be on or before end_date."]}
            )
        if start is not None:
            queryset = queryset.filter(date__gte=start)
        if end is not None:
            queryset = queryset.filter(date__lte=end)
        return queryset

    def perform_create(self, serializer):
        with transaction.atomic():
            serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        with transaction.atomic():
            serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
