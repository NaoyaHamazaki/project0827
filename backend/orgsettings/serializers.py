from rest_framework import serializers

from .models import OrgSettings, Webhook


class OrgSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgSettings
        fields = ('enabled_checkin_methods', 'csv_export_columns')


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = ('id', 'name', 'url', 'secret', 'event_types', 'is_active', 'created_at')
        read_only_fields = ('id', 'created_at')
