// 共通のスタイル定義
export const commonStyles = {
  // カラーパレット
  colors: {
    primary: "#3b82f6",
    primaryDark: "#2563eb",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    gray50: "#f9fafb",
    gray100: "#f3f4f6",
    gray200: "#e5e7eb",
    gray300: "#d1d5db",
    gray400: "#9ca3af",
    gray500: "#6b7280",
    gray600: "#4b5563",
    gray700: "#374151",
    gray800: "#1f2937",
    gray900: "#111827",
    white: "#ffffff",
  },

  // ページコンテナ
  page: {
    padding: "32px",
    maxWidth: "1280px",
    margin: "0 auto",
  },

  // ページヘッダー
  pageHeader: {
    marginBottom: "32px",
  },

  pageTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "8px",
  },

  pageDescription: {
    fontSize: "14px",
    color: "#6b7280",
  },

  // カード
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "24px",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
  },

  cardHeader: {
    marginBottom: "20px",
    paddingBottom: "16px",
    borderBottom: "1px solid #e5e7eb",
  },

  cardTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#111827",
  },

  // ボタン
  button: {
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "500",
    borderRadius: "6px",
    cursor: "pointer",
    border: "none",
    transition: "all 0.2s",
  },

  buttonPrimary: {
    backgroundColor: "#3b82f6",
    color: "#ffffff",
  },

  buttonSecondary: {
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
  },

  buttonDanger: {
    backgroundColor: "#ef4444",
    color: "#ffffff",
  },

  // インプット
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    outline: "none",
  },

  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: "500",
    color: "#374151",
    marginBottom: "6px",
  },

  // グリッド
  gridContainer: {
    display: "grid",
    gap: "20px",
  },

  // KPIカード（ダッシュボード用）
  kpiCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },

  kpiLabel: {
    fontSize: "13px",
    color: "#6b7280",
    marginBottom: "8px",
  },

  kpiValue: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#111827",
  },

  // テーブル行
  tableRow: {
    padding: "16px",
    borderBottom: "1px solid #e5e7eb",
  },

  // アラート
  alert: {
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
  },

  alertSuccess: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#166534",
  },

  alertWarning: {
    backgroundColor: "#fefce8",
    border: "1px solid #fde047",
    color: "#854d0e",
  },

  alertDanger: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },

  alertInfo: {
    backgroundColor: "#eff6ff",
    border: "1px solid #93c5fd",
    color: "#1e40af",
  },
};
