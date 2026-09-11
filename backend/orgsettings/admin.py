from django.contrib import admin

from .models import OrgSettings, Webhook


@admin.register(OrgSettings)
class OrgSettingsAdmin(admin.ModelAdmin):
    list_display = ('enabled_checkin_methods', 'csv_export_columns')


@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ('name', 'url', 'event_types', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'url')
