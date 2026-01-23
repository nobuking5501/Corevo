# Corevo Firebase Functions

バックエンドロジックを実装した Cloud Functions。

## 概要

- **ランタイム**: Node.js 20
- **言語**: TypeScript
- **リージョン**: asia-northeast1 (Tokyo)

## ディレクトリ構成

```
src/
├── api/
│   ├── createTenant.ts      # テナント作成
│   ├── appointments.ts      # 予約CRUD
│   ├── ai.ts                # AI提案生成・送信
│   ├── stripe.ts            # Stripe Webhook
│   └── export.ts            # CSV エクスポート
├── scheduled/
│   ├── metricsJob.ts        # メトリクス集計（03:00）
│   ├── forecastJob.ts       # 売上予測（03:30）
│   ├── insightJob.ts        # インサイト生成（03:45）
│   └── nbaJob.ts            # NBA提案生成（04:00）
├── utils/
│   └── middleware.ts        # 認証・認可ミドルウェア
└── index.ts                 # エントリーポイント
```

## Functions 一覧

### HTTPS Callable Functions

#### 1. createTenant

テナント作成（オンボーディング時）。

**Input:**
```typescript
{
  tenantName: string;
  ownerEmail: string;
  ownerName: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  tenantId: string;
  message: string;
}
```

**処理:**
- テナントドキュメント作成
- オーナーユーザードキュメント作成
- Custom Claims 設定 (`tenantIds`)
- 初期設定（営業時間、機能フラグ）作成

#### 2. createAppointment / updateAppointment / cancelAppointment

予約のCRUD操作。

**認可:**
- テナントアクセス権限チェック
- 重複予約チェック（実装推奨）

#### 3. generateSuggestion

AI提案の生成（手動トリガー）。

**Input:**
```typescript
{
  tenantId: string;
  customerId: string;
  context?: string;
}
```

**処理:**
- 顧客の来店履歴を分析
- Claude API でメッセージ生成（本番環境）
- `ai_suggestions` コレクションに保存（`approved: false`）

#### 4. sendMessage

承認済みAI提案の送信。

**Input:**
```typescript
{
  tenantId: string;
  suggestionId: string;
}
```

**処理:**
- 承認済みチェック
- SendGrid / Gmail API でメール送信
- `messages` コレクションに記録
- `ai_suggestions` の `sentAt` 更新

#### 5. exportData

会計/KPIデータのCSVエクスポート。

**Input:**
```typescript
{
  tenantId: string;
  type: "appointments" | "revenue" | "customers";
  startDate: string;
  endDate: string;
}
```

**Output:**
CSV文字列（本番環境では署名付きURL）

### HTTPS onRequest Functions

#### stripeWebhook

Stripe Webhook 受信。

**処理:**
- Webhook 署名検証
- `customer.subscription.updated` / `deleted` を処理
- テナントの `plan` / `status` 更新
- `settings` の `featureFlags` 更新（プランに応じて）

### Scheduled Functions

#### metricsJob

毎日 03:00 (JST) に実行。

**処理:**
- 全テナントの前日データを集計
- 日次メトリクスを計算
  - 売上
  - 予約数
  - No-show率
  - スタッフ別集計
  - メニュー別集計
- `metrics` コレクションに保存

#### forecastJob

毎日 03:30 (JST) に実行。

**処理:**
- 過去3ヶ月のメトリクスを分析
- 指数平滑法 + トレンド分析で来月・再来月を予測
- 信頼区間（±20%）を計算
- `forecasts` コレクションに保存

#### insightJob

毎日 03:45 (JST) に実行。

**処理:**
- 最新メトリクスを分析
- 以下のインサイトを生成：
  - **Alert**: No-show率が高い
  - **Opportunity**: 売上ピーク日の活用
  - **Shortage**: 新規顧客獲得の提案
- `insights` コレクションに保存
- 30日以上古いインサイトを削除

#### nbaJob

毎日 04:00 (JST) に実行。

**処理:**
- 来店間隔を超えた顧客を抽出
- 顧客ごとにメッセージ草案を生成
- 優先度スコア計算
- `ai_suggestions` コレクションに保存（最大5件/日）

## 開発

### ローカル開発

```bash
# Firebase Emulator 起動
npm run dev

# または
npm run serve
```

Emulator Suite が起動します：
- Functions: http://localhost:5001
- Firestore: http://localhost:8080
- Auth: http://localhost:9099
- UI: http://localhost:4000

### ビルド

```bash
npm run build
```

`lib/` ディレクトリに JavaScript が出力されます。

### デプロイ

```bash
firebase deploy --only functions
```

または特定の Function のみ：

```bash
firebase deploy --only functions:createTenant
```

## Config 管理

Firebase Functions Config で環境変数を管理します。

### 設定

```bash
firebase functions:config:set \
  stripe.secret_key="sk_test_xxx" \
  webapp.url="https://your-app.vercel.app" \
  sendgrid.api_key="SG.xxx" \
  claude.api_key="sk-ant-xxx"
```

### 取得

```typescript
import { defineString } from "firebase-functions/params";

const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
// 使用時: stripeSecretKey.value()
```

### ローカル開発

`.runtimeconfig.json` を作成：

```json
{
  "stripe": {
    "secret_key": "sk_test_xxx"
  },
  "webapp": {
    "url": "http://localhost:3000"
  }
}
```

**注意**: `.runtimeconfig.json` は Git に含めないこと。

## セキュリティ

### 認証・認可

すべての Callable Functions で以下をチェック：

1. `requireAuth()`: 認証済みか確認
2. `requireTenantAccess()`: テナントアクセス権限確認
3. ロールチェック（必要に応じて）

### データ検証

Zod でリクエストデータを検証：

```typescript
const schema = z.object({
  tenantId: z.string(),
  name: z.string().min(1),
});

const data = schema.parse(request.data);
```

### 冪等性

- Webhook は同じイベントを複数回受信する可能性あり
- トランザクションで重複処理を防止

## 監視

### ログ確認

```bash
firebase functions:log
```

### エラーアラート

Cloud Monitoring で Functions のエラー率を監視し、アラートを設定することを推奨します。

## トラブルシューティング

### Functions がデプロイできない

- Node.js バージョンを確認（20以上）
- `tsconfig.json` のターゲットを確認
- ビルドエラーがないか確認

### Scheduler が実行されない

- タイムゾーンが `Asia/Tokyo` になっているか確認
- Cloud Scheduler が有効化されているか確認
- ログで実行履歴を確認

### Webhook が動かない

- Stripe Dashboard で Webhook URL が正しいか確認
- 署名検証が正しく実装されているか確認

---

詳細な実装は各ファイルのコメントを参照してください。
