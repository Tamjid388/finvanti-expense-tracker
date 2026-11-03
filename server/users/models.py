from django.contrib.auth.models import User
from django.db import models


class GoogleAccount(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="google_account")
    sub = models.CharField(max_length=255, unique=True)
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"GoogleAccount(user={self.user_id}, sub={self.sub})"
