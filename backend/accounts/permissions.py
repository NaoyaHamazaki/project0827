from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdmin(BasePermission):
    """管理者は操作可能。マスターは管理者向け画面を閲覧のみ可能（変更はできない）"""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role == user.Role.ADMIN:
            return True
        return user.role == user.Role.MASTER and request.method in SAFE_METHODS
