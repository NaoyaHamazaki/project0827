import json
import logging
import urllib.error
import urllib.request

from .models import Webhook

logger = logging.getLogger(__name__)

WEBHOOK_TIMEOUT_SECONDS = 3


def send_webhook(webhook, event, payload):
    """1件のWebhookへJSONを同期POSTする。失敗時はOSError/URLErrorを送出する。"""
    body = json.dumps({'event': event, **payload}).encode('utf-8')
    request = urllib.request.Request(
        webhook.url,
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    if webhook.secret:
        request.add_header('X-Webhook-Secret', webhook.secret)
    urllib.request.urlopen(request, timeout=WEBHOOK_TIMEOUT_SECONDS)


def dispatch_webhooks(event, payload):
    """有効なWebhookのうちeventを購読しているものへJSONを同期POSTする。

    送信失敗は受付処理自体を失敗させないため、例外はログに残すのみで握りつぶす。
    """
    webhooks = Webhook.objects.filter(is_active=True)

    for webhook in webhooks:
        if event not in webhook.event_types:
            continue
        try:
            send_webhook(webhook, event, payload)
        except (urllib.error.URLError, OSError) as exc:
            logger.warning('Webhook送信に失敗しました webhook=%s error=%s', webhook.name, exc)
