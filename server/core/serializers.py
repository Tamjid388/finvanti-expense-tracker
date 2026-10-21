"""Shared DRF fields (T3/B2 related-id policy: no category existence hints)."""

from categories.models import Category
from rest_framework import serializers


class OwnedCategoryField(serializers.PrimaryKeyRelatedField):
    """Category FK validation that never hints existence.

    The queryset is scoped to the requesting user, so a foreign id and an
    absent id fail identically with `Invalid category.` — no leak of whether
    the id exists at all. Without request context the queryset is empty:
    fail closed.
    """

    default_error_messages = {"does_not_exist": "Invalid category."}

    def get_queryset(self):
        request = self.context.get("request", None)
        if request is None or request.user is None or request.user.is_anonymous:
            return Category.objects.none()
        return Category.objects.filter(owner=request.user)
