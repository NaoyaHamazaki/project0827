from django.contrib import admin

from .models import MenuItem, Order, OrderLine, OrderSettings


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_available', 'order', 'site_id')
    list_filter = ('is_available',)
    search_fields = ('name',)


@admin.register(OrderSettings)
class OrderSettingsAdmin(admin.ModelAdmin):
    list_display = ('accept_start_time', 'accept_end_time', 'site_id')


class OrderLineInline(admin.TabularInline):
    model = OrderLine
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'status', 'requested_by', 'created_at')
    list_filter = ('status', 'room')
    inlines = (OrderLineInline,)
    date_hierarchy = 'created_at'
