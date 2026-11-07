from django.conf import settings
from django.db import models


class MeetingRoom(models.Model):
    """会議室マスタ（会議室設定画面で管理する）"""

    name = models.CharField('会議室名', max_length=100)
    is_bookable = models.BooleanField('予約可能', default=True)
    order = models.PositiveIntegerField('表示順', default=0)
    created_at = models.DateTimeField('登録日時', auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class Reservation(models.Model):
    """会議室の予約情報（どの所属の誰が予約したかは requested_by から辿る）"""

    class Status(models.TextChoices):
        CONFIRMED = 'confirmed', '予約済'
        CANCELLED = 'cancelled', 'キャンセル'

    room = models.ForeignKey(MeetingRoom, on_delete=models.PROTECT, related_name='reservations')
    start_at = models.DateTimeField('開始日時')
    end_at = models.DateTimeField('終了日時')
    note = models.CharField('備考', max_length=200, blank=True)
    status = models.CharField(
        'ステータス', max_length=10, choices=Status.choices, default=Status.CONFIRMED,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='meeting_room_reservations',
    )
    created_at = models.DateTimeField('予約日時', auto_now_add=True)

    class Meta:
        ordering = ['-start_at']

    def __str__(self):
        return f'{self.room.name} {self.start_at:%m/%d %H:%M}〜{self.end_at:%H:%M}'
