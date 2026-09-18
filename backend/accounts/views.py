from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import StaffSerializer, StaffTokenObtainPairSerializer, UpdateLanguageSerializer


class StaffTokenObtainPairView(TokenObtainPairView):
    serializer_class = StaffTokenObtainPairSerializer


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(StaffSerializer(request.user).data)

    def patch(self, request):
        serializer = UpdateLanguageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.language = serializer.validated_data['language']
        request.user.save(update_fields=['language'])
        return Response(StaffSerializer(request.user).data)


class DemoGateStatusView(APIView):
    """デモ公開用の簡易パスワードゲートが有効かどうかを返す（未設定なら常に無効）。"""

    permission_classes = (AllowAny,)

    def get(self, request):
        return Response({'enabled': bool(settings.DEMO_GATE_PASSWORD)})


class DemoGateVerifyView(APIView):
    """デモ公開用の簡易パスワードゲート。正しいパスワードかどうかだけを判定する
    （スタッフ認証とは別物で、ログイン画面にたどり着く前の一時的な入り口）。
    """

    permission_classes = (AllowAny,)

    def post(self, request):
        if not settings.DEMO_GATE_PASSWORD:
            return Response({'success': True})
        if request.data.get('password') == settings.DEMO_GATE_PASSWORD:
            return Response({'success': True})
        return Response({'success': False}, status=status.HTTP_403_FORBIDDEN)
