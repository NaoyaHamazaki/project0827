"""デモ用：過去の入退室記録を、それっぽく投入する（会員管理 → 利用状況 の見栄え用）。

    python manage.py seed_access_logs              # 過去60日分（今日の、まだ終わっていない時間は除く）
    python manage.py seed_access_logs --days 30 --seed 1

- 対象は有効な会員。会員ごとに「よく来る人」「たまに来る人」などの来館パターンを割り当てる
- 入室は朝9〜10時台と昼13時台が多め。退室は22時まで。すべて退室済みのセッションだけを作る
- 対象会員の最後の記録がある日までは入れない（同じ日に何度実行しても重複しない）
- デモの見栄えのため、会員の登録日より前の日にも入れる
- プランが未設定の会員には、デモ用プラン（ライト40h／スタンダード80h／フリー無制限）を割り当てる
"""

import random
from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from access.models import AccessLog
from members.models import Member, Plan

DEMO_PLANS = [('ライト', 40), ('スタンダード', 80), ('フリー', None)]
# 来館パターン：(平日に来る確率, 滞在時間の範囲[h], 割り当てるデモプラン名)
# ライト・スタンダードの人は、月の利用が上限の8〜10割前後になるように調整している
PROFILES = [
    (0.80, (5.0, 8.0), 'フリー'),
    (0.50, (3.5, 5.0), 'ライト'),
    (0.65, (4.0, 7.0), 'スタンダード'),
    (0.30, (2.0, 4.0), 'ライト'),
    (0.50, (3.0, 6.0), 'スタンダード'),
    (0.15, (1.0, 3.0), 'フリー'),
]
WEEKEND_RATIO = 0.2  # 土日に来る確率は平日の2割
ARRIVAL_WEIGHTS = {8: 1, 9: 5, 10: 4, 11: 2, 12: 1, 13: 3, 14: 2, 15: 1, 16: 1}
LAST_CHECK_OUT_HOUR = 22
METHOD_WEIGHTS = [(AccessLog.Method.CARD, 6), (AccessLog.Method.QR, 3), (AccessLog.Method.PIN, 1)]


class Command(BaseCommand):
    help = '過去の入退室記録のデモデータを投入する（有効な会員ごとに来館パターンを割り当てる）'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=60, help='今日から何日さかのぼるか（既定 60）')
        parser.add_argument('--seed', type=int, default=None, help='乱数の種（同じ値なら同じ結果）')

    def handle(self, *args, days, seed, **options):
        rng = random.Random(seed)
        now = timezone.now()
        today = timezone.localdate()
        members = list(Member.objects.filter(status=Member.Status.ACTIVE).select_related('plan').order_by('member_code'))
        if not members:
            self.stdout.write('有効な会員がいないため、何もしませんでした')
            return

        with transaction.atomic():
            plans = self._demo_plans()
            last = AccessLog.objects.filter(member__in=members).order_by('-created_at').first()
            last_day = timezone.localdate(last.created_at) if last else None
            assigned = 0
            logs = []
            for index, member in enumerate(members):
                probability, (min_hours, max_hours), plan_name = PROFILES[index % len(PROFILES)]
                if member.plan_id is None:
                    member.plan = plans[plan_name]
                    member.save(update_fields=['plan'])
                    assigned += 1
                for offset in range(days, -1, -1):
                    day = today - timedelta(days=offset)
                    if last_day and day <= last_day:
                        continue
                    chance = probability * (WEEKEND_RATIO if day.weekday() >= 5 else 1)
                    if rng.random() >= chance:
                        continue
                    hour = rng.choices(list(ARRIVAL_WEIGHTS), weights=list(ARRIVAL_WEIGHTS.values()))[0]
                    check_in = timezone.make_aware(datetime.combine(day, time(hour, rng.randint(0, 59))))
                    latest = timezone.make_aware(datetime.combine(day, time(LAST_CHECK_OUT_HOUR)))
                    check_out = min(check_in + timedelta(hours=rng.uniform(min_hours, max_hours)), latest)
                    if check_out > now or check_out <= check_in:
                        continue  # まだ終わっていない時間には入れない
                    method = rng.choices([m for m, _ in METHOD_WEIGHTS], weights=[w for _, w in METHOD_WEIGHTS])[0]
                    logs.append((AccessLog(member=member, type=AccessLog.LogType.CHECK_IN, method=method), check_in))
                    logs.append((AccessLog(member=member, type=AccessLog.LogType.CHECK_OUT, method=method), check_out))

            # created_at は auto_now_add のため、作成後に打刻日時を書き換える
            objects = AccessLog.objects.bulk_create([log for log, _ in logs])
            for obj, (_, at) in zip(objects, logs):
                obj.created_at = at
            AccessLog.objects.bulk_update(objects, ['created_at'], batch_size=500)

        self.stdout.write(self.style.SUCCESS(
            f'入退室記録を {len(logs) // 2} 回分（{len(logs)} 件）作成しました'
            f'（対象 {len(members)} 名、{today - timedelta(days=days)}〜{today}）'
        ))
        if assigned:
            self.stdout.write(f'プラン未設定の会員 {assigned} 名にデモ用プランを割り当てました')

    def _demo_plans(self):
        plans = {}
        for name, limit in DEMO_PLANS:
            plan = Plan.objects.filter(name=name).first()
            if plan is None:
                plan = Plan.objects.create(name=name, monthly_hour_limit=limit)
            plans[name] = plan
        return plans
