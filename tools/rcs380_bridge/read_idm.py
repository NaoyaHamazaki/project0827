"""
RC-S380 (PaSoRi) の動作確認用スクリプト（nfcpy版）。
カードをかざすたびにIDmとタグ種別を表示する。Ctrl+Cで終了。

事前準備:
    1. Zadigでこのデバイスのドライバ(NFC Port/PaSoRi 100 USB)をWinUSBに置き換える
    2. pip install -r requirements.txt

実行:
    python read_idm.py
"""

from felica_nfc import ReaderNotAvailable, make_frontend, wait_for_tap


def main():
    try:
        clf = make_frontend()
    except ReaderNotAvailable as e:
        print(e)
        return
    print(f'リーダーに接続しました: {clf}')
    print('カードをリーダーにかざしてください… (Ctrl+Cで終了)')
    try:
        while True:
            idm, tag_type, tag_repr = wait_for_tap(clf)
            if idm:
                print(f'IDm: {idm}  種別: {tag_type}  ({tag_repr})')
    finally:
        clf.close()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n終了しました')
