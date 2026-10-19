from django.conf import settings
from django.db import models


class Conversation(models.Model):
    """アカウント同士のチャットルーム。参加者以外は一切参照できない。"""

    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through='Participant', related_name='conversations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ('-updated_at',)


class Participant(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='memberships',
    )
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_memberships',
    )
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('conversation', 'staff'), name='uniq_chat_participant'),
        ]


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_messages',
    )
    # 太字は **text** のマークアップで保存する（HTMLは保存しない）
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('id',)


class Reaction(models.Model):
    THUMBS_UP = '👍'

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_reactions',
    )
    emoji = models.CharField(max_length=8, default=THUMBS_UP)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('message', 'staff', 'emoji'), name='uniq_chat_reaction'),
        ]
