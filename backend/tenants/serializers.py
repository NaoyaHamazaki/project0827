from rest_framework import serializers

from accounts.models import Account

from .models import Site


class SiteSerializer(serializers.ModelSerializer):
    admin_count = serializers.SerializerMethodField()
    company_count = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = ('id', 'code', 'name', 'admin_count', 'company_count', 'member_count', 'created_at')
        read_only_fields = ('id', 'code', 'created_at')

    def get_admin_count(self, obj):
        return obj.accounts.filter(role=Account.Role.ADMIN).count()

    def get_company_count(self, obj):
        return obj.companies.count()

    def get_member_count(self, obj):
        return obj.members.count()


class SiteAdminSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ('id', 'admin_number', 'display_name', 'email', 'is_active', 'date_joined')

    def get_display_name(self, obj):
        return obj.get_full_name() or obj.username
