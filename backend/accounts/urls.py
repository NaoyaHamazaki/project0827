from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import MeView, StaffTokenObtainPairView

urlpatterns = [
    path('login/', StaffTokenObtainPairView.as_view(), name='auth-login'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
]
