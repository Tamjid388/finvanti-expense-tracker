from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

TYPE_INCOME = "income"
TYPE_EXPENSE = "expense"
TYPE_CHOICES = [(TYPE_INCOME, TYPE_INCOME), (TYPE_EXPENSE, TYPE_EXPENSE)]


class Category(models.Model):
    """User-owned income/expense filing type (docs/specs/categories/01-model-constraints.md)."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=7, choices=TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "owner",
                "type",
                name="uniq_category_owner_lower_name_type",
            ),
            models.CheckConstraint(condition=~Q(name=""), name="category_name_nonempty"),
            models.CheckConstraint(
                condition=Q(type__in=[TYPE_INCOME, TYPE_EXPENSE]),
                name="category_type_valid",
            ),
        ]
        indexes = [
            models.Index(fields=["owner", "type"], name="idx_category_owner_type"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.type})"
