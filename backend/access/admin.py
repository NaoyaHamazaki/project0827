from django.contrib import admin

from .models import AccessLog


@admin.register(AccessLog)
class AccessLogAdmin(admin.ModelAdmin):
    list_display = ('member', 'type', 'scanned_by', 'created_at')
    list_filter = ('type',)
    search_fields = ('member__name', 'member__company_name')
    date_hierarchy = 'created_at'
