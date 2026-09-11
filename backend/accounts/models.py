from django.contrib.auth.models import AbstractUser
from django.db import models


class Staff(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', '管理者'
        USER = 'user', 'ユーザー'

    class Language(models.TextChoices):
        JA = 'ja', '日本語'
        EN = 'en', 'English'

    email = models.EmailField('メールアドレス', unique=True)
    role = models.CharField(
        '権限', max_length=10, choices=Role.choices, default=Role.USER
    )
    language = models.CharField(
        '表示言語', max_length=5, choices=Language.choices, default=Language.JA
    )
    member = models.ForeignKey(
        'members.Member', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='staff_accounts',
        help_text='ユーザーロールのアカウントが紐付く会員（自分のQR/カードID表示に使用）',
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f'{self.get_full_name() or self.username} ({self.get_role_display()})'

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN
