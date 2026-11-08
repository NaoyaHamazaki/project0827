from django.shortcuts import get_object_or_404
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Account

from .models import Site
from .serializers import SiteAdminSerializer, SiteSerializer


class IsMaster(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == Account.Role.MASTER)


class SiteListCreateView(APIView):
    """マスター向け：所管の一覧と追加（マスター用の S000 は一覧に出さない）"""

    permission_classes = (IsMaster,)

    def get(self, request):
        sites = Site.objects.exclude(code=Site.MASTER_CODE)
        return Response(SiteSerializer(sites, many=True).data)

    def post(self, request):
        serializer = SiteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class SiteAdminListView(APIView):
    """マスター向け：所管ごとの管理者一覧"""

    permission_classes = (IsMaster,)

    def get(self, request, pk):
        site = get_object_or_404(Site.objects.exclude(code=Site.MASTER_CODE), pk=pk)
        admins = site.accounts.filter(role=Account.Role.ADMIN).order_by('admin_number')
        return Response({
            'site': SiteSerializer(site).data,
            'admins': SiteAdminSerializer(admins, many=True).data,
        })
