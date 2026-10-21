from django.db import IntegrityError, transaction
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.months import parse_month_param

from .models import Budget
from .serializers import BudgetSerializer
from .services import month_spend, spend_map_for_months

DUPLICATE_DETAIL = ["Budget for this month and category already exists."]

PATH_ID_PARAM = OpenApiParameter(
    name="id",
    type=OpenApiTypes.INT,
    location=OpenApiParameter.PATH,
    required=True,
    description="Budget id.",
)

FILTER_PARAMS = [
    OpenApiParameter(
        name="month",
        type=str,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Calendar month `YYYY-MM`; bad month returns 400.",
    ),
    OpenApiParameter(
        name="category_id",
        type=int,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter by budget scope category id.",
    ),
]


@extend_schema_view(
    list=extend_schema(
        summary="List my budgets",
        description=("Owner-scoped, ordered by (month, id). Includes computed "
                     "`spent`/`remaining`/`is_over` derived from committed expenses."),
        parameters=FILTER_PARAMS,
    ),
    create=extend_schema(
        summary="Create a monthly budget",
        description=("`month` takes `YYYY-MM`; `category: null` is the overall budget; "
                     "a set category must be an owned expense category. "
                     "Duplicate (user, month, category) returns 400."),
    ),
    retrieve=extend_schema(summary="Retrieve my budget", parameters=[PATH_ID_PARAM]),
    partial_update=extend_schema(
        summary="Partially update my budget",
        description="PATCH only. Re-checks scope uniqueness and the expense-only rule.",
        parameters=[PATH_ID_PARAM],
    ),
    destroy=extend_schema(
        summary="Delete my budget",
        description="204; never deletes historical transactions.",
        parameters=[PATH_ID_PARAM],
    ),
)
class BudgetViewSet(viewsets.ModelViewSet):
    """User-owned budget CRUD + derived spend (B2/B3)."""

    serializer_class = BudgetSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Budget.objects.filter(user=self.request.user)
            .select_related("category")
            .order_by("month", "id")
        )

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        params = self.request.query_params

        month_param = params.get("month")
        if month_param is not None:
            queryset = queryset.filter(month=parse_month_param(month_param))

        category_param = params.get("category_id")
        if category_param is not None:
            try:
                category_id = int(category_param)
            except (TypeError, ValueError):
                raise ValidationError({"category_id": ["Must be an integer."]}) from None
            queryset = queryset.filter(category_id=category_id)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["spend_map"] = getattr(self, "_spend_map", None)
        return context

    # -- computed-field wiring: constant queries per action (B3 criterion 4).

    def list(self, request, *args, **kwargs):
        instances = list(self.filter_queryset(self.get_queryset()))
        self._spend_map = spend_map_for_months(
            request.user,
            [b.month for b in instances],
            scope_keys=[(b.month, b.category_id) for b in instances],
        )
        serializer = self.get_serializer(instances, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._spend_map = self._single_spend_map(instance)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = serializer.instance
        self._spend_map = self._single_spend_map(instance)
        output = self.get_serializer(instance)
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        instance = serializer.instance
        self._spend_map = self._single_spend_map(instance)
        output = self.get_serializer(instance)
        return Response(output.data)

    def _single_spend_map(self, budget) -> dict:
        return {
            (budget.month, budget.category_id): month_spend(
                self.request.user, budget.month, budget.category_id
            )
        }

    # -- writes -------------------------------------------------------------

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                serializer.save(user=self.request.user)
        except IntegrityError as exc:
            if "uniq_budget_user_month_cat" in str(exc):
                raise ValidationError({"non_field_errors": DUPLICATE_DETAIL}) from exc
            raise

    def perform_update(self, serializer):
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as exc:
            if "uniq_budget_user_month_cat" in str(exc):
                raise ValidationError({"non_field_errors": DUPLICATE_DETAIL}) from exc
            raise

    def destroy(self, request, *args, **kwargs):
        """Deletes only the budget row — transactions are never touched (B2)."""
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
