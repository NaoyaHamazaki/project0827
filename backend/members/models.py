import uuid

from django.db import models


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
    class Status(models.TextChoices):
        ACTIVE = 'active', '有効'
        INACTIVE = 'inactive', '無効'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('会員名', max_length=100)
    company_name = models.CharField('所属企業・テナント名', max_length=150, blank=True)
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

    def __str__(self):
        return f'{self.name}（{self.company_name}）'
