from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnnouncementViewSet, DebugTableListView, DebugTableRowsView, OrgSettingsView, WebhookViewSet,
)

router = DefaultRouter()
router.register('webhooks', WebhookViewSet, basename='webhook')
router.register('announcements', AnnouncementViewSet, basename='announcement')

urlpatterns = [
    path('', OrgSettingsView.as_view(), name='org-settings'),
    path('debug-tables/', DebugTableListView.as_view(), name='debug-tables'),
    path('debug-tables/rows/', DebugTableRowsView.as_view(), name='debug-table-rows'),
    path('', include(router.urls)),
]
