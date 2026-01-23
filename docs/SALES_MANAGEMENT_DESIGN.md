# 売上管理機能 設計書

## 概要

GAS（Google Apps Script）で実装されていた脱毛サロン向け業績管理システムをCorevoに統合する設計書です。
既存のCorevoアーキテクチャ（Next.js + Firebase + TypeScript）に準拠し、マルチテナントSaaSとして実装します。

## 設計方針

1. **前計算主義の継承**: 既存のCorevoと同様に、ダッシュボードは集計済みメトリクスのみ参照
2. **夜間バッチ処理**: Firebase Schedulerで日次集計を実行
3. **マルチテナント対応**: すべてのデータは `/tenants/{tenantId}/` 配下に格納
4. **既存機能との統合**: 予約・顧客管理と連携し、重複を避ける
5. **段階的実装**: フェーズ分けして優先度の高い機能から実装

---

## 1. Firestoreデータモデル設計

### 1.1 既存コレクションの拡張

#### 1.1.1 `/tenants/{tenantId}/customers/{customerId}` の拡張

売上管理に必要な顧客情報を追加。

**追加フィールド:**
```typescript
interface CustomerExtension {
  // GAS「顧客シート」から追加
  contractCourse?: string;          // 契約コース名
  courseProgress?: number;           // 通過回数
  courseStatus?: 'initial' | 'mid' | 'completed'; // ステータス
  isContinuing: boolean;             // 継続中かどうか
  cancelReason?: string;             // 解約理由
  preferredStaffId?: string;         // 指名スタッフID

  // 自動計算フィールド（バッチで更新）
  totalRevenue?: number;             // 累計売上
  averageSpending?: number;          // 平均客単価
  visitCount?: number;               // 来店回数
  lastPurchaseAmount?: number;       // 最終購入金額
  ltv?: number;                      // 顧客生涯価値（LTV）
}
```

**インデックス追加:**
- `tenantId, isContinuing` (昇順) ← 継続率計算用
- `tenantId, courseStatus` (昇順) ← ステータス別集計用
- `tenantId, cancelReason` (昇順) ← 解約理由分析用

#### 1.1.2 `/tenants/{tenantId}/appointments/{appointmentId}` の拡張

予約から売上データを生成するための情報を追加。

**追加フィールド:**
```typescript
interface AppointmentExtension {
  // 売上関連
  customerType: 'new' | 'existing';  // 新規 or 既存
  paymentMethod?: 'cash' | 'card' | 'paypay' | 'other'; // 支払い方法
  actualAmount?: number;             // 実売上金額（割引後）
  discount?: number;                 // 割引額
  revenue?: number;                  // 売上（= actualAmount）

  // 次回予約
  hasNextAppointment?: boolean;      // 次回予約あり
  nextAppointmentId?: string;        // 次回予約ID
}
```

**インデックス追加:**
- `tenantId, customerType, startAt` (昇順) ← 新規/既存分析用
- `tenantId, paymentMethod` (昇順) ← 支払い方法別集計用

#### 1.1.3 `/tenants/{tenantId}/users/{userId}` の拡張

スタッフパフォーマンス管理用。

**追加フィールド:**
```typescript
interface UserExtension {
  // スタッフパフォーマンス（バッチで更新）
  performance?: {
    totalSales: number;              // 累計売上
    appointmentCount: number;        // 施術件数
    averagePrice: number;            // 平均単価
    nominationRate: number;          // 指名率（0.0-1.0）
    repeatRate: number;              // リピート率（0.0-1.0）
    reviewCount: number;             // 口コミ数
  };

  // 目標値
  monthlyTarget?: number;            // 月間売上目標
}
```

### 1.2 新規コレクションの追加

#### 1.2.1 `/tenants/{tenantId}/sales/{saleId}`

日々の売上明細を記録（GAS「売上シート」に相当）。

```typescript
interface Sale {
  id: string;                        // 売上ID（自動生成）
  tenantId: string;                  // テナントID
  appointmentId?: string;            // 紐づく予約ID（任意）
  customerId: string;                // 顧客ID
  customerName: string;              // 顧客名（非正規化）
  customerType: 'new' | 'existing';  // 新規 or 既存

  date: string;                      // 売上日（YYYY-MM-DD）
  serviceName: string;               // メニュー名
  coursePrice: number;               // コース単価
  quantity: number;                  // 回数
  amount: number;                    // 売上金額
  paymentMethod: 'cash' | 'card' | 'paypay' | 'other';

  staffId: string;                   // 担当スタッフID
  staffName: string;                 // スタッフ名（非正規化）

  notes?: string;                    // 備考

  createdAt: Date;
  updatedAt: Date;
}
```

**インデックス:**
- `tenantId, date` (降順) ← 日別売上集計
- `tenantId, customerType, date` (降順) ← 新規/既存分析
- `tenantId, staffId, date` (降順) ← スタッフ別売上
- `tenantId, paymentMethod` (昇順) ← 支払い方法別集計

**備考:**
- 予約完了時に自動生成、または手動入力も可能
- 非正規化により高速な集計を実現

#### 1.2.2 `/tenants/{tenantId}/expenses/{expenseId}`

月次経費を管理（GAS「経費シート」に相当）。

```typescript
interface Expense {
  id: string;                        // 経費ID（自動生成）
  tenantId: string;                  // テナントID
  month: string;                     // 対象月（YYYY-MM）

  // 経費項目
  rent: number;                      // 家賃
  labor: number;                     // 人件費
  advertising: number;               // 広告費
  materials: number;                 // 材料費
  utilities: number;                 // 光熱費
  miscellaneous: number;             // 雑費
  systems: number;                   // システム費

  total: number;                     // 合計（自動計算）

  notes?: string;                    // 備考

  createdAt: Date;
  updatedAt: Date;
}
```

