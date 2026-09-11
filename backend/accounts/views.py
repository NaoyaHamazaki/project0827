from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import StaffSerializer, StaffTokenObtainPairSerializer, UpdateLanguageSerializer


class StaffTokenObtainPairView(TokenObtainPairView):
    serializer_class = StaffTokenObtainPairSerializer


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(StaffSerializer(request.user).data)

    def patch(self, request):
        serializer = UpdateLanguageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.language = serializer.validated_data['language']
        request.user.save(update_fields=['language'])
        return Response(StaffSerializer(request.user).data)
