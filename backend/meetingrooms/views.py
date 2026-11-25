from datetime import datetime, time, timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin

from .models import FloorPlanItem, FloorShape, MeetingRoom, Reservation
from .serializers import (
    FloorPlanItemSerializer, FloorShapeSerializer, MeetingRoomSerializer, ReservationSerializer,
    ReservationSlotSerializer, ensure_no_clash,
)


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
        # 同時に同じ会議室を予約されたときの二重登録を防ぐため、会議室の行をロックしてから重複を判定する
        data = serializer.validated_data
        with transaction.atomic():
            MeetingRoom.objects.select_for_update().get(pk=data['room'].pk)
            ensure_no_clash(data['room'], data['start_at'], data['end_at'])
            serializer.save(requested_by=self.request.user)


class ReservationDayView(APIView):
    """日別ビュー（?date=YYYY-MM-DD）。予約可能な会議室と、その日にかかる予約（取消を除く）を返す"""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        raw = request.query_params.get('date')
        try:
            day = datetime.strptime(raw, '%Y-%m-%d').date() if raw else timezone.localdate()
        except ValueError:
            return Response({'detail': '日付は YYYY-MM-DD 形式で指定してください'}, status=400)
        day_start = timezone.make_aware(datetime.combine(day, time.min))
        day_end = day_start + timedelta(days=1)
        reservations = Reservation.objects.filter(
            status=Reservation.Status.CONFIRMED, start_at__lt=day_end, end_at__gt=day_start,
        ).select_related('requested_by__member').order_by('start_at')
        rooms = MeetingRoom.objects.filter(is_bookable=True)
        return Response({
            'date': day.isoformat(),
            'rooms': MeetingRoomSerializer(rooms, many=True).data,
            'reservations': ReservationSlotSerializer(
                reservations, many=True, context={'request': request},
            ).data,
        })


class ReservationUpdateView(generics.UpdateAPIView):
    """予約の変更（会議室・時間・備考）。管理者、または予約を行った本人のみ"""

    serializer_class = ReservationSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ['patch']

    def get_queryset(self):
        return Reservation.objects.filter(status=Reservation.Status.CONFIRMED)

    def get_object(self):
        reservation = super().get_object()
        if not self.request.user.is_admin and reservation.requested_by_id != self.request.user.id:
            self.permission_denied(self.request, message='この予約を変更する権限がありません')
        return reservation

    def perform_update(self, serializer):
        instance, data = serializer.instance, serializer.validated_data
        room = data.get('room', instance.room)
        with transaction.atomic():
            MeetingRoom.objects.select_for_update().get(pk=room.pk)
            ensure_no_clash(
                room, data.get('start_at', instance.start_at), data.get('end_at', instance.end_at), instance.pk,
            )
            serializer.save()


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


class FloorShapeListCreateView(generics.ListCreateAPIView):
    """間取り図の描画履歴（「この図を使用」で保存し、「この図形を使用」で呼び出す。管理者専用）"""

    serializer_class = FloorShapeSerializer
    permission_classes = (IsAdmin,)
    queryset = FloorShape.objects.all()
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class FloorPlanItemsView(APIView):
    """キャンバスに配置済みの図形一式（取得はAdmin/User共通＝フロアマップ予約で使う、一括保存は管理者専用）"""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAdmin()]

    def get(self, request):
        items = FloorPlanItem.objects.select_related('room')
        return Response(FloorPlanItemSerializer(items, many=True).data)

    def put(self, request):
        serializer = FloorPlanItemSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        FloorPlanItem.objects.all().delete()
        FloorPlanItem.objects.bulk_create([FloorPlanItem(**item) for item in serializer.validated_data])
        return Response(FloorPlanItemSerializer(FloorPlanItem.objects.select_related('room'), many=True).data)
