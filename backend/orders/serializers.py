from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import MenuItem, Order, OrderLine, OrderSettings


class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = ('id', 'name', 'is_available', 'order', 'site_id')
        read_only_fields = ('id',)


class OrderSettingsSerializer(serializers.ModelSerializer):
    is_accepting_now = serializers.SerializerMethodField()

    class Meta:
        model = OrderSettings
        fields = ('accept_start_time', 'accept_end_time', 'site_id', 'is_accepting_now')

    def get_is_accepting_now(self, obj):
        return obj.is_accepting_now()


class OrderLineSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source='menu_item.name', read_only=True)

    class Meta:
        model = OrderLine
        fields = ('id', 'menu_item', 'menu_item_name', 'quantity')


class OrderLineInputSerializer(serializers.Serializer):
    menu_item = serializers.PrimaryKeyRelatedField(queryset=MenuItem.objects.all())
    quantity = serializers.IntegerField(min_value=1)


class OrderSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source='room.name', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    lines = OrderLineSerializer(many=True, read_only=True)
    items = OrderLineInputSerializer(many=True, write_only=True)

    class Meta:
        model = Order
        fields = (
            'id', 'room', 'room_name', 'status', 'requested_by_name', 'company_name',
            'lines', 'items', 'requested_at', 'created_at',
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

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('メニューを1つ以上選択してください')
        for item in items:
            if not item['menu_item'].is_available:
                raise serializers.ValidationError(f"「{item['menu_item'].name}」は現在受付できません")
        return items

    def validate_requested_at(self, value):
        """時間指定は「今より後」かつ「受付時間帯の範囲内」かつ「24時間以内」に限る"""
        if value is None:
            return value
        now = timezone.now()
        if value <= now:
            raise serializers.ValidationError('指定時刻は現在より後の時刻を選んでください')
        if value - now > timedelta(hours=24):
            raise serializers.ValidationError('指定時刻は24時間以内で選んでください')
        if not OrderSettings.load().is_within_accept_time(timezone.localtime(value).time()):
            raise serializers.ValidationError('指定時刻が受付時間外です')
        return value

    def create(self, validated_data):
        items = validated_data.pop('items')
        order = Order.objects.create(**validated_data)
        OrderLine.objects.bulk_create([
            OrderLine(order=order, menu_item=item['menu_item'], quantity=item['quantity'])
            for item in items
        ])
        return order
