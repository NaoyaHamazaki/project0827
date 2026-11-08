import uuid

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from accounts.models import Account

from tenants.models import Company, default_site

from .models import Member, MemberInvite, Plan


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ('id', 'name', 'monthly_hour_limit')


def acting_site(account):
    """操作しているアカウントの所管。未設定（マスター等）の場合は既定の所管"""
    if account is not None and getattr(account, 'site_id', None) and not account.site.is_master:
        return account.site
    return default_site()


class MemberSerializer(serializers.ModelSerializer):
    plan = serializers.PrimaryKeyRelatedField(
        queryset=Plan.objects.all(), allow_null=True, required=False,
    )
    plan_detail = PlanSerializer(source='plan', read_only=True)
    # 画面からは所属名で指定する。所管内で同名の所属があればそれを使い、無ければ作る
    company_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    site_code = serializers.CharField(source='site.code', read_only=True, default='')
    company_code = serializers.CharField(source='company.code', read_only=True, default='')

    class Meta:
        model = Member
        fields = (
            'id', 'member_code', 'name', 'company_name', 'site_code', 'company_code',
            'is_representative', 'card_identifier', 'status', 'plan', 'plan_detail', 'created_at',
        )
        read_only_fields = ('id', 'member_code', 'is_representative', 'created_at')

    def _apply_company(self, validated_data, instance=None):
        if 'company_name' not in validated_data:
            return
        name = validated_data.pop('company_name')
        request = self.context.get('request')
        site = instance.site if instance and instance.site_id else acting_site(getattr(request, 'user', None))
        validated_data['company'] = Company.resolve(site, name)
        validated_data['site'] = site

    def create(self, validated_data):
        self._apply_company(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._apply_company(validated_data, instance)
        return super().update(instance, validated_data)


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
    while Account.objects.filter(username=username).exists():
        suffix += 1
        username = f'{base}{suffix}'
    return username


def _create_member_and_account(*, site, name, email, password, company_name='', card_identifier='', plan=None):
    """会員情報とログインアカウントを同時に作る。所属に代表がまだいなければ代表にする"""
    if not card_identifier:
        card_identifier = f'SELF-{uuid.uuid4().hex[:10].upper()}'
    with transaction.atomic():
        company = Company.resolve(site, company_name)
        is_representative = company is not None and not company.members.filter(is_representative=True).exists()
        member = Member.objects.create(
            name=name, site=site, company=company, is_representative=is_representative,
            card_identifier=card_identifier, plan=plan,
        )
        account = Account.objects.create_user(
            username=_unique_username(email), email=email, password=password, first_name=name,
            role=Account.Role.REPRESENTATIVE if is_representative else Account.Role.USER,
            site=site, member=member,
        )
    return member, account


class AdminMemberRegisterSerializer(serializers.Serializer):
    """「新規会員作成」＞フォームに入力：管理者が会員情報とログイン情報をまとめて登録する"""

    name = serializers.CharField(max_length=100)
    company_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    card_identifier = serializers.CharField(max_length=100, required=False, allow_blank=True)
    plan = serializers.PrimaryKeyRelatedField(queryset=Plan.objects.all(), allow_null=True, required=False)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if Account.objects.filter(email=value).exists():
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
        member, _ = _create_member_and_account(**validated_data)
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
        if Account.objects.filter(email=value).exists():
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
        member, _ = _create_member_and_account(**validated_data)
        return member
