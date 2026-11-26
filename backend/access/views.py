import csv
from datetime import date, datetime, time, timedelta

from django.db import transaction
from django.db.models import OuterRef, Subquery
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Account
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
        skip_security_card = serializer.validated_data.get('skip_security_card', False)

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
        security_card = None
        if next_type == AccessLog.LogType.CHECK_IN:
            # 入室時：貸し出すセキュリティカードの選択（またはスキップ）が未確定なら、選べる候補を返して一旦止める
            if not security_card_number and not skip_security_card:
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

            if not skip_security_card:
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

            if next_type == AccessLog.LogType.CHECK_IN and security_card is not None:
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
        active_loan = CardLoan.objects.filter(member=OuterRef('pk'), returned_at__isnull=True).order_by('-issued_at')
        return (
            Member.objects.annotate(
                latest_type=Subquery(latest_log.values('type')[:1]),
                checked_in_at=Subquery(latest_log.values('created_at')[:1]),
                security_card_number=Subquery(active_loan.values('security_card__card_number')[:1]),
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

        if timestamp > timezone.now() + timedelta(minutes=1):
            return Response({'timestamp': ['未来の日時は指定できません']}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            log = AccessLog.objects.create(
                member=member, type=log_type, method=AccessLog.Method.MANUAL, scanned_by=request.user,
            )
            # auto_now_add は .save() 経由でのみ強制されるため、.update() で任意の日時に上書きする
            AccessLog.objects.filter(pk=log.pk).update(created_at=timestamp)
            log.refresh_from_db()
            if log_type == AccessLog.LogType.CHECK_OUT:
                # 退室し忘れを管理者が退室扱いにした場合も、その滞在で貸し出したカードは返却済みにする
                loan = CardLoan.objects.filter(
                    member=member, returned_at__isnull=True, issued_at__lte=timestamp,
                ).select_related('security_card').first()
                if loan is not None:
                    loan.returned_at = timestamp
                    loan.returned_by = request.user
                    loan.access_log_out = log
                    loan.save(update_fields=['returned_at', 'returned_by', 'access_log_out'])
                    loan.security_card.status = SecurityCard.Status.AVAILABLE
                    loan.security_card.save(update_fields=['status'])
                    log = AccessLog.objects.select_related('card_loan_returned__security_card').get(pk=log.pk)

        return Response(AccessLogSerializer(log).data, status=status.HTTP_201_CREATED)


def _log_brief(log):
    if log is None:
        return None
    staff = (log.scanned_by.get_full_name() or log.scanned_by.username) if log.scanned_by else None
    return {'id': str(log.id), 'at': log.created_at, 'method': log.method, 'staff': staff}


def _session_status(check_in, check_out, is_ongoing):
    if is_ongoing:
        return 'ongoing'
    if check_out is None:
        return 'missing_check_out'
    if check_in is None:
        return 'missing_check_in'
    return 'complete'


class AccessLogSessionListView(APIView):
    """過去の入退室履歴を「1回の来館＝入室と退室の組」で返す（在室・ログ管理 → 過去の入退室履歴）。

    ?date_from=&date_to=（入室日で絞る。入室がない組は退室日）、?member=（氏名の部分一致）、
    ?unreturned_card=true（カード未返却のみ）、?page=。管理者は自分の所管の会員だけ
    """

    permission_classes = (IsAdmin,)
    PAIRING_MARGIN = timedelta(days=3)  # 期間の端で入室と退室が分かれないように前後を余分に読む

    def get(self, request):
        params = request.query_params
        try:
            date_from = date.fromisoformat(params['date_from']) if params.get('date_from') else None
            date_to = date.fromisoformat(params['date_to']) if params.get('date_to') else None
        except ValueError:
            return Response({'detail': '日付の形式が正しくありません'}, status=status.HTTP_400_BAD_REQUEST)

        logs = AccessLog.objects.select_related(
            'member', 'scanned_by', 'card_loan_issued__security_card', 'card_loan_returned__security_card',
        )
        user = request.user
        if user.role == Account.Role.ADMIN and user.site_id:
            logs = logs.filter(member__site_id=user.site_id)
        if params.get('member'):
            logs = logs.filter(member__name__icontains=params['member'])
        tz = timezone.get_current_timezone()
        if date_from:
            logs = logs.filter(created_at__gte=datetime.combine(date_from, time.min, tz) - self.PAIRING_MARGIN)
        if date_to:
            day_after = datetime.combine(date_to + timedelta(days=1), time.min, tz)
            logs = logs.filter(created_at__lt=day_after + self.PAIRING_MARGIN)

        sessions = []
        pending = {}
        for log in logs.order_by('member_id', 'created_at'):
            if log.type == AccessLog.LogType.CHECK_IN:
                if log.member_id in pending:  # 退室がないまま次の入室があった
                    sessions.append((pending.pop(log.member_id), None, False))
                pending[log.member_id] = log
            else:
                sessions.append((pending.pop(log.member_id, None), log, False))
        sessions.extend((check_in, None, True) for check_in in pending.values())  # 現在も在室中

        only_unreturned = params.get('unreturned_card') in ('true', 'True', '1')
        rows = []
        for check_in, check_out, is_ongoing in sessions:
            anchor = check_in or check_out
            day = timezone.localdate(anchor.created_at)
            if (date_from and day < date_from) or (date_to and day > date_to):
                continue
            loan = getattr(check_in, 'card_loan_issued', None) if check_in else None
            if loan is None and check_out is not None:
                loan = getattr(check_out, 'card_loan_returned', None)
            if only_unreturned and not (loan and loan.returned_at is None):
                continue
            member = anchor.member
            duration = None
            if check_in and check_out:
                duration = max(int((check_out.created_at - check_in.created_at).total_seconds() // 60), 0)
            rows.append((anchor.created_at, {
                'id': str(anchor.id),
                'member': {'id': str(member.id), 'name': member.name, 'company_name': member.company_name},
                'check_in': _log_brief(check_in),
                'check_out': _log_brief(check_out),
                'duration_minutes': duration,
                'status': _session_status(check_in, check_out, is_ongoing),
                'security_card_number': loan.security_card.card_number if loan else None,
                'security_card_returned': (loan.returned_at is not None) if loan else None,
            }))
        rows.sort(key=lambda row: row[0], reverse=True)

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset([row for _, row in rows], request, view=self)
        return paginator.get_paginated_response(page)


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
