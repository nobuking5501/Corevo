import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();

// Export API functions
// export { createTenant } from "./api/createTenant"; // Deprecated - use createOrganization instead
export { createOrganization } from "./api/createOrganization";
export { updateOrganization } from "./api/updateOrganization";
export { addTenant } from "./api/addTenant";
export { updateTenant } from "./api/updateTenant";
export { deleteTenant } from "./api/deleteTenant";
export { addUserToTenant } from "./api/addUserToTenant";
export { createAppointment, updateAppointment, cancelAppointment } from "./api/appointments";
export { createChart, getChart, getCharts, updateChart, deleteChart } from "./api/charts";
export { uploadChartPhoto, deleteChartPhoto } from "./api/uploadChartPhoto";
export { generateSuggestion, sendMessage } from "./api/ai";
export { stripeWebhook } from "./api/stripe";
export { exportData } from "./api/export";

// Export sales management API functions
export { createSale, updateSale, deleteSale, getSales } from "./api/sales";
export { upsertExpense, getExpense, getExpenses } from "./api/expenses";
export { createAd, updateAd, deleteAd, getAds } from "./api/ads";
export { createActionItem, updateActionItem, deleteActionItem, getActionItems } from "./api/actionItems";
export { updateKPITargets, getKPITargets } from "./api/kpiTargets";
export {
  calculateDailyMetrics,
  getMetrics,
  scheduledDailyMetrics,
  scheduledWeeklyMetrics,
  scheduledMonthlyMetrics
} from "./api/metricsCalculation";
export { getSalesAnalysis, getExpenseAnalysis, getAdAnalysis } from "./api/analytics";

// Export scheduled functions
export { metricsJob } from "./scheduled/metricsJob";
export { forecastJob } from "./scheduled/forecastJob";
export { insightJob } from "./scheduled/insightJob";
export { nbaJob } from "./scheduled/nbaJob";

// Export LINE integration functions
export { lineWebhook } from "./api/lineWebhook";
export { sendLineMessage, sendAppointmentReminders } from "./api/lineSendMessage";

// Export customer portal functions (for LIFF)
export {
  getCustomerByLineUserId,
  getCustomerAppointments,
  getCustomerCharts,
  createCustomerAppointment,
  cancelCustomerAppointment,
  registerLineCustomer
} from "./api/customerPortal";

// Export migration function (development only)
export { migrateToMultiTenant } from "./api/migrateToMultiTenant";
