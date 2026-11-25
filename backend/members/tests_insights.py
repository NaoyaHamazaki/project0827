from datetime import datetime, timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from access.models import AccessLog
from accounts.models import Account
from meetingrooms.models import MeetingRoom, Reservation
from orders.models import MenuItem, Order, OrderLine
from tenants.models import Site
from tenants.testing import make_company

from .models import Member, Plan


class MemberInsightsTests(APITestCase):
    """利用状況（運営者向けダッシュボード）の集計"""

    def setUp(self):
        self.site_a = Site.objects.create(name='中野')
        self.site_b = Site.objects.create(name='新宿')
        self.admin_a = Account.objects.create_user(
            username='ia', email='ia@example.com', password='pass12345', role=Account.Role.ADMIN, site=self.site_a,
        )
        self.master = Account.objects.create_user(
            username='im', email='im@example.com', password='pass12345', role=Account.Role.MASTER,
        )
        self.user = Account.objects.create_user(
            username='iu', email='iu@example.com', password='pass12345', role=Account.Role.USER, site=self.site_a,
        )
        plan = Plan.objects.create(name='ライト', monthly_hour_limit=10)
        self.heavy = Member.objects.create(
            name='利用多い', site=self.site_a, company=make_company('A社', self.site_a), card_identifier='I1', plan=plan,
        )
        self.light = Member.objects.create(
            name='利用少ない', site=self.site_a, company=make_company('A社', self.site_a), card_identifier='I2',
            plan=plan,
        )
        self.other_site = Member.objects.create(
            name='別所管', site=self.site_b, company=make_company('B社', self.site_b), card_identifier='I3',
        )
        # 対象月は先月（集計が「今」に左右されないように）
        today = timezone.localdate()
        first_this = today.replace(day=1)
        last_month = first_this - timedelta(days=1)
        self.year, self.month = last_month.year, last_month.month
        self.monday = self._first_weekday(last_month.replace(day=1), 0)

    @staticmethod
    def _first_weekday(day, weekday):
        while day.weekday() != weekday:
            day += timedelta(days=1)
        return day

    def _at(self, day, hour):
        return timezone.make_aware(datetime.combine(day, datetime.min.time()) + timedelta(hours=hour))

    def _session(self, member, day, start_hour, end_hour):
        check_in = AccessLog.objects.create(member=member, type=AccessLog.LogType.CHECK_IN)
        check_out = AccessLog.objects.create(member=member, type=AccessLog.LogType.CHECK_OUT)
        AccessLog.objects.filter(pk=check_in.pk).update(created_at=self._at(day, start_hour))
        AccessLog.objects.filter(pk=check_out.pk).update(created_at=self._at(day, end_hour))

    def _get(self, who, **params):
        self.client.force_authenticate(who)
        return self.client.get(reverse('member-insights'), {'year': self.year, 'month': self.month, **params})

    def test_user_cannot_access(self):
        self.assertEqual(self._get(self.user).status_code, 403)

    def test_usage_ranking_and_near_limit(self):
        self._session(self.heavy, self.monday, 9, 18)  # 9h → 上限10hの90%
        self._session(self.light, self.monday, 10, 12)  # 2h
        r = self._get(self.admin_a)
        self.assertEqual(r.status_code, 200)
        usage = r.data['usage']
        self.assertEqual([row['name'] for row in usage['top']], ['利用多い', '利用少ない'])
        self.assertEqual(usage['top'][0]['used_hours'], 9.0)
        self.assertEqual(usage['total_hours'], 11.0)
        self.assertEqual([row['name'] for row in usage['near_limit']], ['利用多い'])

    def test_heatmap_counts_check_ins_by_weekday_and_hour(self):
        self._session(self.heavy, self.monday, 9, 10)
        self._session(self.light, self.monday, 9, 11)
        heat = self._get(self.admin_a).data['busy_heatmap']
        self.assertEqual(heat['counts'][0][9], 2)
        self.assertEqual(heat['max'], 2)

    def test_admin_sees_only_own_site_master_can_filter(self):
        self._session(self.other_site, self.monday, 9, 12)
        self.assertEqual(self._get(self.admin_a).data['usage']['total_hours'], 0)
        self.assertEqual(self._get(self.admin_a, site=self.site_b.id).data['usage']['total_hours'], 0)
        self.assertEqual(self._get(self.master).data['usage']['total_hours'], 3.0)
        self.assertEqual(self._get(self.master, site=self.site_b.id).data['usage']['total_hours'], 3.0)
        self.assertEqual(self._get(self.master, site=self.site_a.id).data['usage']['total_hours'], 0)

    def test_room_utilization_counts_open_hours_only(self):
        room = MeetingRoom.objects.create(name='会議室A')
        Reservation.objects.create(
            room=room, start_at=self._at(self.monday, 8), end_at=self._at(self.monday, 11), requested_by=self.user,
        )  # 8〜11時 → 営業時間(9〜18)内は2時間
        Reservation.objects.create(
            room=room, start_at=self._at(self.monday, 13), end_at=self._at(self.monday, 14),
            requested_by=self.user, status=Reservation.Status.CANCELLED,
        )
        util = self._get(self.admin_a).data['room_utilization']
        self.assertEqual(util['rooms'][0]['booked_hours'], 2.0)
        self.assertAlmostEqual(util['rooms'][0]['rate'], round(2 / util['open_hours_per_room'], 3))

    def test_menu_ranking_excludes_cancelled(self):
        room = MeetingRoom.objects.create(name='会議室A')
        tea = MenuItem.objects.create(name='お茶')
        coffee = MenuItem.objects.create(name='コーヒー')
        for item, qty, status in [(tea, 3, Order.Status.DONE), (coffee, 1, Order.Status.RECEIVED),
                                  (coffee, 5, Order.Status.CANCELLED)]:
            order = Order.objects.create(room=room, requested_by=self.user, status=status)
            Order.objects.filter(pk=order.pk).update(created_at=self._at(self.monday, 10))
            OrderLine.objects.create(order=order, menu_item=item, quantity=qty)
        menu = self._get(self.admin_a).data['menu_ranking']
        self.assertEqual(menu['order_count'], 2)
        self.assertEqual([(i['name'], i['quantity']) for i in menu['items']], [('お茶', 3), ('コーヒー', 1)])

    def test_signups_cover_twelve_months(self):
        Member.objects.filter(pk=self.heavy.pk).update(created_at=self._at(self.monday, 10))
        signups = self._get(self.admin_a).data['signups']
        self.assertEqual(len(signups), 12)
        self.assertEqual((signups[-1]['year'], signups[-1]['month']), (self.year, self.month))
        self.assertEqual(signups[-1]['count'], 1)

    def test_bad_month_rejected(self):
        self.client.force_authenticate(self.admin_a)
        self.assertEqual(self.client.get(reverse('member-insights'), {'month': 13}).status_code, 400)
