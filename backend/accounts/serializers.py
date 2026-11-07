from django.contrib.auth.password_validation import validate_password
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


class UpdateSelfAccountSerializer(serializers.Serializer):
    """ログイン中の本人によるアカウント情報の編集（設定＞ユーザー画面）"""

    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    password = serializers.CharField(required=False, write_only=True, min_length=1)

    def validate_email(self, value):
        if Staff.objects.exclude(pk=self.instance.pk).filter(email=value).exists():
            raise serializers.ValidationError('このメールアドレスは既に使用されています')
        return value

    def validate_password(self, value):
        validate_password(value, user=self.instance)
        return value

    def save(self):
        user = self.instance
        for field in ('first_name', 'last_name', 'email'):
            if field in self.validated_data:
                setattr(user, field, self.validated_data[field])
        if 'password' in self.validated_data:
            user.set_password(self.validated_data['password'])
        user.save()
        return user


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
