from django.contrib import admin

from .models import MeetingRoom, Reservation


@admin.register(MeetingRoom)
class MeetingRoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_bookable', 'order')
    list_filter = ('is_bookable',)
    search_fields = ('name',)


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ('room', 'start_at', 'end_at', 'status', 'requested_by')
    list_filter = ('status', 'room')
    search_fields = ('room__name', 'note')
    date_hierarchy = 'start_at'
