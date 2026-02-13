# 03_domain.md - ドメイン定義

## ドメイン概要

Corevoは**美容サロン（特に脱毛サロン）の経営支援**を行うSaaSプラットフォームです。

### 対象業種

- 脱毛サロン（メイン）
- エステサロン
- 美容サロン全般

### ビジネスモデル

```
サロン経営者 → Corevo（SaaS） → データ分析・AI提案 → 経営改善
     ↓                                                      ↓
  顧客管理・予約管理                               継続率向上・売上向上
```

## コアドメイン概念

### 0. Platform Admin（プラットフォーム管理者）

**定義**: Corevo SaaSを運営する管理者（販売者）

```typescript
interface User {
  isPlatformAdmin: boolean; // trueの場合、Platform Admin
  // Platform Adminの場合、organizationIdはnull/undefined
}
```

**ビジネスルール**:
- 全Organization（クライアント企業）を管理可能
- 料金プラン変更、ステータス変更が可能
- 全Organizationの統計情報を閲覧可能
- 初期は特定メールアドレスで判定（暫定）→ 将来的にFirestoreフラグに移行

**アクセス範囲**:
- `/platform-admin` 専用ルート
- 全Organizationの読み取り・更新
- システム全体設定

### 1. Organization（組織）

**定義**: サロンを運営する企業・グループ

```typescript
interface Organization {
  id: string;
  name: string; // 組織名（例: "美容室グループABC"）
  plan: "trial" | "basic" | "pro" | "enterprise";
  status: "active" | "suspended" | "canceled";
  ownerId: string;
}
```

**ビジネスルール**:
- 1 Organization は複数の Tenant（店舗）を持てる
- Ownerのみがプラン変更可能
- 課金は Organization 単位

### 2. Tenant（店舗）

**定義**: 実際のサロン店舗

```typescript
interface Tenant {
  id: string;
  organizationId: string;
  name: string; // 店舗名（例: "ABC東京店"）
  slug: string; // URL識別子（例: "abc-tokyo"）
  status: "active" | "inactive";
}
```

**ビジネスルール**:
- 1 Tenant のデータは完全分離（tenantId必須）
- スタッフは複数 Tenant にアクセス可能
- メトリクスは Tenant 単位で集計

### 3. User（スタッフ）

**定義**: サロンで働くスタッフ（ログイン可能）

```typescript
interface User {
  id: string;
  organizationId: string;
  tenantIds: string[]; // アクセス可能な店舗
  email: string;
  displayName: string;
  roles: Record<string, UserRole>; // { "tenant_tokyo": "manager" }
}

type UserRole = "owner" | "manager" | "staff" | "accountant";
```

**ロール定義**:
- **owner**: 全権限（プラン変更、経費管理、削除）
- **manager**: 経営管理（KPI閲覧、設定変更、スタッフ管理）
- **staff**: 現場作業（予約管理、カルテ入力）
- **accountant**: 経理（売上・経費閲覧のみ）

### 4. Customer（顧客）

**定義**: サロンに来店する顧客

```typescript
interface Customer {
  id: string;
  tenantId: string;
  name: string;
  kana: string; // フリガナ検索用
  email?: string;
  phone?: string;
  lastVisit?: Date;
  visitInterval?: number; // 来店間隔（日数）
  lineUserId?: string; // LINE連携
}
```

**ビジネスルール**:
- 同意（consent）なしにマーケティング送信不可
- lastVisit は appointment完了時に自動更新
- visitInterval は NBA（次回来店提案）に使用

### 5. Appointment（予約）

**定義**: 顧客の来店予約

```typescript
interface Appointment {
  id: string;
  tenantId: string;
  customerId: string;
  staffId: string; // 施術担当者（StaffMember）
  serviceIds: string[]; // 複数サービス選択可能
  startAt: Date;
  endAt: Date;
  status: "scheduled" | "confirmed" | "completed" | "canceled" | "noshow";
  pricing?: {
    subtotal: number;
    discount: number;
    total: number;
    eligibleCount: number; // セット割引対象数
  };
}
```

**ライフサイクル**:
```
予約作成 (scheduled)
  ↓
確認 (confirmed)
  ↓
来店・施術 (completed)
  ↓
カルテ作成 (Chart)
```

**ビジネスルール**:
- status が completed になると売上データ生成
- noshow（無断キャンセル）は継続率計算に影響
- Google Calendar に同期可能

### 6. Service（メニュー）

**定義**: サロンが提供する施術メニュー

```typescript
interface Service {
  id: string;
  tenantId: string;
  name: string;
  price: number;
  durationMinutes: number;
  marginCoefficient: number; // 粗利係数（0.0〜1.0）
  promotionPriority: number; // 販促優先度（1〜10）
  category?: string; // カテゴリー（顔、手、足、VIOなど）
  setDiscountEligible: boolean; // セット割引対象
}
```

**ビジネスルール**:
- promotionPriority が高いメニューを AI が優先的に提案
- marginCoefficient で利益率計算
- setDiscountEligible なメニューのみセット割引適用

### 7. Chart（カルテ）

**定義**: 施術記録

```typescript
interface Chart {
  id: string;
  tenantId: string;
  customerId: string;
  appointmentId: string;
  staffId: string;
  photos: string[]; // Before/After写真
  notes: string; // 施術内容
  cautions?: string; // 注意事項
  effectPeriodDays?: number; // 効果持続期間
}
```

