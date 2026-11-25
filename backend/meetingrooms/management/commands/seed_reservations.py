"""デモ用：今日から1週間分の会議室予約を、それっぽく投入する。

    python manage.py seed_reservations            # 今日から7日間、全体で5割前後（平日6割・土日少なめ）埋める
    python manage.py seed_reservations --replace  # 以前このコマンドで入れた予約を消してから入れ直す
    python manage.py seed_reservations --days 14 --fill 0.6

- 対象は 9:00〜18:00、予約可能な会議室すべて。既存の予約と重なる時間には入れない
- 予約者は seed_demo で作るデモアカウント（管理者・代表・ユーザー）からランダムに選ぶ
- 備考は DEMO_NOTES のどれか。--replace はこの備考とデモアカウントの組み合わせだけを消す
"""

import random
from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Account
from meetingrooms.models import MeetingRoom, Reservation

DAY_START_HOUR = 9
DAY_END_HOUR = 18
DEMO_EMAILS = [
    'operator@example.com', 'user@example.com', 'rep2@example.com', 'admin@example.com', 'admin2@example.com',
]
DEMO_NOTES = [
    '定例ミーティング', '商談', '来客対応', '面接', '1on1', '社内研修', 'オンライン会議', '打ち合わせ',
    'プロジェクト進捗確認', '採用説明会', '勉強会', '取材対応',
]
# 予約の長さ（時間）と出やすさ
DURATION_WEIGHTS = [(1, 5), (2, 3), (3, 1)]
WEEKEND_FILL_RATIO = 0.4  # 土日は平日の4割程度


class Command(BaseCommand):
    help = '今日から指定日数分の会議室予約デモデータを投入する（9:00〜18:00 の枠を指定割合くらい埋める）'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=7, help='今日から何日分か（既定 7）')
        parser.add_argument('--fill', type=float, default=0.6, help='平日に埋める割合 0〜1（既定 0.6。土日込みで全体5割前後になる）')
        parser.add_argument('--replace', action='store_true', help='以前このコマンドで入れた予約を消してから入れる')
        parser.add_argument('--seed', type=int, default=None, help='乱数の種（同じ値なら同じ結果）')

    def handle(self, *args, days, fill, replace, seed, **options):
        if not 0 < fill <= 1:
            raise CommandError('--fill は 0 より大きく 1 以下で指定してください')
        rng = random.Random(seed)
        rooms = list(MeetingRoom.objects.filter(is_bookable=True))
        people = list(Account.objects.filter(email__in=DEMO_EMAILS))
        if not rooms:
            raise CommandError('予約可能な会議室がありません（先に seed_demo を実行してください）')
        if not people:
            raise CommandError('デモアカウントがありません（先に seed_demo を実行してください）')

        today = timezone.localdate()
        range_start = timezone.make_aware(datetime.combine(today, time.min))
        range_end = range_start + timedelta(days=days)
        now = timezone.now()

        with transaction.atomic():
            if replace:
                deleted, _ = Reservation.objects.filter(
                    requested_by__in=people, note__in=DEMO_NOTES,
                    start_at__gte=range_start, start_at__lt=range_end,
                ).delete()
                self.stdout.write(f'以前のデモ予約を {deleted} 件削除しました')

            created = 0
            filled_hours = 0
            total_hours = 0
            for offset in range(days):
                day = today + timedelta(days=offset)
                ratio = fill * (WEEKEND_FILL_RATIO if day.weekday() >= 5 else 1)
                for room in rooms:
                    hours = DAY_END_HOUR - DAY_START_HOUR
                    total_hours += hours
                    busy = self._busy_hours(room, day)
                    target = round(hours * ratio * rng.uniform(0.75, 1.25))
                    attempts = 0
                    while len(busy) < target and attempts < 40:
                        attempts += 1
                        length = rng.choices(
                            [d for d, _ in DURATION_WEIGHTS], weights=[w for _, w in DURATION_WEIGHTS],
                        )[0]
                        start_hour = rng.randint(DAY_START_HOUR, DAY_END_HOUR - length)
                        slot = set(range(start_hour, start_hour + length))
                        if slot & busy:
                            continue
                        start_at = timezone.make_aware(datetime.combine(day, time(start_hour)))
                        end_at = start_at + timedelta(hours=length)
                        if end_at <= now:
                            busy |= slot  # 過ぎた時間は埋めない（埋まった扱いにしてループを終わらせる）
                            continue
                        Reservation.objects.create(
                            room=room, start_at=start_at, end_at=end_at,
                            note=rng.choice(DEMO_NOTES), requested_by=rng.choice(people),
                        )
                        busy |= slot
                        created += 1
                    filled_hours += len(self._busy_hours(room, day))

        rate = filled_hours / total_hours * 100 if total_hours else 0
        self.stdout.write(self.style.SUCCESS(
            f'予約を {created} 件作成しました（{today}〜{today + timedelta(days=days - 1)}、'
            f'{DAY_START_HOUR}:00〜{DAY_END_HOUR}:00 の埋まり具合 約{rate:.0f}%）'
        ))

    def _busy_hours(self, room, day):
        """その日・その会議室で、9〜18時のうち予約が入っている時（hour）の集合"""
        busy = set()
        day_start = timezone.make_aware(datetime.combine(day, time.min))
        for r in Reservation.objects.filter(
            room=room, status=Reservation.Status.CONFIRMED,
            start_at__lt=day_start + timedelta(days=1), end_at__gt=day_start,
        ):
            start = timezone.localtime(r.start_at)
            end = timezone.localtime(r.end_at)
            for hour in range(DAY_START_HOUR, DAY_END_HOUR):
                slot_start = day_start + timedelta(hours=hour)
                if start < slot_start + timedelta(hours=1) and end > slot_start:
                    busy.add(hour)
        return busy
