# 引き継ぎメモ（Claude Code CLI → デスクトップアプリ）

このファイルは、CLI側のセッションで進めていた作業をデスクトップアプリ側に引き継ぐための
状況共有メモ。読めば経緯とすぐ次に何をすべきかが分かるようにしてある。

## プロジェクト概要

コワーキングスペースの受付・入退室管理システムMVP。要件は [docs/MVP.txt](docs/MVP.txt) 参照。
「現行カード（バーコード/ICカード）を活かした受付業務の効率化」が目的。企業ごとに運用が
異なることを想定し、入力方式・CSV出力列・外部連携（Webhook）を管理画面から設定できる
「パーソナライズ可能」な設計になっている。

- バックエンド: Django 5 + Django REST Framework + SimpleJWT（`backend/`）
- フロントエンド: React 19 + Vite、JavaScript/JSX（`frontend/`）
- ICカードリーダー連携ツール: Python（`tools/rcs380_bridge/`）
- ngrokトンネル・LINE通知ツール: Python（`tools/ngrok_tunnel/`）
- ドキュメント: `docs/要件定義書.xlsx`, `docs/設計書.xlsx`, `docs/研修資料_技術要素解説.xlsx`
- **gitリポジトリ未初期化**（`git init`されていない。コミット管理したい場合は要対応）

アプリ本体（Django+React）は一通り実装・テスト済みで動作する状態。

## すぐ動かす手順

### ローカルのみで動かす（トンネルなし）

`start_app.bat`（プロジェクトルート）をダブルクリックすると、バックエンド・フロントエンドを
起動してブラウザを開く。

手動で起動する場合:

```powershell
# バックエンド
cd backend
.\venv\Scripts\activate
python manage.py runserver 127.0.0.1:8827

# フロントエンド（別ターミナル）
cd frontend
npm run dev
```

`http://localhost:5827` を開く。

**注意（ポート固定について）**: このPC上には他プロジェクト（project0310, project0911等）の
開発サーバーも動いていることがあり、よくある既定値（8000/5173）を使うと衝突して
「別プロジェクトの画面が開いてしまう」事故が起きたことがある。そのため
project0827は8827/5827に固定し、`vite.config.js`で`strictPort: true`にして
ポート衝突時は黙って別ポートにずれずエラーにするようにしてある
（`start_app.bat`等の`.bat`ファイルにもポート使用中チェックを追加済み）。

### スマホ実機で確認する（ngrok経由）2ステップ

1. `backend\start_server.bat` を実行（venv作成・依存インストール・migrate・
   `runserver 127.0.0.1:8827` を自動実行）
2. 別途 `backend\start_ngrok_and_notify.bat` を実行
   （バックエンドは起動済み前提。フロントエンド起動→ngrokで`http://localhost:5827`を
   トンネル→ `tools/ngrok_tunnel/notify_ngrok_url.py` がトンネルURLとQRコード画像を
   LINEに送信）

**注意**: `tools/ngrok_tunnel/notify_ngrok_url.py` にはLINE Messaging APIの
チャンネルアクセストークンとユーザーIDが平文で埋め込まれている（ユーザー自身の既存個人
スクリプトから流用）。外部に公開・共有しないこと。トークンが有効なままなら、
不要になった時点でLINE Developers側での失効・再発行を推奨。

### デモアカウント

`python manage.py seed_demo` で投入。

- 管理者: `admin@example.com` / `adminpass123`（role=admin）
- ユーザー: `operator@example.com` / `operatorpass123`（role=user、会員「山田太郎」
  card_identifier='0001'、所属会社「株式会社サンプル」に紐付け済み）

ログイン画面には開発用のクイックログインボタンあり（`frontend/src/pages/LoginPage.jsx`の
`QUICK_LOGIN_ACCOUNTS`）。本番リリース前に削除要検討。

## ロール設計（2ロール）

- **①管理者（Admin）**: バーコード/ICカード/PIN/QRの読み取りによる受付操作、会員管理、
  在室・ログ管理（編集・削除可）、設定（入力方式・CSV列・Webhook・プラン管理）、
  すべて閲覧・操作可能。表示（QR提示）機能はなし。
- **②ユーザー（User）**: 自分に紐付いた会員（`Staff.member` FK）のQRコード・カードIDを
  表示するだけの簡易画面と、自分自身の入退室履歴（`/my-history`、入室・退室をペアで
  「セット」表示し、滞在時間も表示）のみ閲覧可能。

ログイン画面のサブタイトル「スタッフアカウントでログインしてください」は削除済み。

## 主要機能（実装・動作確認済み）