**インデックス:**
- `tenantId, month` (降順) ← 月次経費取得

**バリデーション:**
- 1テナント1ヶ月につき1レコード（unique制約）
- totalは自動計算: `rent + labor + advertising + materials + utilities + miscellaneous + systems`

#### 1.2.3 `/tenants/{tenantId}/ads/{adId}`

広告媒体ごとの実績管理（GAS「広告シート」に相当）。

```typescript
interface Ad {
  id: string;                        // 広告ID（自動生成）
  tenantId: string;                  // テナントID
  month: string;                     // 対象月（YYYY-MM）
  medium: string;                    // 媒体名（Instagram、ホットペッパーなど）

  adCost: number;                    // 広告費
  newReservations: number;           // 新規予約数
  conversions: number;               // 成約数

  // 自動計算フィールド（バッチで更新）
  conversionRate?: number;           // 成約率（conversions / newReservations）
  cpa?: number;                      // CPA（adCost / conversions）
  ltv?: number;                      // 平均LTV（顧客別に計算）
  roi?: number;                      // ROI（(ltv - cpa) / cpa）

  notes?: string;                    // 備考

  createdAt: Date;
  updatedAt: Date;
}
```

**インデックス:**
- `tenantId, month, medium` (降順) ← 月次・媒体別集計
- `tenantId, roi` (降順) ← ROIランキング

#### 1.2.4 `/tenants/{tenantId}/action_items/{actionId}`

改善アクション（PDCA管理）（GAS「改善アクション」シートに相当）。

```typescript
interface ActionItem {
  id: string;                        // アクションID（自動生成）
  tenantId: string;                  // テナントID

  title: string;                     // タイトル
  category: 'sales' | 'cost' | 'customer' | 'staff' | 'other'; // カテゴリ
  problem: string;                   // 課題
  action: string;                    // 対策
  dueDate?: Date;                    // 期限

  status: 'pending' | 'in_progress' | 'completed' | 'canceled'; // ステータス
  priority: number;                  // 優先度（1-10）

  assignedTo?: string;               // 担当者ユーザーID

  // 効果測定
  measuredAt?: Date;                 // 測定日
  effectDescription?: string;        // 効果説明
  effectValue?: number;              // 効果の数値（売上増加額など）

  createdAt: Date;
  updatedAt: Date;
}
```

**インデックス:**
- `tenantId, status, priority` (降順) ← PDCA管理画面用
- `tenantId, dueDate` (昇順) ← 期限管理

#### 1.2.5 `/tenants/{tenantId}/kpi_targets/{targetId}`

KPI目標値管理。

```typescript
interface KPITarget {
  id: string;                        // 目標ID（通常は "main" 固定）
  tenantId: string;                  // テナントID

  // 目標値（GAS constants.gs の KPI_TARGETS に相当）
  profitMarginTarget: number;        // 利益率目標（0.20 = 20%）
  continuationRateTarget: number;    // 継続率目標（0.85 = 85%）
  nextReservationRateTarget: number; // 次回予約率目標（0.80 = 80%）
  newCustomersMonthlyTarget: number; // 月間新規来店目標（20名）
  cpaMaxTarget: number;              // CPA上限（15,000円）
  adCostRatioMaxTarget: number;      // 広告費率上限（0.15 = 15%）
  laborCostRatioMaxTarget: number;   // 人件費率上限（0.30 = 30%）
  expenseRatioMaxTarget: number;     // 経費率上限（0.60 = 60%）

  monthlyRevenueTarget?: number;     // 月間売上目標
  monthlyProfitTarget?: number;      // 月間利益目標

  updatedAt: Date;
}
```

**備考:**
- 通常は1テナント1レコード（id = "main"）
- 設定画面から変更可能

### 1.3 既存コレクションの拡張: Metrics

既存の `/tenants/{tenantId}/metrics/{metricId}` を拡張し、GASで計算していたKPIを追加。

```typescript
interface MetricsExtended extends Metrics {
  // 既存フィールド（変更なし）
  // id, tenantId, period, date, revenue, appointmentCount, customerCount, noshowRate, byStaff, byService, createdAt

  // 売上管理KPIを追加
  salesMetrics?: {
    // 売上分析
    newCustomerRevenue: number;      // 新規売上
    existingCustomerRevenue: number; // 既存売上
    newCustomerCount: number;        // 新規顧客数
    averageSpending: number;         // 平均客単価
    courseRatio: number;             // コース比率（0.0-1.0）

    // 支払い方法別
    paymentBreakdown: {
      cash: number;
      card: number;
      paypay: number;
      other: number;
    };
  };

  // 経費・利益
  profitMetrics?: {
    totalExpenses: number;           // 総経費
    operatingProfit: number;         // 営業利益（revenue - totalExpenses）
    profitMargin: number;            // 利益率（operatingProfit / revenue）

    // 経費内訳
    expenseBreakdown: {
      rent: number;
      labor: number;
      advertising: number;
      materials: number;
      utilities: number;
      miscellaneous: number;
      systems: number;
    };

    // 経費比率（対売上）
    expenseRatios: {
      total: number;                 // 総経費率
      rent: number;
      labor: number;
      advertising: number;
      materials: number;
      utilities: number;
      miscellaneous: number;
      systems: number;
    };
  };

  // 顧客KPI
  customerMetrics?: {
    continuationRate: number;        // 継続率（0.0-1.0）
    nextReservationRate: number;     // 次回予約率（0.0-1.0）
    cancelRate: number;              // 解約率（0.0-1.0）

    // ステータス別顧客数
    statusBreakdown: {
      initial: number;               // 初回
      mid: number;                   // 中間
      completed: number;             // 完了
    };

    // 解約理由TOP5
    cancelReasons: Array<{
      reason: string;
      count: number;
    }>;
  };

  // 広告KPI
  adMetrics?: {
    totalAdCost: number;             // 総広告費
    averageCPA: number;              // 平均CPA
    averageLTV: number;              // 平均LTV
    averageROI: number;              // 平均ROI

    // 媒体別実績
    byMedium: Record<string, {
      adCost: number;
      conversions: number;
      cpa: number;
      roi: number;
    }>;
  };

  // スタッフパフォーマンス（既存のbyStaffを拡張）
  staffMetrics?: {
    byStaff: Record<string, {
      revenue: number;
      count: number;
      averagePrice: number;
      nominationRate: number;
      repeatRate: number;
    }>;
  };
}
```

