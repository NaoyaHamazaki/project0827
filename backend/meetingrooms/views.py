from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin

from .models import MeetingRoom, Reservation
from .serializers import MeetingRoomSerializer, ReservationSerializer


class MeetingRoomViewSet(viewsets.ModelViewSet):
    """会議室マスタの一覧・追加・編集・削除（会議室設定画面・管理者専用）"""

    serializer_class = MeetingRoomSerializer
    permission_classes = (IsAdmin,)
    queryset = MeetingRoom.objects.all()
    pagination_class = None


class BookableMeetingRoomsView(generics.ListAPIView):
    """予約フォームの会議室選択肢（Admin/User共通、予約可能な会議室のみ）"""

    serializer_class = MeetingRoomSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_queryset(self):
        return MeetingRoom.objects.filter(is_bookable=True)


class ReservationListCreateView(generics.ListCreateAPIView):
    """予約状況の一覧（管理者専用）／会議室予約の作成（Admin/User共通）"""

    serializer_class = ReservationSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [IsAdmin()]

    def get_queryset(self):
        return Reservation.objects.select_related('room', 'requested_by__member')

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)


class ReservationCancelView(APIView):
    """予約のキャンセル（管理者、または予約を行った本人のみ）"""

    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        reservation = get_object_or_404(Reservation, pk=pk)
        if not request.user.is_admin and reservation.requested_by_id != request.user.id:
            return Response({'detail': 'この予約をキャンセルする権限がありません'}, status=403)
        reservation.status = Reservation.Status.CANCELLED
        reservation.save(update_fields=['status'])
        return Response(ReservationSerializer(reservation).data)