### 画面構成
- スキャン受付(`/`): 管理者はバーコード/ICカード・PIN入力・QR読取（カメラ）・手動入力の
  タイル選択式UI（タップで表示切替、スマホは3列グリッド）、ユーザーは自分のQR/カードID表示
- 会員管理(`/members`, 管理者限定): CRUD、プラン割当、利用状況（来場回数・月間利用時間/
  上限）モーダル表示
- 在室・ログ管理(`/logs`, 管理者限定): 現在の在室者一覧、過去履歴フィルタ、手動追加・
  **編集・削除**、CSVエクスポート（列選択可）
- 利用履歴(`/my-history`, ユーザー限定): 自分の入退室をペアで表示、月ごとの利用時間合計
- 設定(`/settings`, 管理者限定): 入力方式トグル、CSV出力列選択、Webhook管理、プラン管理

### 会員プラン・利用時間トラッキング
`members/usage.py`の`calculate_usage()`が入室/退室ログを時系列でペアリングし、来場回数・
使用時間・プラン上限・残り時間を算出。管理者の会員一覧モーダル、スキャン成功時の利用状況
パネル、ユーザー自身の利用履歴ページの3箇所で共通利用。

### QRコードのセキュリティ（画面キャプチャ再利用対策）
`django.core.signing`で署名付きトークンを発行し、**5分で失効**する（`access/qr_token.py`、
`QR_TOKEN_MAX_AGE_SECONDS=300`）。スキャン側は`card_identifier`の直接一致を先に試し、
ダメならトークンとして`resolve_qr_token()`を試す2段構え（`access/views.py`の
`_resolve_member()`）。そのため**カード裏に印刷した静的QRシール（生のカード番号のまま）も
そのまま読み取れる**（署名トークンでなくても直接一致でヒットする）ことを確認済み・追加改修
不要。

### 入退室のパーソナライズ
`orgsettings`アプリの`OrgSettings`（シングルトン）で有効な入力方式・CSV出力列を管理。
`Webhook`モデルで入退室イベントを外部URLへJSON POST（複数登録・イベント種別ごとの購読・
テスト送信ボタンあり）。

### スキャン結果のフィードバック
- 成功: 音声「ピンポン！」（2音のチャイム、Web Audio APIで合成、音声ファイル不要）
- 失敗: 揺れるような（ビブラート）ブザー音（サウトゥース波+LFO周波数変調）
- `navigator.vibrate()`による物理バイブレーションは**実装していない**（ユーザーが明示的に
  不要と指示したため、音のみ）
- 実装: `frontend/src/utils/feedback.js`の`notifyScanResult(success)`

### ユーザー画面の在室状況表示
以前は入退室のたびに数秒間トースト通知を出す方式だったが、**常時表示のステータスパネルに
変更**。ユーザーのQR画面（`ScanPage.jsx`の`UserQrView`/`StatusPanel`）のQRコード下に、
「入室中（HH:MM〜）」または「退室済（HH:MM〜）」を常に表示し、月間利用時間に上限のある
プランの会員には「残りX.Xh」も併記する。5秒間隔のポーリング（`MyStatusView`）で最新の
ログと当月の利用状況(`usage`)をまとめて取得する。

### 長時間在室（打刻漏れ疑い）のハイライト
入室してから24時間以上が経過している在室者は、**現実には起こりにくい＝退室打刻漏れの
可能性が高い**という前提で、在室・ログ管理画面（`/logs`）の「現在の在室者」タブで目立つ
ように表示する（`LogsPage.jsx`の`CurrentOccupantsTab`、`STALE_CHECKIN_HOURS = 24`）。
該当者がいる場合、一覧上部に件数入りの警告バッジを表示し、該当行を赤くハイライト、
入室時刻の隣に「24h以上」バッジを表示する。管理者はここから該当ログを編集・削除して
是正できる（既存の打刻ログ編集・削除機能を利用）。バックエンドのAPI変更は不要
（`CurrentOccupantSerializer`が元々`checked_in_at`を返しており、判定はフロントエンド側で
計算）。

### モバイル対応UX
- ハンバーガーメニュー（480px以下）
- スキャン画面の入力方式選択は3列正方形タイルUI（タップで該当方式のUIを表示）
- 在室・ログ管理のテーブルはスマホ幅で3列カードグリッドにレイアウト変化
- iOS Safariの入力欄フォーカス時自動ズームを`input,select,textarea{font-size:16px}`で防止
- スキャン結果は数秒で自動的に閉じるモーダル表示（背景タップでも閉じる）

