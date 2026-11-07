from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Staff


class SelfAccountUpdateTests(APITestCase):
    def setUp(self):
        self.user = Staff.objects.create_user(
            username='selfedit', email='selfedit@example.com', password='orig-pass-123',
            first_name='太郎', last_name='山田',
        )

    def test_user_can_update_own_name_and_email(self):
        self.client.force_authenticate(self.user)
        r = self.client.patch(reverse('auth-me-account'), {
            'first_name': '次郎', 'email': 'new-mail@example.com',
        })
        self.assertEqual(r.status_code, 200, r.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, '次郎')
        self.assertEqual(self.user.email, 'new-mail@example.com')

    def test_user_can_change_password(self):
        self.client.force_authenticate(self.user)
        r = self.client.patch(reverse('auth-me-account'), {'password': 'new-strong-pass-456'})
        self.assertEqual(r.status_code, 200, r.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('new-strong-pass-456'))

    def test_weak_password_rejected(self):
        self.client.force_authenticate(self.user)
        r = self.client.patch(reverse('auth-me-account'), {'password': '123'})
        self.assertEqual(r.status_code, 400)

    def test_duplicate_email_rejected(self):
        Staff.objects.create_user(username='other', email='taken@example.com', password='pass12345')
        self.client.force_authenticate(self.user)
        r = self.client.patch(reverse('auth-me-account'), {'email': 'taken@example.com'})
        self.assertEqual(r.status_code, 400)

    def test_requires_authentication(self):
        r = self.client.patch(reverse('auth-me-account'), {'first_name': 'x'})
        self.assertEqual(r.status_code, 401)
