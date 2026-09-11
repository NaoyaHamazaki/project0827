from rest_framework import generics, viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsAdmin

from .models import CardLoan, SecurityCard
from .serializers import CardLoanSerializer, SecurityCardSerializer


class SecurityCardViewSet(viewsets.ModelViewSet):
    """セキュリティカード台帳の一覧・追加・編集・廃止（管理者専用）"""

    serializer_class = SecurityCardSerializer
    permission_classes = (IsAdmin,)
    queryset = SecurityCard.objects.all()
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset


class AvailableSecurityCardsView(generics.ListAPIView):
    """スキャン受付画面で貸出可能なカードを選ぶための一覧（Admin/User共通）"""

    serializer_class = SecurityCardSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_queryset(self):
        return SecurityCard.objects.filter(status=SecurityCard.Status.AVAILABLE)


class CardLoanListView(generics.ListAPIView):
    """貸出記録一覧（未返却のみのフィルタ対応）"""

    serializer_class = CardLoanSerializer
    permission_classes = (IsAdmin,)
    pagination_class = None

    def get_queryset(self):
        queryset = CardLoan.objects.select_related(
            'member', 'security_card', 'issued_by', 'returned_by',
        )
        if self.request.query_params.get('unreturned') == 'true':
            queryset = queryset.filter(returned_at__isnull=True)
        return queryset
