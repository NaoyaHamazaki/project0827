from rest_framework import serializers

from .models import Member, Plan


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ('id', 'name', 'monthly_hour_limit')


class MemberSerializer(serializers.ModelSerializer):
    plan = serializers.PrimaryKeyRelatedField(
        queryset=Plan.objects.all(), allow_null=True, required=False,
    )
    plan_detail = PlanSerializer(source='plan', read_only=True)

    class Meta:
        model = Member
        fields = (
            'id', 'name', 'company_name', 'card_identifier', 'status',
            'plan', 'plan_detail', 'created_at',
        )
        read_only_fields = ('id', 'created_at')


class UsageSessionSerializer(serializers.Serializer):
    check_in = serializers.DateTimeField()
    check_out = serializers.DateTimeField(allow_null=True)
    duration_hours = serializers.FloatField()
    is_ongoing = serializers.BooleanField()


class MemberUsageSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    visit_count = serializers.IntegerField()
    used_hours = serializers.FloatField()
    limit_hours = serializers.IntegerField(allow_null=True)
    remaining_hours = serializers.FloatField(allow_null=True)
    plan_name = serializers.CharField(allow_null=True)
    sessions = UsageSessionSerializer(many=True)
