from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Staff

from .models import MeetingRoom, Reservation


class MeetingRoomTests(APITestCase):
    def setUp(self):
        self.admin = Staff.objects.create_user(
            username='admin', email='admin2@example.com', password='pass12345',
            role=Staff.Role.ADMIN,
        )
        self.user = Staff.objects.create_user(
            username='user', email='user2@example.com', password='pass12345',
            role=Staff.Role.USER,
        )
        self.room = MeetingRoom.objects.create(name='会議室A')

    def test_user_can_see_bookable_rooms(self):
        MeetingRoom.objects.create(name='会議室B（非公開）', is_bookable=False)
        self.client.force_authenticate(self.user)
        names = [r['name'] for r in self.client.get(reverse('meeting-rooms-bookable')).data]
        self.assertEqual(names, ['会議室A'])

    def test_user_can_create_reservation(self):
        self.client.force_authenticate(self.user)
        payload = {
            'room': self.room.id, 'start_at': '2026-12-01T10:00:00Z',
            'end_at': '2026-12-01T11:00:00Z', 'note': 'テスト',
        }
        r = self.client.post(reverse('meeting-room-reservations'), payload)
        self.assertEqual(r.status_code, 201, r.data)
        reservation = Reservation.objects.get(pk=r.data['id'])
        self.assertEqual(reservation.requested_by, self.user)

    def test_end_before_start_is_rejected(self):
        self.client.force_authenticate(self.user)
        payload = {
            'room': self.room.id, 'start_at': '2026-12-01T11:00:00Z',
            'end_at': '2026-12-01T10:00:00Z',
        }
        r = self.client.post(reverse('meeting-room-reservations'), payload)
        self.assertEqual(r.status_code, 400)

    def test_cannot_book_non_bookable_room(self):
        closed_room = MeetingRoom.objects.create(name='閉室中', is_bookable=False)
        self.client.force_authenticate(self.user)
        payload = {
            'room': closed_room.id, 'start_at': '2026-12-01T10:00:00Z',
            'end_at': '2026-12-01T11:00:00Z',
        }
        r = self.client.post(reverse('meeting-room-reservations'), payload)
        self.assertEqual(r.status_code, 400)

    def test_only_admin_can_list_reservations(self):
        self.client.force_authenticate(self.user)
        r = self.client.get(reverse('meeting-room-reservations'))
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.admin)
        r = self.client.get(reverse('meeting-room-reservations'))
        self.assertEqual(r.status_code, 200)

    def test_owner_can_cancel_but_other_user_cannot(self):
        reservation = Reservation.objects.create(
            room=self.room, start_at='2026-12-01T10:00:00Z', end_at='2026-12-01T11:00:00Z',
            requested_by=self.user,
        )
        other = Staff.objects.create_user(
            username='other', email='other2@example.com', password='pass12345',
        )
        self.client.force_authenticate(other)
        r = self.client.post(reverse('meeting-room-reservation-cancel', args=[reservation.id]))
        self.assertEqual(r.status_code, 403)

        self.client.force_authenticate(self.user)
        r = self.client.post(reverse('meeting-room-reservation-cancel', args=[reservation.id]))
        self.assertEqual(r.status_code, 200)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.CANCELLED)

    def test_only_admin_can_manage_rooms(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(reverse('meeting-room-list'), {'name': '会議室C'})
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.admin)
        r = self.client.post(reverse('meeting-room-list'), {'name': '会議室C'})
        self.assertEqual(r.status_code, 201, r.data)
