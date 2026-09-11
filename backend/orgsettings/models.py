from django.db import models

DEFAULT_ENABLED_METHODS = ['card']
DEFAULT_CSV_COLUMNS = ['member_name', 'company_name', 'type', 'staff', 'timestamp']


class OrgSettings(models.Model):
    """企業ごとの運用設定（シングルトン、pk=1固定で1レコードのみ運用）"""

    enabled_checkin_methods = models.JSONField(
        '有効な入力方式', default=list,
        help_text='受付画面で有効化する入力方式コードのリスト（例: ["card","pin","qr"]）',
    )
    csv_export_columns = models.JSONField(
        'CSV出力列', default=list,
        help_text='CSVエクスポート時に含める列キーのリスト',
    )

    def __str__(self):
        return '企業設定'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                'enabled_checkin_methods': DEFAULT_ENABLED_METHODS,
                'csv_export_columns': DEFAULT_CSV_COLUMNS,
            },
        )
        return obj


class Webhook(models.Model):
    class EventType(models.TextChoices):
        CHECK_IN = 'checkin', '入室'
        CHECK_OUT = 'checkout', '退室'

    name = models.CharField('名称', max_length=100)
    url = models.URLField('通知先URL', max_length=500)
    secret = models.CharField('シークレット', max_length=200, blank=True)
    event_types = models.JSONField(
        '発火イベント', default=list,
        help_text='発火するイベント種別のリスト（checkin / checkout）',
    )
    is_active = models.BooleanField('有効', default=True)
    created_at = models.DateTimeField('登録日時', auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
