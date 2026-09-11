# Railwayへのデプロイ手順（お試し版公開用）

このリポジトリには`backend/`（Django API）と`frontend/`（React SPA）の2つが入っているため、
Railway上では**2つの別サービス**として同じリポジトリからデプロイする。

## 前提
- Railwayアカウント作成・GitHub連携は完了している前提
- このリポジトリ（`NaoyaHamazaki/project0827`）がRailwayから見えるようになっていること

## 手順

### 1. バックエンド（Django）を先にデプロイする

1. Railwayでこのリポジトリから新規サービスを作成
2. サービスの設定で **Root Directory** を `backend` に設定
3. 環境変数を設定：
   - `DJANGO_SECRET_KEY` … 適当なランダム文字列（本番用に変更）
   - `DJANGO_DEBUG` … `False`
   - `DJANGO_ALLOWED_HOSTS` … `*`（お試し版なので簡略化。絞る場合はRailwayが割り当てるドメインを指定）
   - `CORS_ALLOWED_ORIGINS` … 一旦 `http://localhost:5173` のままで良い（フロントエンドのURLが分かったらStep 3で更新）
4. デプロイ実行。`backend/railway.toml`が`backend/deploy.sh`を起動コマンドに指定しており、migrate→collectstatic→gunicorn起動まで自動で行う（project0310のRailway構成を参考にした構成）
5. デプロイ完了後、割り当てられたURL（例: `https://xxxxx.up.railway.app`）を控える
6. デモ用アカウントを作成する（Railwayのシェル機能 or ローカルから接続して）：
   ```bash
   python manage.py seed_demo
   ```
   もしくは`python manage.py createsuperuser`で個別に作成

### 2. フロントエンド（React）をデプロイする

1. 同じリポジトリから、もう1つ新規サービスを作成
2. **Root Directory** を `frontend` に設定
3. 環境変数を設定：
   - `VITE_API_BASE_URL` … Step 1で控えたバックエンドURL + `/api`（例: `https://xxxxx.up.railway.app/api`）
     - ⚠️ Viteの環境変数は**ビルド時**に埋め込まれるため、必ずデプロイ（ビルド）前に設定すること。後から変更したら再デプロイが必要
4. デプロイ実行。`frontend/Procfile`が`npm run build`相当のビルド後、`vite preview`で配信する
5. デプロイ完了後、割り当てられたURL（例: `https://yyyyy.up.railway.app`）を控える

### 3. バックエンドのCORS設定を更新する

1. Step 1のバックエンドサービスに戻り、環境変数`CORS_ALLOWED_ORIGINS`をStep 2のフロントエンドURLに更新
   （例: `https://yyyyy.up.railway.app`）
2. バックエンドを再デプロイ

### 4. 動作確認

フロントエンドのURLにアクセスし、ログイン画面から`seed_demo`で作成したデモアカウントでログインできることを確認する。

## 注意点（お試し版としての割り切り）

- **データベースはSQLiteのまま。** Railwayのファイルシステムは永続化されないため、再デプロイのたびにデータが消える可能性がある。本格運用する場合はRailwayのPostgresアドオンへの切り替えが必要（今回はデモ目的のため対応していない）
- **フロントエンドは`vite preview`で配信している。** 本番向けの高負荷配信には向かないが、デモとしての利用には十分
- ICカードリーダー連携（`tools/rcs380_bridge/`）はローカルPCに物理リーダーを接続する用途のため、Railway上のデモでは動作しない。デモではQRコード/PIN入力での入退室を見せる想定

## 関連ファイル
- [backend/railway.toml](backend/railway.toml) / [backend/deploy.sh](backend/deploy.sh)
- [frontend/Procfile](frontend/Procfile)
- [backend/config/settings.py](backend/config/settings.py)（環境変数対応箇所）
