from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework import serializers as drf_serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.generics import CreateAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .cookies import clear_refresh_cookie, set_refresh_cookie
from .google import derive_username, verify_google_id_token
from .models import GoogleAccount
from .serializers import EmailTokenObtainPairSerializer, GoogleAuthSerializer, RegisterSerializer, UserSerializer


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


@extend_schema(summary='Logout', description='Blacklist the refresh token (cookie or body) and clear the refresh cookie. The access token expires on its own (30m).', request={'application/json': {'type': 'object', 'properties': {'refresh': {'type': 'string'}}}}, responses={204: None})
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


def _issue_cookie_pair(user) -> tuple:
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


@extend_schema(summary='Google login', description='Verify a Google ID token server-side and issue the same access + httpOnly refresh-cookie pair. Existing password-only email gets 409 password_account_exists.', request=GoogleAuthSerializer, responses={200: AccessResponse})
class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = verify_google_id_token(serializer.validated_data['id_token'])
        except AuthenticationFailed as exc:
            return Response({'detail': str(exc.detail)}, status=status.HTTP_401_UNAUTHORIZED)
        sub = payload['sub']
        email = payload['email']
        with transaction.atomic():
            linked = GoogleAccount.objects.select_related('user').filter(sub=sub).first()
            if linked:
                user = linked.user
            elif User.objects.filter(email__iexact=email).exists():
                return Response(
                    {'detail': 'An account with this email already exists — sign in with password first, then link Gmail in Profile.', 'code': 'password_account_exists'},
                    status=409,
                )
            else:
                user = User.objects.create_user(username=derive_username(email), email=email)
                user.set_unusable_password()
                user.save()
                GoogleAccount.objects.create(user=user, sub=sub, email=email)
            access, refresh = _issue_cookie_pair(user)
        response = Response({'access': access}, status=status.HTTP_200_OK)
        set_refresh_cookie(response, refresh)
        return response


@extend_schema(summary='Link Google', description='Link the authenticated user to a Google account. Verifies the ID token server-side; rejects subs linked to other users.', request=GoogleAuthSerializer, responses={200: UserSerializer})
class GoogleLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = verify_google_id_token(serializer.validated_data['id_token'])
        except AuthenticationFailed as exc:
            return Response({'detail': str(exc.detail)}, status=status.HTTP_401_UNAUTHORIZED)
        sub = payload['sub']
        email = payload['email']
        with transaction.atomic():
            if GoogleAccount.objects.filter(sub=sub).exclude(user=request.user).exists():
                return Response(
                    {'detail': 'This Google account is already linked to another user.', 'code': 'sub_already_linked'},
                    status=409,
                )
            existing = getattr(request.user, 'google_account', None)
            if existing and existing.sub != sub:
                return Response(
                    {'detail': 'This user is already linked to a different Google account.', 'code': 'already_linked_other'},
                    status=409,
                )
            GoogleAccount.objects.update_or_create(
                user=request.user, defaults={'sub': sub, 'email': email}
            )
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)