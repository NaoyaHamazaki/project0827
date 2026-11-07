from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BookableMeetingRoomsView, MeetingRoomViewSet, ReservationCancelView,
    ReservationListCreateView,
)

router = DefaultRouter()
router.register('rooms', MeetingRoomViewSet, basename='meeting-room')

urlpatterns = [
    path('rooms/bookable/', BookableMeetingRoomsView.as_view(), name='meeting-rooms-bookable'),
    path('reservations/', ReservationListCreateView.as_view(), name='meeting-room-reservations'),
    path('reservations/<int:pk>/cancel/', ReservationCancelView.as_view(), name='meeting-room-reservation-cancel'),
] + router.urls
