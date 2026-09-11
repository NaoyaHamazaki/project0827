from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/members/', include('members.urls')),
    path('api/orgsettings/', include('orgsettings.urls')),
    path('api/cards/', include('cards.urls')),
    path('api/', include('access.urls')),
]
