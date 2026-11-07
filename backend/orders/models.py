from django.conf import settings
from django.db import models
from django.utils import timezone

from meetingrooms.models import MeetingRoom

SITE_ID_HELP = '複数拠点運用を見据えた項目。現状は未使用（空欄のままでよい）'


class MenuItem(models.Model):
    """注文メニューのマスタ（メニュー設定画面で管理する）"""

    name = models.CharField('メニュー名', max_length=100)
    is_available = models.BooleanField('受付可能', default=True)
    order = models.PositiveIntegerField('表示順', default=0)
    site_id = models.CharField('拠点ID', max_length=50, blank=True, help_text=SITE_ID_HELP)
    created_at = models.DateTimeField('登録日時', auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class OrderSettings(models.Model):
    """注文受付の時間帯設定（シングルトン、pk=1固定で1レコードのみ運用）"""

    accept_start_time = models.TimeField('受付開始時刻', null=True, blank=True)
    accept_end_time = models.TimeField('受付終了時刻', null=True, blank=True)
    site_id = models.CharField('拠点ID', max_length=50, blank=True, help_text=SITE_ID_HELP)

    def __str__(self):
        return '注文受付設定'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def is_accepting_now(self):
        """開始・終了のどちらかが未設定なら常時受付可能とする"""
        if not self.accept_start_time or not self.accept_end_time:
            return True
        now = timezone.localtime().time()
        if self.accept_start_time <= self.accept_end_time:
            return self.accept_start_time <= now <= self.accept_end_time
        # 日をまたぐ設定（例: 22:00〜翌6:00）にも一応対応しておく
        return now >= self.accept_start_time or now <= self.accept_end_time


class Order(models.Model):
    """注文（Request系テーブル）。会議室予約の情報を再利用するため会議室とひも付ける"""

    class Status(models.TextChoices):
        RECEIVED = 'received', '受付'
        DONE = 'done', '対応済'
        CANCELLED = 'cancelled', '取消'

    room = models.ForeignKey(MeetingRoom, on_delete=models.PROTECT, related_name='orders')
    status = models.CharField(
        'ステータス', max_length=10, choices=Status.choices, default=Status.RECEIVED,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='orders',
    )
    created_at = models.DateTimeField('注文日時', auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'注文#{self.id}（{self.room.name}）'


class OrderLine(models.Model):
    """注文の明細（メニュー×数量）"""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='lines')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT, related_name='order_lines')
    quantity = models.PositiveIntegerField('数量', default=1)

    def __str__(self):
        return f'{self.menu_item.name} x{self.quantity}'
