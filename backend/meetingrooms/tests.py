from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Staff

from .models import FloorPlanItem, FloorShape, MeetingRoom, Reservation


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


class FloorPlanTests(APITestCase):
    def setUp(self):
        self.admin = Staff.objects.create_user(
            username='admin4', email='admin4@example.com', password='pass12345',
            role=Staff.Role.ADMIN,
        )
        self.user = Staff.objects.create_user(
            username='user4', email='user4@example.com', password='pass12345',
            role=Staff.Role.USER,
        )
        self.room = MeetingRoom.objects.create(name='会議室A')
        self.shape_payload = {
            'name': '台形の部屋',
            'points': [[0, 0], [5, 0], [3, 6], [0, 6]],
            'cells': [[True, True], [True, False]],
            'width': 5,
            'height': 6,
        }

    def test_user_cannot_access_floor_shapes(self):
        self.client.force_authenticate(self.user)
        r = self.client.get(reverse('floor-shapes'))
        self.assertEqual(r.status_code, 403)

    def test_admin_can_save_and_list_floor_shape_history(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(reverse('floor-shapes'), self.shape_payload, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        shape = FloorShape.objects.get(pk=r.data['id'])
        self.assertEqual(shape.created_by, self.admin)
        self.assertEqual(shape.points, self.shape_payload['points'])

        r = self.client.get(reverse('floor-shapes'))
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]['created_by_name'], self.admin.get_full_name() or self.admin.username)

    def test_admin_can_save_and_reload_placed_layout(self):
        self.client.force_authenticate(self.admin)
        layout = [
            {
                'name': '台形の部屋', 'points': self.shape_payload['points'],
                'width': 5, 'height': 6, 'x': 2, 'y': 3, 'wall_height': 250, 'room': self.room.id,
            },
            {
                'name': '応接室', 'points': [[0, 0], [3, 0], [3, 3], [0, 3]],
                'width': 3, 'height': 3, 'x': 10, 'y': 0, 'wall_height': 200, 'room': None,
            },
        ]
        r = self.client.put(reverse('floor-plan-items'), layout, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(FloorPlanItem.objects.count(), 2)

        r = self.client.get(reverse('floor-plan-items'))
        self.assertEqual(len(r.data), 2)
        names = {item['name'] for item in r.data}
        self.assertEqual(names, {'台形の部屋', '応接室'})

    def test_saving_layout_replaces_previous_one(self):
        self.client.force_authenticate(self.admin)
        FloorPlanItem.objects.create(
            name='古い配置', points=[[0, 0], [1, 0], [1, 1], [0, 1]], width=1, height=1, x=0, y=0,
        )
        r = self.client.put(reverse('floor-plan-items'), [], format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(FloorPlanItem.objects.count(), 0)

    def test_user_cannot_save_layout(self):
        self.client.force_authenticate(self.user)
        r = self.client.put(reverse('floor-plan-items'), [], format='json')
        self.assertEqual(r.status_code, 403)
