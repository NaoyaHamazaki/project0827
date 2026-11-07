import uuid

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from accounts.models import Staff

from .models import Member, MemberInvite, Plan


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


def _unique_username(email):
    base = slugify(email.split('@')[0]) or 'member'
    username = base
    suffix = 1
    while Staff.objects.filter(username=username).exists():
        suffix += 1
        username = f'{base}{suffix}'
    return username


def _create_member_and_staff(*, name, email, password, company_name='', card_identifier='', plan=None):
    if not card_identifier:
        card_identifier = f'SELF-{uuid.uuid4().hex[:10].upper()}'
    with transaction.atomic():
        member = Member.objects.create(
            name=name, company_name=company_name or '', card_identifier=card_identifier, plan=plan,
        )
        staff = Staff.objects.create_user(
            username=_unique_username(email), email=email, password=password,
            first_name=name, role=Staff.Role.USER, member=member,
        )
    return member, staff


class AdminMemberRegisterSerializer(serializers.Serializer):
    """「新規会員作成」＞フォームに入力：管理者が会員情報とログイン情報をまとめて登録する"""

    name = serializers.CharField(max_length=100)
    company_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    card_identifier = serializers.CharField(max_length=100, required=False, allow_blank=True)
    plan = serializers.PrimaryKeyRelatedField(queryset=Plan.objects.all(), allow_null=True, required=False)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if Staff.objects.filter(email=value).exists():
            raise serializers.ValidationError('このメールアドレスは既に使用されています')
        return value

    def validate_card_identifier(self, value):
        if value and Member.objects.filter(card_identifier=value).exists():
            raise serializers.ValidationError('このカードIDは既に使用されています')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        member, staff = _create_member_and_staff(**validated_data)
        return member


class MemberInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberInvite
        fields = ('token', 'expires_at')
        read_only_fields = fields


class InviteStatusSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    expires_at = serializers.DateTimeField(allow_null=True)


class SelfRegisterSerializer(serializers.Serializer):
    """招待リンク（QR／URL）から、会員本人が自分の情報を入力して登録する"""

    name = serializers.CharField(max_length=100)
    company_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    card_identifier = serializers.CharField(max_length=100, required=False, allow_blank=True)
    plan = serializers.PrimaryKeyRelatedField(queryset=Plan.objects.all(), allow_null=True, required=False)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if Staff.objects.filter(email=value).exists():
            raise serializers.ValidationError('このメールアドレスは既に使用されています')
        return value

    def validate_card_identifier(self, value):
        if value and Member.objects.filter(card_identifier=value).exists():
            raise serializers.ValidationError('このカードIDは既に使用されています')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        member, staff = _create_member_and_staff(**validated_data)
        return member
