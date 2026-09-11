from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AvailableSecurityCardsView, CardLoanListView, SecurityCardViewSet

router = DefaultRouter()
router.register('', SecurityCardViewSet, basename='security-card')

urlpatterns = [
    path('available/', AvailableSecurityCardsView.as_view(), name='security-cards-available'),
    path('loans/', CardLoanListView.as_view(), name='card-loans'),
] + router.urls