**インデックス（追加）:**
- `tenantId, period, date, profitMetrics.profitMargin` (降順) ← 利益率推移
- `tenantId, period, date, customerMetrics.continuationRate` (降順) ← 継続率推移

---

## 2. API/Firebase Functions設計

### 2.1 Callable Functions

#### 2.1.1 売上管理API

**`createSale`**
```typescript
interface CreateSaleRequest {
  tenantId: string;
  appointmentId?: string;
  customerId: string;
  date: string; // YYYY-MM-DD
  serviceName: string;
  coursePrice: number;
  quantity: number;
  paymentMethod: 'cash' | 'card' | 'paypay' | 'other';
  staffId: string;
  notes?: string;
}

interface CreateSaleResponse {
  saleId: string;
}
```

**`updateSale`**
```typescript
interface UpdateSaleRequest {
  tenantId: string;
  saleId: string;
  // 更新可能フィールド
  serviceName?: string;
  coursePrice?: number;
  quantity?: number;
  paymentMethod?: string;
  staffId?: string;
  notes?: string;
}
```

**`deleteSale`**
```typescript
interface DeleteSaleRequest {
  tenantId: string;
  saleId: string;
}
```

**`getSales`**
```typescript
interface GetSalesRequest {
  tenantId: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  customerId?: string;
  staffId?: string;
  limit?: number;
}

interface GetSalesResponse {
  sales: Sale[];
  total: number;
}
```

#### 2.1.2 経費管理API

**`upsertExpense`**
```typescript
interface UpsertExpenseRequest {
  tenantId: string;
  month: string; // YYYY-MM
  rent: number;
  labor: number;
  advertising: number;
  materials: number;
  utilities: number;
  miscellaneous: number;
  systems: number;
  notes?: string;
}

interface UpsertExpenseResponse {
  expenseId: string;
}
```

**`getExpense`**
```typescript
interface GetExpenseRequest {
  tenantId: string;
  month: string; // YYYY-MM
}

interface GetExpenseResponse {
  expense: Expense | null;
}
```

#### 2.1.3 広告管理API

**`createAd`**
```typescript
interface CreateAdRequest {
  tenantId: string;
  month: string;
  medium: string;
  adCost: number;
  newReservations: number;
  conversions: number;
  notes?: string;
}

interface CreateAdResponse {
  adId: string;
}
```

**`updateAd`**, **`deleteAd`**, **`getAds`** も同様に実装。

#### 2.1.4 改善アクション管理API

**`createActionItem`**
```typescript
interface CreateActionItemRequest {
  tenantId: string;
  title: string;
  category: 'sales' | 'cost' | 'customer' | 'staff' | 'other';
  problem: string;
  action: string;
  dueDate?: Date;
  priority: number;
  assignedTo?: string;
}

interface CreateActionItemResponse {
  actionId: string;
}
```

**`updateActionItem`**, **`deleteActionItem`**, **`getActionItems`** も同様に実装。

#### 2.1.5 KPI目標管理API

**`updateKPITargets`**
```typescript
interface UpdateKPITargetsRequest {
  tenantId: string;
  profitMarginTarget?: number;
  continuationRateTarget?: number;
  nextReservationRateTarget?: number;
  newCustomersMonthlyTarget?: number;
  cpaMaxTarget?: number;
  adCostRatioMaxTarget?: number;
  laborCostRatioMaxTarget?: number;
  expenseRatioMaxTarget?: number;
  monthlyRevenueTarget?: number;
  monthlyProfitTarget?: number;
}
```

**`getKPITargets`**
```typescript
interface GetKPITargetsRequest {
  tenantId: string;
}

interface GetKPITargetsResponse {
  targets: KPITarget;
}
```

#### 2.1.6 ダッシュボードAPI

**`getDashboard`**
```typescript
interface GetDashboardRequest {
  tenantId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
}

interface GetDashboardResponse {
  metrics: MetricsExtended[];
  targets: KPITarget;
  alerts: Array<{
    type: 'warning' | 'danger';
    message: string;
    kpi: string;
    actual: number;
    target: number;
  }>;
}
```

**`getSalesAnalysis`**
```typescript
interface GetSalesAnalysisRequest {
  tenantId: string;
  startDate: string;
  endDate: string;
}

interface GetSalesAnalysisResponse {
  // コース別売上
  byCourse: Array<{
    courseName: string;
    count: number;
    revenue: number;
    ratio: number;
    averagePrice: number;
  }>;

  // 新規vs既存
  byCustomerType: {
    new: { count: number; revenue: number; ratio: number; averagePrice: number };
    existing: { count: number; revenue: number; ratio: number; averagePrice: number };
  };

  // 支払い方法別
  byPaymentMethod: Record<string, { count: number; revenue: number; ratio: number }>;
}
```

