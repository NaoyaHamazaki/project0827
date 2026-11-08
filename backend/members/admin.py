from django.contrib import admin

from .models import Member, MemberInvite, Plan


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('member_code', 'name', 'company', 'site', 'is_representative', 'card_identifier', 'status', 'plan', 'created_at')
    list_filter = ('status', 'plan')
    search_fields = ('member_code', 'name', 'company__name', 'card_identifier')


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'monthly_hour_limit', 'created_at')
    search_fields = ('name',)


@admin.register(MemberInvite)
class MemberInviteAdmin(admin.ModelAdmin):
    list_display = ('token', 'created_by', 'expires_at', 'used_at', 'created_at')
    list_filter = ('used_at',)
