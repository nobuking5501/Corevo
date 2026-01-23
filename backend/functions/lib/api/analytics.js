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
exports.getAdAnalysis = exports.getExpenseAnalysis = exports.getSalesAnalysis = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const middleware_1 = require("../utils/middleware");
const date_fns_1 = require("date-fns");
// Schemas
const getSalesAnalysisSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    startDate: zod_1.z.string(), // YYYY-MM-DD
    endDate: zod_1.z.string(), // YYYY-MM-DD
});
const getExpenseAnalysisSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    startMonth: zod_1.z.string(), // YYYY-MM
    endMonth: zod_1.z.string(), // YYYY-MM
});
const getAdAnalysisSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    startMonth: zod_1.z.string(), // YYYY-MM
    endMonth: zod_1.z.string(), // YYYY-MM
});
// Sales Analysis
exports.getSalesAnalysis = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = getSalesAnalysisSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        // Fetch sales data for the period
        const salesSnapshot = await db
            .collection(`tenants/${data.tenantId}/sales`)
            .where("tenantId", "==", data.tenantId)
            .where("date", ">=", data.startDate)
            .where("date", "<=", data.endDate)
            .get();
        // Initialize analysis data structures
        const byCourse = {};
        const byCustomerType = {
            new: { count: 0, revenue: 0 },
            existing: { count: 0, revenue: 0 },
        };
        const byPaymentMethod = {
            cash: { count: 0, revenue: 0 },
            card: { count: 0, revenue: 0 },
            paypay: { count: 0, revenue: 0 },
            other: { count: 0, revenue: 0 },
        };
        const byStaff = {};
        let totalRevenue = 0;
        let totalCount = 0;
        // Process each sale
        salesSnapshot.forEach((doc) => {
            const sale = doc.data();
            totalRevenue += sale.amount;
            totalCount++;
            // By course
            if (!byCourse[sale.serviceName]) {
                byCourse[sale.serviceName] = { count: 0, revenue: 0 };
            }
            byCourse[sale.serviceName].count++;
            byCourse[sale.serviceName].revenue += sale.amount;
            // By customer type
            byCustomerType[sale.customerType].count++;
            byCustomerType[sale.customerType].revenue += sale.amount;
            // By payment method
            if (byPaymentMethod[sale.paymentMethod]) {
                byPaymentMethod[sale.paymentMethod].count++;
                byPaymentMethod[sale.paymentMethod].revenue += sale.amount;
            }
            // By staff
            if (!byStaff[sale.staffId]) {
                byStaff[sale.staffId] = { staffName: sale.staffName, count: 0, revenue: 0 };
            }
            byStaff[sale.staffId].count++;
            byStaff[sale.staffId].revenue += sale.amount;
        });
        // Format course data with ratios
        const byCourseFormatted = Object.entries(byCourse).map(([courseName, data]) => ({
            courseName,
            count: data.count,
            revenue: data.revenue,
            ratio: totalRevenue > 0 ? data.revenue / totalRevenue : 0,
            averagePrice: data.count > 0 ? data.revenue / data.count : 0,
        })).sort((a, b) => b.revenue - a.revenue);
        // Format customer type data
        const byCustomerTypeFormatted = {
            new: {
                count: byCustomerType.new.count,
                revenue: byCustomerType.new.revenue,
                ratio: totalRevenue > 0 ? byCustomerType.new.revenue / totalRevenue : 0,
                averagePrice: byCustomerType.new.count > 0 ? byCustomerType.new.revenue / byCustomerType.new.count : 0,
            },
            existing: {
                count: byCustomerType.existing.count,
                revenue: byCustomerType.existing.revenue,
                ratio: totalRevenue > 0 ? byCustomerType.existing.revenue / totalRevenue : 0,
                averagePrice: byCustomerType.existing.count > 0 ? byCustomerType.existing.revenue / byCustomerType.existing.count : 0,
            },
        };
        // Format payment method data
        const byPaymentMethodFormatted = Object.entries(byPaymentMethod).reduce((acc, [method, data]) => {
            acc[method] = {
                count: data.count,
                revenue: data.revenue,
                ratio: totalRevenue > 0 ? data.revenue / totalRevenue : 0,
            };
            return acc;
        }, {});
        // Format staff data
        const byStaffFormatted = Object.entries(byStaff).map(([staffId, data]) => ({
            staffId,
            staffName: data.staffName,
            count: data.count,
            revenue: data.revenue,
            ratio: totalRevenue > 0 ? data.revenue / totalRevenue : 0,
            averagePrice: data.count > 0 ? data.revenue / data.count : 0,
        })).sort((a, b) => b.revenue - a.revenue);
        return {
            success: true,
            analysis: {
                period: {
                    startDate: data.startDate,
                    endDate: data.endDate,
                },
                summary: {
                    totalRevenue,
                    totalCount,
                    averagePrice: totalCount > 0 ? totalRevenue / totalCount : 0,
                },
                byCourse: byCourseFormatted,
                byCustomerType: byCustomerTypeFormatted,
                byPaymentMethod: byPaymentMethodFormatted,
                byStaff: byStaffFormatted,
            },
        };
    }
    catch (error) {
        console.error("Error fetching sales analysis:", error);
        throw new Error(`Failed to fetch sales analysis: ${error.message}`);
    }
});
// Expense Analysis
exports.getExpenseAnalysis = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = getExpenseAnalysisSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        // Generate list of months between startMonth and endMonth
        const months = [];
        let currentDate = (0, date_fns_1.parseISO)(`${data.startMonth}-01`);
        const endDate = (0, date_fns_1.parseISO)(`${data.endMonth}-01`);
        while (currentDate <= endDate) {
            months.push((0, date_fns_1.format)(currentDate, "yyyy-MM"));
            currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        }
        // Fetch expenses for all months
        const expensesSnapshot = await db
            .collection(`tenants/${data.tenantId}/expenses`)
            .where("tenantId", "==", data.tenantId)
            .where("month", "in", months.slice(0, 10)) // Firestore 'in' limit is 10
            .get();
        const expensesByMonth = {};
        expensesSnapshot.forEach((doc) => {
            const expense = doc.data();
            expensesByMonth[expense.month] = expense;
        });
        // Calculate trends
        const trend = months.map((month) => {
            const expense = expensesByMonth[month];
            if (!expense) {
                return {
                    month,
                    total: 0,
                    rent: 0,
                    labor: 0,
                    advertising: 0,
                    materials: 0,
                    utilities: 0,
                    miscellaneous: 0,
                    systems: 0,
                };
            }
            return {
                month,
                total: expense.total,
                rent: expense.rent,
                labor: expense.labor,
                advertising: expense.advertising,
                materials: expense.materials,
                utilities: expense.utilities,
                miscellaneous: expense.miscellaneous,
                systems: expense.systems,
            };
        });
        // Calculate average composition
        const totalExpenses = trend.reduce((sum, t) => sum + t.total, 0);
        const composition = {
            rent: trend.reduce((sum, t) => sum + t.rent, 0),
            labor: trend.reduce((sum, t) => sum + t.labor, 0),
            advertising: trend.reduce((sum, t) => sum + t.advertising, 0),
            materials: trend.reduce((sum, t) => sum + t.materials, 0),
            utilities: trend.reduce((sum, t) => sum + t.utilities, 0),
            miscellaneous: trend.reduce((sum, t) => sum + t.miscellaneous, 0),
            systems: trend.reduce((sum, t) => sum + t.systems, 0),
        };
        const compositionWithRatio = Object.entries(composition).map(([category, amount]) => ({
            category,
            amount,
            ratio: totalExpenses > 0 ? amount / totalExpenses : 0,
        })).sort((a, b) => b.amount - a.amount);
        return {
            success: true,
            analysis: {
                period: {
                    startMonth: data.startMonth,
                    endMonth: data.endMonth,
                },
                summary: {
                    totalExpenses,
                    averageMonthly: months.length > 0 ? totalExpenses / months.length : 0,
                    monthCount: months.length,
                },
                trend,
                composition: compositionWithRatio,
            },
        };
    }
    catch (error) {
        console.error("Error fetching expense analysis:", error);
        throw new Error(`Failed to fetch expense analysis: ${error.message}`);
    }
});
// Ad Performance Analysis
exports.getAdAnalysis = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = getAdAnalysisSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        // Generate list of months
        const months = [];
        let currentDate = (0, date_fns_1.parseISO)(`${data.startMonth}-01`);
        const endDate = (0, date_fns_1.parseISO)(`${data.endMonth}-01`);
        while (currentDate <= endDate) {
            months.push((0, date_fns_1.format)(currentDate, "yyyy-MM"));
            currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        }
        // Fetch ads for all months
        const adsSnapshot = await db
            .collection(`tenants/${data.tenantId}/ads`)
            .where("tenantId", "==", data.tenantId)
            .where("month", "in", months.slice(0, 10))
            .get();
        // Group by medium and month
        const byMedium = {};
        const monthlyTrend = {};
        adsSnapshot.forEach((doc) => {
            const ad = doc.data();
            // By medium
            if (!byMedium[ad.medium]) {
                byMedium[ad.medium] = {
                    totalAdCost: 0,
                    totalConversions: 0,
                    averageCPA: 0,
                    averageROI: 0,
                    monthlyData: [],
                };
            }
            byMedium[ad.medium].totalAdCost += ad.adCost;
            byMedium[ad.medium].totalConversions += ad.conversions;
            byMedium[ad.medium].monthlyData.push({
                month: ad.month,
                adCost: ad.adCost,
                conversions: ad.conversions,
                cpa: ad.cpa || 0,
                roi: ad.roi || 0,
            });
            // Monthly trend
            if (!monthlyTrend[ad.month]) {
                monthlyTrend[ad.month] = {
                    month: ad.month,
                    totalAdCost: 0,
                    totalConversions: 0,
                    averageCPA: 0,
                    averageROI: 0,
                };
            }
            monthlyTrend[ad.month].totalAdCost += ad.adCost;
            monthlyTrend[ad.month].totalConversions += ad.conversions;
        });
        // Calculate averages for each medium
        Object.keys(byMedium).forEach((medium) => {
            const data = byMedium[medium];
            data.averageCPA = data.totalConversions > 0 ? data.totalAdCost / data.totalConversions : 0;
            data.averageROI = data.monthlyData.length > 0
                ? data.monthlyData.reduce((sum, d) => sum + (d.roi || 0), 0) / data.monthlyData.length
                : 0;
        });
        // Calculate monthly averages
        Object.keys(monthlyTrend).forEach((month) => {
            const data = monthlyTrend[month];
            data.averageCPA = data.totalConversions > 0 ? data.totalAdCost / data.totalConversions : 0;
        });
        // Format medium data
        const byMediumFormatted = Object.entries(byMedium).map(([medium, data]) => ({
            medium,
            totalAdCost: data.totalAdCost,
            totalConversions: data.totalConversions,
            averageCPA: data.averageCPA,
            averageROI: data.averageROI,
            monthlyData: data.monthlyData.sort((a, b) => a.month.localeCompare(b.month)),
        })).sort((a, b) => b.averageROI - a.averageROI);
        // Format trend data
        const trendFormatted = months.map((month) => {
            const data = monthlyTrend[month];
            if (!data) {
                return {
                    month,
                    totalAdCost: 0,
                    totalConversions: 0,
                    averageCPA: 0,
                    averageROI: 0,
                };
            }
            return data;
        });
        return {
            success: true,
            analysis: {
                period: {
                    startMonth: data.startMonth,
                    endMonth: data.endMonth,
                },
                summary: {
                    totalAdCost: Object.values(byMedium).reduce((sum, m) => sum + m.totalAdCost, 0),
                    totalConversions: Object.values(byMedium).reduce((sum, m) => sum + m.totalConversions, 0),
                    mediumCount: Object.keys(byMedium).length,
                },
                byMedium: byMediumFormatted,
                trend: trendFormatted,
            },
        };
    }
    catch (error) {
        console.error("Error fetching ad analysis:", error);
        throw new Error(`Failed to fetch ad analysis: ${error.message}`);
    }
});
//# sourceMappingURL=analytics.js.map