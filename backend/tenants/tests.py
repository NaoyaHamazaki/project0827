from django.db import IntegrityError
from django.test import TestCase
from rest_framework.test import APITestCase

from accounts.models import Account
from members.models import Member

from .models import Company, Site


class CodeNumberingTests(TestCase):
    def test_site_codes_are_sequential_and_master_is_fixed(self):
        master = Site.objects.create(code=Site.MASTER_CODE, name='本社')
        nakano = Site.objects.create(name='中野')
        shinjuku = Site.objects.create(name='新宿')
        self.assertEqual((master.code, nakano.code, shinjuku.code), ('S000', 'S001', 'S002'))
        self.assertTrue(master.is_master)

    def test_company_and_member_codes(self):
        site = Site.objects.create(name='中野')
        c1 = Company.objects.create(site=site, name='A社')
        c2 = Company.objects.create(site=site, name='B社')
        self.assertEqual((c1.code, c2.code), ('C0001', 'C0002'))
        m1 = Member.objects.create(name='一人目', company=c1, card_identifier='X1')
        m2 = Member.objects.create(name='二人目', company=c1, card_identifier='X2')
        self.assertEqual((m1.member_code, m2.member_code), ('M00001', 'M00002'))
        self.assertEqual(m1.site, site)

    def test_admin_number_and_display_name_per_site(self):
        nakano = Site.objects.create(name='中野')
        shinjuku = Site.objects.create(name='新宿')
        a1 = Account.objects.create_user(username='a1', email='a1@x.com', password='p', role='admin', site=nakano)
        a2 = Account.objects.create_user(username='a2', email='a2@x.com', password='p', role='admin', site=nakano)
        b1 = Account.objects.create_user(username='b1', email='b1@x.com', password='p', role='admin', site=shinjuku)
        self.assertEqual((a1.admin_number, a2.admin_number, b1.admin_number), (1, 2, 1))
        self.assertEqual(a2.get_full_name(), '中野_管理者02')

    def test_only_one_representative_per_company(self):
        site = Site.objects.create(name='中野')
        company = Company.objects.create(site=site, name='A社')
        Member.objects.create(name='代表', company=company, card_identifier='R1', is_representative=True)
        with self.assertRaises(IntegrityError):
            Member.objects.create(name='代表2', company=company, card_identifier='R2', is_representative=True)


class MasterReadOnlyTests(APITestCase):
    def setUp(self):
        master_site = Site.objects.create(code=Site.MASTER_CODE, name='本社')
        self.master = Account.objects.create_user(
            username='m', email='m@x.com', password='p', role='master', site=master_site,
        )

    def test_master_can_view_but_not_change_admin_screens(self):
        self.client.force_authenticate(self.master)
        self.assertEqual(self.client.get('/api/members/').status_code, 200)
        self.assertEqual(self.client.post('/api/members/', {'name': 'x', 'card_identifier': 'z'}).status_code, 403)


class ThreeLevelInviteTests(APITestCase):
    def setUp(self):
        self.master_site = Site.objects.create(code=Site.MASTER_CODE, name='本社')
        self.site = Site.objects.create(name='中野')
        self.master = Account.objects.create_user(
            username='m', email='m@x.com', password='p', role='master', site=self.master_site,
        )

    def _issue(self, account, **data):
        self.client.force_authenticate(account)
        r = self.client.post('/api/members/invites/', data)
        self.assertEqual(r.status_code, 201, r.data)
        self.client.force_authenticate(None)
        return r.data['token']

    def test_master_admin_representative_user_chain(self):
        token = self._issue(self.master, site=self.site.id)
        status = self.client.get(f'/api/members/invites/{token}/').data
        self.assertEqual((status['target_role'], status['site_name']), ('admin', '中野'))
        r = self.client.post(f'/api/members/invites/{token}/register/', {
            'email': 'adm@x.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 201, r.data)
        admin = Account.objects.get(email='adm@x.com')
        self.assertEqual((admin.role, admin.site, admin.get_full_name()), ('admin', self.site, '中野_管理者01'))

        token = self._issue(admin)
        r = self.client.post(f'/api/members/invites/{token}/register/', {
            'name': '代表太郎', 'company_name': 'E社', 'email': 'rep@x.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 201, r.data)
        rep = Account.objects.get(email='rep@x.com')
        self.assertEqual(rep.role, 'representative')

        token = self._issue(rep)
        self.assertEqual(self.client.get(f'/api/members/invites/{token}/').data['company_name'], 'E社')
        r = self.client.post(f'/api/members/invites/{token}/register/', {
            'name': '一般花子', 'email': 'usr@x.com', 'password': 'a-strong-pass-999',
        })
        self.assertEqual(r.status_code, 201, r.data)
        usr = Account.objects.get(email='usr@x.com')
        self.assertEqual((usr.role, usr.member.company, usr.site), ('user', rep.member.company, self.site))

        # 代表は自分の所属のメンバーを一覧・無効化・削除できる
        self.client.force_authenticate(rep)
        names = [m['name'] for m in self.client.get('/api/members/my-company/').data['members']]
        self.assertEqual(names, ['代表太郎', '一般花子'])
        r = self.client.patch(f'/api/members/my-company/{usr.member.id}/', {'status': 'inactive'})
        self.assertEqual(r.status_code, 200)
        usr.refresh_from_db()
        self.assertFalse(usr.is_active)
        self.assertEqual(self.client.delete(f'/api/members/my-company/{rep.member.id}/').status_code, 404)

    def test_regular_user_cannot_issue_invite(self):
        account = Account.objects.create_user(username='u', email='u@x.com', password='p', role='user')
        self.client.force_authenticate(account)
        self.assertEqual(self.client.post('/api/members/invites/').status_code, 403)

    def test_login_portal_rejects_wrong_role(self):
        Account.objects.create_user(username='a', email='a@x.com', password='pw-12345678', role='admin', site=self.site)
        ok = self.client.post('/api/auth/login/', {'email': 'a@x.com', 'password': 'pw-12345678', 'portal': 'staff'})
        ng = self.client.post('/api/auth/login/', {'email': 'a@x.com', 'password': 'pw-12345678', 'portal': 'member'})
        self.assertEqual((ok.status_code, ng.status_code), (200, 400))
