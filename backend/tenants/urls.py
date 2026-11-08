from django.urls import path

from .views import SiteAdminListView, SiteListCreateView

urlpatterns = [
    path('sites/', SiteListCreateView.as_view(), name='tenant-sites'),
    path('sites/<int:pk>/admins/', SiteAdminListView.as_view(), name='tenant-site-admins'),
]
