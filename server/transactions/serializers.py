from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from core.serializers import OwnedCategoryField

from .models import TYPE_EXPENSE, TYPE_INCOME, Transaction


class TransactionSerializer(serializers.ModelSerializer):
    """Money-row validation (docs/specs/transactions/02 + 03).

    - `amount` positive Decimal(12,2), serialized as a string.
    - `category` must exist AND belong to `request.user` AND match `type`
      (both foreign and absent ids return the same 400 — no existence leak).
    - Client-sent `user`/`owner` keys are ignored: owner is set by the view.
    """

    category = OwnedCategoryField()

    class Meta:
        model = Transaction
        fields = [
            "id",
            "category",
            "amount",
            "type",
            "date",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "amount": {"coerce_to_string": True},
            "description": {"required": False, "allow_blank": True},
        }

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate_type(self, value):
        if value not in (TYPE_INCOME, TYPE_EXPENSE):
            raise serializers.ValidationError("Must be income or expense.")
        return value

    def validate(self, attrs):
        # `category` ownership is enforced by OwnedCategoryField's user-scoped
        # queryset above: foreign and absent ids are indistinguishable 400s
        # before this method ever sees them. What remains (T3) is joint
        # type-match on create/PATCH with input-or-instance resolution.
        instance = self.instance
        category = attrs.get(
            "category", instance.category if instance is not None else None
        )
        txn_type = attrs.get("type", instance.type if instance is not None else None)
        if category is not None and txn_type is not None and category.type != txn_type:
            raise ValidationError(
                {"category": ["Category type does not match transaction type."]}
            )
        return attrs
