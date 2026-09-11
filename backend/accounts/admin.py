from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Staff


@admin.register(Staff)
class StaffAdmin(UserAdmin):
    model = Staff
    list_display = ('email', 'username', 'first_name', 'last_name', 'role', 'member', 'language', 'is_active')
    list_filter = ('role', 'language', 'is_active')
    ordering = ('email',)
    fieldsets = UserAdmin.fieldsets + (
        ('権限', {'fields': ('role', 'member', 'language')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('権限', {'fields': ('role', 'email', 'member', 'language')}),
    )