**`getCustomerAnalysis`**
```typescript
interface GetCustomerAnalysisRequest {
  tenantId: string;
  startDate?: string;
  endDate?: string;
}

interface GetCustomerAnalysisResponse {
  // 解約理由TOP5
  cancelReasons: Array<{
    reason: string;
    count: number;
    ratio: number;
    priority: string;
  }>;

  // ステータス別顧客数
  byStatus: {
    initial: { count: number; ratio: number; averageVisits: number };
    mid: { count: number; ratio: number; averageVisits: number };
    completed: { count: number; ratio: number; averageVisits: number };
  };

  // 継続率・解約率
  retention: {
    continuationRate: number;
    cancelRate: number;
    nextReservationRate: number;
  };

  // コース別顧客数
  byCourse: Array<{
    courseName: string;
    count: number;
    ratio: number;
  }>;
}
```

**`getProfitAnalysis`**
```typescript
interface GetProfitAnalysisRequest {
  tenantId: string;
  startMonth: string; // YYYY-MM
  endMonth: string;
}

interface GetProfitAnalysisResponse {
  months: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
  }>;

  // 経費比率分析
  expenseAnalysis: {
    items: Array<{
      name: string;
      actual: number;
      actualRatio: number;
      targetRange: { min: number; max: number };
      status: 'ok' | 'warning';
      potentialSavings: number;
    }>;
    totalPotentialSavings: number;
  };
}
```

**`getStaffPerformance`**
```typescript
interface GetStaffPerformanceRequest {
  tenantId: string;
  startDate: string;
  endDate: string;
}

interface GetStaffPerformanceResponse {
  staff: Array<{
    staffId: string;
    staffName: string;
    revenue: number;
    appointmentCount: number;
    averagePrice: number;
    nominationRate: number;
    repeatRate: number;
    reviewCount: number;
    targetAchievementRate: number;
    performance: 'excellent' | 'good' | 'needs_improvement';
  }>;
}
```

### 2.2 Scheduled Functions（夜間バッチ）

#### 2.2.1 `calculateDailyMetrics`

毎日午前2時に実行（asia-northeast1）。

**処理内容:**
1. 前日の売上データを集計
2. 経費データを取得（月次）
3. 利益を計算
4. 顧客KPI（継続率、次回予約率）を計算
5. 広告KPI（CPA、LTV、ROI）を計算
6. スタッフパフォーマンスを計算
7. MetricsExtendedコレクションに保存

**スケジュール:**
```typescript
export const calculateDailyMetrics = onSchedule(
  {
    schedule: "0 2 * * *", // 毎日午前2時
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
  },
  async (context) => {
    // 処理内容
  }
);
```

#### 2.2.2 `calculateWeeklyMetrics`

毎週月曜午前3時に実行。

**処理内容:**
- 過去7日間のdailyメトリクスを集計してweeklyメトリクスを生成

#### 2.2.3 `calculateMonthlyMetrics`

毎月1日午前4時に実行。

**処理内容:**
- 前月のdailyメトリクスを集計してmonthlyメトリクスを生成
- 月次KPIアラートを生成（目標未達の場合）

#### 2.2.4 `updateCustomerLTV`

毎日午前3時に実行。

**処理内容:**
1. 各顧客の累計売上を計算
2. LTVを更新（customers.ltv）
3. 広告媒体別の平均LTVを計算
4. ads.ltvを更新

#### 2.2.5 `generateKPIAlerts`

毎日午前5時に実行。

**処理内容:**
1. 前日のメトリクスと目標値を比較
2. 目標未達のKPIがあれば、insightsコレクションにアラートを生成

**アラート例:**
```typescript
{
  type: 'alert',
  title: '継続率が目標を下回っています',
  description: '継続率: 78%（目標: 85%）',
  actionable: 'LINEフォロー・特典付与を実施してください',
  priority: 8
}
```

---

## 3. UI/画面設計

### 3.1 画面一覧

#### 3.1.1 売上管理画面

**パス:** `/dashboard/sales`

**主要機能:**
- 売上一覧表示（日付、顧客名、メニュー、金額、支払い方法、担当スタッフ）
- 売上入力フォーム
- 売上編集・削除
- フィルタ（日付範囲、顧客、スタッフ、支払い方法）
- CSV出力

**レイアウト:**
```
+--------------------------------------------------+
| [売上管理]                      [+ 売上を追加]    |
+--------------------------------------------------+
| フィルタ: [日付範囲] [顧客] [スタッフ] [支払方法]  |
+--------------------------------------------------+
| 日付     | 顧客名  | メニュー | 金額 | 支払 | スタッフ | 操作 |
|----------|---------|----------|------|------|----------|------|
| 2025-01-15| 山田太郎 | 全身脱毛 |150,000| カード | 佐藤 | [編集][削除] |
| 2025-01-15| 田中花子 | VIO脱毛 | 80,000| 現金   | 鈴木 | [編集][削除] |
+--------------------------------------------------+
| 合計: 230,000円  件数: 2件                       |
+--------------------------------------------------+
```

#### 3.1.2 経費管理画面

**パス:** `/dashboard/expenses`

**主要機能:**
- 月次経費入力フォーム（家賃、人件費、広告費、材料費、光熱費、雑費、システム費）
- 経費推移グラフ（月別）
- 経費比率分析（売上対比）
- 適正範囲との比較

