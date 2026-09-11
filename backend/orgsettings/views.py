import urllib.error

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin

from .dispatch import send_webhook
from .models import OrgSettings, Webhook
from .serializers import OrgSettingsSerializer, WebhookSerializer


class OrgSettingsView(APIView):
    permission_classes = (IsAdmin,)

    def get(self, request):
        return Response(OrgSettingsSerializer(OrgSettings.load()).data)

    def put(self, request):
        instance = OrgSettings.load()
        serializer = OrgSettingsSerializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WebhookViewSet(viewsets.ModelViewSet):
    serializer_class = WebhookSerializer
    permission_classes = (IsAdmin,)
    queryset = Webhook.objects.all()
    pagination_class = None

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        webhook = self.get_object()
        try:
            send_webhook(webhook, 'test', {'message': 'これはテスト送信です'})
        except (urllib.error.URLError, OSError) as exc:
            return Response(
                {'success': False, 'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({'success': True})
