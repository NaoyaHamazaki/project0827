from django.core import signing

QR_TOKEN_SALT = 'access.qr-token'
QR_TOKEN_MAX_AGE_SECONDS = 300  # 5分。スクリーンショットの使い回しを防ぐための有効期限


def generate_qr_token(card_identifier):
    """会員のcard_identifierから、有効期限付きの署名トークンを生成する。

    生の会員番号をQRに埋め込まず、期限切れになれば無効になるトークンにすることで、
    スクリーンショットや盗撮によるQRの使い回しを防ぐ。
    """
    return signing.dumps(card_identifier, salt=QR_TOKEN_SALT)


def resolve_qr_token(token):
    """トークンを検証し、有効であれば元のcard_identifierを返す。無効・期限切れならNone。"""
    try:
        return signing.loads(token, salt=QR_TOKEN_SALT, max_age=QR_TOKEN_MAX_AGE_SECONDS)
    except signing.BadSignature:
        return None
