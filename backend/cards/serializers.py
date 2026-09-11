from rest_framework import serializers

from members.serializers import MemberSerializer

from .models import CardLoan, SecurityCard


class SecurityCardSerializer(serializers.ModelSerializer):
    current_holder = serializers.SerializerMethodField()

    class Meta:
        model = SecurityCard
        fields = ('id', 'card_number', 'status', 'created_at', 'current_holder')
        read_only_fields = ('id', 'created_at')

    def get_current_holder(self, obj):
        loan = obj.loans.filter(returned_at__isnull=True).select_related('member').first()
        if not loan:
            return None
        return {
            'member_id': loan.member_id,
            'member_name': loan.member.name,
            'issued_at': loan.issued_at,
        }


class CardLoanSerializer(serializers.ModelSerializer):
    member = MemberSerializer(read_only=True)
    security_card = SecurityCardSerializer(read_only=True)
    issued_by_name = serializers.SerializerMethodField()
    returned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CardLoan
        fields = (
            'id', 'member', 'security_card', 'issued_at', 'issued_by_name',
            'returned_at', 'returned_by_name',
        )

    def get_issued_by_name(self, obj):
        if obj.issued_by:
            return obj.issued_by.get_full_name() or obj.issued_by.username
        return None

    def get_returned_by_name(self, obj):
        if obj.returned_by:
            return obj.returned_by.get_full_name() or obj.returned_by.username
        return None
