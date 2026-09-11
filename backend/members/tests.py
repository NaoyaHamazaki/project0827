from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Staff
from access.models import AccessLog

from .models import Member, Plan
from .usage import calculate_usage


class MemberApiTests(APITestCase):
    def setUp(self):
        self.operator = Staff.objects.create_user(
            username='op', email='op@example.com', password='pass12345',
            role=Staff.Role.USER,
        )
        self.admin = Staff.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Staff.Role.ADMIN,
        )
        Member.objects.create(name='山田太郎', company_name='A社', card_identifier='C1')
        Member.objects.create(name='佐藤花子', company_name='B社', card_identifier='C2')

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
        self.operator = Staff.objects.create_user(
            username='op', email='op@example.com', password='pass12345',
            role=Staff.Role.USER,
        )
        self.admin = Staff.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Staff.Role.ADMIN,
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
        self.admin = Staff.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Staff.Role.ADMIN,
        )
        self.plan = Plan.objects.create(name='ライトプラン', monthly_hour_limit=10)
        self.member = Member.objects.create(
            name='テスト太郎', company_name='テスト社', card_identifier='U1', plan=self.plan,
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
            name='上限なし太郎', company_name='テスト社', card_identifier='U2',
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
