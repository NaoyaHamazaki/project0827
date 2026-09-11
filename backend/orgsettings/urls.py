from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OrgSettingsView, WebhookViewSet

router = DefaultRouter()
router.register('webhooks', WebhookViewSet, basename='webhook')

urlpatterns = [
    path('', OrgSettingsView.as_view(), name='org-settings'),
    path('', include(router.urls)),
]
