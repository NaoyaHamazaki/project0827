from django.conf import settings
from django.db import models


class MeetingRoom(models.Model):
    """会議室マスタ（会議室設定画面で管理する）"""

    name = models.CharField('会議室名', max_length=100)
    is_bookable = models.BooleanField('予約可能', default=True)
    order = models.PositiveIntegerField('表示順', default=0)
    site_id = models.CharField(
        '拠点ID', max_length=50, blank=True,
        help_text='複数拠点運用を見据えた項目。現状は未使用（空欄のままでよい）',
    )
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


class FloorShape(models.Model):
    """間取り図作成画面の描画履歴（マス目→頂点判定した図形を「この図形を使用」で再利用するため）"""

    name = models.CharField('名称', max_length=100, blank=True)
    points = models.JSONField('頂点座標', help_text='左上を(0,0)に揃えた [[x,y], ...] の配列')
    cells = models.JSONField('マス目の選択状態', help_text='grid[row][col] = true/false の2次元配列')
    width = models.PositiveIntegerField('幅（マス）')
    height = models.PositiveIntegerField('高さ（マス）')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='floor_shapes',
    )
    created_at = models.DateTimeField('作成日時', auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name or f'図形#{self.id}'


class FloorPlanItem(models.Model):
    """間取り図に配置済みの図形（キャンバス全体をまとめて保存・復元する）"""

    shape = models.ForeignKey(
        FloorShape, on_delete=models.SET_NULL, null=True, blank=True, related_name='placements',
    )
    name = models.CharField('名称', max_length=100, blank=True)
    points = models.JSONField('頂点座標')
    width = models.PositiveIntegerField('幅（マス）')
    height = models.PositiveIntegerField('高さ（マス）')
    x = models.FloatField('配置X（マス）')
    y = models.FloatField('配置Y（マス）')
    wall_height = models.PositiveIntegerField('壁の高さ（cm）', default=250)
    room = models.ForeignKey(
        MeetingRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='floor_plan_items',
    )

    def __str__(self):
        return self.name or f'配置#{self.id}'
