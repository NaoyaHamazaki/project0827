from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin

from .models import Member, MemberInvite, Plan
from .serializers import (
    AdminMemberRegisterSerializer, InviteStatusSerializer, acting_site, MemberInviteSerializer, MemberSerializer,
    MemberUsageSerializer, PlanSerializer, SelfRegisterSerializer,
)
from .usage import calculate_usage


class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSerializer
    permission_classes = (IsAdmin,)
    queryset = Member.objects.all()
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get('q')
        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) | Q(company__name__icontains=query) | Q(member_code__icontains=query)
            )
        return queryset

    @action(detail=True, methods=['get'])
    def usage(self, request, pk=None):
        member = self.get_object()
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        data = calculate_usage(
            member,
            year=int(year) if year else None,
            month=int(month) if month else None,
        )
        return Response(MemberUsageSerializer(data).data)


class PlanViewSet(viewsets.ModelViewSet):
    serializer_class = PlanSerializer
    permission_classes = (IsAdmin,)
    queryset = Plan.objects.all()
    pagination_class = None


class PublicPlanListView(APIView):
    """招待リンクからの自己登録フォーム用：プラン選択肢だけを認証なしで返す"""

    permission_classes = (AllowAny,)

    def get(self, request):
        return Response(PlanSerializer(Plan.objects.all(), many=True).data)


class AdminMemberRegisterView(APIView):
    """「新規会員作成」＞フォームに入力：管理者が会員＋ログインアカウントをまとめて作成する"""

    permission_classes = (IsAdmin,)

    def post(self, request):
        serializer = AdminMemberRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.save(site=acting_site(request.user))
        return Response(MemberSerializer(member).data, status=201)


class MemberInviteCreateView(APIView):
    """「新規会員作成」＞QR表示／URLをコピー：自己登録用の招待トークンを発行する（管理者専用）"""

    permission_classes = (IsAdmin,)

    def post(self, request):
        invite = MemberInvite.objects.create(created_by=request.user)
        return Response(MemberInviteSerializer(invite).data, status=201)


class InviteStatusView(APIView):
    """招待トークンの有効性チェック（登録フォームを開いた会員本人が使う。認証不要）"""

    permission_classes = (AllowAny,)

    def get(self, request, token):
        invite = get_object_or_404(MemberInvite, token=token)
        return Response(InviteStatusSerializer({
            'valid': invite.is_valid,
            'expires_at': invite.expires_at,
        }).data)


class InviteRegisterView(APIView):
    """招待トークンを使った会員本人による自己登録（認証不要）"""

    permission_classes = (AllowAny,)

    def post(self, request, token):
        invite = get_object_or_404(MemberInvite, token=token)
        if not invite.is_valid:
            return Response({'detail': 'このリンクは有効期限切れ、または既に使用されています'}, status=410)

        serializer = SelfRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.save(site=acting_site(invite.created_by))

        invite.used_at = timezone.now()
        invite.created_member = member
        invite.save(update_fields=['used_at', 'created_member'])
        return Response(MemberSerializer(member).data, status=201)
