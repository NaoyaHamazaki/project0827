import csv
from datetime import timedelta

from django.db import transaction
from django.db.models import OuterRef, Subquery
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin
from cards.models import CardLoan, SecurityCard
from cards.serializers import SecurityCardSerializer
from members.models import Member
from members.serializers import MemberUsageSerializer
from members.usage import calculate_usage
from orgsettings.dispatch import dispatch_webhooks
from orgsettings.models import DEFAULT_CSV_COLUMNS, OrgSettings, Webhook

from .filters import AccessLogFilter
from .models import AccessLog
from .qr_token import generate_qr_token, resolve_qr_token
from .serializers import (
    AccessLogSerializer,
    CurrentOccupantSerializer,
    ManualLogSerializer,
    QrTokenRequestSerializer,
    ScanRequestSerializer,
)


def _resolve_member(identifier):
    """card_identifierの直接一致、または期限付きQRトークンの検証・復元で会員を特定する"""
    member = Member.objects.filter(card_identifier=identifier).first()
    if member:
        return member

    original_identifier = resolve_qr_token(identifier)
    if original_identifier is None:
        return None
    return Member.objects.filter(card_identifier=original_identifier).first()


class ScanView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = ScanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        card_identifier = serializer.validated_data['card_identifier']
        method = serializer.validated_data['method']
        security_card_number = serializer.validated_data.get('security_card_number') or ''

        member = _resolve_member(card_identifier)
        if member is None:
            return Response(
                {'success': False, 'reason': 'not_found', 'member': None, 'log': None},
                status=status.HTTP_200_OK,
            )

        if member.status != Member.Status.ACTIVE:
            return Response(
                {
                    'success': False,
                    'reason': 'inactive',
                    'member': {'name': member.name, 'company_name': member.company_name},
                    'log': None,
                },
                status=status.HTTP_200_OK,
            )

        member_brief = {'name': member.name, 'company_name': member.company_name}

        last_log = member.access_logs.order_by('-created_at').first()
        next_type = (
            AccessLog.LogType.CHECK_OUT
            if last_log and last_log.type == AccessLog.LogType.CHECK_IN
            else AccessLog.LogType.CHECK_IN
        )

        active_loan = None
        if next_type == AccessLog.LogType.CHECK_IN:
            # 入室時：貸し出すセキュリティカードの選択/スキャンが未確定なら、選べる候補を返して一旦止める
            if not security_card_number:
                available_cards = SecurityCard.objects.filter(status=SecurityCard.Status.AVAILABLE)
                return Response(
                    {
                        'success': False,
                        'reason': 'security_card_required',
                        'member': member_brief,
                        'log': None,
                        'available_security_cards': SecurityCardSerializer(available_cards, many=True).data,
                    },
                    status=status.HTTP_200_OK,
                )

            security_card = SecurityCard.objects.filter(
                card_number=security_card_number, status=SecurityCard.Status.AVAILABLE,
            ).first()
            if security_card is None:
                return Response(
                    {
                        'success': False,
                        'reason': 'security_card_unavailable',
                        'member': member_brief,
                        'log': None,
                    },
                    status=status.HTTP_200_OK,
                )
        else:
            # 退室時：会員は一度に1枚しか借りられない前提のため、貸出中のカードがあれば
            # 返却対象は一意に決まる。追加のスキャン・入力を求めず自動的に返却扱いにする。
            active_loan = CardLoan.objects.filter(
                member=member, returned_at__isnull=True,
            ).select_related('security_card').first()

        with transaction.atomic():
            log = AccessLog.objects.create(
                member=member, type=next_type, method=method, scanned_by=request.user
            )

            if next_type == AccessLog.LogType.CHECK_IN:
                CardLoan.objects.create(
                    member=member, security_card=security_card,
                    issued_by=request.user, access_log_in=log,
                )
                security_card.status = SecurityCard.Status.LOANED
                security_card.save(update_fields=['status'])
            elif active_loan is not None:
                active_loan.returned_at = timezone.now()
                active_loan.returned_by = request.user
                active_loan.access_log_out = log
                active_loan.save(update_fields=['returned_at', 'returned_by', 'access_log_out'])
                active_loan.security_card.status = SecurityCard.Status.AVAILABLE
                active_loan.security_card.save(update_fields=['status'])

        event = Webhook.EventType.CHECK_IN if next_type == AccessLog.LogType.CHECK_IN else Webhook.EventType.CHECK_OUT
        dispatch_webhooks(event, {
            'member_name': member.name,
            'company_name': member.company_name,
            'type': next_type,
            'method': method,
            'timestamp': log.created_at.isoformat(),
        })

        usage = MemberUsageSerializer(calculate_usage(member)).data

        return Response(
            {
                'success': True,
                'reason': 'ok',
                'member': {'name': member.name, 'company_name': member.company_name},
                'log': AccessLogSerializer(log).data,
                'usage': usage,
            },
            status=status.HTTP_200_OK,
        )


