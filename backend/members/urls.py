from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminMemberRegisterView, InviteRegisterView, InviteStatusView, MemberInviteCreateView,
    MemberViewSet, PlanViewSet, PublicPlanListView,
)

router = DefaultRouter()
router.register('plans', PlanViewSet, basename='plan')
router.register('', MemberViewSet, basename='member')

urlpatterns = [
    path('register/', AdminMemberRegisterView.as_view(), name='member-admin-register'),
    path('invites/', MemberInviteCreateView.as_view(), name='member-invite-create'),
    path('invites/public-plans/', PublicPlanListView.as_view(), name='member-invite-public-plans'),
    path('invites/<str:token>/', InviteStatusView.as_view(), name='member-invite-status'),
    path('invites/<str:token>/register/', InviteRegisterView.as_view(), name='member-invite-register'),
] + router.urls
