from django.contrib import admin
from django.urls import include, path, re_path

from .spa import spa_index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/members/', include('members.urls')),
    path('api/orgsettings/', include('orgsettings.urls')),
    path('api/cards/', include('cards.urls')),
    path('api/', include('access.urls')),
    # 上記以外の全パスはビルド済みフロントエンド（frontend/dist/index.html）を返す。
    # React Router側のルート（/members, /logs など）を直接開いたときのため、
    # 必ず一番最後に置くこと。
    re_path(r'^(?!admin/|api/|static/).*$', spa_index),
]
