from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from tenants.testing import make_company
from access.models import AccessLog

from .models import Member, MemberInvite, Plan
from .usage import calculate_usage


class MemberApiTests(APITestCase):
    def setUp(self):
        self.operator = Account.objects.create_user(
            username='op', email='op@example.com', password='pass12345',
            role=Account.Role.USER,
        )
        self.admin = Account.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Account.Role.ADMIN,
        )
        Member.objects.create(name='山田太郎', company=make_company('A社'), card_identifier='C1')
        Member.objects.create(name='佐藤花子', company=make_company('B社'), card_identifier='C2')

    def test_operator_cannot_list_members(self):
        self.client.force_authenticate(self.operator)
        response = self.client.get(reverse('member-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_search_members(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse('member-list'), {'q': '山田'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_admin_can_create_member(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('member-list'), {
            'name': '新規太郎', 'company_name': 'C社', 'card_identifier': 'C3',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Member.objects.count(), 3)


class PlanApiTests(APITestCase):
    def setUp(self):
        self.operator = Account.objects.create_user(
            username='op', email='op@example.com', password='pass12345',
            role=Account.Role.USER,
        )
        self.admin = Account.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Account.Role.ADMIN,
        )

    def test_operator_cannot_create_plan(self):
        self.client.force_authenticate(self.operator)
        response = self.client.post(reverse('plan-list'), {'name': 'ライトプラン', 'monthly_hour_limit': 10})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_and_list_plans(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('plan-list'), {'name': 'ライトプラン', 'monthly_hour_limit': 10})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.get(reverse('plan-list'))
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'ライトプラン')

    def test_member_can_be_assigned_a_plan(self):
        self.client.force_authenticate(self.admin)
        plan = Plan.objects.create(name='フリープラン', monthly_hour_limit=None)
        response = self.client.post(reverse('member-list'), {
            'name': '新規太郎', 'company_name': 'C社', 'card_identifier': 'C3', 'plan': plan.id,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['plan_detail']['name'], 'フリープラン')


class CalculateUsageTests(APITestCase):
    def setUp(self):
        self.admin = Account.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Account.Role.ADMIN,
        )
        self.plan = Plan.objects.create(name='ライトプラン', monthly_hour_limit=10)
        self.member = Member.objects.create(
            name='テスト太郎', company=make_company('テスト社'), card_identifier='U1', plan=self.plan,
        )

    def _log(self, log_type, when):
        log = AccessLog.objects.create(member=self.member, type=log_type, scanned_by=self.admin)
        AccessLog.objects.filter(pk=log.pk).update(created_at=when)
        return AccessLog.objects.get(pk=log.pk)

    def test_completed_session_within_month_is_counted(self):
        now = timezone.localtime(timezone.now()).replace(day=10, hour=10, minute=0, second=0, microsecond=0)
        self._log(AccessLog.LogType.CHECK_IN, now)
        self._log(AccessLog.LogType.CHECK_OUT, now + timedelta(hours=2))

        usage = calculate_usage(self.member, year=now.year, month=now.month)
        self.assertEqual(usage['visit_count'], 1)
        self.assertEqual(usage['used_hours'], 2.0)
        self.assertEqual(usage['limit_hours'], 10)
        self.assertEqual(usage['remaining_hours'], 8.0)
        self.assertEqual(usage['plan_name'], 'ライトプラン')
        self.assertFalse(usage['sessions'][0]['is_ongoing'])

    def test_ongoing_session_is_counted_up_to_now(self):
        # 月初の深夜に実行されると「1時間前」が前月に飛ぶため、月半ばの固定時刻を基準にする
        now = timezone.localtime(timezone.now()).replace(day=15, hour=10, minute=0, second=0, microsecond=0)
        checkin_time = now - timedelta(hours=1)
        self._log(AccessLog.LogType.CHECK_IN, checkin_time)

        with patch('members.usage.timezone.now', return_value=checkin_time + timedelta(hours=1)):
            usage = calculate_usage(self.member, year=now.year, month=now.month)
        self.assertEqual(usage['visit_count'], 1)
        self.assertTrue(usage['sessions'][0]['is_ongoing'])
        self.assertGreater(usage['used_hours'], 0)

    def test_session_from_other_month_is_excluded(self):
        now = timezone.localtime(timezone.now())
        last_month = (now.replace(day=1) - timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        self._log(AccessLog.LogType.CHECK_IN, last_month)
        self._log(AccessLog.LogType.CHECK_OUT, last_month + timedelta(hours=3))

        usage = calculate_usage(self.member, year=now.year, month=now.month)
        self.assertEqual(usage['visit_count'], 0)
        self.assertEqual(usage['used_hours'], 0.0)

    def test_member_without_plan_has_no_limit(self):
        member = Member.objects.create(
            name='上限なし太郎', company=make_company('テスト社'), card_identifier='U2',
        )
        usage = calculate_usage(member)
        self.assertIsNone(usage['limit_hours'])
        self.assertIsNone(usage['remaining_hours'])
        self.assertIsNone(usage['plan_name'])

    def test_member_usage_action_returns_summary(self):
        self.client.force_authenticate(self.admin)
        now = timezone.localtime(timezone.now()).replace(day=5, hour=9, minute=0, second=0, microsecond=0)
        self._log(AccessLog.LogType.CHECK_IN, now)
        self._log(AccessLog.LogType.CHECK_OUT, now + timedelta(hours=1, minutes=30))

        response = self.client.get(
            reverse('member-usage', args=[self.member.pk]), {'year': now.year, 'month': now.month},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['visit_count'], 1)
        self.assertEqual(response.data['used_hours'], 1.5)


class MemberRegistrationTests(APITestCase):
    def setUp(self):
        self.admin = Account.objects.create_user(
            username='reg-admin', email='reg-admin@example.com', password='pass12345',
            role=Account.Role.ADMIN,
        )
        self.user = Account.objects.create_user(
            username='reg-user', email='reg-user@example.com', password='pass12345',
            role=Account.Role.USER,
        )

    def test_admin_can_register_member_with_login(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(reverse('member-admin-register'), {
            'name': '新規太郎', 'company_name': 'C社', 'email': 'new-taro@example.com',
            'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 201, r.data)
        member = Member.objects.get(name='新規太郎')
        account = Account.objects.get(email='new-taro@example.com')
        self.assertEqual(account.member, member)
        self.assertTrue(account.check_password('a-strong-pass-999'))
        # 新しい所属の最初の会員は代表になる
        self.assertEqual(account.role, Account.Role.REPRESENTATIVE)
        self.assertTrue(member.is_representative)
        self.assertEqual(member.company.name, 'C社')
        self.assertTrue(member.member_code.startswith('M'))

    def test_second_member_of_same_company_is_regular_user(self):
        self.client.force_authenticate(self.admin)
        for name, email in [('代表', 'rep@example.com'), ('一般', 'general@example.com')]:
            r = self.client.post(reverse('member-admin-register'), {
                'name': name, 'company_name': 'D社', 'email': email, 'password': 'a-strong-pass-999',
            })
            self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Account.objects.get(email='general@example.com').role, Account.Role.USER)
        self.assertFalse(Member.objects.get(name='一般').is_representative)

    def test_non_admin_cannot_register_member(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(reverse('member-admin-register'), {
            'name': 'x', 'email': 'blocked@example.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 403)

    def test_duplicate_email_rejected(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(reverse('member-admin-register'), {
            'name': 'x', 'email': self.user.email, 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 400)


class MemberInviteTests(APITestCase):
    def setUp(self):
        self.admin = Account.objects.create_user(
            username='inv-admin', email='inv-admin@example.com', password='pass12345',
            role=Account.Role.ADMIN,
        )
        self.user = Account.objects.create_user(
            username='inv-user', email='inv-user@example.com', password='pass12345',
            role=Account.Role.USER,
        )

    def test_non_admin_cannot_create_invite(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(reverse('member-invite-create'))
        self.assertEqual(r.status_code, 403)

    def test_admin_can_create_invite_and_anyone_can_check_status(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(reverse('member-invite-create'))
        self.assertEqual(r.status_code, 201, r.data)
        token = r.data['token']

        self.client.force_authenticate(None)
        r = self.client.get(reverse('member-invite-status', args=[token]))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['valid'])

    def test_self_register_with_valid_token_creates_member_and_marks_used(self):
        invite = MemberInvite.objects.create(created_by=self.admin)
        r = self.client.post(reverse('member-invite-register', args=[invite.token]), {
            'name': '自己登録太郎', 'email': 'self-taro@example.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 201, r.data)
        invite.refresh_from_db()
        self.assertIsNotNone(invite.used_at)
        self.assertEqual(invite.created_member.name, '自己登録太郎')

    def test_self_register_with_used_token_rejected(self):
        invite = MemberInvite.objects.create(created_by=self.admin, used_at=timezone.now())
        r = self.client.post(reverse('member-invite-register', args=[invite.token]), {
            'name': 'x', 'email': 'blocked2@example.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 410)

    def test_self_register_with_expired_token_rejected(self):
        invite = MemberInvite.objects.create(
            created_by=self.admin, expires_at=timezone.now() - timedelta(hours=1),
        )
        r = self.client.post(reverse('member-invite-register', args=[invite.token]), {
            'name': 'x', 'email': 'blocked3@example.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 410)

    def test_self_register_without_card_identifier_autogenerates_one(self):
        invite = MemberInvite.objects.create(created_by=self.admin)
        r = self.client.post(reverse('member-invite-register', args=[invite.token]), {
            'name': '自動カード太郎', 'email': 'auto-card@example.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 201, r.data)
        member = Member.objects.get(name='自動カード太郎')
        self.assertTrue(member.card_identifier.startswith('SELF-'))

    def test_token_cannot_be_reused(self):
        invite = MemberInvite.objects.create(created_by=self.admin)
        r1 = self.client.post(reverse('member-invite-register', args=[invite.token]), {
            'name': '一人目', 'email': 'first@example.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r1.status_code, 201, r1.data)
        r2 = self.client.post(reverse('member-invite-register', args=[invite.token]), {
            'name': '二人目', 'email': 'second@example.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r2.status_code, 410)
