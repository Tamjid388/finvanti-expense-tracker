from django.conf import settings
from django.db import models
from django.db.models import Q

TYPE_INCOME = "income"
TYPE_EXPENSE = "expense"
TYPE_CHOICES = [(TYPE_INCOME, TYPE_INCOME), (TYPE_EXPENSE, TYPE_EXPENSE)]


class Transaction(models.Model):
    """A user-owned income/expense record (docs/specs/transactions/01-model-constraints.md).

    Amount is fixed-precision Decimal(12,2); never float. `category` is PROTECT
    as the DB backstop to the view-layer delete guard (Categories C3). Type
    match with the category is an app-level invariant (T3) — not portable as a
    DB constraint.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    category = models.ForeignKey(
        "categories.Category",
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=7, choices=TYPE_CHOICES)
    date = models.DateField()
    description = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="txn_amount_positive"),
            models.CheckConstraint(
                condition=Q(type__in=[TYPE_INCOME, TYPE_EXPENSE]),
                name="txn_type_valid",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "date"], name="idx_txn_user_date"),
            models.Index(fields=["user", "type", "date"], name="idx_txn_user_type_date"),
            models.Index(fields=["user", "category", "date"], name="idx_txn_user_cat_date"),
        ]
        ordering = ["-date", "-id"]

    def __str__(self) -> str:
        return f"{self.type} {self.amount} {self.date}"
