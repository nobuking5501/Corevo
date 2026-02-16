# 開発環境セットアップ

Corevoプロジェクトの開発環境をセットアップするためのガイドです。

## 前提条件

- Node.js 20.x 以上
- npm 10.x 以上
- Firebase CLI (`npm install -g firebase-tools`)
- Git

## 初回セットアップ

### 1. リポジトリをクローン

```bash
git clone <repository-url>
cd Corevo
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

```bash
# .env.local.exampleをコピー
cp apps/web/.env.local.example apps/web/.env.local

# .env.localを編集（Firebase設定を追加）
# エディタで apps/web/.env.local を開き、必要な値を設定
```

#### 必須の環境変数

- `NEXT_PUBLIC_FIREBASE_*`: Firebase Web SDK設定（Firebase Console → プロジェクト設定から取得）
- `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: Firebase Admin SDK（サービスアカウントキーから取得）

#### オプションの環境変数

- `NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`: Googleカレンダー連携用
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe決済用

### 4. Firebase Emulatorの起動

```bash
# 別ターミナルでEmulatorを起動
npm run emulator
```

Emulatorが起動すると、以下のサービスが利用可能になります:

- **Emulator UI**: http://127.0.0.1:4000
- **Firestore**: 127.0.0.1:8080
- **Auth**: 127.0.0.1:9099
- **Functions**: 127.0.0.1:5001
- **Storage**: 127.0.0.1:9199

### 5. Emulatorにテストデータを投入

#### 方法A: 共有データを使用（推奨 - 生徒さん向け）

本番データから作成された共有データを使用します：

```bash
# 別ターミナルで実行
npm run emulator:restore-shared
```

以下のテストデータが復元されます:

- **Organizations**: 2組織
- **Tenants**: 2テナント（サロン）
- **Users**: 2ユーザー（全員パスワード: `test1234`）
  - `test@corevo.dev` / `test1234`
  - `test@example.com` / `test1234`
- **Customers**: 2顧客
- **Services**: 44サービス
- **Staff Members**: 1スタッフ
- **Metrics**: 42メトリクス

#### 方法B: サンプルデータを使用

```bash
# 別ターミナルで実行
npm run emulator:seed
```

以下のテストデータが作成されます:

- **Organizations**: 4組織
- **Tenants**: 8テナント（サロン）
- **Users**: 2ユーザー
  - Platform Admin: `nobuking5501@gmail.com` / `kitamura55`
  - Test User: `test@example.com` / `test1234`
- **Customers**: 複数の顧客データ
- **Appointments**: 複数の予約データ
- **Services**: 5サービス
- **Staff Members**: 3スタッフ

#### 方法C: 本番データをコピー（プロジェクトオーナーのみ）

```bash
# 本番FirebaseからEmulatorにデータをコピー
npm run emulator:copy-prod
```

**注意**: 本番データのコピーには、`.env.local`に本番Firebaseの認証情報が必要です。

### 6. 開発サーバーの起動

```bash
# 別ターミナルで実行
npm run dev:web
```

開発サーバーが起動します:

- **Web App**: http://localhost:3006

## 開発フロー

### Emulatorの使用

開発中は常にEmulatorを起動しておきます。Emulatorを使用することで:

- 本番データに影響を与えずに開発できる
- オフラインでも開発可能
- データのリセットが簡単

### Emulatorデータのリセット

```bash
# Emulatorを停止してから実行
npm run emulator:clear

# 再度テストデータを投入
npm run emulator:seed
```

### Functions のビルド

Firebase Functionsを変更した場合:

```bash
# TypeScriptのビルド
npm run build:functions
```

Functionsの変更は、Emulatorが自動的に検出してリロードします。

## 便利なコマンド

```bash
# Emulator起動（データの自動インポート/エクスポート）
npm run emulator

# テストデータ投入
npm run emulator:seed

# 本番データコピー（プロジェクトメンバーのみ）
npm run emulator:copy-prod

# Emulatorデータクリア
npm run emulator:clear

# Web開発サーバー起動
npm run dev:web

# Functions開発サーバー起動
npm run dev:functions

# リント
npm run lint

# テスト
npm run test

# ビルド（本番用）
npm run build
```

## トラブルシューティング

### Emulatorが起動しない

```bash
# ポートが使用中の場合、プロセスを確認
lsof -i :8080
lsof -i :9099
lsof -i :5001

# 必要に応じてプロセスを終了
kill -9 <PID>
```

### Functions が読み込まれない

```bash
# Functionsをビルド
cd backend/functions
npm run build

# Emulatorを再起動
npm run emulator
```

### 認証エラー

- `.env.local`のFirebase設定が正しいか確認
- `NEXT_PUBLIC_APP_ENV=dev`になっているか確認（Emulator使用時）

### Emulatorデータが保存されない

- Emulatorを`Ctrl+C`で正しく終了しているか確認
- `--export-on-exit`オプションが有効か確認（`npm run emulator`で自動設定）

## プロジェクト構成

```
Corevo/
├── apps/
│   └── web/              # Next.js Webアプリ
│       ├── src/
│       ├── .env.local    # 環境変数（gitignore）
│       └── package.json
├── backend/
│   └── functions/        # Firebase Functions
│       ├── src/
│       ├── lib/          # ビルド出力（gitignore）
│       └── package.json
├── infra/
│   └── scripts/          # インフラスクリプト
│       └── seed-emulator.js
├── core/                 # プロジェクトドキュメント
│   ├── 00_concept.md
│   ├── 01_agent_role.md
│   ├── 02_rules.md
│   ├── 03_domain.md
│   ├── 04_flow.md
│   └── 05_decisions.md
├── emulator-data/        # Emulatorデータ（gitignore）
├── firebase.json         # Firebase設定
├── firestore.rules       # Firestoreセキュリティルール
├── package.json          # ルートpackage.json
└── DEVELOPMENT.md        # このファイル
```

## 外部サービス連携

### Googleカレンダー連携

開発環境でもテスト可能です:

1. Google Cloud Consoleでプロジェクトを作成
2. Google Calendar APIを有効化
3. OAuth 2.0クライアントIDを作成
4. `.env.local`にClient IDとClient Secretを設定
5. OAuth同意画面でテストユーザーを追加

詳細は http://localhost:3006/settings/google-calendar のセットアップガイドを参照。

### LINE連携

**注意**: LINE連携は本番環境（HTTPS）が必要です。

開発環境でテストする場合は:

1. ngrokを使用してローカルサーバーを公開
2. LINE DevelopersでWebhook URLを設定
3. メッセージテンプレートの編集はローカルでも可能

## コーディング規約

プロジェクトのコーディング規約は `/core/02_rules.md` を参照してください。

主な規約:

- TypeScript strict mode
- マルチテナント完全分離（すべてのクエリで`tenantId`を指定）
- 前計算主義（ダッシュボードは事前計算済みメトリクスを使用）
- 承認制AI（AI提案は人間の承認が必要）

## ブランチ戦略

- `main` / `master`: 本番環境
- `develop`: 開発環境
- `feature/*`: 機能追加
- `fix/*`: バグ修正

## コミット前のチェックリスト

- [ ] Lintエラーがないか確認
- [ ] TypeScriptのビルドが通るか確認
- [ ] 既存の機能が壊れていないか確認
- [ ] `.env.local`など機密情報をコミットしていないか確認

## サポート

質問や問題がある場合は、GitHubのIssuesで報告してください。
