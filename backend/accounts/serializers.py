from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from members.models import Member

from .models import Staff


class StaffMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ('id', 'name', 'card_identifier')


class StaffSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    member = StaffMemberSerializer(read_only=True)

    class Meta:
        model = Staff
        fields = ('id', 'email', 'display_name', 'role', 'member', 'language')

    def get_display_name(self, obj):
        return obj.get_full_name() or obj.username


class UpdateLanguageSerializer(serializers.Serializer):
    language = serializers.ChoiceField(choices=Staff.Language.choices)


class StaffTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['display_name'] = user.get_full_name() or user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['staff'] = StaffSerializer(self.user).data
        return data
