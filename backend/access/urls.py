from django.urls import path

from .views import (
    AccessLogDetailView,
    AccessLogExportView,
    AccessLogListView,
    AccessLogManualCreateView,
    CurrentOccupantsView,
    MyHistoryView,
    MyQrView,
    MyStatusView,
    QrTokenView,
    RecentLogsView,
    ScanView,
)

urlpatterns = [
    path('scan/', ScanView.as_view(), name='scan'),
    path('qr-token/', QrTokenView.as_view(), name='qr-token'),
    path('my-qr/', MyQrView.as_view(), name='my-qr'),
    path('my-status/', MyStatusView.as_view(), name='my-status'),
    path('my-history/', MyHistoryView.as_view(), name='my-history'),
    path('logs/recent/', RecentLogsView.as_view(), name='logs-recent'),
    path('logs/current/', CurrentOccupantsView.as_view(), name='logs-current'),
    path('logs/export/', AccessLogExportView.as_view(), name='logs-export'),
    path('logs/manual/', AccessLogManualCreateView.as_view(), name='logs-manual-create'),
    path('logs/<uuid:pk>/', AccessLogDetailView.as_view(), name='logs-detail'),
    path('logs/', AccessLogListView.as_view(), name='logs-list'),
]
