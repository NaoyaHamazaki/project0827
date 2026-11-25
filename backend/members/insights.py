"""運営者向けの利用状況（会員管理 → 利用状況 画面）。

指定した月について、次の5つをまとめて返す。
- usage_ranking : 会員ごとの月の利用時間と、プラン上限に対する割合（上限に近い会員の把握）
- busy_heatmap  : 曜日×時間帯ごとの入室数（混み具合）
- room_utilization : 会議室ごとの稼働率（9:00〜18:00 を営業時間とみなす）
- menu_ranking  : メニューごとの注文数（取消を除く）
- signups       : 直近12か月の新規会員数

集計範囲：管理者は自分の所管、マスターは全所管（?site=<id> で1所管に絞れる）。
会議室・メニューはまだ所管にひも付いていないため、予約者・注文者の所管で絞り込む。
"""

from calendar import monthrange
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from access.models import AccessLog
from meetingrooms.models import MeetingRoom, Reservation
from orders.models import Order, OrderLine

from .models import Member

OPEN_HOUR = 9
CLOSE_HOUR = 18
NEAR_LIMIT_RATIO = 0.8
RANKING_SIZE = 10
SIGNUP_MONTHS = 12


def _month_range(year, month):
    start = timezone.make_aware(datetime(year, month, 1))
    end = timezone.make_aware(datetime(year, month, monthrange(year, month)[1]) + timedelta(days=1))
    return start, end


def _usage_ranking(members, start, end, now):
    """check_in が対象月にあるセッションの合計時間（members/usage.py と同じ数え方）"""
    hours = defaultdict(float)
    visits = Counter()
    pending = {}
    logs = (
        AccessLog.objects.filter(member__in=members, created_at__gte=start, created_at__lt=end + timedelta(days=7))
        .order_by('member_id', 'created_at')
        .values_list('member_id', 'type', 'created_at')
    )
    for member_id, log_type, created_at in logs:
        if log_type == AccessLog.LogType.CHECK_IN:
            pending[member_id] = created_at if created_at < end else None
        elif member_id in pending:
            check_in = pending.pop(member_id)
            if check_in is not None:
                hours[member_id] += max((created_at - check_in).total_seconds(), 0) / 3600
                visits[member_id] += 1
    for member_id, check_in in pending.items():  # 在室中のセッションは現在時刻までで数える
        if check_in is not None:
            hours[member_id] += max((min(now, end) - check_in).total_seconds(), 0) / 3600
            visits[member_id] += 1

    rows = []
    for member in members.select_related('company', 'plan'):
        used = round(hours.get(member.id, 0.0), 1)
        limit = member.plan.monthly_hour_limit if member.plan else None
        ratio = round(used / limit, 3) if limit else None
        rows.append({
            'member_id': str(member.id),
            'name': member.name,
            'company': member.company.name if member.company_id else '',
            'plan': member.plan.name if member.plan else None,
            'used_hours': used,
            'limit_hours': limit,
            'ratio': ratio,
            'visits': visits.get(member.id, 0),
            'near_limit': ratio is not None and ratio >= NEAR_LIMIT_RATIO,
        })
    total_hours = round(sum(r['used_hours'] for r in rows), 1)
    total_visits = sum(r['visits'] for r in rows)
    near_limit = sorted((r for r in rows if r['near_limit']), key=lambda r: -r['ratio'])
    top = sorted((r for r in rows if r['used_hours'] > 0), key=lambda r: -r['used_hours'])[:RANKING_SIZE]
    return {'total_hours': total_hours, 'total_visits': total_visits, 'top': top, 'near_limit': near_limit}


def _busy_heatmap(members, start, end):
    """曜日（月=0〜日=6）× 時（0〜23）ごとの入室数"""
    grid = [[0] * 24 for _ in range(7)]
    for created_at in AccessLog.objects.filter(
        member__in=members, type=AccessLog.LogType.CHECK_IN, created_at__gte=start, created_at__lt=end,
    ).values_list('created_at', flat=True):
        local = timezone.localtime(created_at)
        grid[local.weekday()][local.hour] += 1
    return {'counts': grid, 'max': max(max(row) for row in grid)}


