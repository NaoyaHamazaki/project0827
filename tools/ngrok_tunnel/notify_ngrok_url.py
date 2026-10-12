"""
project0827（受付・入退室管理システム）を ngrok でスマホ公開した際に、
発行された公開URLとQRコードをLINE Botで通知するスクリプト。

前提:
- ngrok がフロントエンド（Vite, 5827番）のみをトンネルしていること
  （バックエンドAPIへのアクセスは frontend/vite.config.js の server.proxy 経由で中継される）
- ngrok のローカル管理API（http://127.0.0.1:4040）が有効であること
- このフォルダに .env ファイルを作成し、LINE_CHANNEL_ACCESS_TOKEN / LINE_USER_ID を
  設定しておくこと（.env.example を参照。.env はGit管理外）
"""

import os
import time

import qrcode
import requests
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

NGROK_API = "http://127.0.0.1:4040/api/tunnels"

LINE_TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")
LINE_USER_ID = os.environ.get("LINE_USER_ID", "")

QR_OUTPUT_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "frontend", "public", "qr.png"))


def get_ngrok_https_url(retries=15, delay=1):
    """ngrokのローカル管理APIから、フロントエンド(5827)向けのhttps公開URLを取得する"""
    last_error = None
    for _ in range(retries):
        try:
            res = requests.get(NGROK_API, timeout=2).json()
            tunnels = res.get("tunnels", [])
            https_tunnels = [t for t in tunnels if t["public_url"].startswith("https://")]
            if https_tunnels:
                return https_tunnels[0]["public_url"]
        except Exception as exc:  # noqa: BLE001 - ngrok起動待ちのリトライなので広めに捕捉
            last_error = exc
        time.sleep(delay)
    raise RuntimeError(f"ngrokのURL取得に失敗しました: {last_error}")


def save_qr_code(url, output_path):
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output_path)


def notify_line(url, qr_url):
    endpoint = "https://api.line.me/v2/bot/message/push"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LINE_TOKEN}",
    }
    data = {
        "to": LINE_USER_ID,
        "messages": [
            {
                "type": "text",
                "text": f"受付・入退室管理システム（project0827）\n{url}",
            },
            {
                "type": "image",
                "originalContentUrl": qr_url,
                "previewImageUrl": qr_url,
            },
        ],
    }
    response = requests.post(endpoint, headers=headers, json=data, timeout=10)
    return response


def main():
    if not LINE_TOKEN or not LINE_USER_ID:
        raise RuntimeError(
            "LINE_CHANNEL_ACCESS_TOKEN / LINE_USER_ID が設定されていません。"
            "tools/ngrok_tunnel/.env.example を参考に .env を作成してください。"
        )

    url = get_ngrok_https_url()
    print("ngrok URL:", url)

    save_qr_code(url, QR_OUTPUT_PATH)
    print("QRコードを保存しました:", QR_OUTPUT_PATH)

    # frontend/public/qr.png は Vite の public ディレクトリ配下なので、
    # そのまま "<公開URL>/qr.png" でアクセスできる
    qr_url = f"{url}/qr.png"

    response = notify_line(url, qr_url)
    print("LINE通知ステータス:", response.status_code, response.text)


if __name__ == "__main__":
    main()
