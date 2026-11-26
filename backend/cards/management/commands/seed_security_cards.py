"""デモ用：セキュリティカードと貸出記録を投入する（台帳・在室者一覧・過去の入退室履歴の見栄え用）。

    python manage.py seed_security_cards            # seed_demo → seed_access_logs の後に実行する
    python manage.py seed_security_cards --seed 1

- カード SC-001〜SC-020 を登録する（SC-019＝紛失、SC-020＝廃止）
- 在室中の会員を4名作る（今朝×2、前日朝＝12時間超の注意、2日前＝24時間超の要確認）。各自カード貸出中
  ※その会員の入室時刻より後のデモ記録は削除する
- 過去の来館（入室と退室の組）のうち約7割にカードの貸出・返却を付ける。同じ時間帯に同じカードは貸さない
- 直近の来館1件を「退室したがカード未返却」にし、そのカード（SC-019）を紛失扱いにする
- 担当スタッフが空の記録には、会員の所管の管理者を入れる。数件を手動入力（打刻漏れの補正）にする
- 何度実行してもよい（カード貸出がまだない来館にだけ付け、在室中の会員がいれば在室者は作らない）
"""

import random
from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from access.models import AccessLog
from accounts.models import Account
from cards.models import CardLoan, SecurityCard
from members.models import Member

CARD_COUNT = 20
LOST_CARD = 'SC-019'
RETIRED_CARD = 'SC-020'
LOAN_RATIO = 0.7
MANUAL_COUNT = 3
# 在室中の会員：(何日前, 入室の時, 分)
ONGOING = [(0, 9, 12), (0, 10, 41), (1, 9, 30), (2, 9, 5)]


