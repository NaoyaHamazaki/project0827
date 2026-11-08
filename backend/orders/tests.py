import datetime

from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Account
from meetingrooms.models import MeetingRoom

from .models import MenuItem, Order, OrderSettings


class OrderTests(APITestCase):
    def setUp(self):
        self.admin = Account.objects.create_user(
            username='admin3', email='admin3@example.com', password='pass12345',
            role=Account.Role.ADMIN,
        )
        self.user = Account.objects.create_user(
            username='user3', email='user3@example.com', password='pass12345',
            role=Account.Role.USER,
        )
        self.room = MeetingRoom.objects.create(name='会議室A')
        self.tea_hot = MenuItem.objects.create(name='お茶（Hot）', order=0)
        self.tea_ice = MenuItem.objects.create(name='お茶（Ice）', order=1)

    def order_payload(self):
        return {
            'room': self.room.id,
            'items': [
                {'menu_item': self.tea_hot.id, 'quantity': 2},
                {'menu_item': self.tea_ice.id, 'quantity': 1},
            ],
        }

    def test_user_can_see_available_menu_items(self):
        MenuItem.objects.create(name='コーヒー（非公開）', is_available=False)
        self.client.force_authenticate(self.user)
        names = [m['name'] for m in self.client.get(reverse('order-menu-items-available')).data]
        self.assertEqual(names, ['お茶（Hot）', 'お茶（Ice）'])

    def test_user_can_place_order_with_multiple_lines(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(reverse('orders'), self.order_payload(), format='json')
        self.assertEqual(r.status_code, 201, r.data)
        order = Order.objects.get(pk=r.data['id'])
        self.assertEqual(order.requested_by, self.user)
        self.assertEqual(order.lines.count(), 2)
        self.assertEqual(order.status, Order.Status.RECEIVED)

    def test_empty_items_rejected(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(reverse('orders'), {'room': self.room.id, 'items': []}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_unavailable_menu_item_rejected(self):
        self.tea_hot.is_available = False
        self.tea_hot.save()
        self.client.force_authenticate(self.user)
        r = self.client.post(reverse('orders'), self.order_payload(), format='json')
        self.assertEqual(r.status_code, 400)

    def test_order_blocked_outside_accept_window(self):
        settings_obj = OrderSettings.load()
        settings_obj.accept_start_time = datetime.time(0, 0)
        settings_obj.accept_end_time = datetime.time(0, 1)
        settings_obj.save()
        self.client.force_authenticate(self.user)
        r = self.client.post(reverse('orders'), self.order_payload(), format='json')
        self.assertEqual(r.status_code, 400)

    def test_only_admin_can_list_orders(self):
        self.client.force_authenticate(self.user)
        r = self.client.get(reverse('orders'))
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.admin)
        r = self.client.get(reverse('orders'))
        self.assertEqual(r.status_code, 200)

    def test_only_admin_can_change_status(self):
        self.client.force_authenticate(self.user)
        order = Order.objects.create(room=self.room, requested_by=self.user)
        r = self.client.post(reverse('order-status', args=[order.id]), {'status': 'done'})
        self.assertEqual(r.status_code, 403)

        self.client.force_authenticate(self.admin)
        r = self.client.post(reverse('order-status', args=[order.id]), {'status': 'done'})
        self.assertEqual(r.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.DONE)

    def test_invalid_status_rejected(self):
        self.client.force_authenticate(self.admin)
        order = Order.objects.create(room=self.room, requested_by=self.user)
        r = self.client.post(reverse('order-status', args=[order.id]), {'status': 'bogus'})
        self.assertEqual(r.status_code, 400)

    def test_only_admin_can_manage_menu_items(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(reverse('order-menu-item-list'), {'name': 'コーヒー'})
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.admin)
        r = self.client.post(reverse('order-menu-item-list'), {'name': 'コーヒー'})
        self.assertEqual(r.status_code, 201, r.data)
