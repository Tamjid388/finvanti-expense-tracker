from django.urls import path
from .views import CookieTokenRefreshView, EmailTokenObtainPairView, GoogleLinkView, GoogleLoginView, LogoutView, MeView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", EmailTokenObtainPairView.as_view(), name="login"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("google/link/", GoogleLinkView.as_view(), name="google-link"),
    path("token/refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