### 日本語/英語切替（i18n）※現在UIからは非表示（オフ）
- 機能自体（`Staff.language`DBカラム、`PATCH /api/auth/me/`、`LanguageContext`、
  `frontend/src/i18n/en.js`の英訳辞書約190エントリ）は実装済みで残っているが、
  **`Layout.jsx`と`LoginPage.jsx`の先頭にある`LANGUAGE_TOGGLE_ENABLED = false`定数で
  JA/EN切替ボタンをUIから非表示にしている**（ユーザーの指示により「いったんオフ」）。
  再度有効化する場合はこの2箇所を`true`に戻すだけでよい
- 全スタッフアカウントの`language`はDB上で`ja`にリセット済み（切替オフ中に`en`のまま
  残っていると、たとえUIに切替ボタンがなくても英語表示のままになるため）
- 実装は自作の軽量Context＋「日本語原文をキーにした英訳辞書」方式。i18nextなど外部
  ライブラリは未使用（既存のAuthContext/ToastContextと統一したhouse style）
- 未登録キーはフォールバックで日本語表示のまま（翻訳漏れがあってもアプリは壊れない設計）

### ICカードリーダー(RC-S380)連携
`tools/rcs380_bridge/`にPythonブリッジツール一式あり。Sony RC-S380（PaSoRi）でiPhoneの
Suica（FeliCa）読み取りに対応。詳細な経緯（pyscard失敗→nfcpy+Zadigドライバ変更→iPhone
ランダムUID問題の解決）は`tools/rcs380_bridge/README.md`を参照。

- `agent.py`: 本番用常駐プロセス。起動と同時にカード検知ループを自動開始し、
  HTTPサービス（`http://127.0.0.1:5577`、`GET /status`/`POST /start`）としても動作
- `launch.vbs`: デスクトップから1クリックでagent起動+ブラウザを開くランチャー
- フロントエンド`frontend/src/api/readerAgent.js`→`ScanPage.jsx`がstatusをポーリングし、
  停止時のみ起動バナーを表示
- Zadigでのドライバ切り替え（`sonynfcport100c`→`WinUSB`）により、このPCのJPKI
  （マイナンバーカード）機能は使えなくなっている（ユーザー了承済み、まだ未復元）

## テスト状況

`cd backend && python manage.py test` でバックエンドテスト一式がパス（accounts/access/
members/orgsettings各アプリ）。

**既知のflaky（不安定）テスト**: `access/tests.py`の
`test_current_occupants_reflects_latest_check_in`が、Windowsのタイムスタンプ分解能の
制約で2件のログがほぼ同時刻になった際に`-created_at`順のタイ・ブレークが不定になり、
まれに失敗する。原因は特定済みだが未修正。別タスクとして切り出し済み
（`mcp__ccd_session__spawn_task`のtask_id: `task_4bef15ae`、必要なら着手可）。

## その他の注意点

- Windowsではバッチファイルに日本語テキストを含めると`cmd.exe`のエンコーディング解釈が
  壊れて`@echo off`ごと誤動作することがある。プロジェクト内の`.bat`ファイルは全てASCIIのみ
  で記述している
- Windowsは`http.server`等のデフォルト設定（`allow_reuse_address=True`）で、既にLISTEN中の
  ポートにも二重bindできてしまう（POSIXと挙動が異なる）。開発サーバーが複数プロセス
  起動したまま停止し忘れると、古いプロセスが応答して混乱の原因になる。動作確認前に
  `netstat -ano | findstr :8827`等でポート使用状況を確認し、不要なプロセスは
  `taskkill //F //PID <pid>`で停止すること
- Claude_Browserツールの`preview_start {name}`は`.claude/launch.json`を**プロジェクトルート
  ではなく親作業ディレクトリ（`C:\Users\right\OneDrive\Desktop\Python`）**から読む。
  `project0827-frontend`という名前で登録済み（`npm --prefix project0827/frontend run dev`,
  port 5827）
- 会員の`card_identifier`（カードID）は単なる一意文字列で長さ・形式の制限なし。IC/バーコード
  の実際のIDだけでなく、短い手入力コード（例:カード裏の3桁番号）もそのまま使える

## 未着手・保留中の項目

- **HANDOFF.mdの本更新以降、まだ実施していない検討事項**:
  - スマホ実機でのMVP実使用感の最終確認（ngrok経由での実機テスト、ユーザーからの明示的な
    実施指示はまだ受けていない）
  - アプリ名・アイコンのブランディング検討（一度提案したがユーザーが「やっぱいいです」と
    保留、MVPの実使用確認が先という結論）
- `launch.vbs`のユーザー本人による実機ダブルクリック動作確認は未実施（構文チェックのみ済み）
- iPhoneのSuicaタップからIDm取得までの反応速度チューニング（nfcpyのポーリング間隔調整）は
  未着手・優先度低
- 上記の`test_current_occupants_reflects_latest_check_in`のflaky修正（背景タスク化済み）
