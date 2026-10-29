from django.conf import settings
from django.contrib.auth.models import User
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework import serializers as drf_serializers
from rest_framework.generics import CreateAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .cookies import clear_refresh_cookie, set_refresh_cookie
from .serializers import EmailTokenObtainPairSerializer, RegisterSerializer, UserSerializer


class RegisterView(CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    
@extend_schema(summary='My profile', description='Return the authenticated user profile. Never lists other users.')
class MeView(RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


@extend_schema(summary='Logout', description='Blacklist the refresh token (cookie or body) and clear the refresh cookie. The access token expires on its own (15m).', request={'application/json': {'type': 'object', 'properties': {'refresh': {'type': 'string'}}}}, responses={204: None})
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # No session authentication is used anywhere, so Django CSRF checks do not
        # apply; containment is SameSite=Lax + path-scoped cookie + CORS allowlist.
        refresh = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not refresh and isinstance(request.data, dict):
            refresh = request.data.get('refresh')
        if not refresh:
            return Response({'refresh': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            return Response({'detail': 'Invalid or expired refresh token.'}, status=status.HTTP_400_BAD_REQUEST)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response


class AccessResponse(drf_serializers.Serializer):
    """Access-token-only response body (refresh travels via httpOnly cookie)."""
    access = drf_serializers.CharField()


@extend_schema(summary='Login', description='Email + password login. Returns the short-lived access token; the refresh token is set as a scoped httpOnly cookie (never in the body).', responses={200: AccessResponse})
class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            set_refresh_cookie(response, response.data['refresh'])
            response.data = {'access': response.data['access']}
        return response


@extend_schema(summary='Refresh', description='Rotate the refresh token. Read from the httpOnly cookie first, legacy JSON body second (deprecated); returns the new access token and rotates the cookie.', responses={200: AccessResponse})
class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        data = dict(request.data) if isinstance(request.data, dict) else {}
        if 'refresh' not in data:
            cookie_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
            if cookie_token:
                data['refresh'] = cookie_token
        if 'refresh' not in data:
            raise InvalidToken('No refresh token provided.')
        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])
        response = Response({'access': serializer.validated_data['access']}, status=status.HTTP_200_OK)
        set_refresh_cookie(response, serializer.validated_data['refresh'])
        return response