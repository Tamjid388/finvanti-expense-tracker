from rest_framework import serializers

from .models import TYPE_EXPENSE, TYPE_INCOME

from .models import Category


def transactions_reference(category) -> bool:
    """True when any transaction references the category (C3 forward-compat).

    Local import + app check so the guard works while the transactions app is
    absent or unmigrated, per docs/specs/categories/03-delete-guard.md.
    """
    from django.apps import apps

    if not apps.is_installed("transactions"):
        return False
    from transactions.models import Transaction

    return Transaction.objects.filter(category=category).exists()


class CategorySerializer(serializers.ModelSerializer):
    """Validate + serialize user-owned categories (docs/specs/categories/02-crud-api.md).

    `owner` is never in the payload; the view sets it server-side from
    `request.user`. Duplicate checks are case-insensitive per (owner, type).
    """

    class Meta:
        model = Category
        fields = ["id", "name", "type", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name must not be empty.")
        if len(name) > 100:
            raise serializers.ValidationError("Name must be 100 characters or fewer.")
        return name

    def validate_type(self, value):
        if value not in (TYPE_INCOME, TYPE_EXPENSE):
            raise serializers.ValidationError("Must be income or expense.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        instance = self.instance
        name = attrs.get("name", instance.name if instance is not None else None)
        type_ = attrs.get("type", instance.type if instance is not None else None)
        if name is not None and type_ is not None:
            queryset = Category.objects.filter(owner=user, type=type_, name__iexact=name)
            if instance is not None:
                queryset = queryset.exclude(pk=instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"name": ["Category with this name already exists."]}
                )
        # C3 type-change guard: block flipping type on a category with history.
        if (
            instance is not None
            and "type" in attrs
            and attrs["type"] != instance.type
            and transactions_reference(instance)
        ):
            raise serializers.ValidationError(
                {"type": ["Cannot change type while transactions reference this category."]}
            )
        return attrs
