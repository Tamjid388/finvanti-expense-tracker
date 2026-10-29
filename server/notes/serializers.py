from rest_framework import serializers

from .models import Note


class NoteSerializer(serializers.ModelSerializer):
    """Validate + serialize user-owned standalone notes.

    `owner` is never in the payload; the view sets it server-side from
    `request.user`.
    """

    class Meta:
        model = Note
        fields = ["id", "title", "description", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_title(self, value: str) -> str:
        title = value.strip()
        if not title:
            raise serializers.ValidationError("Title must not be empty.")
        if len(title) > 200:
            raise serializers.ValidationError(
                "Title must be 200 characters or fewer."
            )
        return title

    def validate_description(self, value: str) -> str:
        if len(value) > 2000:
            raise serializers.ValidationError(
                "Description must be 2000 characters or fewer."
            )
        return value
