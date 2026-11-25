import datetime

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Account

from .models import FloorPlanItem, FloorShape, MeetingRoom, Reservation


class MeetingRoomTests(APITestCase):
    def setUp(self):
        self.admin = Account.objects.create_user(
            username='admin', email='admin2@example.com', password='pass12345',
            role=Account.Role.ADMIN,
        )
        self.user = Account.objects.create_user(
            username='user', email='user2@example.com', password='pass12345',
            role=Account.Role.USER,
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
            'room': self.room.id, 'start_at': '2030-12-01T10:00:00Z',
            'end_at': '2030-12-01T11:00:00Z', 'note': 'テスト',
        }
        r = self.client.post(reverse('meeting-room-reservations'), payload)
        self.assertEqual(r.status_code, 201, r.data)
        reservation = Reservation.objects.get(pk=r.data['id'])
        self.assertEqual(reservation.requested_by, self.user)

    def test_end_before_start_is_rejected(self):
        self.client.force_authenticate(self.user)
        payload = {
            'room': self.room.id, 'start_at': '2030-12-01T11:00:00Z',
            'end_at': '2030-12-01T10:00:00Z',
        }
        r = self.client.post(reverse('meeting-room-reservations'), payload)
        self.assertEqual(r.status_code, 400)

    def test_cannot_book_non_bookable_room(self):
        closed_room = MeetingRoom.objects.create(name='閉室中', is_bookable=False)
        self.client.force_authenticate(self.user)
        payload = {
            'room': closed_room.id, 'start_at': '2030-12-01T10:00:00Z',
            'end_at': '2030-12-01T11:00:00Z',
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
            room=self.room, start_at='2030-12-01T10:00:00Z', end_at='2030-12-01T11:00:00Z',
            requested_by=self.user,
        )
        other = Account.objects.create_user(
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
        self.admin = Account.objects.create_user(
            username='admin4', email='admin4@example.com', password='pass12345',
            role=Account.Role.ADMIN,
        )
        self.user = Account.objects.create_user(
            username='user4', email='user4@example.com', password='pass12345',
            role=Account.Role.USER,
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


class ReservationCalendarTests(APITestCase):
    """日別ビュー・重複防止・本人による変更・フロアマップ取得"""

    def setUp(self):
        self.admin = Account.objects.create_user(
            username='cal_admin', email='cal_admin@example.com', password='pass12345', role=Account.Role.ADMIN,
        )
        self.user = Account.objects.create_user(
            username='cal_user', email='cal_user@example.com', password='pass12345', role=Account.Role.USER,
        )
        self.other = Account.objects.create_user(
            username='cal_other', email='cal_other@example.com', password='pass12345', role=Account.Role.USER,
        )
        self.room = MeetingRoom.objects.create(name='会議室A')
        self.day = timezone.localdate() + datetime.timedelta(days=3)

    def at(self, hour, day=None):
        return timezone.make_aware(datetime.datetime.combine(day or self.day, datetime.time(hour)))

    def book(self, who, start, end):
        self.client.force_authenticate(who)
        return self.client.post(reverse('meeting-room-reservations'), {
            'room': self.room.id, 'start_at': start.isoformat(), 'end_at': end.isoformat(),
        }, format='json')

    def test_overlapping_reservation_rejected(self):
        self.assertEqual(self.book(self.user, self.at(10), self.at(12)).status_code, 201)
        r = self.book(self.other, self.at(11), self.at(13))
        self.assertEqual(r.status_code, 400)
        self.assertIn('すでに予約', str(r.data))

    def test_adjacent_reservation_allowed(self):
        self.assertEqual(self.book(self.user, self.at(10), self.at(11)).status_code, 201)
        self.assertEqual(self.book(self.other, self.at(11), self.at(12)).status_code, 201)

    def test_cancelled_reservation_frees_slot(self):
        Reservation.objects.create(
            room=self.room, start_at=self.at(10), end_at=self.at(11),
            status=Reservation.Status.CANCELLED, requested_by=self.other,
        )
        self.assertEqual(self.book(self.user, self.at(10), self.at(11)).status_code, 201)

    def test_past_reservation_rejected(self):
        past = timezone.localdate() - datetime.timedelta(days=1)
        self.assertEqual(self.book(self.user, self.at(10, past), self.at(11, past)).status_code, 400)

    def test_day_view_masks_other_users_details(self):
        mine = Reservation.objects.create(
            room=self.room, start_at=self.at(9), end_at=self.at(10), note='自分', requested_by=self.user,
        )
        Reservation.objects.create(
            room=self.room, start_at=self.at(13), end_at=self.at(14), note='秘密', requested_by=self.other,
        )
        self.client.force_authenticate(self.user)
        r = self.client.get(reverse('meeting-room-reservations-day'), {'date': self.day.isoformat()})
        self.assertEqual(r.status_code, 200)
        self.assertEqual([room['name'] for room in r.data['rooms']], ['会議室A'])
        by_id = {res['id']: res for res in r.data['reservations']}
        self.assertTrue(by_id[mine.id]['is_mine'])
        self.assertEqual(by_id[mine.id]['note'], '自分')
        other = [res for res in r.data['reservations'] if res['id'] != mine.id][0]
        self.assertFalse(other['is_mine'])
        self.assertIsNone(other['note'])
        self.assertIsNone(other['requested_by_name'])

    def test_day_view_admin_sees_details(self):
        Reservation.objects.create(
            room=self.room, start_at=self.at(13), end_at=self.at(14), note='詳細', requested_by=self.other,
        )
        self.client.force_authenticate(self.admin)
        r = self.client.get(reverse('meeting-room-reservations-day'), {'date': self.day.isoformat()})
        self.assertEqual(r.data['reservations'][0]['note'], '詳細')

    def test_day_view_rejects_bad_date(self):
        self.client.force_authenticate(self.user)
        r = self.client.get(reverse('meeting-room-reservations-day'), {'date': '2026/11/25'})
        self.assertEqual(r.status_code, 400)

    def test_owner_can_change_time_but_other_cannot(self):
        res = Reservation.objects.create(
            room=self.room, start_at=self.at(10), end_at=self.at(11), requested_by=self.user,
        )
        url = reverse('meeting-room-reservation-detail', args=[res.id])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(url, {'end_at': self.at(12).isoformat()}, format='json').status_code, 403)
        self.client.force_authenticate(self.user)
        r = self.client.patch(url, {'end_at': self.at(12).isoformat()}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        res.refresh_from_db()
        self.assertEqual(res.end_at, self.at(12))

    def test_change_into_clash_rejected(self):
        Reservation.objects.create(room=self.room, start_at=self.at(12), end_at=self.at(13), requested_by=self.other)
        res = Reservation.objects.create(
            room=self.room, start_at=self.at(10), end_at=self.at(11), requested_by=self.user,
        )
        self.client.force_authenticate(self.user)
        r = self.client.patch(
            reverse('meeting-room-reservation-detail', args=[res.id]),
            {'end_at': self.at(13).isoformat()}, format='json',
        )
        self.assertEqual(r.status_code, 400)

    def test_user_can_read_floor_plan_but_not_save(self):
        FloorPlanItem.objects.create(
            name='会議室A', points=[[0, 0], [2, 0], [2, 2]], width=2, height=2, x=1, y=1, room=self.room,
        )
        self.client.force_authenticate(self.user)
        r = self.client.get(reverse('floor-plan-items'))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data[0]['room'], self.room.id)
        self.assertEqual(self.client.put(reverse('floor-plan-items'), [], format='json').status_code, 403)
