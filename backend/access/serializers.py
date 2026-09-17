from rest_framework import serializers

from members.models import Member
from members.serializers import MemberSerializer

from .models import AccessLog


class AccessLogSerializer(serializers.ModelSerializer):
    member = MemberSerializer(read_only=True)
    scanned_by_name = serializers.SerializerMethodField()
    security_card_number = serializers.SerializerMethodField()
    security_card_returned = serializers.SerializerMethodField()

    class Meta:
        model = AccessLog
        fields = (
            'id', 'member', 'type', 'method', 'scanned_by_name',
            'security_card_number', 'security_card_returned', 'created_at',
        )

    def get_scanned_by_name(self, obj):
        if obj.scanned_by:
            return obj.scanned_by.get_full_name() or obj.scanned_by.username
        return None

    def get_security_card_number(self, obj):
        # cardsアプリのCardLoanから、このログで貸し出した/返却したカード番号を逆引きする
        loan = getattr(obj, 'card_loan_issued', None) or getattr(obj, 'card_loan_returned', None)
        return loan.security_card.card_number if loan else None

    def get_security_card_returned(self, obj):
        # 入室ログに紐づく貸出が返却済みかどうか（退室ログや貸出なしの場合はNone）
        loan = getattr(obj, 'card_loan_issued', None)
        if loan is None:
            return None
        return loan.returned_at is not None


class ScanRequestSerializer(serializers.Serializer):
    card_identifier = serializers.CharField(max_length=100, trim_whitespace=True)
    method = serializers.ChoiceField(
        choices=AccessLog.Method.choices, required=False, default=AccessLog.Method.CARD,
    )
    security_card_number = serializers.CharField(
        max_length=50, required=False, allow_blank=True, trim_whitespace=True,
    )
    skip_security_card = serializers.BooleanField(required=False, default=False)


class CurrentOccupantSerializer(serializers.ModelSerializer):
    checked_in_at = serializers.DateTimeField()

    class Meta:
        model = Member
        fields = ('id', 'name', 'company_name', 'checked_in_at')


class QrTokenRequestSerializer(serializers.Serializer):
    card_identifier = serializers.CharField(max_length=100, trim_whitespace=True)


class ManualLogSerializer(serializers.Serializer):
    member = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all())
    type = serializers.ChoiceField(choices=AccessLog.LogType.choices)
    timestamp = serializers.DateTimeField()
