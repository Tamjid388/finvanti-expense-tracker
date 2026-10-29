from django.conf import settings
from django.db import models
from django.db.models import Q


class Note(models.Model):
    """User-owned standalone personal note."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notes",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=~Q(title=""), name="note_title_nonempty"),
        ]
        indexes = [
            models.Index(fields=["owner", "-updated_at"], name="idx_note_owner_updated"),
        ]

    def __str__(self) -> str:
        return self.title
