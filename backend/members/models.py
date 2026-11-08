import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

INVITE_TTL = timedelta(hours=24)


class Plan(models.Model):
    """利用プランマスタ（例: ライトプラン=月10h、フリープラン=無制限）"""

    name = models.CharField('プラン名', max_length=100)
    monthly_hour_limit = models.PositiveIntegerField(
        '月間上限時間', null=True, blank=True,
        help_text='未設定の場合は無制限として扱う',
    )
    created_at = models.DateTimeField('登録日時', auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        if self.monthly_hour_limit is None:
            return f'{self.name}（無制限）'
        return f'{self.name}（月{self.monthly_hour_limit}h）'


class Member(models.Model):
    """会員情報（代表・ユーザー）。所管・所属に属し、ログインはひも付くAccountで行う"""

    class Status(models.TextChoices):
        ACTIVE = 'active', '有効'
        INACTIVE = 'inactive', '無効'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member_code = models.CharField('メンバーコード', max_length=10, unique=True, blank=True)
    name = models.CharField('会員名', max_length=100)
    site = models.ForeignKey(
        'tenants.Site', on_delete=models.PROTECT, null=True, blank=True,
        related_name='members', verbose_name='所管',
    )
    company = models.ForeignKey(
        'tenants.Company', on_delete=models.PROTECT, null=True, blank=True,
        related_name='members', verbose_name='所属',
    )
    is_representative = models.BooleanField('代表', default=False)
    card_identifier = models.CharField(
        'カードID', max_length=100, unique=True,
        help_text='バーコード文字列またはICカードのIDm',
    )
    status = models.CharField(
        'ステータス', max_length=10, choices=Status.choices, default=Status.ACTIVE
    )
    plan = models.ForeignKey(
        Plan, on_delete=models.SET_NULL, null=True, blank=True, related_name='members',
    )
    created_at = models.DateTimeField('登録日時', auto_now_add=True)

    class Meta:
        ordering = ['name']
        constraints = [
            # 代表は1つの所属につき1名
            models.UniqueConstraint(
                fields=('company',), condition=models.Q(is_representative=True),
                name='uniq_representative_per_company',
            ),
        ]

    def __str__(self):
        return f'{self.member_code} {self.name}（{self.company_name}）'

    def save(self, *args, **kwargs):
        from tenants.models import next_code

        if not self.member_code:
            self.member_code = next_code(Member, 'M', 5, field='member_code')
        if self.company_id and not self.site_id:
            self.site_id = self.company.site_id
        super().save(*args, **kwargs)

    @property
    def company_name(self):
        return self.company.name if self.company_id else ''


def _generate_token():
    return secrets.token_urlsafe(24)


class MemberInvite(models.Model):
    """会員の自己登録用招待リンク（QR表示／URLをコピーのどちらでも使う）。
    有効期限付き・1回限り：使用済みまたは期限切れのトークンは登録に使えない。
    """

    token = models.CharField('トークン', max_length=64, unique=True, default=_generate_token)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='member_invites',
    )
    expires_at = models.DateTimeField('有効期限')
    used_at = models.DateTimeField('使用日時', null=True, blank=True)
    created_member = models.ForeignKey(
        Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='invite',
    )
    created_at = models.DateTimeField('発行日時', auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'招待{self.token[:8]}…（{"使用済み" if self.used_at else "未使用"}）'

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + INVITE_TTL
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()
