# Types Directory Structure

このディレクトリは、Corevo プロジェクト全体で使用される TypeScript 型定義を管理します。

## 📁 ファイル構成

```
types/
├── index.ts          # メイン型定義ファイル（325行）
├── sales.ts          # 売上管理関連の型定義
└── README.md         # このファイル
```

## 📋 型定義一覧

### 🏢 組織・テナント管理

- `Organization` - 組織（サロングループ）
- `Tenant` - 店舗
- `User` - ユーザー（スタッフ）
- `UserRole` - ロール（owner, manager, staff, accountant）

### 👥 顧客管理

- `Customer` - 顧客情報
- `CustomerConsent` - 同意設定（マーケティング、写真利用）

### 📅 予約管理

- `Appointment` - 予約情報
- `AppointmentStatus` - 予約ステータス（scheduled, confirmed, completed, canceled, noshow）
- `AppointmentPricing` - 料金情報（セット割引含む）

### 💆 施術管理

- `Service` - サービス（メニュー）
- `Chart` - カルテ
- `StaffMember` - 施術スタッフ

### 💰 売上・経費管理

#### index.ts
- `Sale` - 売上（基本型）

#### sales.ts（詳細型）
- `Sale` - 売上（拡張型：customerName, staffName含む）
- `Expense` - 経費（月次、7カテゴリ）
- `Ad` - 広告（月次、媒体別）
- `ActionItem` - 改善アクション
- `KPITarget` - KPI目標

**注意**: `Sale` 型が2ファイルで重複定義されています。

### 📊 分析・メトリクス

- `Metrics` - メトリクス（前計算データ）
- `Forecast` - 売上予測
- `Insight` - インサイト（alert, opportunity, shortage）

### 🤖 AI・メッセージング

- `AISuggestion` - AI提案（承認待ち）
- `Message` - 送信予定メッセージ
- `MessageChannel` - チャネル（line, email, sms）
- `MessageStatus` - ステータス（draft, scheduled, sent, failed）

### ⚙️ 設定

- `Settings` - テナント設定
- `GoogleCalendarConfig` - Google Calendar設定
- `LINEConfig` - LINE設定
- `SetDiscountConfig` - セット割引設定

## 🔧 今後の改善案

### 優先度：高

1. **Sale 型の重複解消**
   - `types/index.ts` と `types/sales.ts` で `Sale` が重複定義
   - 統一するか、基本型と拡張型で明確に分ける

2. **型のドメイン別分割**
   ```
   types/
   ├── index.ts              # Re-export hub
   ├── common.types.ts       # Organization, Tenant, User
   ├── customer.types.ts     # Customer, Consent
   ├── appointment.types.ts  # Appointment, Service, StaffMember
   ├── chart.types.ts        # Chart
   ├── sales.types.ts        # Sale, Expense, Ad
   ├── analytics.types.ts    # Metrics, Forecast, Insight
   └── ai.types.ts           # AISuggestion, Message
   ```

### 優先度：中

3. **型のドキュメント強化**
   - 各型に JSDoc コメント追加
   - ビジネスルールの明記
   - 使用例の追加

4. **型の一貫性チェック**
   - Firestore のドキュメント構造と型の整合性確認
   - バックエンドAPIの型定義と整合性確認

## 📖 使用例

### インポート

```typescript
// メインファイルから
import { Customer, Appointment, Sale } from "@/types";

// 個別ファイルから
import { Sale, Expense, Ad } from "@/types/sales";
```

### 型の使用

```typescript
// 顧客作成
const newCustomer: Partial<Customer> = {
  name: "山田太郎",
  email: "yamada@example.com",
  consent: {
    marketing: true,
    photoUsage: false,
  },
};

// 予約作成
const newAppointment: Partial<Appointment> = {
  tenantId: "tenant-123",
  customerId: "customer-456",
  serviceIds: ["service-789"],
  startAt: new Date(),
  status: "scheduled",
};
```

## 🚨 重要な注意事項

### Firestore Timestamp 変換

Firestore の Timestamp 型は、クライアント側では Date 型に変換されます：

```typescript
// ❌ 悪い例
const lastVisit: Timestamp = customer.lastVisit; // 型エラー

// ✅ 良い例
const lastVisit: Date | null = customer.lastVisit 
  ? customer.lastVisit.toDate() 
  : null;
```

### Optional vs Nullable

- `field?` : フィールドが存在しない可能性（undefined）
- `field: Type | null` : フィールドは存在するが値がnull

```typescript
interface Customer {
  email?: string;        // undefined or string
  lastVisit: Date | null; // null or Date
}
```

## 🔗 関連ドキュメント

- [Data Model Design](/docs/DATA_MODEL.md)
- [API Documentation](/backend/functions/README.md)
- [Core Domain](/core/03_domain.md)

---

**最終更新**: 2026-01-23
