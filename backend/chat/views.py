from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Staff

from .models import Conversation, Message, Participant, Reaction
from .serializers import ChatUserSerializer, MessageSerializer, SendMessageSerializer


def my_conversation_or_404(user, pk):
    """自分が参加している会話のみ取得する（他人の会話は存在しない扱い＝404。管理者も例外なし）"""
    return get_object_or_404(Conversation.objects.filter(participants=user), pk=pk)


def serialize_conversation(conv, me):
    memberships = list(conv.memberships.all())
    others = [m.staff for m in memberships if m.staff_id != me.id]
    mine = next((m for m in memberships if m.staff_id == me.id), None)
    last = conv.messages.order_by('-id').first()
    unread = conv.messages.exclude(sender=me)
    if mine and mine.last_read_at:
        unread = unread.filter(created_at__gt=mine.last_read_at)
    return {
        'id': conv.id,
        'partner': ChatUserSerializer(others[0]).data if others else None,
        'last_message': (
            {'body': last.body, 'created_at': last.created_at, 'sender_id': last.sender_id}
            if last else None
        ),
        'unread_count': unread.count(),
        'updated_at': conv.updated_at,
    }


class ChatUserSearchView(APIView):
    """チャット相手の検索（自分以外の有効なアカウント）"""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        qs = Staff.objects.filter(is_active=True).exclude(pk=request.user.pk)
        if q:
            qs = qs.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q)
                | Q(username__icontains=q) | Q(email__icontains=q)
                | Q(member__name__icontains=q) | Q(member__company_name__icontains=q)
            )
        qs = qs.select_related('member').order_by('first_name', 'username')[:20]
        return Response(ChatUserSerializer(qs, many=True).data)


class ConversationListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        convs = (
            Conversation.objects.filter(participants=request.user)
            .prefetch_related('memberships__staff__member')
        )
        return Response([serialize_conversation(c, request.user) for c in convs])

    def post(self, request):
        """指定ユーザーとの1対1チャットを取得（無ければ作成）"""
        target = get_object_or_404(
            Staff.objects.filter(is_active=True), pk=request.data.get('user_id'),
        )
        if target.pk == request.user.pk:
            return Response({'detail': '自分自身とはチャットできません'}, status=400)
        conv = (
            Conversation.objects.filter(participants=request.user)
            .filter(participants=target).first()
        )
        if conv is None:
            conv = Conversation.objects.create(updated_at=timezone.now())
            Participant.objects.create(conversation=conv, staff=request.user)
            Participant.objects.create(conversation=conv, staff=target)
        conv = Conversation.objects.prefetch_related('memberships__staff__member').get(pk=conv.pk)
        return Response(serialize_conversation(conv, request.user))


class MessageListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, pk):
        conv = my_conversation_or_404(request.user, pk)
        messages = conv.messages.select_related('sender').prefetch_related('reactions')
        data = MessageSerializer(messages, many=True, context={'request': request}).data
        Participant.objects.filter(conversation=conv, staff=request.user).update(
            last_read_at=timezone.now(),
        )
        return Response(data)

    def post(self, request, pk):
        conv = my_conversation_or_404(request.user, pk)
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.objects.create(
            conversation=conv, sender=request.user, body=serializer.validated_data['body'],
        )
        Conversation.objects.filter(pk=conv.pk).update(updated_at=message.created_at)
        Participant.objects.filter(conversation=conv, staff=request.user).update(
            last_read_at=message.created_at,
        )
        return Response(
            MessageSerializer(message, context={'request': request}).data, status=201,
        )


class ThumbsUpToggleView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        message = get_object_or_404(
            Message.objects.filter(conversation__participants=request.user), pk=pk,
        )
        reaction, created = Reaction.objects.get_or_create(
            message=message, staff=request.user, emoji=Reaction.THUMBS_UP,
        )
        if not created:
            reaction.delete()
        message = Message.objects.select_related('sender').prefetch_related(
            'reactions'
        ).get(pk=message.pk)
        return Response(MessageSerializer(message, context={'request': request}).data)


class UnreadTotalView(APIView):
    """サイドバーのバッジ用：未読メッセージ総数"""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        total = 0
        for m in Participant.objects.filter(staff=request.user):
            qs = Message.objects.filter(conversation_id=m.conversation_id).exclude(sender=request.user)
            if m.last_read_at:
                qs = qs.filter(created_at__gt=m.last_read_at)
            total += qs.count()
        return Response({'unread_count': total})
