from django.conf import settings
from django.db import models
from django.db.models import Q

TYPE_EXPENSE = "expense"


class Budget(models.Model):
    """A monthly spending cap (docs/specs/budgets/01-model-constraints.md).

    - `month` is always the first-of-month date.
    - `category=None` is the overall budget; null values count as equal in the
      unique constraint (`nulls_not_distinct=True`, Postgres 15+).
    - No stored `spent` counter: spend is derived from committed expense
      transactions on every read (docs/specs/budgets/03-spend-calc.md).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="budgets",
    )
    category = models.ForeignKey(
        "categories.Category",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="budgets",
    )
    month = models.DateField()
    limit_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "month", "category"],
                name="uniq_budget_user_month_cat",
                # Django 6 kwarg form of `nulls_not_distinct`: NULL category
                # (overall budget) participates in uniqueness, Postgres 15+.
                nulls_distinct=False,
            ),
            models.CheckConstraint(
                condition=Q(limit_amount__gt=0),
                name="budget_limit_positive",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "month"], name="idx_budget_user_month"),
        ]
        ordering = ["month", "id"]

    def __str__(self) -> str:
        scope = self.category.name if self.category_id else "overall"
        return f"{self.month} {scope} ≤ {self.limit_amount}"
