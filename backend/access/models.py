import uuid

from django.conf import settings
from django.db import models

from members.models import Member


class AccessLog(models.Model):
    class LogType(models.TextChoices):
        CHECK_IN = 'check_in', '入室'
        CHECK_OUT = 'check_out', '退室'

    class Method(models.TextChoices):
        CARD = 'card', 'バーコード/ICカード'
        PIN = 'pin', '番号入力'
        QR = 'qr', 'QRコード'
        FINGERPRINT = 'fingerprint', '指紋認証'
        PHONE = 'phone', 'スマホ認証'
        MANUAL = 'manual', '手動入力（管理者）'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='access_logs')
    type = models.CharField('種別', max_length=10, choices=LogType.choices)
    method = models.CharField(
        '入力方式', max_length=20, choices=Method.choices, default=Method.CARD,
    )
    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='scanned_logs',
    )
    created_at = models.DateTimeField('打刻日時', auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.member.name} - {self.get_type_display()} ({self.created_at:%Y-%m-%d %H:%M})'
