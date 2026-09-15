# Railwayへのデプロイ手順

本番は「1サービス構成」にしている。Django(gunicorn)が `/api/` でAPIを、それ以外の全パスで
ビルド済みフロントエンド（`frontend/dist`）を配信する（`backend/config/urls.py` / `spa.py`）。
これによりCORS設定やフロント・バックエンドの2サービス管理が不要になる
（`project0911`のRailway構成を踏襲したもの。詳細な経緯は同プロジェクトの`DEPLOY_LOG.md`参照）。

## 前提
- Railwayアカウント作成・GitHub連携は完了している前提
- このリポジトリ（`NaoyaHamazaki/project0827`）がRailwayから見えるようになっていること

## 手順

### 1. Railwayプロジェクトを作成する

1. GitHubリポジトリ（このリポジトリ）を連携して新規サービスを作成する
   （リポジトリ直下の `Dockerfile` を自動で見つけてビルドする。Root Directoryの指定は不要。
   backend/とfrontend/が並ぶモノレポ構成のため、RailwayのNixpacks/Railpackという
   自動ビルダーには頼らず、Dockerfileで明示的にビルド手順を指定している）

### 2. Postgresを追加する

Railwayプロジェクトに **Postgres プラグイン**を追加する。追加しただけでは
Webサービス側に自動で環境変数が渡らないため、次のステップで明示的に紐付ける。

### 3. 環境変数を設定する

Webサービスの Variables タブで以下を設定する。

| 変数 | 値 | 備考 |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | ランダムな文字列 | **必須**。未設定だと起動時にエラーで止まる（安全装置） |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railwayのサービス間参照構文。Postgresプラグインの接続情報を注入する |
| `DJANGO_ALLOWED_HOSTS` | （任意） | Railwayが払い出すドメインは自動で許可されるので、独自ドメインを使うときだけ指定 |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | （任意） | 独自ドメインでDjango adminにログインする場合のみ |
| `DJANGO_DEBUG` | 基本触らなくてOK | Railway上では自動的に `False` 扱いになる |

`CORS_ALLOWED_ORIGINS` は1サービス構成では基本的に不要（フロントとAPIが同一オリジンのため）。
設定しなくてもそのまま動く。

### 4. デプロイ・ドメイン発行

1. 環境変数を保存すると自動で再デプロイがかかる
2. 「Generate Domain」等でドメインを発行する
3. デプロイ完了後、割り当てられたURL（例: `https://xxxxx.up.railway.app`）にアクセスして確認

### 5. デモ用アカウントを作成する

Railwayのシェル機能（またはローカルから`DATABASE_URL`を指定して接続）で、
`backend/`ディレクトリから実行する。

```bash
python manage.py seed_demo
```

もしくは`python manage.py createsuperuser`で個別に作成してもよい。

## ビルド・起動の流れ（`Dockerfile` の中身）

1. 1段目（node:20-slim）: `frontend/` で `npm ci` → `npm run build` → `frontend/dist` が生成される
2. 2段目（python:3.11-slim）: `backend/requirements.txt` を `pip install`、1段目の `frontend/dist` を
   `/app/frontend/dist` にコピー（`settings.py` の `FRONTEND_DIST_DIR` が参照する場所と一致させている）
3. 起動時（コンテナのCMD）: `python manage.py migrate` → `collectstatic` → `gunicorn config.wsgi`

Dockerを使わず、Dockerfileの中でやっていることを手元で直接試したい場合:

```bash
cd frontend && npm run build && cd ..
cd backend
DJANGO_DEBUG=False DJANGO_SECRET_KEY=temp-local-test venv/Scripts/python manage.py collectstatic --noinput
DJANGO_DEBUG=False DJANGO_SECRET_KEY=temp-local-test venv/Scripts/python manage.py runserver 127.0.0.1:8827
```

<http://127.0.0.1:8827/> を開くとフロントエンドが、`/api/...` はAPIが、`/admin/` は管理画面が
同じポートで動く。

## 注意点

- **データベースはPostgres（Railwayプラグイン）を使う。** SQLiteのままだとRailwayの
  ファイルシステムが永続化されないため、再デプロイのたびにデータが消える。上記の
  `DATABASE_URL` 設定を必ず行うこと
- ICカードリーダー連携（`tools/rcs380_bridge/`）はローカルPCに物理リーダーを接続する用途のため、
  Railway上のデプロイでは動作しない。QRコード/PIN入力での入退室で代替する
- `DJANGO_SECRET_KEY`は本番用に必ず独自の値へ変更すること（開発用の既定値のままだと
  `DEBUG=False`起動時にエラーで止まる安全装置が入っている）

## 関連ファイル
- [Dockerfile](Dockerfile) / [.dockerignore](.dockerignore)
- [backend/config/settings.py](backend/config/settings.py)（Railway向けの自動判定、環境変数対応箇所）
- [backend/config/spa.py](backend/config/spa.py)（SPA配信用のcatch-allビュー）
- [backend/config/urls.py](backend/config/urls.py)
