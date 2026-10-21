from django.urls import path

from .views import BudgetStatusView, CategoryBreakdownView, MonthlySummaryView

urlpatterns = [
    path("monthly-summary/", MonthlySummaryView.as_view(), name="monthly-summary"),
    path("category-breakdown/", CategoryBreakdownView.as_view(), name="category-breakdown"),
    path("budget-status/", BudgetStatusView.as_view(), name="budget-status"),
]
