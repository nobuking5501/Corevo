# Corevo データモデル

Firestore のコレクション構造とデータモデルを説明します。

## 概要

Corevo はマルチテナント SaaS として設計されており、すべてのデータは `tenants/{tenantId}/` 配下に格納されます。

## コレクション一覧

### 1. `/tenants/{tenantId}`

テナント（サロン）の基本情報。

**フィールド:**
- `id` (string): テナントID（自動生成）
- `name` (string): サロン名
- `plan` (string): プラン（trial | basic | pro | enterprise）
- `status` (string): ステータス（active | suspended | canceled）
- `stripeCustomerId` (string, optional): Stripe 顧客ID
- `createdAt` (timestamp): 作成日時
- `updatedAt` (timestamp): 更新日時

**インデックス:**
- `status` (昇順)
- `stripeCustomerId` (昇順)

### 2. `/tenants/{tenantId}/users/{userId}`

テナント内のユーザー（オーナー、マネージャー、スタッフ等）。

**フィールド:**
- `id` (string): ユーザーID（Firebase Auth UID）
- `tenantId` (string): 所属テナントID
- `email` (string): メールアドレス
- `displayName` (string): 表示名
- `role` (string): ロール（owner | manager | staff | accountant）
- `photoURL` (string, optional): プロフィール画像URL
- `createdAt` (timestamp): 作成日時
- `updatedAt` (timestamp): 更新日時

### 3. `/tenants/{tenantId}/customers/{customerId}`

顧客情報。

**フィールド:**
- `id` (string): 顧客ID（自動生成）
- `tenantId` (string): テナントID
- `name` (string): 氏名
- `kana` (string): フリガナ
- `email` (string, optional): メールアドレス
- `phone` (string, optional): 電話番号
- `consent` (object): 同意情報
  - `marketing` (boolean): マーケティング利用同意
  - `photoUsage` (boolean): 写真利用同意
- `visitInterval` (number, optional): 来店間隔の目安（日数）
- `preferences` (array<string>): 嗜好タグ
- `tags` (array<string>): カテゴリタグ
- `lastVisit` (timestamp, optional): 最終来店日
- `createdAt` (timestamp): 作成日時
- `updatedAt` (timestamp): 更新日時

**インデックス:**
- `tenantId`, `kana` (昇順)
- `tenantId`, `lastVisit` (降順)
- `lastVisit` (昇順) ← NBA Job 用

**代表クエリ:**
```typescript
// フリガナ検索
db.collection(`tenants/${tenantId}/customers`)
  .where('kana', '>=', 'ヤマダ')
  .where('kana', '<', 'ヤマダ' + '\uf8ff')

// 最近来店していない顧客（NBA 用）
db.collection(`tenants/${tenantId}/customers`)
  .where('lastVisit', '<', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  .limit(10)
```

### 4. `/tenants/{tenantId}/appointments/{appointmentId}`

予約情報。

**フィールド:**
- `id` (string): 予約ID（自動生成）
- `tenantId` (string): テナントID
- `customerId` (string): 顧客ID
- `staffId` (string): 担当スタッフID
- `serviceId` (string): メニューID
- `startAt` (timestamp): 開始日時
- `endAt` (timestamp): 終了日時
- `status` (string): ステータス（scheduled | confirmed | completed | canceled | noshow）
- `notes` (string, optional): メモ
- `createdAt` (timestamp): 作成日時
- `updatedAt` (timestamp): 更新日時

**インデックス:**
- `tenantId`, `staffId`, `startAt` (昇順) ← スタッフ別スケジュール
- `tenantId`, `customerId`, `startAt` (降順) ← 顧客別履歴
- `tenantId`, `status`, `startAt` (昇順)
- `startAt`, `startAt` (昇順) ← 日別集計用

**代表クエリ:**
```typescript
// スタッフの1日のスケジュール
db.collection(`tenants/${tenantId}/appointments`)
  .where('staffId', '==', staffId)
  .where('startAt', '>=', startOfDay)
  .where('startAt', '<=', endOfDay)
  .orderBy('startAt')

// 顧客の来店履歴
db.collection(`tenants/${tenantId}/appointments`)
  .where('customerId', '==', customerId)
  .orderBy('startAt', 'desc')
  .limit(10)
```

