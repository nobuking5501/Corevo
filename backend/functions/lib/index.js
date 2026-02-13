"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpenseAnalysis = exports.getSalesAnalysis = exports.scheduledMonthlyMetrics = exports.scheduledWeeklyMetrics = exports.scheduledDailyMetrics = exports.getMetrics = exports.calculateDailyMetrics = exports.getKPITargets = exports.updateKPITargets = exports.getActionItems = exports.deleteActionItem = exports.updateActionItem = exports.createActionItem = exports.getAds = exports.deleteAd = exports.updateAd = exports.createAd = exports.getExpenses = exports.getExpense = exports.upsertExpense = exports.getSales = exports.deleteSale = exports.updateSale = exports.createSale = exports.exportData = exports.stripeWebhook = exports.sendMessage = exports.generateSuggestion = exports.deleteChartPhoto = exports.uploadChartPhoto = exports.deleteChart = exports.updateChart = exports.getCharts = exports.getChart = exports.createChart = exports.searchCustomers = exports.getCustomers = exports.getCustomer = exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.cancelAppointment = exports.updateAppointment = exports.createAppointment = exports.addUserToTenant = exports.deleteTenant = exports.updateTenant = exports.addTenant = exports.updateOrganization = exports.createOrganization = void 0;
exports.migrateToMultiTenant = exports.registerLineCustomer = exports.cancelCustomerAppointment = exports.createCustomerAppointment = exports.getCustomerCharts = exports.getCustomerAppointments = exports.getCustomerByLineUserId = exports.updateLineMessageTemplates = exports.getLineMessageTemplates = exports.sendAppointmentReminders = exports.sendLineMessage = exports.lineWebhook = exports.nbaJob = exports.insightJob = exports.forecastJob = exports.metricsJob = exports.getAdAnalysis = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
admin.initializeApp();
// Export API functions
// export { createTenant } from "./api/createTenant"; // Deprecated - use createOrganization instead
var createOrganization_1 = require("./api/createOrganization");
Object.defineProperty(exports, "createOrganization", { enumerable: true, get: function () { return createOrganization_1.createOrganization; } });
var updateOrganization_1 = require("./api/updateOrganization");
Object.defineProperty(exports, "updateOrganization", { enumerable: true, get: function () { return updateOrganization_1.updateOrganization; } });
var addTenant_1 = require("./api/addTenant");
Object.defineProperty(exports, "addTenant", { enumerable: true, get: function () { return addTenant_1.addTenant; } });
var updateTenant_1 = require("./api/updateTenant");
Object.defineProperty(exports, "updateTenant", { enumerable: true, get: function () { return updateTenant_1.updateTenant; } });
var deleteTenant_1 = require("./api/deleteTenant");
Object.defineProperty(exports, "deleteTenant", { enumerable: true, get: function () { return deleteTenant_1.deleteTenant; } });
var addUserToTenant_1 = require("./api/addUserToTenant");
Object.defineProperty(exports, "addUserToTenant", { enumerable: true, get: function () { return addUserToTenant_1.addUserToTenant; } });
var appointments_1 = require("./api/appointments");
Object.defineProperty(exports, "createAppointment", { enumerable: true, get: function () { return appointments_1.createAppointment; } });
Object.defineProperty(exports, "updateAppointment", { enumerable: true, get: function () { return appointments_1.updateAppointment; } });
Object.defineProperty(exports, "cancelAppointment", { enumerable: true, get: function () { return appointments_1.cancelAppointment; } });
var customers_1 = require("./api/customers");
Object.defineProperty(exports, "createCustomer", { enumerable: true, get: function () { return customers_1.createCustomer; } });
Object.defineProperty(exports, "updateCustomer", { enumerable: true, get: function () { return customers_1.updateCustomer; } });
Object.defineProperty(exports, "deleteCustomer", { enumerable: true, get: function () { return customers_1.deleteCustomer; } });
Object.defineProperty(exports, "getCustomer", { enumerable: true, get: function () { return customers_1.getCustomer; } });
Object.defineProperty(exports, "getCustomers", { enumerable: true, get: function () { return customers_1.getCustomers; } });
Object.defineProperty(exports, "searchCustomers", { enumerable: true, get: function () { return customers_1.searchCustomers; } });
var charts_1 = require("./api/charts");
Object.defineProperty(exports, "createChart", { enumerable: true, get: function () { return charts_1.createChart; } });
Object.defineProperty(exports, "getChart", { enumerable: true, get: function () { return charts_1.getChart; } });
Object.defineProperty(exports, "getCharts", { enumerable: true, get: function () { return charts_1.getCharts; } });
Object.defineProperty(exports, "updateChart", { enumerable: true, get: function () { return charts_1.updateChart; } });
Object.defineProperty(exports, "deleteChart", { enumerable: true, get: function () { return charts_1.deleteChart; } });
var uploadChartPhoto_1 = require("./api/uploadChartPhoto");
Object.defineProperty(exports, "uploadChartPhoto", { enumerable: true, get: function () { return uploadChartPhoto_1.uploadChartPhoto; } });
Object.defineProperty(exports, "deleteChartPhoto", { enumerable: true, get: function () { return uploadChartPhoto_1.deleteChartPhoto; } });
var ai_1 = require("./api/ai");
Object.defineProperty(exports, "generateSuggestion", { enumerable: true, get: function () { return ai_1.generateSuggestion; } });
Object.defineProperty(exports, "sendMessage", { enumerable: true, get: function () { return ai_1.sendMessage; } });
var stripe_1 = require("./api/stripe");
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripe_1.stripeWebhook; } });
var export_1 = require("./api/export");
Object.defineProperty(exports, "exportData", { enumerable: true, get: function () { return export_1.exportData; } });
// Export sales management API functions
var sales_1 = require("./api/sales");
Object.defineProperty(exports, "createSale", { enumerable: true, get: function () { return sales_1.createSale; } });
Object.defineProperty(exports, "updateSale", { enumerable: true, get: function () { return sales_1.updateSale; } });
Object.defineProperty(exports, "deleteSale", { enumerable: true, get: function () { return sales_1.deleteSale; } });
Object.defineProperty(exports, "getSales", { enumerable: true, get: function () { return sales_1.getSales; } });
var expenses_1 = require("./api/expenses");
Object.defineProperty(exports, "upsertExpense", { enumerable: true, get: function () { return expenses_1.upsertExpense; } });
Object.defineProperty(exports, "getExpense", { enumerable: true, get: function () { return expenses_1.getExpense; } });
Object.defineProperty(exports, "getExpenses", { enumerable: true, get: function () { return expenses_1.getExpenses; } });
var ads_1 = require("./api/ads");
Object.defineProperty(exports, "createAd", { enumerable: true, get: function () { return ads_1.createAd; } });
Object.defineProperty(exports, "updateAd", { enumerable: true, get: function () { return ads_1.updateAd; } });
Object.defineProperty(exports, "deleteAd", { enumerable: true, get: function () { return ads_1.deleteAd; } });
Object.defineProperty(exports, "getAds", { enumerable: true, get: function () { return ads_1.getAds; } });
var actionItems_1 = require("./api/actionItems");
Object.defineProperty(exports, "createActionItem", { enumerable: true, get: function () { return actionItems_1.createActionItem; } });
Object.defineProperty(exports, "updateActionItem", { enumerable: true, get: function () { return actionItems_1.updateActionItem; } });
Object.defineProperty(exports, "deleteActionItem", { enumerable: true, get: function () { return actionItems_1.deleteActionItem; } });
Object.defineProperty(exports, "getActionItems", { enumerable: true, get: function () { return actionItems_1.getActionItems; } });
var kpiTargets_1 = require("./api/kpiTargets");
Object.defineProperty(exports, "updateKPITargets", { enumerable: true, get: function () { return kpiTargets_1.updateKPITargets; } });
Object.defineProperty(exports, "getKPITargets", { enumerable: true, get: function () { return kpiTargets_1.getKPITargets; } });
var metricsCalculation_1 = require("./api/metricsCalculation");
Object.defineProperty(exports, "calculateDailyMetrics", { enumerable: true, get: function () { return metricsCalculation_1.calculateDailyMetrics; } });
Object.defineProperty(exports, "getMetrics", { enumerable: true, get: function () { return metricsCalculation_1.getMetrics; } });
Object.defineProperty(exports, "scheduledDailyMetrics", { enumerable: true, get: function () { return metricsCalculation_1.scheduledDailyMetrics; } });
Object.defineProperty(exports, "scheduledWeeklyMetrics", { enumerable: true, get: function () { return metricsCalculation_1.scheduledWeeklyMetrics; } });
Object.defineProperty(exports, "scheduledMonthlyMetrics", { enumerable: true, get: function () { return metricsCalculation_1.scheduledMonthlyMetrics; } });
// Analytics APIs (refactored into separate modules)
var salesAnalysis_1 = require("./api/salesAnalysis");
Object.defineProperty(exports, "getSalesAnalysis", { enumerable: true, get: function () { return salesAnalysis_1.getSalesAnalysis; } });
var expenseAnalysis_1 = require("./api/expenseAnalysis");
Object.defineProperty(exports, "getExpenseAnalysis", { enumerable: true, get: function () { return expenseAnalysis_1.getExpenseAnalysis; } });
var adAnalysis_1 = require("./api/adAnalysis");
Object.defineProperty(exports, "getAdAnalysis", { enumerable: true, get: function () { return adAnalysis_1.getAdAnalysis; } });
// Export scheduled functions
var metricsJob_1 = require("./scheduled/metricsJob");
Object.defineProperty(exports, "metricsJob", { enumerable: true, get: function () { return metricsJob_1.metricsJob; } });
var forecastJob_1 = require("./scheduled/forecastJob");
Object.defineProperty(exports, "forecastJob", { enumerable: true, get: function () { return forecastJob_1.forecastJob; } });
var insightJob_1 = require("./scheduled/insightJob");
Object.defineProperty(exports, "insightJob", { enumerable: true, get: function () { return insightJob_1.insightJob; } });
var nbaJob_1 = require("./scheduled/nbaJob");
Object.defineProperty(exports, "nbaJob", { enumerable: true, get: function () { return nbaJob_1.nbaJob; } });
// Export LINE integration functions
var lineWebhook_1 = require("./api/lineWebhook");
Object.defineProperty(exports, "lineWebhook", { enumerable: true, get: function () { return lineWebhook_1.lineWebhook; } });
var lineSendMessage_1 = require("./api/lineSendMessage");
Object.defineProperty(exports, "sendLineMessage", { enumerable: true, get: function () { return lineSendMessage_1.sendLineMessage; } });
Object.defineProperty(exports, "sendAppointmentReminders", { enumerable: true, get: function () { return lineSendMessage_1.sendAppointmentReminders; } });
var lineMessageTemplates_1 = require("./api/lineMessageTemplates");
Object.defineProperty(exports, "getLineMessageTemplates", { enumerable: true, get: function () { return lineMessageTemplates_1.getLineMessageTemplates; } });
Object.defineProperty(exports, "updateLineMessageTemplates", { enumerable: true, get: function () { return lineMessageTemplates_1.updateLineMessageTemplates; } });
// Export customer portal functions (for LIFF)
var customerPortal_1 = require("./api/customerPortal");
Object.defineProperty(exports, "getCustomerByLineUserId", { enumerable: true, get: function () { return customerPortal_1.getCustomerByLineUserId; } });
Object.defineProperty(exports, "getCustomerAppointments", { enumerable: true, get: function () { return customerPortal_1.getCustomerAppointments; } });
Object.defineProperty(exports, "getCustomerCharts", { enumerable: true, get: function () { return customerPortal_1.getCustomerCharts; } });
Object.defineProperty(exports, "createCustomerAppointment", { enumerable: true, get: function () { return customerPortal_1.createCustomerAppointment; } });
Object.defineProperty(exports, "cancelCustomerAppointment", { enumerable: true, get: function () { return customerPortal_1.cancelCustomerAppointment; } });
Object.defineProperty(exports, "registerLineCustomer", { enumerable: true, get: function () { return customerPortal_1.registerLineCustomer; } });
// Export migration function (development only)
var migrateToMultiTenant_1 = require("./api/migrateToMultiTenant");
Object.defineProperty(exports, "migrateToMultiTenant", { enumerable: true, get: function () { return migrateToMultiTenant_1.migrateToMultiTenant; } });
//# sourceMappingURL=index.js.map