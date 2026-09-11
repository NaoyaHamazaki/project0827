# 受付・入退室管理システム（MVP）

コワーキングスペースの「物理カード＋有人受付」運用を活かした、受付スタッフの台帳確認・手動記帳の負担を軽減するWebアプリ。要件は [docs/MVP.txt](docs/MVP.txt) を参照。

- バックエンド: Django 5 + Django REST Framework + SimpleJWT（`backend/`）
- フロントエンド: React 19 + Vite（`frontend/`）

## セットアップ

### バックエンド

```bash
cd backend
python -m venv venv
./venv/Scripts/activate       # Windows PowerShell: venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo    # デモ用の管理者/受付ユーザーと会員を投入
python manage.py runserver 127.0.0.1:8000
```

デモアカウント（`seed_demo` 実行後）:

- 管理者: `admin@example.com` / `adminpass123`
- 受付スタッフ: `operator@example.com` / `operatorpass123`
- デモ会員カードID: `0001`（有効） / `0002`（有効） / `0003`（無効）

### フロントエンド

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:5173` を開く。API接続先は `.env.development`（`VITE_API_BASE_URL`）で設定済み（`http://127.0.0.1:8000/api`）。

## 主要機能

1. **受付スキャン画面**（`/`）: カードID入力（バーコード/ICカードリーダーはキーボード入力として扱われる）→ 入退室を自動判定・記録。直近5件のログをリアルタイム風に表示。
2. **会員管理画面**（`/members`, 管理者のみ）: 会員の登録・編集・検索・カードID紐付け。
3. **在室・ログ管理画面**（`/logs`, 管理者のみ）: 現在の在室者一覧、過去履歴の絞り込み、CSVエクスポート。

## テスト

```bash
cd backend
python manage.py test
```

## ICカードリーダー（RC-S380 / PaSoRi）連携

RC-S380はバーコードリーダーと異なりキーボード入力エミュレーションを行わないため、
`tools/rcs380_bridge/` にカードのIDm読み取り→キーボード入力送信を代行するブリッジスクリプトを用意している。
詳細は [tools/rcs380_bridge/README.md](tools/rcs380_bridge/README.md) を参照。
