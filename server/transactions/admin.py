from django.contrib import admin

from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "category", "amount", "type", "date")
    list_filter = ("type", "date")
    search_fields = ("description",)
    ordering = ("-date", "-id")
