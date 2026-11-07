from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BookableMeetingRoomsView, FloorPlanItemsView, FloorShapeListCreateView, MeetingRoomViewSet,
    ReservationCancelView, ReservationListCreateView,
)

router = DefaultRouter()
router.register('rooms', MeetingRoomViewSet, basename='meeting-room')

urlpatterns = [
    path('rooms/bookable/', BookableMeetingRoomsView.as_view(), name='meeting-rooms-bookable'),
    path('reservations/', ReservationListCreateView.as_view(), name='meeting-room-reservations'),
    path('reservations/<int:pk>/cancel/', ReservationCancelView.as_view(), name='meeting-room-reservation-cancel'),
    path('floor-shapes/', FloorShapeListCreateView.as_view(), name='floor-shapes'),
    path('floor-plan-items/', FloorPlanItemsView.as_view(), name='floor-plan-items'),
] + router.urls
