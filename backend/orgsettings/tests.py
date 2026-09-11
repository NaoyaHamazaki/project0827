from unittest.mock import MagicMock, patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Staff

from .dispatch import dispatch_webhooks
from .models import OrgSettings, Webhook


class OrgSettingsViewTests(APITestCase):
    def setUp(self):
        self.operator = Staff.objects.create_user(
            username='op', email='op@example.com', password='pass12345',
            role=Staff.Role.USER,
        )
        self.admin = Staff.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Staff.Role.ADMIN,
        )

    def test_get_requires_admin(self):
        self.client.force_authenticate(self.operator)
        response = self.client.get(reverse('org-settings'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_creates_defaults_when_missing(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse('org-settings'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['enabled_checkin_methods'], ['card'])

    def test_put_updates_settings(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put(reverse('org-settings'), {
            'enabled_checkin_methods': ['card', 'pin', 'qr'],
            'csv_export_columns': ['member_name', 'type'],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        settings_obj = OrgSettings.load()
        self.assertEqual(settings_obj.enabled_checkin_methods, ['card', 'pin', 'qr'])
        self.assertEqual(settings_obj.csv_export_columns, ['member_name', 'type'])


class WebhookViewSetTests(APITestCase):
    def setUp(self):
        self.admin = Staff.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Staff.Role.ADMIN,
        )
        self.client.force_authenticate(self.admin)

    def test_create_and_list_webhook(self):
        response = self.client.post(reverse('webhook-list'), {
            'name': 'テスト連携',
            'url': 'https://example.com/hook',
            'event_types': ['checkin', 'checkout'],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.get(reverse('webhook-list'))
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'テスト連携')

    def test_test_action_reports_success_and_failure(self):
        webhook = Webhook.objects.create(
            name='テスト送信対象', url='https://example.com/hook', event_types=['checkin'],
        )
        with patch('orgsettings.views.send_webhook') as mock_send:
            response = self.client.post(reverse('webhook-test', args=[webhook.pk]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertTrue(mock_send.called)

        with patch('orgsettings.views.send_webhook', side_effect=OSError('unreachable')):
            response = self.client.post(reverse('webhook-test', args=[webhook.pk]))
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertFalse(response.data['success'])


class DispatchWebhooksTests(APITestCase):
    def test_only_active_and_subscribed_webhooks_are_called(self):
        Webhook.objects.create(
            name='有効・購読', url='https://example.com/a',
            event_types=['checkin'], is_active=True,
        )
        Webhook.objects.create(
            name='無効', url='https://example.com/b',
            event_types=['checkin'], is_active=False,
        )
        Webhook.objects.create(
            name='未購読', url='https://example.com/c',
            event_types=['checkout'], is_active=True,
        )

        with patch('orgsettings.dispatch.urllib.request.urlopen') as mock_urlopen:
            mock_urlopen.return_value = MagicMock()
            dispatch_webhooks('checkin', {'member_name': 'テスト太郎'})

        self.assertEqual(mock_urlopen.call_count, 1)

    def test_dispatch_failure_does_not_raise(self):
        Webhook.objects.create(
            name='失敗する', url='https://example.invalid/hook',
            event_types=['checkin'], is_active=True,
        )
        with patch('orgsettings.dispatch.urllib.request.urlopen', side_effect=OSError('boom')):
            dispatch_webhooks('checkin', {'member_name': 'テスト太郎'})
