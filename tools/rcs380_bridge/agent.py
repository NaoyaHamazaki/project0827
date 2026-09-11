"""
受付PCで常駐させるローカルサービス。

起動すると同時にRC-S380のカード検知ループをバックグラウンドスレッドで開始し、
以降はブラウザを開くだけでスキャンできる状態になる（ブラウザ操作は不要）。
受付スキャン画面は`/status`で状態を確認し、万一ループが停止していた場合のみ
（USB抜き差し直後など）画面上の「起動する」ボタンから`/start`で再開できる。

Windows起動時にこのスクリプト自体を自動実行しておくこと（README参照）。

エンドポイント (http://127.0.0.1:5577):
    GET  /status  -> {"running": bool}   カード検知ループが動作中か
    POST /start   -> {"started": bool}   停止していれば再開する

実行:
    python agent.py
"""

import http.server
import json
import threading

from felica_nfc import ReaderNotAvailable
from reader_loop import run as run_reader_loop

PORT = 5577

_lock = threading.Lock()
_thread = None
_last_error = None


def _thread_body():
    global _last_error
    try:
        run_reader_loop(on_log=print)
    except ReaderNotAvailable as e:
        _last_error = str(e)
        print(_last_error)


def is_running():
    with _lock:
        return _thread is not None and _thread.is_alive()


def start_loop():
    global _thread, _last_error
    with _lock:
        if _thread is not None and _thread.is_alive():
            return False
        _last_error = None
        _thread = threading.Thread(target=_thread_body, daemon=True)
        _thread.start()
        return True


class Handler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/status':
            self._send_json({'running': is_running(), 'last_error': _last_error})
        else:
            self._send_json({'error': 'not found'}, status=404)

    def do_POST(self):
        if self.path == '/start':
            self._send_json({'started': start_loop()})
        else:
            self._send_json({'error': 'not found'}, status=404)

    def log_message(self, format, *args):
        pass  # コンソール出力を静かに保つ


class Server(http.server.ThreadingHTTPServer):
    # Windowsではallow_reuse_address=True(デフォルト)だと、既に起動中のポートにも
    # 二重にbindできてしまう(SO_REUSEADDRの挙動がPOSIXと異なるため)。
    # 二重起動を確実に検知してOSErrorにするためFalseにする。
    allow_reuse_address = False


def main():
    try:
        server = Server(('127.0.0.1', PORT), Handler)
    except OSError:
        # 既に起動済み(ポート使用中)。二重起動しても害はないのでそのまま終了する。
        print('リーダー連携サービスは既に起動しています。')
        return

    start_loop()
    print(f'リーダー連携サービスを起動しました: http://127.0.0.1:{PORT}')
    print('このウィンドウは閉じずに常駐させてください。(Ctrl+Cで終了)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n終了しました')


if __name__ == '__main__':
    main()
