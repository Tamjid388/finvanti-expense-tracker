from django.db import IntegrityError, transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import TYPE_EXPENSE, TYPE_INCOME, Category
from .serializers import CategorySerializer, transactions_reference

DUPLICATE_DETAIL = ["Category with this name already exists."]


def _map_integrity_error(exc: IntegrityError):
    """Map the CI-unique constraint race to a stable 400 (C2 rule 3)."""
    if "uniq_category_owner_lower_name_type" in str(exc):
        return ValidationError({"name": DUPLICATE_DETAIL})
    return None


@extend_schema_view(
    list=extend_schema(
        summary="List my categories",
        description="Owner-scoped, ordered by (name, id). Optional `type` filter.",
        parameters=[
            OpenApiParameter(
                name="type",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=[TYPE_INCOME, TYPE_EXPENSE],
                description="Filter by category type.",
            )
        ],
    ),
    create=extend_schema(
        summary="Create a category", description="Owner set from the JWT. 201 on success."
    ),
    retrieve=extend_schema(summary="Retrieve my category"),
    partial_update=extend_schema(
        summary="Partially update my category",
        description="PATCH only. Type change is blocked while transactions reference the category.",
    ),
    destroy=extend_schema(
        summary="Delete my category",
        description=(
            "204 when unreferenced; 400 `category_in_use` when transactions "
            "reference the category. Referenced categories are never cascade-deleted."
        ),
    ),
)
class CategoryViewSet(viewsets.ModelViewSet):
    """User-owned category CRUD with `?type=` filter and history guards (C2/C3)."""

    serializer_class = CategorySerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Category.objects.filter(owner=self.request.user).order_by("name", "id")

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        type_param = self.request.query_params.get("type")
        if type_param is not None:
            if type_param not in (TYPE_INCOME, TYPE_EXPENSE):
                raise ValidationError({"type": ["Must be income or expense."]})
            queryset = queryset.filter(type=type_param)
        return queryset

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                serializer.save(owner=self.request.user)
        except IntegrityError as exc:
            mapped = _map_integrity_error(exc)
            if mapped is not None:
                raise mapped
            raise

    def perform_update(self, serializer):
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as exc:
            mapped = _map_integrity_error(exc)
            if mapped is not None:
                raise mapped
            raise

    @staticmethod
    def _transactions_reference(category) -> bool:
        """Shared C3 helper — see categories.serializers.transactions_reference."""
        return transactions_reference(category)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Close the check-then-act race with a locked re-read before guard+delete.
        with transaction.atomic():
            locked = Category.objects.select_for_update().get(pk=instance.pk)
            if self._transactions_reference(locked):
                return Response(
                    {
                        "code": "category_in_use",
                        "detail": "Category has transactions and cannot be deleted.",
                        "fields": {"id": ["Category is referenced by transactions."]},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            locked.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
