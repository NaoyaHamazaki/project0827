from django.utils import timezone
from rest_framework import serializers

from .models import FloorPlanItem, FloorShape, MeetingRoom, Reservation


def ensure_no_clash(room, start_at, end_at, exclude_pk=None):
    """同じ会議室で時間が重なる予約（取消済みは除く）があれば ValidationError"""
    clash = Reservation.objects.filter(
        room=room, status=Reservation.Status.CONFIRMED,
        start_at__lt=end_at, end_at__gt=start_at,
    )
    if exclude_pk is not None:
        clash = clash.exclude(pk=exclude_pk)
    if clash.exists():
        raise serializers.ValidationError('この時間帯はすでに予約されています')


class MeetingRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeetingRoom
        fields = ('id', 'name', 'is_bookable', 'order')
        read_only_fields = ('id',)


class ReservationSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source='room.name', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = (
            'id', 'room', 'room_name', 'start_at', 'end_at', 'note', 'status',
            'requested_by_name', 'company_name', 'created_at',
        )
        read_only_fields = ('id', 'status', 'created_at')

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return None

    def get_company_name(self, obj):
        staff = obj.requested_by
        if staff and staff.member:
            return staff.member.company_name
        return None

    def validate(self, attrs):
        start_at = attrs.get('start_at', getattr(self.instance, 'start_at', None))
        end_at = attrs.get('end_at', getattr(self.instance, 'end_at', None))
        if start_at and end_at and end_at <= start_at:
            raise serializers.ValidationError('終了時間は開始時間より後に設定してください')
        room = attrs.get('room', getattr(self.instance, 'room', None))
        if room is not None and not room.is_bookable:
            raise serializers.ValidationError('この会議室は現在予約できません')
        if end_at and end_at <= timezone.now():
            raise serializers.ValidationError('過去の時間は予約できません')
        if room is not None and start_at and end_at:
            ensure_no_clash(room, start_at, end_at, self.instance.pk if self.instance else None)
        return attrs


class ReservationSlotSerializer(serializers.ModelSerializer):
    """日別ビュー用。他人の予約は「予約済」として時間帯だけを返す（本人・管理者には詳細も返す）"""

    is_mine = serializers.SerializerMethodField()
    note = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = (
            'id', 'room', 'start_at', 'end_at', 'is_mine', 'note', 'requested_by_name', 'company_name',
        )

    def _can_see_detail(self, obj):
        user = self.context['request'].user
        return user.is_admin or obj.requested_by_id == user.id

    def get_is_mine(self, obj):
        return obj.requested_by_id == self.context['request'].user.id

    def get_note(self, obj):
        return obj.note if self._can_see_detail(obj) else None

    def get_requested_by_name(self, obj):
        if not self._can_see_detail(obj) or not obj.requested_by:
            return None
        return obj.requested_by.get_full_name() or obj.requested_by.username

    def get_company_name(self, obj):
        staff = obj.requested_by
        if not self._can_see_detail(obj) or not staff or not staff.member:
            return None
        return staff.member.company_name


class FloorShapeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = FloorShape
        fields = ('id', 'name', 'points', 'cells', 'width', 'height', 'created_by_name', 'created_at')
        read_only_fields = ('id', 'created_by_name', 'created_at')

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class FloorPlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FloorPlanItem
        fields = ('id', 'shape', 'name', 'points', 'width', 'height', 'x', 'y', 'wall_height', 'room')
        read_only_fields = ('id',)
