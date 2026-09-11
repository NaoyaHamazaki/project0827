from django.contrib import admin

from .models import CardLoan, SecurityCard


@admin.register(SecurityCard)
class SecurityCardAdmin(admin.ModelAdmin):
    list_display = ('card_number', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('card_number',)


@admin.register(CardLoan)
class CardLoanAdmin(admin.ModelAdmin):
    list_display = ('member', 'security_card', 'issued_at', 'returned_at')
    list_filter = ('returned_at',)
    search_fields = ('member__name', 'security_card__card_number')
    date_hierarchy = 'issued_at'
