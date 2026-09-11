"""nfcpy経由でRC-S380からFeliCaのIDmを読み取る共通処理。

Sony純正のPC/SCドライバはFeliCa Pollingに対応していなかったため、
RC-S380を直接サポートするnfcpy（USB/libusb経由）を使用する。
事前にZadigでこのデバイスのドライバをWinUSBに置き換えておく必要がある。
"""

import nfc


class ReaderNotAvailable(Exception):
    """RC-S380に接続できないときに送出する。"""


def make_frontend():
    try:
        return nfc.ContactlessFrontend('usb')
    except OSError as e:
        raise ReaderNotAvailable(
            'RC-S380に接続できません。ドライバがWinUSBに置き換わっているか確認してください。'
            f' 詳細: {e!r}'
        ) from e


def wait_for_tap(clf):
    """カードが1回タップされ、離されるまでブロックする。
    (idm, tag_type, tag_repr) のタプルを返す。idmが取れない場合はNone。
    """
    result = {}

    def on_connect(tag):
        result['tag_type'] = type(tag).__name__
        result['tag_repr'] = str(tag)
        identifier = getattr(tag, 'identifier', None)
        result['idm'] = identifier.hex().upper() if identifier else None
        return True  # True: カードが離れるまでconnect()内で待機させる(連続スキャン防止)

    # FeliCa(Type F)だけをポーリングする。無差別にポーリングすると、
    # iPhoneのSuicaのようにプライバシー保護のためのランダムなType A仮IDを
    # 拾ってしまい、本来のFeliCa IDmが読めないことがあるため。
    clf.connect(rdwr={'targets': ['212F'], 'on-connect': on_connect})
    return result.get('idm'), result.get('tag_type'), result.get('tag_repr')
