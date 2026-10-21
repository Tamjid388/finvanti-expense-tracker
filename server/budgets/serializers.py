from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from categories.models import Category
from core.months import parse_month_param

from .models import Budget
from .services import month_spend, status_fields

DUPLICATE_DETAIL = "Budget for this month and category already exists."


class MonthField(serializers.DateField):
    """Wire form for budget months.

    Input accepts only `YYYY-MM` and normalizes to the first-of-month date
    (docs/specs/budgets/02-crud-filter.md). Output renders the stored date as
    ISO `YYYY-MM-01`, matching `docs/reference/budgets-api.md`.
    """

    def to_internal_value(self, value):
        if not isinstance(value, str):
            raise serializers.ValidationError("Invalid month. Use YYYY-MM.")
        try:
            return parse_month_param(value)
        except ValidationError as exc:
            month_messages = list(exc.detail.get("month", ["Invalid month. Use YYYY-MM."]))
            raise serializers.ValidationError(month_messages) from exc


class BudgetSerializer(serializers.ModelSerializer):
    month = MonthField()
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), allow_null=True, required=False
    )
    spent = serializers.SerializerMethodField(help_text="Derived from expense transactions.")
    remaining = serializers.SerializerMethodField(help_text="limit_amount - spent.")
    is_over = serializers.SerializerMethodField(help_text="True when spent exceeds the limit.")

    class Meta:
        model = Budget
        fields = ["id", "category", "month", "limit_amount", "spent", "remaining", "is_over"]
        read_only_fields = ["id", "spent", "remaining", "is_over"]
        extra_kwargs = {"limit_amount": {"coerce_to_string": True}}

    # -- computed fields (B3): derive from the context spend map; fall back to
    # a direct aggregate only when the serializer is used without a view.
    def _status(self, instance) -> dict:
        if not hasattr(self, "_status_cache"):
            self._status_cache = {}
        if instance.pk not in self._status_cache:
            spend_map = self.context.get("spend_map") or {}
            key = (instance.month, instance.category_id)
            if key not in spend_map:
                spend_map = {
                    **spend_map,
                    key: month_spend(
                        self.context["request"].user, instance.month, instance.category_id
                    ),
                }
            self._status_cache[instance.pk] = status_fields(instance, spend_map)
        return self._status_cache[instance.pk]

    def get_spent(self, instance):
        return self._status(instance)["spent"]

    def get_remaining(self, instance):
        return self._status(instance)["remaining"]

    def get_is_over(self, instance):
        return self._status(instance)["is_over"]

    # -- validation (B2) ---------------------------------------------------

    def validate_limit_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Limit must be greater than zero.")
        return value

    def validate_category(self, value):
        if value is None:
            return value  # overall budget scope
        # Foreign and absent ids surface identically — no existence hint.
        if self.context["request"].user.id != value.owner_id:
            raise serializers.ValidationError("Invalid category.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        instance = self.instance

        category = attrs.get("category", instance.category if instance is not None else None)
        if category is not None and category.type != "expense":
            raise ValidationError({"category": ["Budget categories must be expense type."]})

        month = attrs.get("month", instance.month if instance is not None else None)
        # Duplicate (user, month, category) check; DB unique is the race backstop.
        queryset = Budget.objects.filter(user=user, month=month, category=category)
        if instance is not None:
            queryset = queryset.exclude(pk=instance.pk)
        if queryset.exists():
            raise ValidationError({"non_field_errors": [DUPLICATE_DETAIL]})
        return attrs
