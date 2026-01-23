# Corevo デプロイガイド

本番環境へのデプロイ手順を説明します。

## 前提条件

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Vercel CLI (`npm install -g vercel`)
- Firebase プロジェクト作成済み
- Stripe アカウント
- SendGrid または Gmail アカウント

## 1. Firebase プロジェクト設定

### 1.1 Firebase プロジェクト作成

```bash
# Firebase Console で新規プロジェクトを作成
# https://console.firebase.google.com/

# プロジェクトID例: corevo-production
```

### 1.2 Firebase Authentication 有効化

1. Firebase Console → Authentication → Sign-in method
2. Email/Password を有効化（Google ログインは使用しない）

### 1.3 Firestore Database 作成

1. Firebase Console → Firestore Database
2. "Create database" をクリック
3. ロケーション: `asia-northeast1` (Tokyo)
4. セキュリティルール: 本番モードで開始

### 1.4 Cloud Storage 有効化

1. Firebase Console → Storage
2. "Get started" をクリック
3. ロケーション: `asia-northeast1`

## 2. 環境変数設定

### 2.1 Firebase Config（Web App用）

1. Firebase Console → Project settings → General → Your apps
2. Web アプリを追加し、Config をコピー

### 2.2 .env ファイル作成

ルート直下に `.env` を作成：

```bash
cp .env.example .env
```

以下の値を設定：

```env
# Firebase Web SDK
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Environment
NEXT_PUBLIC_APP_ENV=production
```

### 2.3 Firebase Functions Config

```bash
firebase functions:config:set \
  stripe.secret_key="sk_test_xxx" \
  webapp.url="https://your-app.vercel.app" \
  sendgrid.api_key="SG.xxx" \
  claude.api_key="sk-ant-xxx"
```

## 3. Firebase Deploy

### 3.1 Firebase CLI ログイン

```bash
firebase login
firebase use --add
# プロジェクトを選択し、エイリアス (例: production) を設定
```

### 3.2 Security Rules デプロイ

```bash
firebase deploy --only firestore:rules,storage:rules
```

### 3.3 Firestore Indexes デプロイ

```bash
firebase deploy --only firestore:indexes
```

### 3.4 Functions デプロイ

```bash
# Functions のビルドと デプロイ
cd backend/functions
npm install
npm run build
cd ../..
firebase deploy --only functions
```

デプロイ時のリージョンは自動的に `asia-northeast1` に設定されます。

## 4. Vercel Deploy（Web App）

### 4.1 Vercel プロジェクト作成

```bash
cd apps/web
vercel login
vercel
```

プロンプトに従ってプロジェクトを作成します。

### 4.2 環境変数設定

Vercel Dashboard で以下の環境変数を設定：

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_ENV=production`

### 4.3 本番デプロイ

```bash
vercel --prod
```

## 5. Stripe 設定

### 5.1 Webhook 設定

1. Stripe Dashboard → Developers → Webhooks
2. "Add endpoint" をクリック
3. URL: `https://asia-northeast1-your-project-id.cloudfunctions.net/stripeWebhook`
4. イベント選択:
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Webhook Secret をコピーし、Functions Config に追加

### 5.2 プラン設定

1. Stripe Dashboard → Products
2. 以下のプランを作成:
   - Trial (¥0/月)
   - Basic (¥9,800/月)
   - Pro (¥19,800/月)
   - Enterprise (¥49,800/月)

## 6. 初期テナント作成

### 6.1 Service Account Key 取得

1. Firebase Console → Project settings → Service accounts
2. "Generate new private key" をクリック
3. `service-account-key.json` として保存（Git には含めない）

### 6.2 Seed 実行

```bash
cd infra/scripts
npm install
FIREBASE_SERVICE_ACCOUNT=../../service-account-key.json npm run seed
```

デモテナントとテストユーザーが作成されます：
- Email: `owner@demo.corevo.test`
- Password: `demo1234`

### 6.3 本番テナント作成

```bash
node provision-tenant.js owner@salon.com password123 "サロン名"
```

## 7. 動作確認

### 7.1 ログイン確認

1. デプロイした Web App URL にアクセス
2. `/login` でログイン
3. テスト用認証情報でログイン
4. `/dashboard` が表示されることを確認

### 7.2 Functions 確認

```bash
# Functions ログ確認
firebase functions:log
```

### 7.3 Scheduler 確認

Firebase Console → Functions で以下が定期実行されることを確認：
- `metricsJob` (毎日 03:00)
- `forecastJob` (毎日 03:30)
- `insightJob` (毎日 03:45)
- `nbaJob` (毎日 04:00)

## 8. ロールバック手順

### 8.1 Functions ロールバック

```bash
# デプロイ履歴確認
firebase deploy --only functions --version-history

# 特定バージョンにロールバック
firebase rollback functions:functionName --to-version VERSION_ID
```

### 8.2 Vercel ロールバック

Vercel Dashboard で以前のデプロイメントを選択し、"Promote to Production" をクリック。

## 9. トラブルシューティング

### Functions が動かない

- リージョン設定を確認: `asia-northeast1`
- Config が設定されているか確認: `firebase functions:config:get`
- ログを確認: `firebase functions:log`

### Security Rules でアクセス拒否

- Custom Claims が設定されているか確認
- Firestore Rules が正しくデプロイされているか確認
- ユーザーの `tenantIds` が正しいか確認

### Web App が Firebase に接続できない

- 環境変数が正しく設定されているか Vercel Dashboard で確認
- Firebase Console で Web App が追加されているか確認

## 10. 監視・アラート設定

### 10.1 Firebase 監視

- Firebase Console → Functions → Logs でエラー監視
- Cloud Monitoring でメトリクス監視

### 10.2 Vercel 監視

- Vercel Analytics でパフォーマンス監視
- Vercel Logs でエラー監視

## 11. バックアップ

### 11.1 Firestore バックアップ

```bash
# 自動バックアップ設定（Firebase Console → Firestore → Backups）
```

### 11.2 定期エクスポート

Cloud Scheduler で定期的な Firestore エクスポートを設定することを推奨します。

---

デプロイに関する質問は [GitHub Issues](https://github.com/your-org/corevo/issues) で受け付けています。