**レイアウト:**
```
+--------------------------------------------------+
| [経費管理]                      [月: 2025-01 ▼] |
+--------------------------------------------------+
| 経費項目       | 金額        | 売上比率 | 適正範囲 | 判定 |
|----------------|-------------|----------|----------|------|
| 家賃           | 80,000      | 8%       | 5-10%    | ✓OK  |
| 人件費         | 300,000     | 30%      | 20-30%   | ✓OK  |
| 広告費         | 150,000     | 15%      | 10-20%   | ✓OK  |
| 材料費         | 50,000      | 5%       | 3-8%     | ✓OK  |
| 光熱費         | 30,000      | 3%       | 2-5%     | ✓OK  |
| 雑費           | 20,000      | 2%       | 1-3%     | ✓OK  |
| システム費     | 10,000      | 1%       | 1-2%     | ✓OK  |
|----------------|-------------|----------|----------|------|
| 合計           | 640,000     | 64%      | -        | ⚠高  |
+--------------------------------------------------+
| [保存]                                           |
+--------------------------------------------------+
| 📊 経費推移グラフ                                |
|   [折れ線グラフ: 過去6ヶ月の経費推移]            |
+--------------------------------------------------+
```

#### 3.1.3 広告管理画面

**パス:** `/dashboard/ads`

**主要機能:**
- 広告媒体別実績入力（月、媒体、広告費、新規予約数、成約数）
- CPA/LTV/ROI自動計算
- 媒体別ランキング（ROI、CPA、成約率）
- 推奨アクション表示

**レイアウト:**
```
+--------------------------------------------------+
| [広告管理]                      [月: 2025-01 ▼] |
+--------------------------------------------------+
| [+ 広告媒体を追加]                               |
+--------------------------------------------------+
| 媒体           | 広告費 | 予約 | 成約 | CPA   | ROI  | 操作 |
|----------------|--------|------|------|-------|------|------|
| Instagram      | 50,000 | 20   | 10   | 5,000 | 300% | [編集] |
| ホットペッパー | 80,000 | 30   | 15   | 5,333 | 280% | [編集] |
| Google広告     | 20,000 | 5    | 2    | 10,000| 150% | [編集] |
+--------------------------------------------------+
| 📊 ROIランキング              📊 CPAランキング   |
| 1. Instagram (300%)          1. Instagram (5,000)|
| 2. ホットペッパー (280%)      2. ホットペッパー  |
+--------------------------------------------------+
| 💡 推奨アクション                                |
| • ROI 300%超のInstagramは予算を2倍に増額         |
| • Google広告はCPA高いため、LP改善を検討          |
+--------------------------------------------------+
```

#### 3.1.4 ダッシュボード（KPI）

**パス:** `/dashboard` （既存のダッシュボードを拡張）

**追加セクション:**

**A. 売上・利益サマリ（上部）**
```
+---------------------------+---------------------------+
| 月間売上                  | 営業利益                  |
| ¥1,000,000 (+5% vs先月)   | ¥200,000 (利益率: 20%)   |
+---------------------------+---------------------------+
| 平均客単価                | 新規来店数                |
| ¥150,000                  | 25名 (目標達成: ✓)       |
+---------------------------+---------------------------+
```

**B. 重要KPIカード（中央）**
```
+--------------------------------------------------+
| 継続率      | 次回予約率   | CPA       | 利益率    |
| 88% ✓      | 82% ✓       | ¥14,500 ✓ | 20% ✓    |
| (目標: 85%)| (目標: 80%) | (目標: ≤15k) | (目標: ≥20%) |
+--------------------------------------------------+
```

**C. グラフセクション（下部）**
- 売上・経費・利益の推移（折れ線グラフ、過去6ヶ月）
- 経費内訳（積み上げ棒グラフ）
- 新規vs既存売上比率（円グラフ）

#### 3.1.5 売上分析画面

**パス:** `/dashboard/sales-analysis`

**主要機能:**
- コース別売上分析（件数、売上、構成比、平均単価）
- 新規vs既存分析
- 支払い方法別分析
- 期間比較（前月比、前年同月比）

**レイアウト:**
```
+--------------------------------------------------+
| [売上分析]                  [期間: 2025-01 ▼]   |
+--------------------------------------------------+
| 📊 コース別売上                                  |
| コース名       | 件数 | 売上      | 構成比 | 平均単価 |
|----------------|------|-----------|--------|----------|
| 全身脱毛コース | 15   | 2,250,000 | 45%    | 150,000  |
| VIO脱毛        | 20   | 1,600,000 | 32%    | 80,000   |
| 顔脱毛コース   | 10   | 800,000   | 16%    | 80,000   |
| その他         | 5    | 350,000   | 7%     | 70,000   |
+--------------------------------------------------+
| 📊 新規 vs 既存                                  |
| 新規: 30% (1,500,000円)                         |
| 既存: 70% (3,500,000円)                         |
+--------------------------------------------------+
| 💡 分析コメント                                  |
| • 新規比率30%未満 → 広告予算増額が必要           |
| • 全身脱毛が好調、VIOも安定                      |
+--------------------------------------------------+
```

#### 3.1.6 顧客分析画面

**パス:** `/dashboard/customer-analysis`

**主要機能:**
- 解約理由TOP5
- ステータス別顧客数（初回、中間、完了）
- 継続率・解約率・次回予約率
- コース別顧客数

