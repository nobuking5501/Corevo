// Sales Management Types for Corevo

export type CustomerType = "new" | "existing";
export type PaymentMethod = "cash" | "card" | "paypay" | "other";

export interface Sale {
  id: string;
  tenantId: string;
  appointmentId?: string;
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  date: string; // YYYY-MM-DD
  serviceName: string;
  coursePrice: number;
  quantity: number;
  amount: number;
  paymentMethod: PaymentMethod;
  staffId: string;
  staffName: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  tenantId: string;
  month: string; // YYYY-MM
  rent: number;
  labor: number;
  advertising: number;
  materials: number;
  utilities: number;
  miscellaneous: number;
  systems: number;
  total: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ad {
  id: string;
  tenantId: string;
  month: string; // YYYY-MM
  medium: string;
  adCost: number;
  newReservations: number;
  conversions: number;
  conversionRate?: number;
  cpa?: number;
  ltv?: number;
  roi?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ActionItemCategory = "sales" | "cost" | "customer" | "staff" | "other";
export type ActionItemStatus = "pending" | "in_progress" | "completed" | "canceled";

export interface ActionItem {
  id: string;
  tenantId: string;
  title: string;
  category: ActionItemCategory;
  problem: string;
  action: string;
  dueDate?: Date;
  status: ActionItemStatus;
  priority: number; // 1-10
  assignedTo?: string;
  measuredAt?: Date;
  effectDescription?: string;
  effectValue?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPITarget {
  id: string;
  tenantId: string;
  profitMarginTarget: number;
  continuationRateTarget: number;
  nextReservationRateTarget: number;
  newCustomersMonthlyTarget: number;
  cpaMaxTarget: number;
  adCostRatioMaxTarget: number;
  laborCostRatioMaxTarget: number;
  expenseRatioMaxTarget: number;
  monthlyRevenueTarget?: number;
  monthlyProfitTarget?: number;
  updatedAt: Date;
}

// Extended types for existing collections

export type CourseStatus = "initial" | "mid" | "completed";

export interface CustomerExtension {
  contractCourse?: string;
  courseProgress?: number;
  courseStatus?: CourseStatus;
  isContinuing: boolean;
  cancelReason?: string;
  preferredStaffId?: string;
  totalRevenue?: number;
  averageSpending?: number;
  visitCount?: number;
  lastPurchaseAmount?: number;
  ltv?: number;
}

export interface AppointmentExtension {
  customerType: CustomerType;
  paymentMethod?: PaymentMethod;
  actualAmount?: number;
  discount?: number;
  revenue?: number;
  hasNextAppointment?: boolean;
  nextAppointmentId?: string;
}

export interface UserPerformance {
  totalSales: number;
  appointmentCount: number;
  averagePrice: number;
  nominationRate: number;
  repeatRate: number;
  reviewCount: number;
}

export interface UserExtension {
  performance?: UserPerformance;
  monthlyTarget?: number;
}

// Metrics Extensions

export interface SalesMetrics {
  newCustomerRevenue: number;
  existingCustomerRevenue: number;
  newCustomerCount: number;
  averageSpending: number;
  courseRatio: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    paypay: number;
    other: number;
  };
}

export interface ExpenseBreakdown {
  rent: number;
  labor: number;
  advertising: number;
  materials: number;
  utilities: number;
  miscellaneous: number;
  systems: number;
}

export interface ProfitMetrics {
  totalExpenses: number;
  operatingProfit: number;
  profitMargin: number;
  expenseBreakdown: ExpenseBreakdown;
  expenseRatios: {
    total: number;
    rent: number;
    labor: number;
    advertising: number;
    materials: number;
    utilities: number;
    miscellaneous: number;
    systems: number;
  };
}

export interface CustomerMetrics {
  continuationRate: number;
  nextReservationRate: number;
  cancelRate: number;
  statusBreakdown: {
    initial: number;
    mid: number;
    completed: number;
  };
  cancelReasons: Array<{
    reason: string;
    count: number;
  }>;
}

export interface AdMetrics {
  totalAdCost: number;
  averageCPA: number;
  averageLTV: number;
  averageROI: number;
  byMedium: Record<string, {
    adCost: number;
    conversions: number;
    cpa: number;
    roi: number;
  }>;
}

export interface StaffMetrics {
  byStaff: Record<string, {
    revenue: number;
    count: number;
    averagePrice: number;
    nominationRate: number;
    repeatRate: number;
  }>;
}

export interface MetricsExtended {
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
  salesMetrics?: SalesMetrics;
  profitMetrics?: ProfitMetrics;
  customerMetrics?: CustomerMetrics;
  adMetrics?: AdMetrics;
  staffMetrics?: StaffMetrics;
  createdAt: Date;
}

// API Request/Response types

export interface CreateSaleRequest {
  tenantId: string;
  appointmentId?: string;
  customerId: string;
  date: string;
  serviceName: string;
  coursePrice: number;
  quantity: number;
  paymentMethod: PaymentMethod;
  staffId: string;
  notes?: string;
}

export interface UpdateSaleRequest {
  tenantId: string;
  saleId: string;
  serviceName?: string;
  coursePrice?: number;
  quantity?: number;
  paymentMethod?: PaymentMethod;
  staffId?: string;
  notes?: string;
}

export interface DeleteSaleRequest {
  tenantId: string;
  saleId: string;
}

export interface GetSalesRequest {
  tenantId: string;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  staffId?: string;
  limit?: number;
}

export interface GetSalesResponse {
  sales: Sale[];
  total: number;
}

export interface UpsertExpenseRequest {
  tenantId: string;
  month: string;
  rent: number;
  labor: number;
  advertising: number;
  materials: number;
  utilities: number;
  miscellaneous: number;
  systems: number;
  notes?: string;
}

export interface GetExpenseRequest {
  tenantId: string;
  month: string;
}

export interface GetExpenseResponse {
  expense: Expense | null;
}

export interface CreateAdRequest {
  tenantId: string;
  month: string;
  medium: string;
  adCost: number;
  newReservations: number;
  conversions: number;
  notes?: string;
}

export interface UpdateAdRequest {
  tenantId: string;
  adId: string;
  medium?: string;
  adCost?: number;
  newReservations?: number;
  conversions?: number;
  notes?: string;
}

export interface DeleteAdRequest {
  tenantId: string;
  adId: string;
}

export interface GetAdsRequest {
  tenantId: string;
  month?: string;
  limit?: number;
}

export interface GetAdsResponse {
  ads: Ad[];
  total: number;
}

export interface CreateActionItemRequest {
  tenantId: string;
  title: string;
  category: ActionItemCategory;
  problem: string;
  action: string;
  dueDate?: Date;
  priority: number;
  assignedTo?: string;
}

export interface UpdateActionItemRequest {
  tenantId: string;
  actionId: string;
  title?: string;
  category?: ActionItemCategory;
  problem?: string;
  action?: string;
  dueDate?: Date;
  status?: ActionItemStatus;
  priority?: number;
  assignedTo?: string;
  measuredAt?: Date;
  effectDescription?: string;
  effectValue?: number;
}

export interface DeleteActionItemRequest {
  tenantId: string;
  actionId: string;
}

export interface GetActionItemsRequest {
  tenantId: string;
  status?: ActionItemStatus;
  category?: ActionItemCategory;
  limit?: number;
}

export interface GetActionItemsResponse {
  actionItems: ActionItem[];
  total: number;
}

export interface UpdateKPITargetsRequest {
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

export interface GetKPITargetsRequest {
  tenantId: string;
}

export interface GetKPITargetsResponse {
  targets: KPITarget;
}

// Dashboard types

export interface KPIAlert {
  type: "warning" | "danger";
  message: string;
  kpi: string;
  actual: number;
  target: number;
}

export interface GetDashboardRequest {
  tenantId: string;
  period: "daily" | "weekly" | "monthly";
  startDate?: string;
  endDate?: string;
}

export interface GetDashboardResponse {
  metrics: MetricsExtended[];
  targets: KPITarget;
  alerts: KPIAlert[];
}

// Analysis types

export interface CourseSalesData {
  courseName: string;
  count: number;
  revenue: number;
  ratio: number;
  averagePrice: number;
}

export interface CustomerTypeData {
  count: number;
  revenue: number;
  ratio: number;
  averagePrice: number;
}

export interface PaymentMethodData {
  count: number;
  revenue: number;
  ratio: number;
}

export interface GetSalesAnalysisRequest {
  tenantId: string;
  startDate: string;
  endDate: string;
}

export interface GetSalesAnalysisResponse {
  byCourse: CourseSalesData[];
  byCustomerType: {
    new: CustomerTypeData;
    existing: CustomerTypeData;
  };
  byPaymentMethod: Record<string, PaymentMethodData>;
}

// Metrics Calculation types

export interface GetMetricsRequest {
  tenantId: string;
  period: "daily" | "weekly" | "monthly";
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface GetMetricsResponse {
  success: boolean;
  metrics: MetricsExtended[];
}

export interface CalculateMetricsRequest {
  tenantId: string;
  date: string; // YYYY-MM-DD
  period: "daily" | "weekly" | "monthly";
}

export interface CalculateMetricsResponse {
  success: boolean;
  metricId: string;
}
