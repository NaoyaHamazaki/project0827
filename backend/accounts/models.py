from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Max


class Account(AbstractUser):
    """ログイン用アカウント。マスター／管理者／代表／ユーザーの4種類すべてをここで扱う。
    代表とユーザーは会員情報（members.Member）と1対1でひも付く。
    """

    class Role(models.TextChoices):
        MASTER = 'master', 'マスター'
        ADMIN = 'admin', '管理者'
        REPRESENTATIVE = 'representative', 'ユーザー（代表）'
        USER = 'user', 'ユーザー'

    class Language(models.TextChoices):
        JA = 'ja', '日本語'
        EN = 'en', 'English'

    email = models.EmailField('メールアドレス', unique=True)
    role = models.CharField(
        '権限', max_length=20, choices=Role.choices, default=Role.USER
    )
    language = models.CharField(
        '表示言語', max_length=5, choices=Language.choices, default=Language.JA
    )
    site = models.ForeignKey(
        'tenants.Site', on_delete=models.PROTECT, null=True, blank=True,
        related_name='accounts', verbose_name='所管',
    )
    admin_number = models.PositiveSmallIntegerField(
        '管理番号', null=True, blank=True, help_text='管理者の所管内での連番（自動採番）',
    )
    member = models.OneToOneField(
        'members.Member', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='account', verbose_name='会員情報',
        help_text='代表・ユーザーのアカウントがひも付く会員情報',
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = 'アカウント'
        verbose_name_plural = 'アカウント'
        constraints = [
            models.UniqueConstraint(
                fields=('site', 'admin_number'), name='uniq_admin_number_per_site',
            ),
        ]

    def __str__(self):
        return f'{self.get_full_name() or self.username} ({self.get_role_display()})'

    def save(self, *args, **kwargs):
        if self.role == self.Role.ADMIN and self.site_id and self.admin_number is None:
            current = Account.objects.filter(site_id=self.site_id).aggregate(m=Max('admin_number'))['m']
            self.admin_number = (current or 0) + 1
        if self.role == self.Role.ADMIN and self.site_id and not (self.first_name or self.last_name):
            # 例: 中野_管理者01（所管名＋管理番号で、どの支店の何人目かが分かる表示名）
            self.first_name = f'{self.site.name}_管理者{self.admin_number:02d}'
        super().save(*args, **kwargs)

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_master(self):
        return self.role == self.Role.MASTER
