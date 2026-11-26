from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Account
from cards.models import CardLoan, SecurityCard
from members.models import Member
from tenants.models import Site
from tenants.testing import make_company

from .models import AccessLog


class SessionHistoryAndForceCheckoutTests(APITestCase):
    """過去の入退室履歴（入室と退室の組）と、管理者による退室扱い"""

    def setUp(self):
        self.site = Site.objects.create(name='中野')
        self.other_site = Site.objects.create(name='新宿')
        self.admin = Account.objects.create_user(
            username='sa', email='sa@example.com', password='pass12345', role=Account.Role.ADMIN, site=self.site,
            first_name='受付',
        )
        self.member = Member.objects.create(
            name='来館太郎', site=self.site, company=make_company('A社', self.site), card_identifier='S1',
        )
        self.other = Member.objects.create(
            name='別所管花子', site=self.other_site, company=make_company('B社', self.other_site), card_identifier='S2',
        )
        self.client.force_authenticate(self.admin)

    def _log(self, member, log_type, at):
        log = AccessLog.objects.create(member=member, type=log_type, scanned_by=self.admin)
        AccessLog.objects.filter(pk=log.pk).update(created_at=at)
        return AccessLog.objects.get(pk=log.pk)

    def test_sessions_pair_check_in_and_out(self):
        base = timezone.now() - timedelta(days=2)
        self._log(self.member, AccessLog.LogType.CHECK_IN, base)
        self._log(self.member, AccessLog.LogType.CHECK_OUT, base + timedelta(hours=3, minutes=30))
        self._log(self.member, AccessLog.LogType.CHECK_IN, base + timedelta(days=1))  # 退室なしで次の入室
        self._log(self.member, AccessLog.LogType.CHECK_IN, base + timedelta(days=1, hours=20))  # 在室中
        rows = self.client.get(reverse('logs-sessions')).data['results']
        self.assertEqual([r['status'] for r in rows], ['ongoing', 'missing_check_out', 'complete'])
        self.assertEqual(rows[2]['duration_minutes'], 210)
        self.assertEqual(rows[2]['check_in']['staff'], '受付')

    def test_sessions_scoped_to_admin_site_and_filters(self):
        now = timezone.now() - timedelta(hours=5)
        self._log(self.member, AccessLog.LogType.CHECK_IN, now)
        self._log(self.other, AccessLog.LogType.CHECK_IN, now)
        names = [r['member']['name'] for r in self.client.get(reverse('logs-sessions')).data['results']]
        self.assertEqual(names, ['来館太郎'])
        old = timezone.localdate() - timedelta(days=10)
        r = self.client.get(reverse('logs-sessions'), {'date_to': old.isoformat()})
        self.assertEqual(r.data['count'], 0)

    def test_manual_check_out_returns_loaned_card(self):
        check_in = self._log(self.member, AccessLog.LogType.CHECK_IN, timezone.now() - timedelta(hours=30))
        card = SecurityCard.objects.create(card_number='C-01', status=SecurityCard.Status.LOANED)
        loan = CardLoan.objects.create(member=self.member, security_card=card, access_log_in=check_in)
        CardLoan.objects.filter(pk=loan.pk).update(issued_at=check_in.created_at)
        occupants = self.client.get(reverse('logs-current')).data
        self.assertEqual(occupants[0]['security_card_number'], 'C-01')

        out_at = timezone.now() - timedelta(hours=20)
        r = self.client.post(reverse('logs-manual-create'), {
            'member': str(self.member.pk), 'type': 'check_out', 'timestamp': out_at.isoformat(),
        })
        self.assertEqual(r.status_code, 201)
        loan.refresh_from_db()
        card.refresh_from_db()
        self.assertIsNotNone(loan.returned_at)
        self.assertEqual(card.status, SecurityCard.Status.AVAILABLE)
        self.assertEqual(self.client.get(reverse('logs-current')).data, [])

    def test_manual_log_rejects_future_time(self):
        r = self.client.post(reverse('logs-manual-create'), {
            'member': str(self.member.pk), 'type': 'check_out',
            'timestamp': (timezone.now() + timedelta(hours=2)).isoformat(),
        })
        self.assertEqual(r.status_code, 400)
