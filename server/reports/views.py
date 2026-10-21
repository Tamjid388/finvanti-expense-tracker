from django.db.models import Q, Sum
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from budgets.services import status_fields, spend_map_for_months
from core.money import ZERO, as_money
from core.months import format_month, month_bounds, parse_month_param
from transactions.models import TYPE_EXPENSE, TYPE_INCOME, Transaction

MONTH_PARAM = OpenApiParameter(
    name="month",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=True,
    description="Calendar month `YYYY-MM`; inclusive calendar-date bounds.",
)
TYPE_PARAM = OpenApiParameter(
    name="type",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=True,
    enum=[TYPE_EXPENSE, TYPE_INCOME],
    description="Transaction type to group by.",
)


@extend_schema(
    summary="Monthly summary",
    description=("Total income, expenses and net for the month. Empty months "
                 "return zeros, never errors."),
    parameters=[MONTH_PARAM],
)
class MonthlySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        month = parse_month_param(request.query_params.get("month"))
        first, last = month_bounds(month.year, month.month)
        totals = Transaction.objects.filter(
            user=request.user, date__range=(first, last)
        ).aggregate(
            income=Sum("amount", filter=Q(type=TYPE_INCOME)),
            expenses=Sum("amount", filter=Q(type=TYPE_EXPENSE)),
        )
        income = totals["income"] or ZERO
        expenses = totals["expenses"] or ZERO
        return Response(
            {
                "month": format_month(month),
                "total_income": as_money(income),
                "total_expenses": as_money(expenses),
                "net_balance": as_money(income - expenses),
            }
        )


@extend_schema(
    summary="Category breakdown",
    description=("Per-category totals for the month and type in one GROUP BY "
                 "(no per-category queries), ordered by total descending."),
    parameters=[MONTH_PARAM, TYPE_PARAM],
)
class CategoryBreakdownView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        month = parse_month_param(request.query_params.get("month"))
        type_param = request.query_params.get("type")
        if type_param not in (TYPE_EXPENSE, TYPE_INCOME):
            raise ValidationError(
                {"type": ["Type is required. Must be income or expense."]}
            )
        first, last = month_bounds(month.year, month.month)
        grouped = (
            Transaction.objects.filter(
                user=request.user, date__range=(first, last), type=type_param
            )
            .values("category_id", "category__name")
            .annotate(total=Sum("amount"))
            .order_by("-total", "category__name")
        )
        return Response(
            [
                {
                    "category_id": row["category_id"],
                    "category_name": row["category__name"],
                    "total": as_money(row["total"]),
                }
                for row in grouped
            ]
        )


@extend_schema(
    summary="Budget status",
    description=("Limit/spent/remaining/is_over for each of the month's budgets "
                 "(all scopes). Empty budget list returns `[]`. Reuses the "
                 "budgets spend formula."),
    parameters=[MONTH_PARAM],
)
class BudgetStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from budgets.models import Budget

        month = parse_month_param(request.query_params.get("month"))
        budgets = (
            Budget.objects.filter(user=request.user, month=month)
            .select_related("category")
            .order_by("month", "id")
        )
        spend_map = spend_map_for_months(
            request.user,
            [month],
            scope_keys=[(b.month, b.category_id) for b in budgets],
        )
        rows = []
        for budget in budgets:
            fields = status_fields(budget, spend_map)
            rows.append(
                {
                    "budget_id": budget.id,
                    "category_id": budget.category_id,
                    "limit": as_money(budget.limit_amount),
                    "spent": as_money(fields["spent"]),
                    "remaining": as_money(fields["remaining"]),
                    "is_over": fields["is_over"],
                }
            )
        return Response(rows)