**レイアウト:**
```
+--------------------------------------------------+
| [顧客分析]                                       |
+--------------------------------------------------+
| 📊 解約理由 TOP5                                 |
| 1. 価格が高い (40%) - ★最優先                    |
| 2. 効果が薄い (30%) - ★最優先                    |
| 3. 接客不満 (20%) - ◎重要                        |
| 4. 立地が悪い (5%) - ○対応                       |
| 5. 時間がない (5%) - ○対応                       |
+--------------------------------------------------+
| 📊 ステータス別顧客数                            |
| 初回: 30% (60名) - 平均通過回数: 2回             |
| 中間: 50% (100名) - 平均通過回数: 8回            |
| 完了: 20% (40名) - 平均通過回数: 15回            |
+--------------------------------------------------+
| 📊 継続率・解約率                                |
| 継続率: 88% ✓ (目標: 85%)                       |
| 解約率: 12%                                      |
| 次回予約率: 82% ✓ (目標: 80%)                   |
+--------------------------------------------------+
| 💡 改善アクション                                |
| • 解約理由「価格」が多い → 分割払い導入検討      |
| • 継続率は目標達成、継続してフォロー強化         |
+--------------------------------------------------+
```

#### 3.1.7 スタッフパフォーマンス画面

**パス:** `/dashboard/staff-performance`

**主要機能:**
- スタッフ別売上ランキング
- 平均単価ランキング
- 指名率・リピート率
- パフォーマンスマトリクス
- 改善アクション提案

**レイアウト:**
```
+--------------------------------------------------+
| [スタッフパフォーマンス]                         |
+--------------------------------------------------+
| スタッフ名 | 売上     | 件数 | 単価   | 指名率 | リピート率 | 評価 |
|------------|----------|------|--------|--------|------------|------|
| 佐藤花子   | 1,200,000| 30   | 40,000 | 70%    | 85%        | ★優秀 |
| 鈴木太郎   | 1,000,000| 28   | 35,714 | 50%    | 75%        | ○標準 |
| 田中美咲   | 800,000  | 25   | 32,000 | 40%    | 70%        | △要改善 |
+--------------------------------------------------+
| 📊 売上ランキング TOP3                           |
| 1. 佐藤花子 - 目標達成率: 120%                   |
| 2. 鈴木太郎 - 目標達成率: 100%                   |
| 3. 田中美咲 - 目標達成率: 80%                    |
+--------------------------------------------------+
| 💡 改善アクション                                |
| • 田中美咲：指名率40%未満 → 接客スキル研修実施   |
| • 鈴木太郎：リピート率75% → アフターフォロー強化 |
+--------------------------------------------------+
```

#### 3.1.8 PDCA管理画面（改善アクション）

**パス:** `/dashboard/actions`

**主要機能:**
- 改善アクション一覧（カテゴリ別、ステータス別）
- アクション追加・編集・削除
- 進捗管理（ステータス更新）
- 効果測定記録

**レイアウト:**
```
+--------------------------------------------------+
| [PDCA管理]                      [+ アクション追加]|
+--------------------------------------------------+
| フィルタ: [すべて▼] [進行中▼] [優先度: 高▼]     |
+--------------------------------------------------+
| タイトル               | カテゴリ | ステータス | 期限    | 担当 | 優先度 |
|------------------------|----------|------------|---------|------|--------|
| Instagram広告予算増額  | 売上     | 進行中     | 1/31    | 佐藤 | ★★★   |
| 接客研修実施           | スタッフ | 未着手     | 2/15    | 鈴木 | ★★     |
| 分割払い導入           | 顧客     | 完了       | 1/20    | 田中 | ★★★   |
+--------------------------------------------------+
| [アクション詳細: Instagram広告予算増額]           |
| 課題: 新規来店数が目標に届いていない              |
| 対策: ROI 300%のInstagram広告の予算を2倍に増額   |
| 期限: 2025-01-31                                 |
| 担当: 佐藤花子                                    |
| 優先度: ★★★ 高                                  |
|                                                  |
| 効果測定:                                        |
| 測定日: 2025-02-05                               |
| 効果: 新規来店数が20名→30名に増加（+50%）        |
| 効果金額: +1,500,000円                           |
|                                                  |
| [ステータスを更新] [編集] [削除]                 |
+--------------------------------------------------+
```

#### 3.1.9 利益分析画面

**パス:** `/dashboard/profit-analysis`

**主要機能:**
- 月次利益推移（売上・経費・利益のグラフ）
- 利益率推移
- 経費比率分析
- 削減余地の可視化

**レイアウト:**
```
+--------------------------------------------------+
| [利益分析]                  [期間: 過去6ヶ月 ▼] |
+--------------------------------------------------+
| 📊 売上・経費・利益の推移                        |
| [折れ線グラフ]                                   |
| - 売上（青）                                     |
| - 経費（赤）                                     |
| - 営業利益（緑）                                 |
+--------------------------------------------------+
| 月       | 売上      | 経費    | 利益    | 利益率 |
|----------|-----------|---------|---------|--------|
| 2025-01  | 1,000,000 | 640,000 | 360,000 | 36%    |
| 2024-12  | 950,000   | 620,000 | 330,000 | 35%    |
| ...      |           |         |         |        |
+--------------------------------------------------+
| 📊 経費比率分析（2025-01）                       |
| 経費項目   | 実績比率 | 適正範囲 | 判定 | 削減余地 |
|------------|----------|----------|------|----------|
| 家賃       | 8%       | 5-10%    | ✓OK  | 0円      |
| 人件費     | 30%      | 20-30%   | ✓OK  | 0円      |
| 広告費     | 15%      | 10-20%   | ✓OK  | 0円      |
| 材料費     | 5%       | 3-8%     | ✓OK  | 0円      |
| 光熱費     | 3%       | 2-5%     | ✓OK  | 0円      |
| 雑費       | 2%       | 1-3%     | ✓OK  | 0円      |
| システム費 | 1%       | 1-2%     | ✓OK  | 0円      |
|------------|----------|----------|------|----------|
| 合計       | 64%      | -        | ⚠高  | 40,000円 |
+--------------------------------------------------+
| 💡 コスト削減アクション                          |
| • 総経費率64% → 60%以下が理想                    |
| • 削減余地合計: 40,000円/月                      |
+--------------------------------------------------+
```