class QrTokenView(APIView):
    """会員が自分のスマホで表示するための、期限付きQRトークンを発行する。

    ログイン不要（会員自身の端末から直接叩けるようにするため）。レート制限は
    未実装のMVP実装である点に留意（本番運用時は要検討）。
    """

    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = QrTokenRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        card_identifier = serializer.validated_data['card_identifier']

        member = Member.objects.filter(
            card_identifier=card_identifier, status=Member.Status.ACTIVE,
        ).first()
        if member is None:
            return Response(
                {'detail': '番号が正しくないか、無効化されています'}, status=status.HTTP_404_NOT_FOUND,
            )

        token = generate_qr_token(member.card_identifier)
        expires_in = 300
        expires_at = timezone.now() + timedelta(seconds=expires_in)
        return Response({
            'token': token,
            'expires_at': expires_at.isoformat(),
            'expires_in': expires_in,
        })


class MyQrView(APIView):
    """ログイン中ユーザー（会員本人）が自分のQRを表示するためのトークンを発行する"""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        member = request.user.member
        if member is None:
            return Response(
                {'detail': 'アカウントに会員情報が紐付けられていません'}, status=status.HTTP_404_NOT_FOUND,
            )

        token = generate_qr_token(member.card_identifier)
        expires_in = 300
        expires_at = timezone.now() + timedelta(seconds=expires_in)
        return Response({
            'card_identifier': member.card_identifier,
            'member_name': member.name,
            'token': token,
            'expires_at': expires_at.isoformat(),
            'expires_in': expires_in,
        })


class MyStatusView(APIView):
    """ログイン中ユーザー（会員本人）の直近の入退室記録と当月の利用状況を返す（ポーリング用）"""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        member = request.user.member
        if member is None:
            return Response({'log': None, 'usage': None})

        log = member.access_logs.order_by('-created_at').first()
        usage = MemberUsageSerializer(calculate_usage(member)).data
        if log is None:
            return Response({'log': None, 'usage': usage})

        return Response({'log': AccessLogSerializer(log).data, 'usage': usage})


class MyHistoryView(APIView):
    """ログイン中ユーザー（会員本人）の入退室履歴（月次、入退室ワンセット＋滞在時間）を返す"""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        member = request.user.member
        if member is None:
            return Response(
                {'detail': 'アカウントに会員情報が紐付けられていません'}, status=status.HTTP_404_NOT_FOUND,
            )

        year = request.query_params.get('year')
        month = request.query_params.get('month')
        data = calculate_usage(
            member,
            year=int(year) if year else None,
            month=int(month) if month else None,
        )
        return Response(MemberUsageSerializer(data).data)


class RecentLogsView(generics.ListAPIView):
    serializer_class = AccessLogSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_queryset(self):
        limit = int(self.request.query_params.get('limit', 5))
        return AccessLog.objects.select_related(
            'member', 'scanned_by', 'card_loan_issued__security_card', 'card_loan_returned__security_card',
        )[:limit]


class CurrentOccupantsView(generics.ListAPIView):
    serializer_class = CurrentOccupantSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_queryset(self):
        latest_log = AccessLog.objects.filter(member=OuterRef('pk')).order_by('-created_at')
        return (
            Member.objects.annotate(
                latest_type=Subquery(latest_log.values('type')[:1]),
                checked_in_at=Subquery(latest_log.values('created_at')[:1]),
            )
            .filter(latest_type=AccessLog.LogType.CHECK_IN)
            .order_by('-checked_in_at')
        )


