from django.urls import path

from .views import (
    ChatUserSearchView, ConversationListView, MessageListView, ThumbsUpToggleView,
    UnreadTotalView,
)

urlpatterns = [
    path('users/', ChatUserSearchView.as_view(), name='chat-users'),
    path('conversations/', ConversationListView.as_view(), name='chat-conversations'),
    path('conversations/<int:pk>/messages/', MessageListView.as_view(), name='chat-messages'),
    path('messages/<int:pk>/thumbs-up/', ThumbsUpToggleView.as_view(), name='chat-thumbs-up'),
    path('unread/', UnreadTotalView.as_view(), name='chat-unread'),
]