def _room_utilization(account_filter, start, end):
    days = (end - start).days
    open_hours = (CLOSE_HOUR - OPEN_HOUR) * days
    booked = defaultdict(float)
    reservations = Reservation.objects.filter(
        status=Reservation.Status.CONFIRMED, start_at__lt=end, end_at__gt=start, **account_filter,
    ).values_list('room_id', 'start_at', 'end_at')
    for room_id, start_at, end_at in reservations:
        # 営業時間（9〜18時）に重なる部分だけを数える
        day = timezone.localtime(max(start_at, start)).date()
        last = timezone.localtime(min(end_at, end) - timedelta(microseconds=1)).date()
        while day <= last:
            open_at = timezone.make_aware(datetime.combine(day, time(OPEN_HOUR)))
            close_at = timezone.make_aware(datetime.combine(day, time(CLOSE_HOUR)))
            overlap = (min(end_at, close_at) - max(start_at, open_at)).total_seconds()
            if overlap > 0:
                booked[room_id] += overlap / 3600
            day += timedelta(days=1)
    rooms = []
    for room in MeetingRoom.objects.all():
        hours = round(booked.get(room.id, 0.0), 1)
        rooms.append({
            'room_id': room.id, 'name': room.name, 'booked_hours': hours,
            'rate': round(hours / open_hours, 3) if open_hours else 0,
        })
    total_booked = sum(r['booked_hours'] for r in rooms)
    total_open = open_hours * len(rooms)
    return {
        'open_hours_per_room': open_hours,
        'rooms': rooms,
        'overall_rate': round(total_booked / total_open, 3) if total_open else 0,
    }


def _menu_ranking(account_filter, start, end):
    lines = (
        OrderLine.objects.filter(
            order__created_at__gte=start, order__created_at__lt=end,
            **{f'order__{k}': v for k, v in account_filter.items()},
        )
        .exclude(order__status=Order.Status.CANCELLED)
        .values('menu_item__name')
        .annotate(quantity=Sum('quantity'), orders=Count('order', distinct=True))
        .order_by('-quantity', 'menu_item__name')
    )
    order_count = Order.objects.filter(
        created_at__gte=start, created_at__lt=end, **account_filter,
    ).exclude(status=Order.Status.CANCELLED).count()
    return {
        'order_count': order_count,
        'items': [{'name': l['menu_item__name'], 'quantity': l['quantity'], 'orders': l['orders']} for l in lines],
    }


def _signups(members, year, month):
    first = datetime(year, month, 1)
    months = []
    for i in range(SIGNUP_MONTHS - 1, -1, -1):
        y, m = first.year, first.month - i
        while m <= 0:
            y, m = y - 1, m + 12
        months.append((y, m))
    since = timezone.make_aware(datetime(*months[0], 1))
    counts = {
        (row['month'].year, row['month'].month): row['count']
        for row in members.filter(created_at__gte=since, created_at__lt=_month_range(year, month)[1])
        .annotate(month=TruncMonth('created_at')).values('month').annotate(count=Count('id'))
    }
    return [{'year': y, 'month': m, 'count': counts.get((y, m), 0)} for y, m in months]


def build_insights(site_id, year, month):
    """site_id=None なら全所管"""
    start, end = _month_range(year, month)
    now = timezone.now()
    members = Member.objects.all()
    account_filter = {}
    if site_id:
        members = members.filter(site_id=site_id)
        account_filter = {'requested_by__site_id': site_id}
    return {
        'year': year,
        'month': month,
        'near_limit_ratio': NEAR_LIMIT_RATIO,
        'usage': _usage_ranking(members, start, end, now),
        'busy_heatmap': _busy_heatmap(members, start, end),
        'room_utilization': _room_utilization(account_filter, start, end),
        'menu_ranking': _menu_ranking(account_filter, start, end),
        'signups': _signups(members, year, month),
        'active_members': members.filter(status=Member.Status.ACTIVE).count(),
    }
