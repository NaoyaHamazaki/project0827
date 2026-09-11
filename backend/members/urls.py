from rest_framework.routers import DefaultRouter

from .views import MemberViewSet, PlanViewSet

router = DefaultRouter()
router.register('plans', PlanViewSet, basename='plan')
router.register('', MemberViewSet, basename='member')

urlpatterns = router.urls
