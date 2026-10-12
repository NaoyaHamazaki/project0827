import urllib.error

from django.apps import apps
from django.http import Http404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin

from .dispatch import send_webhook
from .models import OrgSettings, Webhook
from .serializers import OrgSettingsSerializer, WebhookSerializer

# テーブル確認（開発用）で表示対象とする自アプリの一覧。
# Django組み込みのauth/admin/sessions等は対象外にする。
DEBUG_TABLE_APP_LABELS = ['accounts', 'members', 'access', 'cards', 'orgsettings', 'chat']
# 画面にそのまま出すべきでない値を持つ列（パスワードハッシュ・Webhookシークレット等）
DEBUG_TABLE_MASKED_FIELDS = {'password', 'secret'}
DEBUG_TABLE_ROW_LIMIT = 200


def _debug_models():
    models = {}
    for app_config in apps.get_app_configs():
        if app_config.label not in DEBUG_TABLE_APP_LABELS:
            continue
        for model in app_config.get_models():
            models[f'{app_config.label}.{model.__name__}'] = model
    return models


class DebugTableListView(APIView):
    """テーブル確認（開発用）：選択可能なテーブル一覧を返す"""

    permission_classes = (IsAdmin,)

    def get(self, request):
        tables = [
            {'value': key, 'label': f'{model._meta.verbose_name} ({key})'}
            for key, model in sorted(_debug_models().items())
        ]
        return Response(tables)


class DebugTableRowsView(APIView):
    """テーブル確認（開発用）：指定テーブルの内容をSELECT的に返す（上限200件、パスワード等はマスク）"""

    permission_classes = (IsAdmin,)

    def get(self, request):
        table = request.query_params.get('table', '')
        model = _debug_models().get(table)
        if model is None:
            raise Http404('不明なテーブルです')

        model_fields = model._meta.fields
        columns = [f.attname for f in model_fields]
        rows = []
        for obj in model.objects.order_by('-pk')[:DEBUG_TABLE_ROW_LIMIT]:
            row = []
            for field in model_fields:
                if field.name.lower() in DEBUG_TABLE_MASKED_FIELDS:
                    row.append('（非表示）')
                else:
                    # attnameはFKなら「xxx_id」の生の値を返す（関連先を辿らないのでN+1にならない）
                    row.append(str(getattr(obj, field.attname)))
            rows.append(row)

        return Response({'columns': columns, 'rows': rows, 'total': model.objects.count()})


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
