from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import DemoGateStatusView, DemoGateVerifyView, MeView, StaffTokenObtainPairView

urlpatterns = [
    path('login/', StaffTokenObtainPairView.as_view(), name='auth-login'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('gate/status/', DemoGateStatusView.as_view(), name='auth-gate-status'),
    path('gate/verify/', DemoGateVerifyView.as_view(), name='auth-gate-verify'),
]
