from rest_framework import serializers

from accounts.models import Staff

from .models import Message, Reaction


def display_name(staff):
    return staff.get_full_name() or staff.username


class ChatUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    company = serializers.SerializerMethodField()

    class Meta:
        model = Staff
        fields = ('id', 'display_name', 'email', 'company')

    def get_display_name(self, obj):
        return display_name(obj)

    def get_company(self, obj):
        return getattr(obj.member, 'company_name', '') if obj.member else ''


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(read_only=True)
    sender_name = serializers.SerializerMethodField()
    thumbs_up_count = serializers.SerializerMethodField()
    thumbs_up_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ('id', 'sender_id', 'sender_name', 'body', 'created_at',
                  'thumbs_up_count', 'thumbs_up_by_me')

    def get_sender_name(self, obj):
        return display_name(obj.sender)

    def _reactions(self, obj):
        return [r for r in obj.reactions.all() if r.emoji == Reaction.THUMBS_UP]

    def get_thumbs_up_count(self, obj):
        return len(self._reactions(obj))

    def get_thumbs_up_by_me(self, obj):
        me = self.context['request'].user.id
        return any(r.staff_id == me for r in self._reactions(obj))


class SendMessageSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, trim_whitespace=True)