### 3.2 コンポーネント設計

#### 3.2.1 共通コンポーネント

**`KPICard`**
```typescript
interface KPICardProps {
  title: string;
  value: number | string;
  target?: number | string;
  format?: 'currency' | 'percent' | 'number';
  trend?: 'up' | 'down' | 'neutral';
  status?: 'success' | 'warning' | 'danger';
}
```

**`SalesTable`**
```typescript
interface SalesTableProps {
  sales: Sale[];
  onEdit: (saleId: string) => void;
  onDelete: (saleId: string) => void;
}
```

**`ChartWidget`**
```typescript
interface ChartWidgetProps {
  type: 'line' | 'bar' | 'pie' | 'area';
  data: any[];
  title: string;
  xKey: string;
  yKey: string | string[];
}
```

**`ActionItemCard`**
```typescript
interface ActionItemCardProps {
  actionItem: ActionItem;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}
```

#### 3.2.2 フォームコンポーネント

**`SaleForm`**
- 売上入力フォーム
- バリデーション（必須項目、金額の範囲チェック）
- 顧客・スタッフの検索機能

**`ExpenseForm`**
- 月次経費入力フォーム
- 各経費項目の入力
- 自動合計計算

**`AdForm`**
- 広告媒体入力フォーム
- CPA/LTV/ROI自動計算表示

**`ActionItemForm`**
- 改善アクション入力フォーム
- カテゴリ選択
- 担当者アサイン

### 3.3 状態管理（Zustand）

#### 3.3.1 `useSalesStore`

```typescript
interface SalesState {
  sales: Sale[];
  loading: boolean;
  error: string | null;

  fetchSales: (params: GetSalesRequest) => Promise<void>;
  createSale: (data: CreateSaleRequest) => Promise<void>;
  updateSale: (data: UpdateSaleRequest) => Promise<void>;
  deleteSale: (saleId: string) => Promise<void>;
}
```

#### 3.3.2 `useExpensesStore`

```typescript
interface ExpensesState {
  expenses: Record<string, Expense>; // key: month (YYYY-MM)
  loading: boolean;
  error: string | null;

  fetchExpense: (month: string) => Promise<void>;
  upsertExpense: (data: UpsertExpenseRequest) => Promise<void>;
}
```

#### 3.3.3 `useAdsStore`

同様の構造で広告データを管理。

#### 3.3.4 `useMetricsStore`

```typescript
interface MetricsState {
  metrics: MetricsExtended[];
  dashboard: DashboardData | null;
  loading: boolean;
  error: string | null;

  fetchMetrics: (params: { period: string; startDate: string; endDate: string }) => Promise<void>;
  fetchDashboard: (params: GetDashboardRequest) => Promise<void>;
}
```

---

## 4. 実装フェーズ計画

### フェーズ1: 基本データ構造とCRUD（Week 1-2）

**目標:** データモデルとCRUD APIを実装し、基本的な売上・経費管理ができる状態にする。

**タスク:**
1. Firestoreコレクション作成
   - `sales`, `expenses`, `ads`, `action_items`, `kpi_targets` コレクション追加
   - 既存コレクション（customers, appointments, users）の拡張
2. Type定義追加（`types/sales.ts`, `types/expenses.ts`, etc.）
3. Firebase Functions実装
   - `createSale`, `updateSale`, `deleteSale`, `getSales`
   - `upsertExpense`, `getExpense`
   - `createAd`, `updateAd`, `deleteAd`, `getAds`
   - `createActionItem`, `updateActionItem`, `deleteActionItem`, `getActionItems`
   - `updateKPITargets`, `getKPITargets`
4. Security Rules更新
   - 新規コレクションのアクセス制御を追加
5. 基本UI実装
   - 売上管理画面（一覧・入力フォーム）
   - 経費管理画面（入力フォーム）
   - 広告管理画面（一覧・入力フォーム）

**成果物:**
- 売上・経費・広告データの手動入力が可能
- データの一覧表示・編集・削除が可能

### フェーズ2: メトリクス計算とダッシュボード（Week 3-4）

**目標:** 夜間バッチで自動集計し、ダッシュボードでKPIを可視化する。

**タスク:**
1. Metricsコレクションの拡張
   - `MetricsExtended` インターフェース実装
   - マイグレーションスクリプト作成
2. 夜間バッチ実装
   - `calculateDailyMetrics` Function
   - `calculateWeeklyMetrics` Function
   - `calculateMonthlyMetrics` Function
   - `updateCustomerLTV` Function
   - `generateKPIAlerts` Function
3. ダッシュボードAPI実装
   - `getDashboard`
   - `getSalesAnalysis`
   - `getCustomerAnalysis`
   - `getProfitAnalysis`
4. ダッシュボードUI拡張
   - KPIカード追加（継続率、次回予約率、CPA、利益率）
   - 売上・経費・利益の推移グラフ
   - 経費内訳グラフ
   - 新規vs既存売上比率グラフ