class Command(BaseCommand):
    help = 'セキュリティカードと貸出記録のデモデータを投入する（seed_access_logs の後に実行）'

    def add_arguments(self, parser):
        parser.add_argument('--seed', type=int, default=None, help='乱数の種（同じ値なら同じ結果）')

    def handle(self, *args, seed, **options):
        self.rng = random.Random(seed)
        self.admins = {}
        for account in Account.objects.filter(role=Account.Role.ADMIN).order_by('date_joined'):
            self.admins.setdefault(account.site_id, account)
        with transaction.atomic():
            cards = self._cards()
            self._fill_staff()
            ongoing = self._ongoing(cards)
            lost = self._unreturned(cards)
            past = self._past_loans(cards)
        self.stdout.write(self.style.SUCCESS(
            f'カード {len(cards)} 枚、在室中 {ongoing} 名、過去の貸出 {past} 件、未返却（紛失） {lost} 件を投入しました'
        ))

    def _staff(self, member):
        return self.admins.get(member.site_id) or next(iter(self.admins.values()), None)

    def _cards(self):
        cards = {}
        for i in range(1, CARD_COUNT + 1):
            card, _ = SecurityCard.objects.get_or_create(card_number=f'SC-{i:03d}')
            cards[card.card_number] = card
        retired = cards[RETIRED_CARD]
        if retired.status != SecurityCard.Status.RETIRED and not retired.loans.exists():
            retired.status = SecurityCard.Status.RETIRED
            retired.save(update_fields=['status'])
        return cards

    def _fill_staff(self):
        logs = list(AccessLog.objects.filter(scanned_by__isnull=True).select_related('member'))
        for log in logs:
            log.scanned_by = self._staff(log.member)
        AccessLog.objects.bulk_update(logs, ['scanned_by'], batch_size=500)
        if not AccessLog.objects.filter(method=AccessLog.Method.MANUAL).exists():
            outs = list(AccessLog.objects.filter(type=AccessLog.LogType.CHECK_OUT).order_by('-created_at')[:60])
            for log in self.rng.sample(outs, min(MANUAL_COUNT, len(outs))):
                log.method = AccessLog.Method.MANUAL
                log.save(update_fields=['method'])

    def _new_log(self, member, log_type, at, method=AccessLog.Method.CARD):
        log = AccessLog.objects.create(member=member, type=log_type, method=method, scanned_by=self._staff(member))
        AccessLog.objects.filter(pk=log.pk).update(created_at=at)  # auto_now_add の上書き
        log.created_at = at
        return log

    def _new_loan(self, member, card, check_in, issued_at, check_out=None, returned_at=None):
        staff = self._staff(member)
        loan = CardLoan.objects.create(
            member=member, security_card=card, access_log_in=check_in, access_log_out=check_out,
            issued_by=staff, returned_at=returned_at, returned_by=staff if returned_at else None,
        )
        CardLoan.objects.filter(pk=loan.pk).update(issued_at=issued_at)  # auto_now_add の上書き
        return loan

    def _ongoing(self, cards):
        if SecurityCard.objects.filter(status=SecurityCard.Status.LOANED).exists():
            self.stdout.write('貸出中のカードがあるため、在室者は作りませんでした')
            return 0
        members = list(Member.objects.filter(status=Member.Status.ACTIVE).order_by('member_code'))
        self.rng.shuffle(members)
        free = [c for n, c in sorted(cards.items())
                if c.status == SecurityCard.Status.AVAILABLE and n not in (LOST_CARD, RETIRED_CARD)]
        today = timezone.localdate()
        created = 0
        for index, ((days_ago, hour, minute), member, card) in enumerate(zip(ONGOING, members, free)):
            at = timezone.make_aware(datetime.combine(today - timedelta(days=days_ago), time(hour, minute)))
            if at > timezone.now():  # まだその時刻になっていなければ、少し前に入室したことにする
                at = timezone.now() - timedelta(minutes=25 + 50 * index)
            removed, _ = AccessLog.objects.filter(member=member, created_at__gte=at).delete()
            last = member.access_logs.order_by('-created_at').first()
            if last and last.type == AccessLog.LogType.CHECK_IN:
                # 直前の来館が入室のままにならないよう、退室済みにしておく
                self._new_log(member, AccessLog.LogType.CHECK_OUT,
                              min(last.created_at + timedelta(hours=4), at - timedelta(minutes=1)), last.method)
            log = self._new_log(member, AccessLog.LogType.CHECK_IN, at)
            self._new_loan(member, card, log, at)
            card.status = SecurityCard.Status.LOANED
            card.save(update_fields=['status'])
            created += 1
            note = f'（以降の記録 {removed} 件を削除）' if removed else ''
            self.stdout.write(f'在室中: {member.name} {timezone.localtime(at):%m/%d %H:%M} 入室 / {card.card_number}{note}')
        return created

    def _sessions(self):
        """カード貸出がまだない、退室済みの来館（入室ログ, 退室ログ）を古い順に"""
        sessions, pending = [], {}
        for log in AccessLog.objects.select_related('member').order_by('member_id', 'created_at'):
            if log.type == AccessLog.LogType.CHECK_IN:
                pending[log.member_id] = log
            elif log.member_id in pending:
                sessions.append((pending.pop(log.member_id), log))
        used = set(CardLoan.objects.exclude(access_log_in=None).values_list('access_log_in_id', flat=True))
        used |= set(CardLoan.objects.exclude(access_log_out=None).values_list('access_log_out_id', flat=True))
        return sorted([(i, o) for i, o in sessions if i.pk not in used and o.pk not in used],
                      key=lambda s: s[0].created_at)

    def _unreturned(self, cards):
        lost = cards[LOST_CARD]
        if lost.loans.exists():
            return 0
        recent = [s for s in self._sessions() if s[1].created_at < timezone.now() - timedelta(days=1)]
        if not recent:
            return 0
        check_in, _ = recent[-1]
        self._new_loan(check_in.member, lost, check_in, check_in.created_at)
        lost.status = SecurityCard.Status.LOST
        lost.save(update_fields=['status'])
        self.stdout.write(
            f'未返却: {check_in.member.name} {timezone.localtime(check_in.created_at):%m/%d} 来館 / {LOST_CARD}（紛失扱い）'
        )
        return 1

    def _past_loans(self, cards):
        pool = [c for n, c in sorted(cards.items()) if n not in (LOST_CARD, RETIRED_CARD)]
        far_future = timezone.now() + timedelta(days=3650)
        busy = {}  # カード番号 → 使用中の期間の一覧
        for loan in CardLoan.objects.select_related('security_card'):
            busy.setdefault(loan.security_card.card_number, []).append((loan.issued_at, loan.returned_at or far_future))
        created = 0
        for check_in, check_out in self._sessions():
            # 貸す／貸さないは来館ごとに固定（再実行で貸さなかった来館に付け直さない）
            if random.Random(str(check_in.pk)).random() >= LOAN_RATIO:
                continue  # カードを貸さなかった来館
            start, end = check_in.created_at, check_out.created_at
            candidates = [c for c in pool if all(end <= s or start >= e for s, e in busy.get(c.card_number, []))]
            if not candidates:
                continue
            card = self.rng.choice(candidates[:6])  # 若い番号から使われがちにする
            self._new_loan(check_in.member, card, check_in, start, check_out, end)
            busy.setdefault(card.card_number, []).append((start, end))
            created += 1
        return created