### 5. `/tenants/{tenantId}/services/{serviceId}`

メニュー（施術サービス）情報。

**フィールド:**
- `id` (string): メニューID（自動生成）
- `tenantId` (string): テナントID
- `name` (string): メニュー名
- `price` (number): 価格（円）
- `durationMinutes` (number): 所要時間（分）
- `marginCoefficient` (number): 粗利係数（0.0 ～ 1.0）
- `promotionPriority` (number): 販促優先度（1 ～ 10）
- `tags` (array<string>): タグ
- `description` (string, optional): 説明
- `active` (boolean): 有効/無効
- `createdAt` (timestamp): 作成日時
- `updatedAt` (timestamp): 更新日時

### 6. `/tenants/{tenantId}/charts/{chartId}`

施術記録（カルテ）。

**フィールド:**
- `id` (string): カルテID（自動生成）
- `tenantId` (string): テナントID
- `customerId` (string): 顧客ID
- `appointmentId` (string): 予約ID
- `staffId` (string): 担当スタッフID
- `photos` (array<string>): 写真URL配列
- `tags` (array<string>): タグ
- `notes` (string): 施術内容メモ
- `cautions` (string, optional): 注意事項
- `effectPeriodDays` (number, optional): 効果持続期間（日数）
- `createdAt` (timestamp): 作成日時
- `updatedAt` (timestamp): 更新日時

### 7. `/tenants/{tenantId}/messages/{messageId}`

送信メッセージ履歴。

**フィールド:**
- `id` (string): メッセージID（自動生成）
- `tenantId` (string): テナントID
- `customerId` (string): 顧客ID
- `channel` (string): チャネル（email | line | sms）
- `purpose` (string): 目的（reminder | followup | promotion | nba）
- `subject` (string, optional): 件名
- `body` (string): 本文
- `sentAt` (timestamp, optional): 送信日時
- `readAt` (timestamp, optional): 既読日時
- `convertedToAppointmentAt` (timestamp, optional): 予約転換日時
- `createdAt` (timestamp): 作成日時

### 8. `/tenants/{tenantId}/ai_suggestions/{suggestionId}`

AI 提案（承認待ちメッセージ草案）。

**フィールド:**
- `id` (string): 提案ID（自動生成）
- `tenantId` (string): テナントID
- `customerId` (string): 顧客ID
- `messageBody` (string): メッセージ本文
- `reason` (string): 提案理由
- `scheduledAt` (timestamp): 送信予定日時
- `approved` (boolean): 承認済みフラグ
- `approvedBy` (string, optional): 承認者ユーザーID
- `approvedAt` (timestamp, optional): 承認日時
- `sentAt` (timestamp, optional): 送信日時
- `priority` (number): 優先度（1 ～ 10）
- `createdAt` (timestamp): 作成日時

**インデックス:**
- `tenantId`, `approved`, `priority` (降順)
- `customerId`, `approved`, `sentAt` (昇順) ← 重複チェック用

### 9. `/tenants/{tenantId}/metrics/{metricId}`

前計算済みメトリクス（集計データ）。

**フィールド:**
- `id` (string): メトリクスID（自動生成）
- `tenantId` (string): テナントID
- `period` (string): 期間（daily | weekly | monthly）
- `date` (string): 日付（ISO 形式: YYYY-MM-DD）
- `revenue` (number): 売上（円）
- `appointmentCount` (number): 予約数
- `customerCount` (number): 顧客数
- `noshowRate` (number): No-show 率（0.0 ～ 1.0）
- `byStaff` (object): スタッフ別集計 `{ staffId: { revenue, count } }`
- `byService` (object): メニュー別集計 `{ serviceId: { revenue, count } }`
- `createdAt` (timestamp): 作成日時

**インデックス:**
- `tenantId`, `period`, `date` (降順)

**前計算方針:**
ダッシュボードは生データを集計せず、必ず `metrics` コレクションを参照します。夜間バッチ（`metricsJob`）で日次・週次・月次を計算します。

