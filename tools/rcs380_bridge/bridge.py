"""
RC-S380 (PaSoRi) -> 受付スキャン画面 自動入力ブリッジ（手動実行用）

カードをリーダーにかざすと、そのIDmをキーボード入力として
（バーコードリーダーと同じ方式で）現在フォーカスされているウィンドウに
自動入力し、Enterを送信する。

通常運用ではagent.pyが同じ処理を常駐スレッドとして自動的に行うため、
このスクリプトを手動で起動する必要はない。動作確認やデバッグ用。

前提:
    受付PCでこのスクリプトを常駐させ、ブラウザで受付スキャン画面
    （/ 画面）を開いてフォーカスした状態にしておくこと。

実行:
    python bridge.py
"""

from felica_nfc import ReaderNotAvailable
from reader_loop import run


def main():
    print('受付スキャン画面をブラウザで開き、フォーカスした状態にしてください。')
    print('カード待受中… (Ctrl+Cで終了)')
    try:
        run()
    except ReaderNotAvailable as e:
        print(e)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n終了しました')
