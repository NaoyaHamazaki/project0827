from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Account

from .models import Message


class ChatTests(APITestCase):
    def setUp(self):
        def mk(name, **kwargs):
            return Account.objects.create_user(
                username=name, email=f'{name}@example.com', password='pass12345',
                first_name=name, **kwargs,
            )
        self.a, self.b, self.c = mk('alice'), mk('bob'), mk('carol')
        self.admin = mk('root', role=Account.Role.ADMIN)

    def open_chat(self, me, other):
        self.client.force_authenticate(me)
        return self.client.post(reverse('chat-conversations'), {'user_id': other.id}).data['id']

    def test_search_excludes_self_and_filters(self):
        self.client.force_authenticate(self.a)
        names = [u['display_name'] for u in self.client.get(reverse('chat-users'), {'q': 'bo'}).data]
        self.assertEqual(names, ['bob'])
        all_ids = [u['id'] for u in self.client.get(reverse('chat-users')).data]
        self.assertNotIn(self.a.id, all_ids)

    def test_create_is_idempotent(self):
        self.assertEqual(self.open_chat(self.a, self.b), self.open_chat(self.b, self.a))

    def test_cannot_chat_with_self(self):
        self.client.force_authenticate(self.a)
        r = self.client.post(reverse('chat-conversations'), {'user_id': self.a.id})
        self.assertEqual(r.status_code, 400)

    def test_non_participants_including_admin_cannot_read_or_post(self):
        cid = self.open_chat(self.a, self.b)
        url = reverse('chat-messages', args=[cid])
        self.client.post(url, {'body': 'secret'})
        msg = Message.objects.get()
        for outsider in (self.c, self.admin):
            self.client.force_authenticate(outsider)
            self.assertEqual(self.client.get(url).status_code, 404)
            self.assertEqual(self.client.post(url, {'body': 'x'}).status_code, 404)
            self.assertEqual(self.client.get(reverse('chat-conversations')).data, [])
            self.assertEqual(
                self.client.post(reverse('chat-thumbs-up', args=[msg.id])).status_code, 404)

    def test_send_unread_and_read(self):
        cid = self.open_chat(self.a, self.b)
        url = reverse('chat-messages', args=[cid])
        self.assertEqual(self.client.post(url, {'body': '**hi**'}).status_code, 201)
        self.assertEqual(self.client.post(url, {'body': '  '}).status_code, 400)
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.get(reverse('chat-unread')).data['unread_count'], 1)
        self.assertEqual(self.client.get(reverse('chat-conversations')).data[0]['unread_count'], 1)
        self.assertEqual(self.client.get(url).data[0]['body'], '**hi**')
        self.assertEqual(self.client.get(reverse('chat-unread')).data['unread_count'], 0)

    def test_thumbs_up_toggle(self):
        cid = self.open_chat(self.a, self.b)
        self.client.post(reverse('chat-messages', args=[cid]), {'body': 'hi'})
        url = reverse('chat-thumbs-up', args=[Message.objects.get().id])
        d = self.client.post(url).data
        self.assertEqual((d['thumbs_up_count'], d['thumbs_up_by_me']), (1, True))
        self.client.force_authenticate(self.b)
        d = self.client.post(url).data
        self.assertEqual((d['thumbs_up_count'], d['thumbs_up_by_me']), (2, True))
        d = self.client.post(url).data
        self.assertEqual((d['thumbs_up_count'], d['thumbs_up_by_me']), (1, False))
