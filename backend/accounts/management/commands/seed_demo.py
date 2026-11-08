from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Account
from meetingrooms.models import MeetingRoom, Reservation
from members.models import Member
from orders.models import MenuItem, Order, OrderLine
from tenants.models import Company, Site

DEMO_COMPANIES = [
    # (所属名, 代表の氏名, カードID, ステータス)
    ('株式会社サンプル', '山田 太郎', '0001', Member.Status.ACTIVE),
    ('ExpertOffice合同会社', '佐藤 花子', '0002', Member.Status.ACTIVE),
    ('フリーランス', '鈴木 次郎', '0003', Member.Status.INACTIVE),
]
DEMO_ROOMS = ['第1会議室', '第2会議室', '大会議室', '応接室A', '応接室B']
DEMO_MENU = ['お茶（Hot）', 'お茶（Ice）', 'コーヒー（Hot）', 'コーヒー（Ice）', '水']


class Command(BaseCommand):
    help = '動作確認用の初期データ（所管・所属・アカウント・会員・会議室・メニュー等）を投入する。何度実行してもよい'

    def handle(self, *args, **options):
        master_site, _ = Site.objects.get_or_create(code=Site.MASTER_CODE, defaults={'name': '本社'})
        site = Site.objects.filter(name='中野').first() or Site.objects.create(name='中野')

        self._account('master@example.com', 'masterpass123', 'master', Account.Role.MASTER, master_site,
                      first_name='マスター')
        admin = self._account('admin@example.com', 'adminpass123', 'admin', Account.Role.ADMIN, site,
                              superuser=True)

        for company_name, member_name, card_id, status in DEMO_COMPANIES:
            company = Company.resolve(site, company_name)
            member, created = Member.objects.get_or_create(
                card_identifier=card_id,
                defaults={'name': member_name, 'site': site, 'company': company,
                          'is_representative': True, 'status': status},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'会員を作成しました: {member.member_code} {member.name}'))

        # 会員ログインのデモは「株式会社サンプル」の代表・山田太郎
        yamada = Member.objects.get(card_identifier='0001')
        self._account('operator@example.com', 'operatorpass123', 'operator', Account.Role.REPRESENTATIVE, site,
                      first_name='山田', last_name='太郎', member=yamada)

        for i, name in enumerate(DEMO_ROOMS):
            MeetingRoom.objects.get_or_create(name=name, defaults={'order': i})
        for i, name in enumerate(DEMO_MENU):
            MenuItem.objects.get_or_create(name=name, defaults={'order': i})

        if not Reservation.objects.exists():
            self._seed_requests(admin, Account.objects.get(email='operator@example.com'))

        self.stdout.write(self.style.SUCCESS('デモデータ投入が完了しました'))

    def _account(self, email, password, username, role, site, superuser=False, **extra):
        account = Account.objects.filter(email=email).first()
        if account:
            self.stdout.write(f'アカウントは既に存在します: {email}')
            return account
        create = Account.objects.create_superuser if superuser else Account.objects.create_user
        account = create(username=username, email=email, password=password, role=role, site=site, **extra)
        self.stdout.write(self.style.SUCCESS(f'アカウントを作成しました: {email}（{account.get_role_display()}）'))
        return account

    def _seed_requests(self, admin, user):
        rooms = list(MeetingRoom.objects.order_by('order', 'id'))
        menu = list(MenuItem.objects.order_by('order', 'id'))
        base = timezone.localtime().replace(minute=0, second=0, microsecond=0)
        for room, day, start, end, note, who, status in [
            (rooms[0], 1, 10, 11, '定例ミーティング', user, Reservation.Status.CONFIRMED),
            (rooms[2], 1, 14, 16, '全体会議', admin, Reservation.Status.CONFIRMED),
            (rooms[3], 2, 13, 14, '来客対応', user, Reservation.Status.CONFIRMED),
            (rooms[1], 3, 9, 10, '面接', user, Reservation.Status.CANCELLED),
            (rooms[4], 5, 15, 17, '', admin, Reservation.Status.CONFIRMED),
        ]:
            d = base + timedelta(days=day)
            Reservation.objects.create(room=room, note=note, requested_by=who, status=status,
                                       start_at=d.replace(hour=start), end_at=d.replace(hour=end))
        for room, who, status, lines in [
            (rooms[0], user, Order.Status.RECEIVED, [(0, 2), (2, 1)]),
            (rooms[3], user, Order.Status.RECEIVED, [(1, 3)]),
            (rooms[2], admin, Order.Status.DONE, [(0, 4), (4, 4)]),
            (rooms[1], user, Order.Status.CANCELLED, [(3, 1)]),
        ]:
            order = Order.objects.create(room=room, requested_by=who, status=status)
            for index, qty in lines:
                OrderLine.objects.create(order=order, menu_item=menu[index], quantity=qty)
        self.stdout.write(self.style.SUCCESS('会議室予約・注文のデモデータを作成しました'))
