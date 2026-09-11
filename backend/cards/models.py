import uuid

from django.conf import settings
from django.db import models

from members.models import Member


class SecurityCard(models.Model):
    """受付が会員に貸し出す物理セキュリティカードの台帳（紙の手書き管理の置き換え）"""

    class Status(models.TextChoices):
        AVAILABLE = 'available', '在庫'
        LOANED = 'loaned', '貸出中'
        LOST = 'lost', '紛失'
        RETIRED = 'retired', '廃止'

    card_number = models.CharField('カード番号', max_length=50, unique=True)
    status = models.CharField(
        'ステータス', max_length=10, choices=Status.choices, default=Status.AVAILABLE,
    )
    created_at = models.DateTimeField('登録日時', auto_now_add=True)

    class Meta:
        ordering = ['card_number']

    def __str__(self):
        return f'{self.card_number}（{self.get_status_display()}）'


class CardLoan(models.Model):
    """会員へのセキュリティカード貸出〜返却の1件分の記録"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='card_loans')
    security_card = models.ForeignKey(
        SecurityCard, on_delete=models.PROTECT, related_name='loans',
    )
    # 入退室ログとの対応関係（LogsPage表示・整合性チェック用）。ログ自体はaccessアプリが所有し続ける。
    access_log_in = models.OneToOneField(
        'access.AccessLog', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='card_loan_issued',
    )
    access_log_out = models.OneToOneField(
        'access.AccessLog', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='card_loan_returned',
    )
    issued_at = models.DateTimeField('貸出日時', auto_now_add=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='issued_card_loans',
    )
    returned_at = models.DateTimeField('返却日時', null=True, blank=True)
    returned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='returned_card_loans',
    )

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        status = '返却済' if self.returned_at else '未返却'
        return f'{self.member.name} - {self.security_card.card_number}（{status}）'
