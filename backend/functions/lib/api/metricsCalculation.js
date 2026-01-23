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
exports.getMetrics = exports.scheduledMonthlyMetrics = exports.scheduledWeeklyMetrics = exports.scheduledDailyMetrics = exports.calculateDailyMetrics = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const zod_1 = require("zod");
const middleware_1 = require("../utils/middleware");
const date_fns_1 = require("date-fns");
// Schemas
const calculateMetricsSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    date: zod_1.z.string(), // YYYY-MM-DD
    period: zod_1.z.enum(["daily", "weekly", "monthly"]),
});
const getMetricsSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    period: zod_1.z.enum(["daily", "weekly", "monthly"]),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    limit: zod_1.z.number().default(30),
});
// Helper to get date range
function getDateRange(date, period) {
    const targetDate = new Date(date);
    switch (period) {
        case "daily":
            return {
                start: (0, date_fns_1.startOfDay)(targetDate),
                end: (0, date_fns_1.endOfDay)(targetDate),
            };
        case "weekly":
            return {
                start: (0, date_fns_1.startOfWeek)(targetDate, { weekStartsOn: 1 }), // Monday
                end: (0, date_fns_1.endOfWeek)(targetDate, { weekStartsOn: 1 }),
            };
        case "monthly":
            return {
                start: (0, date_fns_1.startOfMonth)(targetDate),
                end: (0, date_fns_1.endOfMonth)(targetDate),
            };
    }
}
// Calculate sales metrics
async function calculateSalesMetrics(tenantId, startDate, endDate) {
    const db = admin.firestore();
    const salesSnapshot = await db
        .collection(`tenants/${tenantId}/sales`)
        .where("tenantId", "==", tenantId)
        .where("date", ">=", (0, date_fns_1.format)(startDate, "yyyy-MM-dd"))
        .where("date", "<=", (0, date_fns_1.format)(endDate, "yyyy-MM-dd"))
        .get();
    let totalRevenue = 0;
    let newCustomerRevenue = 0;
    let existingCustomerRevenue = 0;
    let newCustomerCount = 0;
    const paymentBreakdown = { cash: 0, card: 0, paypay: 0, other: 0 };
    const byStaff = {};
    const byService = {};
    salesSnapshot.forEach((doc) => {
        const sale = doc.data();
        totalRevenue += sale.amount;
        if (sale.customerType === "new") {
            newCustomerRevenue += sale.amount;
            newCustomerCount++;
        }
        else {
            existingCustomerRevenue += sale.amount;
        }
        // Payment breakdown
        paymentBreakdown[sale.paymentMethod] += sale.amount;
        // By staff
        if (!byStaff[sale.staffId]) {
            byStaff[sale.staffId] = { revenue: 0, count: 0 };
        }
        byStaff[sale.staffId].revenue += sale.amount;
        byStaff[sale.staffId].count++;
        // By service
        if (!byService[sale.serviceName]) {
            byService[sale.serviceName] = { revenue: 0, count: 0 };
        }
        byService[sale.serviceName].revenue += sale.amount;
        byService[sale.serviceName].count++;
    });
    const saleCount = salesSnapshot.size;
    const averageSpending = saleCount > 0 ? totalRevenue / saleCount : 0;
    return {
        totalRevenue,
        saleCount,
        salesMetrics: {
            newCustomerRevenue,
            existingCustomerRevenue,
            newCustomerCount,
            averageSpending,
            courseRatio: 0, // To be calculated if course data is available
            paymentBreakdown,
        },
        byStaff,
        byService,
    };
}
// Calculate expense metrics
async function calculateExpenseMetrics(tenantId, month) {
    const db = admin.firestore();
    const expenseSnapshot = await db
        .collection(`tenants/${tenantId}/expenses`)
        .where("tenantId", "==", tenantId)
        .where("month", "==", month)
        .limit(1)
        .get();
    if (expenseSnapshot.empty) {
        return null;
    }
    const expense = expenseSnapshot.docs[0].data();
    const totalExpenses = expense.total;
    return {
        totalExpenses,
        expenseBreakdown: {
            rent: expense.rent,
            labor: expense.labor,
            advertising: expense.advertising,
            materials: expense.materials,
            utilities: expense.utilities,
            miscellaneous: expense.miscellaneous,
            systems: expense.systems,
        },
    };
}
// Calculate ad metrics
async function calculateAdMetrics(tenantId, month) {
    const db = admin.firestore();
    const adsSnapshot = await db
        .collection(`tenants/${tenantId}/ads`)
        .where("tenantId", "==", tenantId)
        .where("month", "==", month)
        .get();
    let totalAdCost = 0;
    let totalConversions = 0;
    const byMedium = {};
    adsSnapshot.forEach((doc) => {
        const ad = doc.data();
        totalAdCost += ad.adCost;
        totalConversions += ad.conversions;
        byMedium[ad.medium] = {
            adCost: ad.adCost,
            conversions: ad.conversions,
            cpa: ad.cpa || 0,
            roi: ad.roi || 0,
        };
    });
    const averageCPA = totalConversions > 0 ? totalAdCost / totalConversions : 0;
    const averageROI = adsSnapshot.size > 0
        ? adsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().roi || 0), 0) / adsSnapshot.size
        : 0;
    return {
        totalAdCost,
        averageCPA,
        averageLTV: 0, // To be calculated from customer data
        averageROI,
        byMedium,
    };
}
// Calculate customer metrics
async function calculateCustomerMetrics(tenantId) {
    const db = admin.firestore();
    const customersSnapshot = await db
        .collection(`tenants/${tenantId}/customers`)
        .where("tenantId", "==", tenantId)
        .get();
    let continuingCount = 0;
    let totalCount = 0;
    let canceledCount = 0;
    const statusBreakdown = { initial: 0, mid: 0, completed: 0 };
    const cancelReasons = {};
    customersSnapshot.forEach((doc) => {
        const customer = doc.data();
        totalCount++;
        if (customer.isContinuing) {
            continuingCount++;
        }
        else {
            canceledCount++;
            if (customer.cancelReason) {
                cancelReasons[customer.cancelReason] = (cancelReasons[customer.cancelReason] || 0) + 1;
            }
        }
        if (customer.courseStatus) {
            statusBreakdown[customer.courseStatus]++;
        }
    });
    const continuationRate = totalCount > 0 ? continuingCount / totalCount : 0;
    const cancelRate = totalCount > 0 ? canceledCount / totalCount : 0;
    // Calculate next reservation rate (customers with scheduled appointments)
    const appointmentsSnapshot = await db
        .collection(`tenants/${tenantId}/appointments`)
        .where("tenantId", "==", tenantId)
        .where("date", ">=", (0, date_fns_1.format)(new Date(), "yyyy-MM-dd"))
        .get();
    const customersWithNextAppointment = new Set(appointmentsSnapshot.docs.map(doc => doc.data().customerId));
    const nextReservationRate = totalCount > 0 ? customersWithNextAppointment.size / totalCount : 0;
    return {
        continuationRate,
        nextReservationRate,
        cancelRate,
        statusBreakdown,
        cancelReasons: Object.entries(cancelReasons).map(([reason, count]) => ({ reason, count })),
    };
}
// Main calculation function
async function calculateMetrics(tenantId, date, period) {
    const { start, end } = getDateRange(date, period);
    const month = (0, date_fns_1.format)(start, "yyyy-MM");
    // Calculate all metrics
    const salesData = await calculateSalesMetrics(tenantId, start, end);
    const expenseData = await calculateExpenseMetrics(tenantId, month);
    const adData = await calculateAdMetrics(tenantId, month);
    const customerData = await calculateCustomerMetrics(tenantId);
    // Calculate profit metrics if expense data is available
    let profitMetrics = null;
    if (expenseData && salesData.totalRevenue > 0) {
        const operatingProfit = salesData.totalRevenue - expenseData.totalExpenses;
        const profitMargin = salesData.totalRevenue > 0 ? operatingProfit / salesData.totalRevenue : 0;
        profitMetrics = {
            totalExpenses: expenseData.totalExpenses,
            operatingProfit,
            profitMargin,
            expenseBreakdown: expenseData.expenseBreakdown,
            expenseRatios: {
                total: salesData.totalRevenue > 0 ? expenseData.totalExpenses / salesData.totalRevenue : 0,
                rent: salesData.totalRevenue > 0 ? expenseData.expenseBreakdown.rent / salesData.totalRevenue : 0,
                labor: salesData.totalRevenue > 0 ? expenseData.expenseBreakdown.labor / salesData.totalRevenue : 0,
                advertising: salesData.totalRevenue > 0 ? expenseData.expenseBreakdown.advertising / salesData.totalRevenue : 0,
                materials: salesData.totalRevenue > 0 ? expenseData.expenseBreakdown.materials / salesData.totalRevenue : 0,
                utilities: salesData.totalRevenue > 0 ? expenseData.expenseBreakdown.utilities / salesData.totalRevenue : 0,
                miscellaneous: salesData.totalRevenue > 0 ? expenseData.expenseBreakdown.miscellaneous / salesData.totalRevenue : 0,
                systems: salesData.totalRevenue > 0 ? expenseData.expenseBreakdown.systems / salesData.totalRevenue : 0,
            },
        };
    }
    // Get appointment count and noshow rate
    const db = admin.firestore();
    const appointmentsSnapshot = await db
        .collection(`tenants/${tenantId}/appointments`)
        .where("tenantId", "==", tenantId)
        .where("date", ">=", (0, date_fns_1.format)(start, "yyyy-MM-dd"))
        .where("date", "<=", (0, date_fns_1.format)(end, "yyyy-MM-dd"))
        .get();
    let noshowCount = 0;
    appointmentsSnapshot.forEach((doc) => {
        const apt = doc.data();
        if (apt.status === "noshow") {
            noshowCount++;
        }
    });
    const noshowRate = appointmentsSnapshot.size > 0 ? noshowCount / appointmentsSnapshot.size : 0;
    // Store metrics
    const metricsData = {
        tenantId,
        period,
        date: (0, date_fns_1.format)(start, "yyyy-MM-dd"),
        revenue: salesData.totalRevenue,
        appointmentCount: appointmentsSnapshot.size,
        customerCount: salesData.saleCount,
        noshowRate,
        byStaff: salesData.byStaff,
        byService: salesData.byService,
        salesMetrics: salesData.salesMetrics,
        profitMetrics,
        customerMetrics: customerData,
        adMetrics: adData,
        createdAt: new Date(),
    };
    // Check if metrics already exist for this period
    const existingMetricsSnapshot = await db
        .collection(`tenants/${tenantId}/metrics`)
        .where("tenantId", "==", tenantId)
        .where("period", "==", period)
        .where("date", "==", (0, date_fns_1.format)(start, "yyyy-MM-dd"))
        .limit(1)
        .get();
    let metricId;
    if (!existingMetricsSnapshot.empty) {
        // Update existing
        metricId = existingMetricsSnapshot.docs[0].id;
        await db.collection(`tenants/${tenantId}/metrics`).doc(metricId).update(metricsData);
    }
    else {
        // Create new
        const docRef = await db.collection(`tenants/${tenantId}/metrics`).add(metricsData);
        metricId = docRef.id;
    }
    // Generate KPI alerts
    await generateKPIAlerts(tenantId, metricsData, period);
    return metricId;
}
// Generate KPI Alerts by comparing metrics with targets
async function generateKPIAlerts(tenantId, metricsData, period) {
    // Only generate alerts for monthly metrics
    if (period !== "monthly")
        return;
    const db = admin.firestore();
    // Get KPI targets
    const kpiTargetsSnapshot = await db
        .collection(`tenants/${tenantId}/kpi_targets`)
        .where("tenantId", "==", tenantId)
        .limit(1)
        .get();
    if (kpiTargetsSnapshot.empty)
        return;
    const targets = kpiTargetsSnapshot.docs[0].data();
    const alerts = [];
    // Check profit margin
    if (metricsData.profitMetrics && metricsData.profitMetrics.profitMargin < targets.profitMarginTarget) {
        alerts.push({
            type: "danger",
            kpi: "profitMargin",
            message: `利益率が目標値を下回っています（実績: ${(metricsData.profitMetrics.profitMargin * 100).toFixed(1)}%, 目標: ${(targets.profitMarginTarget * 100).toFixed(1)}%）`,
            actual: metricsData.profitMetrics.profitMargin,
            target: targets.profitMarginTarget,
        });
    }
    // Check continuation rate
    if (metricsData.customerMetrics && metricsData.customerMetrics.continuationRate < targets.continuationRateTarget) {
        alerts.push({
            type: metricsData.customerMetrics.continuationRate < targets.continuationRateTarget * 0.9 ? "danger" : "warning",
            kpi: "continuationRate",
            message: `継続率が目標値を下回っています（実績: ${(metricsData.customerMetrics.continuationRate * 100).toFixed(1)}%, 目標: ${(targets.continuationRateTarget * 100).toFixed(1)}%）`,
            actual: metricsData.customerMetrics.continuationRate,
            target: targets.continuationRateTarget,
        });
    }
    // Check next reservation rate
    if (metricsData.customerMetrics && metricsData.customerMetrics.nextReservationRate < targets.nextReservationRateTarget) {
        alerts.push({
            type: "warning",
            kpi: "nextReservationRate",
            message: `次回予約率が目標値を下回っています（実績: ${(metricsData.customerMetrics.nextReservationRate * 100).toFixed(1)}%, 目標: ${(targets.nextReservationRateTarget * 100).toFixed(1)}%）`,
            actual: metricsData.customerMetrics.nextReservationRate,
            target: targets.nextReservationRateTarget,
        });
    }
    // Check new customers count
    if (metricsData.salesMetrics && metricsData.salesMetrics.newCustomerCount < targets.newCustomersMonthlyTarget) {
        alerts.push({
            type: "warning",
            kpi: "newCustomers",
            message: `新規顧客数が目標値を下回っています（実績: ${metricsData.salesMetrics.newCustomerCount}人, 目標: ${targets.newCustomersMonthlyTarget}人）`,
            actual: metricsData.salesMetrics.newCustomerCount,
            target: targets.newCustomersMonthlyTarget,
        });
    }
    // Check CPA
    if (metricsData.adMetrics && metricsData.adMetrics.averageCPA > targets.cpaMaxTarget) {
        alerts.push({
            type: "danger",
            kpi: "cpa",
            message: `CPAが目標値を上回っています（実績: ¥${Math.round(metricsData.adMetrics.averageCPA).toLocaleString()}, 上限: ¥${Math.round(targets.cpaMaxTarget).toLocaleString()}）`,
            actual: metricsData.adMetrics.averageCPA,
            target: targets.cpaMaxTarget,
        });
    }
    // Check ad cost ratio
    if (metricsData.adMetrics && metricsData.profitMetrics && metricsData.revenue > 0) {
        const adCostRatio = metricsData.adMetrics.totalAdCost / metricsData.revenue;
        if (adCostRatio > targets.adCostRatioMaxTarget) {
            alerts.push({
                type: "warning",
                kpi: "adCostRatio",
                message: `広告費率が目標値を上回っています（実績: ${(adCostRatio * 100).toFixed(1)}%, 上限: ${(targets.adCostRatioMaxTarget * 100).toFixed(1)}%）`,
                actual: adCostRatio,
                target: targets.adCostRatioMaxTarget,
            });
        }
    }
    // Check labor cost ratio
    if (metricsData.profitMetrics && metricsData.revenue > 0) {
        const laborCostRatio = metricsData.profitMetrics.expenseRatios.labor;
        if (laborCostRatio > targets.laborCostRatioMaxTarget) {
            alerts.push({
                type: "warning",
                kpi: "laborCostRatio",
                message: `人件費率が目標値を上回っています（実績: ${(laborCostRatio * 100).toFixed(1)}%, 上限: ${(targets.laborCostRatioMaxTarget * 100).toFixed(1)}%）`,
                actual: laborCostRatio,
                target: targets.laborCostRatioMaxTarget,
            });
        }
    }
    // Check total expense ratio
    if (metricsData.profitMetrics && metricsData.revenue > 0) {
        const expenseRatio = metricsData.profitMetrics.expenseRatios.total;
        if (expenseRatio > targets.expenseRatioMaxTarget) {
            alerts.push({
                type: "danger",
                kpi: "expenseRatio",
                message: `総経費率が目標値を上回っています（実績: ${(expenseRatio * 100).toFixed(1)}%, 上限: ${(targets.expenseRatioMaxTarget * 100).toFixed(1)}%）`,
                actual: expenseRatio,
                target: targets.expenseRatioMaxTarget,
            });
        }
    }
    // Check monthly revenue target
    if (targets.monthlyRevenueTarget && metricsData.revenue < targets.monthlyRevenueTarget) {
        alerts.push({
            type: metricsData.revenue < targets.monthlyRevenueTarget * 0.8 ? "danger" : "warning",
            kpi: "monthlyRevenue",
            message: `月次売上が目標値を下回っています（実績: ¥${Math.round(metricsData.revenue).toLocaleString()}, 目標: ¥${Math.round(targets.monthlyRevenueTarget).toLocaleString()}）`,
            actual: metricsData.revenue,
            target: targets.monthlyRevenueTarget,
        });
    }
    // Check monthly profit target
    if (targets.monthlyProfitTarget && metricsData.profitMetrics && metricsData.profitMetrics.operatingProfit < targets.monthlyProfitTarget) {
        alerts.push({
            type: metricsData.profitMetrics.operatingProfit < targets.monthlyProfitTarget * 0.8 ? "danger" : "warning",
            kpi: "monthlyProfit",
            message: `月次利益が目標値を下回っています（実績: ¥${Math.round(metricsData.profitMetrics.operatingProfit).toLocaleString()}, 目標: ¥${Math.round(targets.monthlyProfitTarget).toLocaleString()}）`,
            actual: metricsData.profitMetrics.operatingProfit,
            target: targets.monthlyProfitTarget,
        });
    }
    // Store alerts if any exist
    if (alerts.length > 0) {
        const alertsData = {
            tenantId,
            date: metricsData.date,
            period: metricsData.period,
            alerts,
            createdAt: new Date(),
        };
        // Check if alerts already exist for this period
        const existingAlertsSnapshot = await db
            .collection(`tenants/${tenantId}/kpi_alerts`)
            .where("tenantId", "==", tenantId)
            .where("period", "==", period)
            .where("date", "==", metricsData.date)
            .limit(1)
            .get();
        if (!existingAlertsSnapshot.empty) {
            // Update existing
            const alertId = existingAlertsSnapshot.docs[0].id;
            await db.collection(`tenants/${tenantId}/kpi_alerts`).doc(alertId).update(alertsData);
        }
        else {
            // Create new
            await db.collection(`tenants/${tenantId}/kpi_alerts`).add(alertsData);
        }
        console.log(`Generated ${alerts.length} KPI alerts for tenant ${tenantId}`);
    }
}
// Callable function to manually trigger calculation
exports.calculateDailyMetrics = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = calculateMetricsSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const metricId = await calculateMetrics(data.tenantId, data.date, data.period);
        return { success: true, metricId };
    }
    catch (error) {
        console.error("Error calculating metrics:", error);
        throw new Error(`Failed to calculate metrics: ${error.message}`);
    }
});
// Scheduled function to run daily at 2 AM JST
exports.scheduledDailyMetrics = (0, scheduler_1.onSchedule)({
    schedule: "0 2 * * *",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
}, async () => {
    console.log("Running scheduled daily metrics calculation");
    try {
        const db = admin.firestore();
        // Get all active tenants
        const tenantsSnapshot = await db.collection("tenants").get();
        const yesterday = (0, date_fns_1.format)((0, date_fns_1.subDays)(new Date(), 1), "yyyy-MM-dd");
        // Calculate metrics for each tenant
        const promises = tenantsSnapshot.docs.map(async (tenantDoc) => {
            const tenantId = tenantDoc.id;
            try {
                await calculateMetrics(tenantId, yesterday, "daily");
                console.log(`Calculated daily metrics for tenant ${tenantId}`);
            }
            catch (error) {
                console.error(`Error calculating metrics for tenant ${tenantId}:`, error);
            }
        });
        await Promise.all(promises);
        console.log("Completed scheduled daily metrics calculation");
    }
    catch (error) {
        console.error("Error in scheduled daily metrics:", error);
        throw error;
    }
});
// Scheduled function to run weekly on Monday at 3 AM JST
exports.scheduledWeeklyMetrics = (0, scheduler_1.onSchedule)({
    schedule: "0 3 * * 1",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
}, async () => {
    console.log("Running scheduled weekly metrics calculation");
    try {
        const db = admin.firestore();
        const tenantsSnapshot = await db.collection("tenants").get();
        const lastMonday = (0, date_fns_1.format)((0, date_fns_1.subDays)(new Date(), 7), "yyyy-MM-dd");
        const promises = tenantsSnapshot.docs.map(async (tenantDoc) => {
            const tenantId = tenantDoc.id;
            try {
                await calculateMetrics(tenantId, lastMonday, "weekly");
                console.log(`Calculated weekly metrics for tenant ${tenantId}`);
            }
            catch (error) {
                console.error(`Error calculating weekly metrics for tenant ${tenantId}:`, error);
            }
        });
        await Promise.all(promises);
        console.log("Completed scheduled weekly metrics calculation");
    }
    catch (error) {
        console.error("Error in scheduled weekly metrics:", error);
        throw error;
    }
});
// Scheduled function to run monthly on 1st at 4 AM JST
exports.scheduledMonthlyMetrics = (0, scheduler_1.onSchedule)({
    schedule: "0 4 1 * *",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
}, async () => {
    console.log("Running scheduled monthly metrics calculation");
    try {
        const db = admin.firestore();
        const tenantsSnapshot = await db.collection("tenants").get();
        const firstDayOfLastMonth = (0, date_fns_1.format)((0, date_fns_1.startOfMonth)((0, date_fns_1.subDays)(new Date(), 1)), "yyyy-MM-dd");
        const promises = tenantsSnapshot.docs.map(async (tenantDoc) => {
            const tenantId = tenantDoc.id;
            try {
                await calculateMetrics(tenantId, firstDayOfLastMonth, "monthly");
                console.log(`Calculated monthly metrics for tenant ${tenantId}`);
            }
            catch (error) {
                console.error(`Error calculating monthly metrics for tenant ${tenantId}:`, error);
            }
        });
        await Promise.all(promises);
        console.log("Completed scheduled monthly metrics calculation");
    }
    catch (error) {
        console.error("Error in scheduled monthly metrics:", error);
        throw error;
    }
});
// Get metrics
exports.getMetrics = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = getMetricsSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        let query = db
            .collection(`tenants/${data.tenantId}/metrics`)
            .where("tenantId", "==", data.tenantId)
            .where("period", "==", data.period)
            .orderBy("date", "desc");
        if (data.startDate) {
            query = query.where("date", ">=", data.startDate);
        }
        if (data.endDate) {
            query = query.where("date", "<=", data.endDate);
        }
        query = query.limit(data.limit);
        const snapshot = await query.get();
        const metrics = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        return { success: true, metrics };
    }
    catch (error) {
        console.error("Error fetching metrics:", error);
        throw new Error(`Failed to fetch metrics: ${error.message}`);
    }
});
//# sourceMappingURL=metricsCalculation.js.map