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
DEBUG_TABLE_APP_LABELS = [
    'accounts', 'members', 'access', 'cards', 'orgsettings', 'chat', 'meetingrooms', 'orders',
]
# 画面にそのまま出すべきでない値を持つ列（パスワードハッシュ・Webhookシークレット等）
DEBUG_TABLE_MASKED_FIELDS = {'password', 'secret'}
DEBUG_TABLE_ROW_LIMIT = 200

# 各テーブルが何のためのものかを一覧画面に表示するための説明文
DEBUG_TABLE_DESCRIPTIONS = {
    'accounts.Staff': 'ログインアカウント（管理者／ユーザー）。会員との紐づけや権限を保持します',
    'members.Member': '受付・入退室の対象となる会員の基本情報（氏名・所属企業・カードID等）',
    'members.Plan': '会員に割り当てる月間利用時間の上限プラン',
    'access.AccessLog': '入退室（チェックイン・チェックアウト）の打刻ログ',
    'cards.SecurityCard': '貸出用セキュリティカードの台帳',
    'cards.CardLoan': 'セキュリティカードの貸出〜返却の記録',
    'orgsettings.OrgSettings': '入力方式・CSV出力列などの運用設定（1件のみ）',
    'orgsettings.Webhook': '入退室イベントを外部URLへ通知するWebhookの登録情報',
    'chat.Conversation': 'チャットの会話単位（1対1）',
    'chat.Participant': 'チャット会話の参加者（既読状況を含む）',
    'chat.Message': 'チャットの送信メッセージ本文',
    'chat.Reaction': 'チャットメッセージへのリアクション（いいね等）',
    'meetingrooms.MeetingRoom': '会議室マスタ（名称・予約可否）',
    'meetingrooms.Reservation': '会議室の予約情報',
    'meetingrooms.FloorShape': '間取り図作成画面で描画した図形の履歴',
    'meetingrooms.FloorPlanItem': '間取り図に配置済みの図形一式',
    'orders.MenuItem': '注文メニューのマスタ（お茶・コーヒー等）',
    'orders.OrderSettings': '注文の受付可能時間などの設定（1件のみ）',
    'orders.Order': '注文（どの会議室への注文か・ステータス）',
    'orders.OrderLine': '注文の明細（メニュー×数量）',
}


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
            {
                'value': key,
                'label': f'{model._meta.verbose_name} ({key})',
                'description': DEBUG_TABLE_DESCRIPTIONS.get(key, ''),
            }
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
