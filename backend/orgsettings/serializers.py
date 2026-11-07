from rest_framework import serializers

from .models import Announcement, OrgSettings, Webhook


class OrgSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgSettings
        fields = ('enabled_checkin_methods', 'csv_export_columns')


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = ('id', 'name', 'url', 'secret', 'event_types', 'is_active', 'created_at')
        read_only_fields = ('id', 'created_at')


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = ('id', 'title', 'body', 'created_by_name', 'created_at')
        read_only_fields = ('id', 'created_by_name', 'created_at')

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
