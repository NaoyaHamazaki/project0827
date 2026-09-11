from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Staff


class AuthTests(APITestCase):
    def setUp(self):
        self.admin = Staff.objects.create_user(
            username='adm', email='adm@example.com', password='pass12345',
            role=Staff.Role.ADMIN, first_name='テスト管理者',
        )

    def test_login_returns_tokens_and_role(self):
        response = self.client.post(reverse('auth-login'), {
            'email': 'adm@example.com', 'password': 'pass12345',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['staff']['role'], 'admin')

    def test_login_rejects_wrong_password(self):
        response = self.client.post(reverse('auth-login'), {
            'email': 'adm@example.com', 'password': 'wrong',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_authentication(self):
        response = self.client.get(reverse('auth-me'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_defaults_to_japanese(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse('auth-me'))
        self.assertEqual(response.data['language'], 'ja')

    def test_patch_language_updates_and_persists(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(reverse('auth-me'), {'language': 'en'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['language'], 'en')

        self.admin.refresh_from_db()
        self.assertEqual(self.admin.language, Staff.Language.EN)

    def test_patch_language_rejects_invalid_value(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(reverse('auth-me'), {'language': 'fr'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_language_requires_authentication(self):
        response = self.client.patch(reverse('auth-me'), {'language': 'en'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
