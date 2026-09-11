"""カード検知ループ。agent.py(常駐スレッド)とbridge.py(手動実行)の両方から使う。"""

from pynput.keyboard import Controller, Key

from felica_nfc import make_frontend, wait_for_tap

keyboard = Controller()


def type_scan(card_identifier):
    # 入力欄に残っている可能性のある文字を念のため全選択して消してから入力する
    with keyboard.pressed(Key.ctrl):
        keyboard.tap('a')
    keyboard.tap(Key.backspace)

    keyboard.type(card_identifier)
    keyboard.tap(Key.enter)


def run(on_scan=None, on_log=print):
    """カードがタップされるたびにon_scan(idm)を呼び続ける。
    on_scanを省略した場合はtype_scanでキー入力する。
    RC-S380に接続できない場合はfelica_nfc.ReaderNotAvailableを送出する。
    """
    handle_scan = on_scan or type_scan
    clf = make_frontend()
    on_log(f'リーダーに接続しました: {clf}')
    try:
        while True:
            idm, _tag_type, _tag_repr = wait_for_tap(clf)
            if idm:
                on_log(f'スキャン検知: {idm}')
                handle_scan(idm)
    finally:
        clf.close()
