import django_filters

from .models import AccessLog


class AccessLogFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name='created_at', lookup_expr='date__gte')
    date_to = django_filters.DateFilter(field_name='created_at', lookup_expr='date__lte')
    member = django_filters.CharFilter(field_name='member__name', lookup_expr='icontains')
    unreturned_card = django_filters.BooleanFilter(method='filter_unreturned_card')

    class Meta:
        model = AccessLog
        fields = ('date_from', 'date_to', 'member', 'type', 'unreturned_card')

    def filter_unreturned_card(self, queryset, name, value):
        if not value:
            return queryset
        # 貸出中（未返却）のセキュリティカードに紐づく入室ログのみを残す
        return queryset.filter(card_loan_issued__returned_at__isnull=True)
