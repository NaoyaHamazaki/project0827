from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Account
from accounts.permissions import IsAdmin
from tenants.models import Site

from .models import Member, MemberInvite, Plan
from .serializers import (
    AdminMemberRegisterSerializer, AdminSelfRegisterSerializer, InviteStatusSerializer, acting_site,
    MemberInviteSerializer, MemberSerializer, MemberUsageSerializer, PlanSerializer, SelfRegisterSerializer,
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
    """招待URLを発行する。発行できる相手は自分の権限で決まる：
    マスター→管理者（所管を指定）、管理者→代表、代表→自分の所属のユーザー
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        user = request.user
        Role = Account.Role
        if user.role == Role.MASTER:
            site = get_object_or_404(Site.objects.exclude(code=Site.MASTER_CODE), pk=request.data.get('site'))
            invite = MemberInvite(target_role=MemberInvite.TargetRole.ADMIN, site=site)
        elif user.role == Role.ADMIN:
            invite = MemberInvite(target_role=MemberInvite.TargetRole.REPRESENTATIVE, site=acting_site(user))
        elif user.role == Role.REPRESENTATIVE and user.member and user.member.company_id:
            company = user.member.company
            invite = MemberInvite(target_role=MemberInvite.TargetRole.USER, site=company.site, company=company)
        else:
            return Response({'detail': '招待URLを発行する権限がありません'}, status=403)
        invite.created_by = user
        invite.save()
        return Response(MemberInviteSerializer(invite).data, status=201)


class InviteStatusView(APIView):
    """招待トークンの有効性チェック（登録フォームを開いた本人が使う。認証不要）"""

    permission_classes = (AllowAny,)

    def get(self, request, token):
        invite = get_object_or_404(MemberInvite.objects.select_related('site', 'company'), token=token)
        return Response(InviteStatusSerializer({
            'valid': invite.is_valid,
            'expires_at': invite.expires_at,
            'target_role': invite.target_role,
            'site_name': invite.site.name if invite.site_id else '',
            'company_name': invite.company.name if invite.company_id else '',
        }).data)


class InviteRegisterView(APIView):
    """招待トークンを使った本人による登録（認証不要）。招待の種類で作るアカウントが変わる"""

    permission_classes = (AllowAny,)

    def post(self, request, token):
        invite = get_object_or_404(MemberInvite, token=token)
        if not invite.is_valid:
            return Response({'detail': 'このリンクは有効期限切れ、または既に使用されています'}, status=410)

        site = invite.site or acting_site(invite.created_by)
        member = None
        if invite.target_role == MemberInvite.TargetRole.ADMIN:
            serializer = AdminSelfRegisterSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            account = serializer.save(site=site)
            body = {'role': account.role, 'display_name': account.get_full_name()}
        else:
            serializer = SelfRegisterSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            extra = {'site': site}
            if invite.target_role == MemberInvite.TargetRole.USER and invite.company_id:
                extra['company_name'] = invite.company.name
            member = serializer.save(**extra)
            body = MemberSerializer(member).data

        invite.used_at = timezone.now()
        invite.created_member = member
        invite.save(update_fields=['used_at', 'created_member'])
        return Response(body, status=201)


class MyCompanyMembersView(APIView):
    """代表向け：自分の所属のメンバー一覧"""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        company = _representative_company(request.user)
        if company is None:
            return Response({'detail': '代表のみ利用できます'}, status=403)
        members = Member.objects.filter(company=company).select_related('account').order_by('-is_representative', 'member_code')
        return Response({
            'company': {'code': company.code, 'name': company.name, 'site_code': company.site.code},
            'members': [
                {
                    'id': m.id, 'member_code': m.member_code, 'name': m.name, 'status': m.status,
                    'is_representative': m.is_representative,
                    'email': getattr(getattr(m, 'account', None), 'email', ''),
                }
                for m in members
            ],
        })


class MyCompanyMemberDetailView(APIView):
    """代表向け：自分の所属のメンバーを有効／無効に切り替える・削除する（代表自身は対象外）"""

    permission_classes = (IsAuthenticated,)

    def _target(self, request, pk):
        company = _representative_company(request.user)
        if company is None:
            return None
        return Member.objects.filter(company=company, is_representative=False, pk=pk).first()

    def patch(self, request, pk):
        member = self._target(request, pk)
        if member is None:
            return Response({'detail': '対象のメンバーが見つかりません'}, status=404)
        status_value = request.data.get('status')
        if status_value not in Member.Status.values:
            return Response({'detail': '不正なステータスです'}, status=400)
        member.status = status_value
        member.save(update_fields=['status'])
        account = getattr(member, 'account', None)
        if account:
            account.is_active = status_value == Member.Status.ACTIVE
            account.save(update_fields=['is_active'])
        return Response({'id': member.id, 'status': member.status})

    def delete(self, request, pk):
        member = self._target(request, pk)
        if member is None:
            return Response({'detail': '対象のメンバーが見つかりません'}, status=404)
        account = getattr(member, 'account', None)
        if account:
            account.delete()
        member.delete()
        return Response(status=204)


def _representative_company(user):
    if user.role == Account.Role.REPRESENTATIVE and user.member and user.member.company_id:
        return user.member.company
    return None
