from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AvailableMenuItemsView, MenuItemViewSet, OrderListCreateView, OrderSettingsView,
    OrderStatusUpdateView,
)

router = DefaultRouter()
router.register('menu-items', MenuItemViewSet, basename='order-menu-item')

urlpatterns = [
    path('menu-items/available/', AvailableMenuItemsView.as_view(), name='order-menu-items-available'),
    path('settings/', OrderSettingsView.as_view(), name='order-settings'),
    path('<int:pk>/status/', OrderStatusUpdateView.as_view(), name='order-status'),
    path('', OrderListCreateView.as_view(), name='orders'),
] + router.urls
