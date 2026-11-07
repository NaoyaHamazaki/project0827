from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin

from .models import MenuItem, Order, OrderSettings
from .serializers import MenuItemSerializer, OrderSerializer, OrderSettingsSerializer


class MenuItemViewSet(viewsets.ModelViewSet):
    """注文メニューの一覧・追加・編集・削除（メニュー設定画面・管理者専用）"""

    serializer_class = MenuItemSerializer
    permission_classes = (IsAdmin,)
    queryset = MenuItem.objects.all()
    pagination_class = None


class AvailableMenuItemsView(generics.ListAPIView):
    """注文フォームのメニュー選択肢（Admin/User共通、受付可能なメニューのみ）"""

    serializer_class = MenuItemSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_queryset(self):
        return MenuItem.objects.filter(is_available=True)


class OrderSettingsView(APIView):
    """注文受付時間帯の取得／更新（取得はAdmin/User共通、更新は管理者専用）"""

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get(self, request):
        return Response(OrderSettingsSerializer(OrderSettings.load()).data)

    def patch(self, request):
        obj = OrderSettings.load()
        serializer = OrderSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class OrderListCreateView(generics.ListCreateAPIView):
    """注文一覧（管理者専用）／注文の作成（Admin/User共通、受付時間内のみ）"""

    serializer_class = OrderSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [IsAdmin()]

    def get_queryset(self):
        return Order.objects.select_related('room', 'requested_by__member').prefetch_related(
            'lines__menu_item',
        )

    def perform_create(self, serializer):
        if not OrderSettings.load().is_accepting_now():
            raise ValidationError('現在は注文受付時間外です')
        serializer.save(requested_by=self.request.user)


class OrderStatusUpdateView(APIView):
    """注文ステータスの変更（受付／対応済／取消、管理者専用）"""

    permission_classes = (IsAdmin,)

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk)
        status_value = request.data.get('status')
        if status_value not in Order.Status.values:
            return Response({'detail': '不正なステータスです'}, status=400)
        order.status = status_value
        order.save(update_fields=['status'])
        return Response(OrderSerializer(order).data)
