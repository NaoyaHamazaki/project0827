from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdmin

from .models import Member, Plan
from .serializers import MemberSerializer, MemberUsageSerializer, PlanSerializer
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
                Q(name__icontains=query) | Q(company_name__icontains=query)
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
