from rest_framework import serializers

from .models import MeetingRoom, Reservation


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
        return attrs
