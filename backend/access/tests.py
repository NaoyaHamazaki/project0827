from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Staff
from members.models import Member, Plan

from .models import AccessLog
from .qr_token import generate_qr_token, resolve_qr_token


class ScanFlowTests(APITestCase):
    def setUp(self):
        self.operator = Staff.objects.create_user(
            username='op', email='op@example.com', password='pass12345',
            role=Staff.Role.USER,
        )
        self.admin = Staff.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Staff.Role.ADMIN,
        )
        self.member = Member.objects.create(
            name='テスト太郎', company_name='テスト株式会社', card_identifier='CARD001'
        )
        self.inactive_member = Member.objects.create(
            name='無効太郎', company_name='テスト株式会社', card_identifier='CARD002',
            status=Member.Status.INACTIVE,
        )

    def test_scan_toggles_check_in_then_check_out(self):
        self.client.force_authenticate(self.operator)

        response = self.client.post(reverse('scan'), {'card_identifier': 'CARD001'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['log']['type'], 'check_in')

        response = self.client.post(reverse('scan'), {'card_identifier': 'CARD001'})
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['log']['type'], 'check_out')

        self.assertEqual(AccessLog.objects.filter(member=self.member).count(), 2)

    def test_scan_unknown_card_returns_not_found(self):
        self.client.force_authenticate(self.operator)
        response = self.client.post(reverse('scan'), {'card_identifier': 'UNKNOWN'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['reason'], 'not_found')

    def test_scan_inactive_member_returns_inactive(self):
        self.client.force_authenticate(self.operator)
        response = self.client.post(reverse('scan'), {'card_identifier': 'CARD002'})
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['reason'], 'inactive')
        self.assertEqual(response.data['member']['name'], '無効太郎')

    def test_current_occupants_reflects_latest_check_in(self):
        self.client.force_authenticate(self.operator)
        self.client.post(reverse('scan'), {'card_identifier': 'CARD001'})

        response = self.client.get(reverse('logs-current'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'テスト太郎')

        self.client.post(reverse('scan'), {'card_identifier': 'CARD001'})
        response = self.client.get(reverse('logs-current'))
        self.assertEqual(len(response.data), 0)

    def test_logs_list_requires_admin(self):
        self.client.force_authenticate(self.operator)
        response = self.client.get(reverse('logs-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse('logs-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_export_requires_admin_and_returns_csv(self):
        self.client.force_authenticate(self.operator)
        response = self.client.get(reverse('logs-export'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        self.client.post(reverse('scan'), {'card_identifier': 'CARD001'})
        response = self.client.get(reverse('logs-export'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv; charset=utf-8')

    def test_scan_records_method(self):
        self.client.force_authenticate(self.operator)
        response = self.client.post(
            reverse('scan'), {'card_identifier': 'CARD001', 'method': 'pin'}
        )
        self.assertEqual(response.data['log']['method'], 'pin')
        log = AccessLog.objects.get(member=self.member)
        self.assertEqual(log.method, AccessLog.Method.PIN)

    def test_scan_without_method_defaults_to_card(self):
        self.client.force_authenticate(self.operator)
        self.client.post(reverse('scan'), {'card_identifier': 'CARD001'})
        log = AccessLog.objects.get(member=self.member)
        self.assertEqual(log.method, AccessLog.Method.CARD)

    def test_export_columns_param_limits_output_columns(self):
        self.client.force_authenticate(self.admin)
        self.client.post(reverse('scan'), {'card_identifier': 'CARD001', 'method': 'qr'})
        response = self.client.get(reverse('logs-export'), {'columns': 'member_name,method'})
        content = b''.join(response.streaming_content).decode('utf-8-sig')
        lines = content.strip().splitlines()
        self.assertEqual(lines[0], '会員名,入力方式')
        self.assertIn('テスト太郎,QRコード', lines[1])

    @patch('access.views.dispatch_webhooks')
    def test_scan_dispatches_webhook_event(self, mock_dispatch):
        self.client.force_authenticate(self.operator)
        self.client.post(reverse('scan'), {'card_identifier': 'CARD001'})
        self.assertTrue(mock_dispatch.called)
        event, payload = mock_dispatch.call_args[0]
        self.assertEqual(event, 'checkin')
        self.assertEqual(payload['member_name'], 'テスト太郎')

    def test_scan_response_includes_usage_summary(self):
        plan = Plan.objects.create(name='ライトプラン', monthly_hour_limit=10)
        self.member.plan = plan
        self.member.save()

        self.client.force_authenticate(self.operator)
        response = self.client.post(reverse('scan'), {'card_identifier': 'CARD001'})
        usage = response.data['usage']
        self.assertEqual(usage['visit_count'], 1)
        self.assertEqual(usage['limit_hours'], 10)
        self.assertEqual(usage['plan_name'], 'ライトプラン')
        self.assertIn('remaining_hours', usage)

    def test_scan_response_omits_usage_when_not_found(self):
        self.client.force_authenticate(self.operator)
        response = self.client.post(reverse('scan'), {'card_identifier': 'UNKNOWN'})
        self.assertNotIn('usage', response.data)

    def test_scan_accepts_valid_qr_token_in_place_of_raw_identifier(self):
        token = generate_qr_token('CARD001')
        self.client.force_authenticate(self.operator)
        response = self.client.post(reverse('scan'), {'card_identifier': token, 'method': 'qr'})
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['member']['name'], 'テスト太郎')

    def test_scan_rejects_garbage_token_as_not_found(self):
        self.client.force_authenticate(self.operator)
        response = self.client.post(reverse('scan'), {'card_identifier': 'not-a-real-token-or-card'})
        self.assertEqual(response.data['reason'], 'not_found')


class QrTokenViewTests(APITestCase):
    def setUp(self):
        self.member = Member.objects.create(
            name='テスト太郎', company_name='テスト株式会社', card_identifier='CARD001'
        )
        self.inactive_member = Member.objects.create(
            name='無効太郎', company_name='テスト株式会社', card_identifier='CARD002',
            status=Member.Status.INACTIVE,
        )

    def test_issues_token_without_authentication(self):
        response = self.client.post(reverse('qr-token'), {'card_identifier': 'CARD001'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)
        self.assertEqual(response.data['expires_in'], 300)

        original = resolve_qr_token(response.data['token'])
        self.assertEqual(original, 'CARD001')

    def test_rejects_inactive_or_unknown_member(self):
        response = self.client.post(reverse('qr-token'), {'card_identifier': 'CARD002'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = self.client.post(reverse('qr-token'), {'card_identifier': 'UNKNOWN'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_expired_token_is_rejected(self):
        token = generate_qr_token('CARD001')
        with patch('access.qr_token.QR_TOKEN_MAX_AGE_SECONDS', -1):
            self.assertIsNone(resolve_qr_token(token))


class AccessLogAdminManagementTests(APITestCase):
    def setUp(self):
        self.operator = Staff.objects.create_user(
            username='op', email='op@example.com', password='pass12345',
            role=Staff.Role.USER,
        )
        self.admin = Staff.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Staff.Role.ADMIN,
        )
        self.member = Member.objects.create(
            name='テスト太郎', company_name='テスト株式会社', card_identifier='CARD001'
        )
        self.log = AccessLog.objects.create(
            member=self.member, type=AccessLog.LogType.CHECK_IN, scanned_by=self.admin,
        )

    def test_delete_requires_admin(self):
        self.client.force_authenticate(self.operator)
        response = self.client.delete(reverse('logs-detail', args=[self.log.pk]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        response = self.client.delete(reverse('logs-detail', args=[self.log.pk]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AccessLog.objects.filter(pk=self.log.pk).exists())

    def test_manual_create_requires_admin(self):
        payload = {
            'member': str(self.member.pk),
            'type': 'check_in',
            'timestamp': timezone.now().isoformat(),
        }
        self.client.force_authenticate(self.operator)
        response = self.client.post(reverse('logs-manual-create'), payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manual_create_sets_requested_timestamp_and_method(self):
        custom_time = timezone.now().replace(microsecond=0) - timedelta(days=1)
        payload = {
            'member': str(self.member.pk),
            'type': 'check_out',
            'timestamp': custom_time.isoformat(),
        }
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('logs-manual-create'), payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['method'], 'manual')

        created = AccessLog.objects.get(pk=response.data['id'])
        self.assertEqual(created.created_at, custom_time)
        self.assertEqual(created.type, AccessLog.LogType.CHECK_OUT)
        self.assertEqual(created.method, AccessLog.Method.MANUAL)

    def test_edit_requires_admin(self):
        payload = {
            'member': str(self.member.pk),
            'type': 'check_out',
            'timestamp': timezone.now().isoformat(),
        }
        self.client.force_authenticate(self.operator)
        response = self.client.put(reverse('logs-detail', args=[self.log.pk]), payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_edit_updates_member_type_and_timestamp(self):
        other_member = Member.objects.create(
            name='別会員', company_name='別会社', card_identifier='CARD999',
        )
        custom_time = timezone.now().replace(microsecond=0) - timedelta(hours=3)
        payload = {
            'member': str(other_member.pk),
            'type': 'check_out',
            'timestamp': custom_time.isoformat(),
        }
        self.client.force_authenticate(self.admin)
        response = self.client.put(reverse('logs-detail', args=[self.log.pk]), payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.log.refresh_from_db()
        self.assertEqual(self.log.member, other_member)
        self.assertEqual(self.log.type, AccessLog.LogType.CHECK_OUT)
        self.assertEqual(self.log.created_at, custom_time)


class MyQrAndStatusViewTests(APITestCase):
    def setUp(self):
        self.member = Member.objects.create(
            name='テスト太郎', company_name='テスト株式会社', card_identifier='CARD001'
        )
        self.linked_user = Staff.objects.create_user(
            username='linked', email='linked@example.com', password='pass12345',
            role=Staff.Role.USER, member=self.member,
        )
        self.unlinked_user = Staff.objects.create_user(
            username='unlinked', email='unlinked@example.com', password='pass12345',
            role=Staff.Role.USER,
        )

    def test_my_qr_requires_linked_member(self):
        self.client.force_authenticate(self.unlinked_user)
        response = self.client.get(reverse('my-qr'))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_my_qr_returns_token_for_linked_member(self):
        self.client.force_authenticate(self.linked_user)
        response = self.client.get(reverse('my-qr'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['card_identifier'], 'CARD001')
        self.assertEqual(resolve_qr_token(response.data['token']), 'CARD001')

    def test_my_status_returns_latest_log_for_linked_member(self):
        self.client.force_authenticate(self.linked_user)
        response = self.client.get(reverse('my-status'))
        self.assertIsNone(response.data['log'])

        AccessLog.objects.create(member=self.member, type=AccessLog.LogType.CHECK_IN)
        response = self.client.get(reverse('my-status'))
        self.assertEqual(response.data['log']['type'], 'check_in')

    def test_my_status_returns_none_when_no_member_linked(self):
        self.client.force_authenticate(self.unlinked_user)
        response = self.client.get(reverse('my-status'))
        self.assertIsNone(response.data['log'])

    def test_my_history_requires_linked_member(self):
        self.client.force_authenticate(self.unlinked_user)
        response = self.client.get(reverse('my-history'))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_my_history_returns_paired_sessions_with_duration(self):
        now = timezone.localtime(timezone.now()).replace(day=10, hour=9, minute=0, second=0, microsecond=0)
        check_in = AccessLog.objects.create(member=self.member, type=AccessLog.LogType.CHECK_IN)
        AccessLog.objects.filter(pk=check_in.pk).update(created_at=now)
        check_out = AccessLog.objects.create(member=self.member, type=AccessLog.LogType.CHECK_OUT)
        AccessLog.objects.filter(pk=check_out.pk).update(created_at=now + timedelta(hours=2))

        self.client.force_authenticate(self.linked_user)
        response = self.client.get(reverse('my-history'), {'year': now.year, 'month': now.month})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['visit_count'], 1)
        session = response.data['sessions'][0]
        self.assertEqual(session['duration_hours'], 2.0)
        self.assertFalse(session['is_ongoing'])