class AccessLogListView(generics.ListAPIView):
    serializer_class = AccessLogSerializer
    permission_classes = (IsAdmin,)
    filterset_class = AccessLogFilter
    queryset = AccessLog.objects.select_related(
        'member', 'scanned_by', 'card_loan_issued__security_card', 'card_loan_returned__security_card',
    )


class AccessLogDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = AccessLogSerializer
    permission_classes = (IsAdmin,)
    queryset = AccessLog.objects.select_related('member', 'scanned_by')

    def put(self, request, *args, **kwargs):
        log = self.get_object()
        serializer = ManualLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        log.member = serializer.validated_data['member']
        log.type = serializer.validated_data['type']
        log.save(update_fields=['member', 'type'])
        # auto_now_add は .save() 経由でのみ強制されるため、.update() で任意の日時に上書きする
        AccessLog.objects.filter(pk=log.pk).update(created_at=serializer.validated_data['timestamp'])
        log.refresh_from_db()

        return Response(AccessLogSerializer(log).data)


class AccessLogManualCreateView(APIView):
    """打刻漏れ（入室/退室し忘れ）を管理者が是正するための手動ログ追加"""

    permission_classes = (IsAdmin,)

    def post(self, request):
        serializer = ManualLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.validated_data['member']
        log_type = serializer.validated_data['type']
        timestamp = serializer.validated_data['timestamp']

        log = AccessLog.objects.create(
            member=member, type=log_type, method=AccessLog.Method.MANUAL, scanned_by=request.user,
        )
        # auto_now_add は .save() 経由でのみ強制されるため、.update() で任意の日時に上書きする
        AccessLog.objects.filter(pk=log.pk).update(created_at=timestamp)
        log.refresh_from_db()

        return Response(AccessLogSerializer(log).data, status=status.HTTP_201_CREATED)


class Echo:
    def write(self, value):
        return value


def _staff_name(log):
    if log.scanned_by:
        return log.scanned_by.get_full_name() or log.scanned_by.username
    return ''


def _security_card_number(log):
    loan = getattr(log, 'card_loan_issued', None) or getattr(log, 'card_loan_returned', None)
    return loan.security_card.card_number if loan else ''


CSV_COLUMN_DEFINITIONS = {
    'member_name': ('会員名', lambda log: log.member.name),
    'company_name': ('所属企業', lambda log: log.member.company_name),
    'type': ('種別', lambda log: log.get_type_display()),
    'method': ('入力方式', lambda log: log.get_method_display()),
    'staff': ('対応スタッフ', _staff_name),
    'security_card_number': ('セキュリティカード番号', _security_card_number),
    'timestamp': ('打刻日時', lambda log: timezone.localtime(log.created_at).strftime('%Y-%m-%d %H:%M:%S')),
}


class AccessLogExportView(APIView):
    permission_classes = (IsAdmin,)

    def get(self, request):
        queryset = AccessLogFilter(
            request.GET,
            queryset=AccessLog.objects.select_related(
                'member', 'scanned_by', 'card_loan_issued__security_card', 'card_loan_returned__security_card',
            ),
        ).qs

        requested = request.GET.get('columns')
        if requested:
            columns = [key for key in requested.split(',') if key in CSV_COLUMN_DEFINITIONS]
        else:
            columns = [key for key in OrgSettings.load().csv_export_columns if key in CSV_COLUMN_DEFINITIONS]
        if not columns:
            columns = list(DEFAULT_CSV_COLUMNS)

        writer = csv.writer(Echo())
        headers = [CSV_COLUMN_DEFINITIONS[key][0] for key in columns]

        def row_generator():
            yield '﻿'
            yield writer.writerow(headers)
            for log in queryset.iterator():
                yield writer.writerow([CSV_COLUMN_DEFINITIONS[key][1](log) for key in columns])

        response = StreamingHttpResponse(row_generator(), content_type='text/csv; charset=utf-8')
        filename = f'access_logs_{timezone.localdate():%Y%m%d}.csv'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
