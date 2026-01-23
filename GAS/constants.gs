/**
 * 定数定義
 */

const SHEET_NAMES = {
  DASHBOARD: 'ダッシュボード',
  SALES: '売上',
  ADS: '広告',
  CUSTOMERS: '顧客',
  EXPENSES: '経費',
  PROFIT: '利益',
  STAFF: 'スタッフ',
  ACTIONS: '改善アクション',
  README: '使い方',
  SALES_ANALYSIS: '売上分析',
  CUSTOMER_ANALYSIS: '顧客分析',
  PDCA_DASHBOARD: 'PDCA管理'
};

const COLORS = {
  DASHBOARD: '#F4F8FB',
  SALES: '#E8F5E9',
  ADS: '#FFF8E1',
  CUSTOMERS: '#F3E5F5',
  EXPENSES: '#FFF3E0',
  PROFIT: '#E3F2FD',
  STAFF: '#E8EAF6',
  ACTIONS: '#F1F8E9',
  SUMMARY_ROW: '#F5F5F5',
  SALES_ANALYSIS: '#E8F5E9',
  CUSTOMER_ANALYSIS: '#FCE4EC',
  PDCA_DASHBOARD: '#FFF9C4'
};

const VALIDATION_VALUES = {
  CUSTOMER_TYPE: ['新規', '既存'],
  PAYMENT_METHOD: ['現金', 'カード', 'PayPay'],
  STATUS: ['初回', '中間', '完了'],
  CONTINUATION: ['○', '×']
};

const NAMED_RANGES = {
  SALES_TOTAL: { name: '売上_合計', range: '売上!G101' },
  EXPENSES_TOTAL: { name: '経費_合計', range: '経費!I101' },
  NEXT_RESERVATION_RATE: { name: '次回予約率', range: '顧客!K101' },
  CONTINUATION_RATE: { name: '継続率', range: '顧客!L101' },
  CPA_AVERAGE: { name: 'CPA_平均', range: '広告!G101' },
  LTV_AVERAGE: { name: 'LTV_平均', range: '広告!H101' }
};

const SUMMARY_ROW = 101;

// KPI目標値
const KPI_TARGETS = {
  PROFIT_MARGIN: 0.20,        // 利益率20%以上
  CONTINUATION_RATE: 0.85,    // 継続率85%以上
  NEXT_RESERVATION_RATE: 0.80, // 次回予約率80%以上
  NEW_CUSTOMERS_MONTHLY: 20,   // 新規来店20名以上
  CPA_MAX: 15000,              // CPA15,000円以下
  AD_COST_RATIO_MAX: 0.15,     // 広告費率15%以下
  LABOR_COST_RATIO_MAX: 0.30,  // 人件費率30%以下
  EXPENSE_RATIO_MAX: 0.60      // 経費率60%以下
};

// 業界標準の経費比率
const INDUSTRY_STANDARD = {
  RENT_RATIO: { min: 0.05, max: 0.10, name: '家賃' },      // 5-10%
  LABOR_RATIO: { min: 0.20, max: 0.30, name: '人件費' },   // 20-30%
  AD_RATIO: { min: 0.10, max: 0.20, name: '広告費' },      // 10-20%
  MATERIAL_RATIO: { min: 0.03, max: 0.08, name: '材料費' }, // 3-8%
  UTILITY_RATIO: { min: 0.02, max: 0.05, name: '光熱費' },  // 2-5%
  MISC_RATIO: { min: 0.01, max: 0.03, name: '雑費' },       // 1-3%
  SYSTEM_RATIO: { min: 0.01, max: 0.02, name: 'システム費' } // 1-2%
};
