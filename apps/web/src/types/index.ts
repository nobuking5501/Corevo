// Core entity types for Corevo

export type UserRole = "owner" | "manager" | "staff" | "accountant";

// Organization (クライアント企業/組織)
export interface Organization {
  id: string;
  name: string; // 組織名（例: "美容室グループABC"）
  plan: "trial" | "basic" | "pro" | "enterprise";
  status: "active" | "suspended" | "canceled";
  ownerId: string; // オーナーユーザーID
  stripeCustomerId?: string;
  settings?: {
    branding?: {
      logo?: string;
      primaryColor?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

// Tenant (店舗) - 1つの Organization に複数の Tenant が所属
export interface Tenant {
  id: string;
  organizationId: string; // 所属組織ID
  name: string; // 店舗名（例: "ABC東京店"）
  slug: string; // URL識別子（例: "abc-tokyo"）
  storeCode?: string; // 店舗コード（例: "TKY001"）
  address?: string;
  phone?: string;
  email?: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

// User (スタッフ) - 複数の Tenant に所属可能
export interface User {
  id: string;
  isPlatformAdmin?: boolean; // Platform Admin (SaaS運営者) フラグ
  organizationId?: string; // 所属組織ID (Platform Adminの場合はnull/undefined)
  tenantIds: string[]; // アクセス可能な店舗ID配列
  email: string;
  displayName: string;
  roles: Record<string, UserRole>; // { "tenant_tokyo": "manager", "tenant_osaka": "staff" }
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Custom Claims の型定義
export interface CustomClaims {
  isPlatformAdmin?: boolean; // Platform Admin フラグ
  organizationId?: string; // Platform Adminの場合はundefined
  tenantIds: string[];
  roles: Record<string, UserRole>;
}

// Platform Admin用の全体統計
export interface PlatformAdminStats {
  totalOrganizations: number;
  totalTenants: number;
  totalCustomers: number;
  totalRevenue: number;
  activeOrganizations: number;
  trialOrganizations: number;
  suspendedOrganizations: number;
}

// Organization詳細統計（Platform Admin用）
export interface OrganizationStats {
  organizationId: string;
  tenantCount: number;
  totalCustomers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  appointmentCount: number;
  lastActivityAt?: Date;
}

// Industry-specific profile data
export type SalonIndustryType = "beauty" | "esthetic" | "nail" | "general";

export interface CustomerSalonProfile {
  // Common fields for all salon types
  allergies?: string; // アレルギー情報

  // Beauty salon specific (美容室)
  hairType?: "straight" | "wavy" | "curly" | "coarse" | "fine"; // 髪質
  hairConcerns?: string[]; // 髪の悩み（ダメージ、薄毛、etc.）
  scalpType?: "normal" | "dry" | "oily" | "sensitive"; // 頭皮タイプ

  // Esthetic salon specific (エステサロン)
  skinType?: "normal" | "dry" | "oily" | "combination" | "sensitive"; // 肌質
  skinConcerns?: string[]; // 肌の悩み（シミ、シワ、ニキビ、etc.）

  // Nail salon specific (ネイルサロン)
  nailLength?: "short" | "medium" | "long"; // 爪の長さ
  nailShape?: "square" | "round" | "oval" | "almond" | "stiletto"; // 爪の形
  nailConcerns?: string[]; // 爪の悩み（割れやすい、薄い、etc.）

  // General notes
  specialNotes?: string; // 特記事項
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  kana: string;
  email?: string;
  phone?: string;

  // Basic information
  birthday?: Date; // 生年月日
  gender?: "male" | "female" | "other" | "prefer-not-to-say"; // 性別
  address?: {
    zipCode?: string; // 郵便番号
    prefecture?: string; // 都道府県
    city?: string; // 市区町村
    street?: string; // 番地・建物名
  };

  // Preferences
  preferredStaffId?: string; // 希望スタッフID
  visitInterval?: number; // days
  preferences: string[];
  tags: string[];
  lastVisit?: Date;

  // Consent
  consent: {
    marketing: boolean;
    photoUsage: boolean;
  };

  // Industry-specific profile (editable by salon type)
  salonProfile?: CustomerSalonProfile;

  // 障害者情報
  disability?: {
    hasDisability: boolean;
    disabilityType?: string; // 障害の種類
    specialAccommodations?: string; // 特別な配慮事項
    emergencyContact?: {
      name: string;
      phone: string;
      relationship: string;
    };
  };

  // LINE連携情報
  lineUserId?: string; // LINE User ID
  lineDisplayName?: string; // LINE表示名
  linePictureUrl?: string; // LINEプロフィール画像URL
  lineLinkedAt?: Date; // LINE連携日時
  lineConsent?: boolean; // LINE配信同意

  createdAt: Date;
  updatedAt: Date;
}

// StaffMember (施術担当者) - アプリにログインしない施術スタッフ
export interface StaffMember {
  id: string;
  tenantId: string;
  name: string;
  kana: string;
  color: string; // カレンダー表示用の色 (例: "#FF6B6B")
  phone?: string;
  email?: string;
  active: boolean;
  services: string[]; // 対応可能なサービスIDの配列
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Shift (シフト・勤務予定)
export interface Shift {
  id: string;
  tenantId: string;
  staffMemberId: string;
  date: string; // YYYY-MM-DD形式
  startTime: string; // HH:mm形式 (例: "09:00")
  endTime: string; // HH:mm形式 (例: "18:00")
  breakTimes: Array<{
    start: string; // HH:mm形式
    end: string; // HH:mm形式
  }>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  tenantId: string;
  customerId: string;
  staffId?: string; // 施術担当者のID（StaffMemberのID）
  serviceIds: string[]; // 複数サービスに対応
  startAt: Date;
  endAt: Date;
  status: "scheduled" | "confirmed" | "completed" | "canceled" | "noshow";
  notes?: string;
  pricing?: {
    subtotal: number;
    discount: number;
    total: number;
    eligibleCount: number;
  };
  // Google Calendar同期用フィールド
  googleEventId?: string; // スタッフのGoogleカレンダーのイベントID
  syncedToGoogle?: boolean; // スタッフのGoogleカレンダーに同期済みか
  storeGoogleEventId?: string; // お店用GoogleカレンダーのイベントID
  syncedToStoreCalendar?: boolean; // お店用Googleカレンダーに同期済みか
  lastSyncAt?: Date; // 最終同期日時
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  price: number;
  durationMinutes: number;
  marginCoefficient: number; // 粗利係数
  promotionPriority: number;
  tags: string[];
  description?: string;
  active: boolean;
  category?: string; // カテゴリー（顔、手、足、VIOなど）
  setDiscountEligible: boolean; // セット割引対象
  sortOrder: number; // 表示順序
  createdAt: Date;
  updatedAt: Date;
}

// セット割引ルール
export interface DiscountRule {
  quantity: number; // 選択数
  discountRate: number; // 割引率（0.2 = 20%OFF）
}

// セット割引設定
export interface SetDiscountConfig {
  enabled: boolean;
  rules: DiscountRule[]; // 例: [{quantity: 2, discountRate: 0.2}, {quantity: 3, discountRate: 0.3}]
}

export interface Chart {
  id: string;
  tenantId: string;
  customerId: string;
  appointmentId: string;
  staffId: string;
  photos: string[];
  tags: string[];
  notes: string;
  cautions?: string;
  effectPeriodDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  tenantId: string;
  customerId: string;
  channel: "email" | "line" | "sms";
  purpose: "reminder" | "followup" | "promotion" | "nba";
  subject?: string;
  body: string;
  sentAt?: Date;
  readAt?: Date;
  convertedToAppointmentAt?: Date;
  createdAt: Date;
}

export interface AISuggestion {
  id: string;
  tenantId: string;
  customerId: string;
  messageBody: string;
  reason: string;
  scheduledAt: Date;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  priority: number;
  createdAt: Date;
}

export interface Metrics {
  id: string;
  tenantId: string;
  period: "daily" | "weekly" | "monthly";
  date: string; // ISO date
  revenue: number;
  appointmentCount: number;
  customerCount: number;
  noshowRate: number;
  byStaff: Record<string, { revenue: number; count: number }>;
  byService: Record<string, { revenue: number; count: number }>;
  createdAt: Date;
}

export interface Forecast {
  id: string;
  tenantId: string;
  targetMonth: string; // YYYY-MM
  predictedRevenue: number;
  confidenceLower: number;
  confidenceUpper: number;
  methodology: string;
  createdAt: Date;
}

export interface Insight {
  id: string;
  tenantId: string;
  type: "alert" | "opportunity" | "shortage";
  title: string;
  description: string;
  actionable: string;
  priority: number;
  createdAt: Date;
}

export interface Settings {
  id: string;
  tenantId: string;
  salonIndustryType?: SalonIndustryType; // 業種タイプ（美容室、エステ、ネイル、一般）
  businessHours: {
    [day: string]: { open: string; close: string } | null;
  };
  featureFlags: {
    aiAutoSuggest: boolean;
    lineIntegration: boolean;
    advancedAnalytics: boolean;
    googleCalendarIntegration?: boolean; // Googleカレンダー連携機能
  };
  billingStatus: {
    plan: string;
    periodEnd: Date;
  };
  setDiscountConfig?: SetDiscountConfig; // セット割引設定
  googleCalendar?: {
    clientId: string;
    clientSecret: string;
    syncInterval: number; // 同期間隔（分）
  };
  updatedAt: Date;
}

// Google Calendar連携
export interface GoogleCalendarConnection {
  id: string;
  tenantId: string;
  staffMemberId: string; // スタッフID（お店用の場合は "store"）
  staffName: string; // スタッフ名（お店用の場合は "お店全体"）
  googleEmail: string;
  calendarId: string; // Google Calendar ID (通常はprimary)
  accessToken: string;
  refreshToken: string;
  expiryDate: number; // トークン有効期限（ミリ秒）
  isActive: boolean;
  isStoreCalendar?: boolean; // お店用カレンダーかどうか
  connectedAt: Date;
  lastSyncAt?: Date; // 最終予約同期日時
  lastShiftSyncAt?: Date; // 最終シフト同期日時（お店用カレンダーのみ）
  updatedAt: Date;
}

// スタッフのシフト/予定（Googleカレンダーから取得）
export interface StaffSchedule {
  id: string;
  tenantId: string;
  staffMemberId: string;
  type: "shift" | "break" | "blocked" | "appointment"; // シフト、休憩、ブロック（予約不可）、予約
  startTime: Date;
  endTime: Date;
  googleEventId?: string; // Google Calendar Event ID
  syncedFromGoogle: boolean;
  title?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Re-export sales management types
export * from "./sales";