### 10. `/tenants/{tenantId}/forecasts/{forecastId}`

売上予測データ。

**フィールド:**
- `id` (string): 予測ID（自動生成）
- `tenantId` (string): テナントID
- `targetMonth` (string): 対象月（YYYY-MM）
- `predictedRevenue` (number): 予測売上（円）
- `confidenceLower` (number): 信頼区間下限（円）
- `confidenceUpper` (number): 信頼区間上限（円）
- `methodology` (string): 予測手法説明
- `createdAt` (timestamp): 作成日時

**インデックス:**
- `tenantId`, `createdAt` (降順)

**予測アルゴリズム:**
- 指数平滑法 + 12期季節係数 + 曜日係数 + 直近トレンド + 繁忙期補正
- `forecastJob` で毎日計算

### 11. `/tenants/{tenantId}/insights/{insightId}`

AI インサイト（経営分析コメント）。

**フィールド:**
- `id` (string): インサイトID（自動生成）
- `tenantId` (string): テナントID
- `type` (string): 種別（alert | opportunity | shortage）
- `title` (string): タイトル
- `description` (string): 説明
- `actionable` (string): アクション提案
- `priority` (number): 優先度（1 ～ 10）
- `createdAt` (timestamp): 作成日時

**インデックス:**
- `tenantId`, `priority` (降順)
- `createdAt` (昇順) ← 古い insight の削除用

**生成方針:**
`insightJob` で毎日生成。30日以上古い insight は自動削除。

### 12. `/tenants/{tenantId}/audit_logs/{logId}`

監査ログ。

**フィールド:**
- `id` (string): ログID（自動生成）
- `tenantId` (string): テナントID
- `userId` (string): 実行ユーザーID
- `action` (string): アクション（例: `customer.delete`, `settings.update`）
- `targetType` (string): 対象タイプ（例: `customer`, `appointment`）
- `targetId` (string): 対象ID
- `changes` (object, optional): 変更内容
- `createdAt` (timestamp): 作成日時

**アクセス制御:**
オーナーのみ読み取り可能。書き込みは Functions のみ。

### 13. `/tenants/{tenantId}/settings/main`

テナント設定（単一ドキュメント）。

**フィールド:**
- `id` (string): 固定値 `"main"`
- `tenantId` (string): テナントID
- `businessHours` (object): 営業時間 `{ monday: { open, close }, ... }`
- `featureFlags` (object): 機能フラグ
  - `aiAutoSuggest` (boolean): AI 自動提案
  - `lineIntegration` (boolean): LINE 連携
  - `advancedAnalytics` (boolean): 詳細分析
- `billingStatus` (object): 請求情報
  - `plan` (string): プラン名
  - `periodEnd` (timestamp): 期間終了日
- `updatedAt` (timestamp): 更新日時

## テナント分離の仕組み

### Custom Claims

Firebase Authentication の Custom Claims を使用して、ユーザーに `tenantIds` 配列を設定します。

```json
{
  "tenantIds": ["tenant_abc123"]
}
```

### Security Rules

すべての読み書きで `request.auth.token.tenantIds` に `tenantId` が含まれることを確認します。

```javascript
function hasTenantAccess(tenantId) {
  return request.auth != null &&
         tenantId in request.auth.token.tenantIds;
}
```

### Functions

Functions でも同様に、Callable Context の `auth.token.tenantIds` を検証します。

```typescript
async function requireTenantAccess(context: AuthenticatedContext, tenantId: string) {
  const tenantIds = context.auth.token.tenantIds as string[];
  if (!tenantIds || !tenantIds.includes(tenantId)) {
    throw new HttpsError("permission-denied", "User does not have access to this tenant");
  }
}
```

## リレーション

- `customers` ← `appointments` ← `charts`
- `services` ← `appointments`
- `users (staff)` ← `appointments`
- `customers` ← `ai_suggestions` ← `messages`

## データ整合性

- 削除時はカスケードせず、アーカイブフラグを使用
- トランザクションで複数ドキュメント更新を保証
- 楽観的ロックで競合を検出（`updatedAt` チェック）

---

詳細な実装は各 Functions のコードを参照してください。
