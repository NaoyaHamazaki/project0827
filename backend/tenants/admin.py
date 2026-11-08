from django.contrib import admin

from .models import Company, Site


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'created_at')
    search_fields = ('code', 'name')


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'site', 'created_at')
    list_filter = ('site',)
    search_fields = ('code', 'name')