**ビジネスルール**:
- 写真は consent.photoUsage が true の顧客のみ
- effectPeriodDays は次回来店提案のタイミング計算に使用

## 重要KPI

### 1. 継続率（Continuation Rate）

**定義**: コース途中で解約しない顧客の割合

```
継続率 = 継続中顧客数 / 全顧客数
```

**目標**: 85%以上

**計算タイミング**: 日次バッチ（metricsJob）

### 2. 次回予約率（Next Reservation Rate）

**定義**: 来店時に次回予約を取得した顧客の割合

```
次回予約率 = 次回予約あり顧客数 / 来店顧客数
```

**目標**: 80%以上

**重要性**: 失客予防の最重要指標

### 3. LTV（Lifetime Value）

**定義**: 顧客1人あたりの生涯売上

```
LTV = 累計売上 / 顧客数
```

**用途**: CPA（顧客獲得単価）との比較でROI計算

### 4. CPA（Cost Per Acquisition）

**定義**: 顧客1人獲得にかかった広告費

```
CPA = 広告費 / 成約数
```

**目標**: 15,000円以下

### 5. ROI（Return On Investment）

**定義**: 広告投資の回収率

```
ROI = (LTV - CPA) / CPA × 100%
```

**目標**: 200%以上

### 6. 利益率（Profit Margin）

**定義**: 売上に対する営業利益の割合

```
利益率 = (売上 - 経費) / 売上 × 100%
```

**目標**: 20%以上

## ビジネスプロセス

### 顧客ライフサイクル

```
1. 認知（広告・口コミ）
   ↓
2. 初回予約（Web/LINE）
   ↓
3. 初回来店
   ↓
4. コース契約
   ↓
5. リピート来店
   ↓
6. 継続 or 解約
```

### スタッフの1日の流れ

```
09:00 出勤
  ↓
09:15 今日の予約確認（スマホ）
  ↓
10:00 顧客A 施術
  ↓
11:30 カルテ入力（スマホ）
  ↓
12:00 昼休憩
  ↓
13:00 顧客B 施術
  ↓
...
  ↓
18:00 退勤
```

### 経営者の週次PDCA

```
月曜:
- ダッシュボードで先週の売上確認
- KPI達成状況確認
- AIインサイト確認

火〜木:
- AI提案の承認・送信
- 広告効果確認

金曜:
- 改善アクション（PDCA）レビュー
- 来週の目標設定
```

## データの流れ

### 予約 → 売上データ生成

```
Appointment (completed)
  ↓
自動: Sales レコード生成
  ↓
夜間バッチ: Metrics 更新
  ↓
ダッシュボードに反映
```

### AI提案フロー

```
夜間バッチ（nbaJob）
  ↓
顧客分析（lastVisit, effectPeriodDays）
  ↓
AI提案生成 → ai_suggestions に保存
  ↓
人間が承認
  ↓
Messages に移動 → LINE/Email送信
  ↓
顧客が予約（コンバージョン）
```

## ドメイン用語集

| 用語 | 意味 |
|------|------|
| **NBA** | Next Best Action（次に取るべき最善の行動）- AI提案 |
| **失客** | 顧客が来店しなくなること |
| **継続率** | コース途中で解約しない顧客の割合 |
| **セット割** | 複数サービス同時購入時の割引 |
| **コース** | 複数回来店前提の契約プラン |
| **通過回数** | コースで何回目の来店か |
| **No-show** | 無断キャンセル |
| **指名** | 特定のスタッフを指定しての予約 |
| **リピート率** | 再来店する顧客の割合 |
| **前計算** | 夜間バッチで事前に集計すること |

## 外部システム連携

### LINE

**用途**: 顧客とのコミュニケーション

```
顧客 ←LINE→ Corevo ←Webhook→ LINE API
```

**機能**:
- 予約リマインダー
- 来店御礼メッセージ
- AI提案（承認済みのみ）

### Google Calendar

**用途**: スタッフのスケジュール管理

```
スタッフGoogleカレンダー ←同期→ Corevo ←同期→ Appointment
```

**機能**:
- 予約の自動同期
- シフト管理
- 空き時間表示

### Stripe

**用途**: サブスクリプション課金

```
Organization → Stripe Customer
Plan → Stripe Subscription
```

**プラン**:
- Trial: 無料（14日間）
- Basic: 月額 9,800円
- Pro: 月額 29,800円
- Enterprise: 個別見積もり

## 制約とビジネスルール

### データ保持期間

- **顧客データ**: 最終来店から3年間
- **予約データ**: 無期限
- **メトリクス**: 無期限
- **AI提案（未承認）**: 30日後自動削除

### 同意（Consent）

```typescript
consent: {
  marketing: boolean,  // マーケティング利用同意
  photoUsage: boolean  // 写真利用同意
}
```

- marketing = false の顧客にはAI提案送信不可
- photoUsage = false の顧客の写真は保存不可

### 料金計算

```typescript
// セット割引計算
if (eligibleCount >= 2) {
  discount = subtotal * 0.2; // 2つで20%OFF
}
if (eligibleCount >= 3) {
  discount = subtotal * 0.3; // 3つで30%OFF
}
```

---

**最終更新**: 2026-01-23
**次回見直し**: ビジネスルール変更時