5. テスト
   - 単体テスト（Functions）
   - E2Eテスト（UI）

**成果物:**
- 毎日自動でメトリクスが更新される
- ダッシュボードで主要KPIが一目で確認できる
- グラフで推移が視覚的に把握できる

### フェーズ3: 分析画面とレポート機能（Week 5-6）

**目標:** 詳細な分析画面を実装し、経営判断に必要な情報を提供する。

**タスク:**
1. 売上分析画面実装
   - コース別売上分析
   - 新規vs既存分析
   - 支払い方法別分析
   - 期間比較機能
2. 顧客分析画面実装
   - 解約理由TOP5
   - ステータス別顧客数
   - 継続率・解約率
   - コース別顧客数
3. 利益分析画面実装
   - 月次利益推移
   - 経費比率分析
   - 削減余地の可視化
4. スタッフパフォーマンス画面実装
   - 売上ランキング
   - 平均単価ランキング
   - パフォーマンスマトリクス
   - 改善アクション提案
5. CSV出力機能
   - 売上データのエクスポート
   - 経費データのエクスポート
   - レポート生成

**成果物:**
- 詳細な分析レポートが確認できる
- 改善すべきポイントが明確になる
- データをCSVで出力できる

### フェーズ4: PDCA管理と高度な機能（Week 7-8）

**目標:** 改善アクション管理とAI連携を実装し、継続的な改善サイクルを回せるようにする。

**タスク:**
1. PDCA管理画面実装
   - 改善アクション一覧
   - アクション追加・編集・削除
   - 進捗管理（ステータス更新）
   - 効果測定記録
2. KPI目標管理画面実装
   - 目標値設定フォーム
   - 目標達成状況の可視化
3. AI連携
   - 既存のAI insightに売上管理KPIを統合
   - 自動アラート生成（目標未達時）
   - 改善アクション提案（AI生成）
4. 通知機能
   - KPIアラートのメール通知
   - 期限切れアクションのリマインダー
5. モバイル対応
   - スマホ版UI最適化
   - 簡易ダッシュボード
6. パフォーマンス最適化
   - インデックスの最適化
   - キャッシュ戦略
   - 遅延ロード

**成果物:**
- PDCA管理が完全に機能する
- AI提案が売上管理に統合される
- スマホからも主要機能が利用できる

---

## 5. マイグレーション計画

### 5.1 既存データの移行

既存のCorevoユーザーがいる場合、以下のマイグレーションを実行：

1. **Appointmentsの拡張**
   - 既存の予約データに `customerType`, `paymentMethod`, `actualAmount` を追加
   - デフォルト値を設定（customerType: 'existing', paymentMethod: 'cash'）

2. **Customersの拡張**
   - 既存の顧客データに `isContinuing: true`, `visitCount: 0` を追加
   - バッチで累計売上・来店回数を計算して更新

3. **Salesデータの生成**
   - 過去の完了済み予約（status: 'completed'）から売上データを生成
   - appointmentIdを紐づける

### 5.2 マイグレーションスクリプト

```typescript
// infra/scripts/migrate-sales-management.ts

async function migrateToSalesManagement(tenantId: string) {
  // 1. Customers拡張
  await migrateCustomers(tenantId);

  // 2. Appointments拡張
  await migrateAppointments(tenantId);

  // 3. Sales生成
  await generateSalesFromAppointments(tenantId);

  // 4. KPI Targets初期化
  await initializeKPITargets(tenantId);

  // 5. Metrics再計算
  await recalculateMetrics(tenantId);
}
```

---

## 6. セキュリティ考慮事項

### 6.1 アクセス制御

1. **Firestore Security Rules**
   - すべての売上・経費データは `tenantId` で分離
   - `owner` ロールのみが経費・広告データを編集可能
   - `staff` ロールは自分の売上データのみ参照可能

2. **Functions認証**
   - すべてのCallable FunctionsでtenantIdの検証を実施
   - ロールベースのアクセス制御（RBAC）

### 6.2 データ保護

1. **機密情報の取り扱い**
   - 経費・利益情報はownerとmanagerのみアクセス可能
   - スタッフは自分のパフォーマンスデータのみ閲覧可能

2. **監査ログ**
   - 経費・広告データの変更は監査ログに記録
   - 重要な設定変更（KPI目標値など）も記録

---

## 7. テスト計画

### 7.1 単体テスト

- Firebase Functions（Jest）
  - CRUD API
  - メトリクス計算ロジック
  - KPI計算ロジック

### 7.2 統合テスト

- API連携テスト
- バッチ処理のEnd-to-Endテスト

### 7.3 E2Eテスト

- 画面操作フロー（Playwright）
  - 売上入力 → ダッシュボード更新確認
  - 経費入力 → 利益分析確認

---

## 8. 運用計画

### 8.1 モニタリング

- Firebase Console
  - Functions実行ログ
  - エラー率監視
- バッチ処理の成功/失敗通知

### 8.2 バックアップ

- Firestore自動バックアップ（日次）
- 重要データのエクスポート（週次）

---

## 9. 今後の拡張計画

1. **予算管理機能**
   - 月次予算設定
   - 予実管理

2. **予測機能の強化**
   - 売上予測にAI予測を統合
   - 経費予測

3. **外部連携**
   - 会計ソフト連携（freee、MFクラウドなど）
   - POSシステム連携

4. **レポート機能の拡充**
   - PDFレポート生成
   - 週次・月次レポートの自動メール配信

---

以上が売上管理機能の詳細設計書です。
