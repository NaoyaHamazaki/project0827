from django.core.management.base import BaseCommand

from accounts.models import Staff
from members.models import Member


class Command(BaseCommand):
    help = '動作確認用の初期スタッフ・会員データを投入する'

    def handle(self, *args, **options):
        if not Staff.objects.filter(email='admin@example.com').exists():
            Staff.objects.create_superuser(
                username='admin', email='admin@example.com',
                password='adminpass123', first_name='管理者', role=Staff.Role.ADMIN,
            )
            self.stdout.write(self.style.SUCCESS('管理者ユーザーを作成しました: admin@example.com / adminpass123'))
        else:
            self.stdout.write('管理者ユーザーは既に存在します')

        demo_members = [
            {'name': '山田 太郎', 'company_name': '株式会社サンプル', 'card_identifier': '0001'},
            {'name': '佐藤 花子', 'company_name': 'ExpertOffice合同会社', 'card_identifier': '0002'},
            {'name': '鈴木 次郎', 'company_name': 'フリーランス', 'card_identifier': '0003', 'status': Member.Status.INACTIVE},
        ]
        for data in demo_members:
            member, created = Member.objects.get_or_create(
                card_identifier=data['card_identifier'], defaults=data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'会員を作成しました: {member.name}'))

        # ユーザーロールのデモアカウントは、自分のQR/カードIDを表示できるよう
        # デモ会員（山田太郎, card_identifier='0001'）に紐付ける。
        # 「ユーザー」ロール＝会員本人のログインであることが分かるよう、
        # 氏名もその会員と同じ名前にしておく（旧名「受付」だと管理者/受付担当の
        # アカウントに見えて紛らわしいため）。
        demo_member = Member.objects.get(card_identifier='0001')

        user_staff, staff_created = Staff.objects.get_or_create(
            email='operator@example.com',
            defaults={
                'username': 'operator', 'first_name': '山田', 'last_name': '太郎',
                'role': Staff.Role.USER, 'member': demo_member,
            },
        )
        if staff_created:
            user_staff.set_password('operatorpass123')
            user_staff.save()
            self.stdout.write(self.style.SUCCESS('ユーザーアカウントを作成しました: operator@example.com / operatorpass123'))
        else:
            update_fields = []
            if user_staff.member_id is None:
                user_staff.member = demo_member
                update_fields.append('member')
            if user_staff.first_name == '受付':
                user_staff.first_name = '山田'
                user_staff.last_name = '太郎'
                update_fields += ['first_name', 'last_name']
            if update_fields:
                user_staff.save(update_fields=update_fields)
            self.stdout.write('ユーザーアカウントは既に存在します')

        self.stdout.write(self.style.SUCCESS('デモデータ投入が完了しました'))
