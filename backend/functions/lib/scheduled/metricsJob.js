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
exports.metricsJob = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const date_fns_1 = require("date-fns");
exports.metricsJob = (0, scheduler_1.onSchedule)({
    schedule: "0 3 * * *", // Daily at 03:00 JST
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
}, async () => {
    console.log("Starting metrics calculation job");
    const db = admin.firestore();
    const yesterday = (0, date_fns_1.format)((0, date_fns_1.subDays)(new Date(), 1), "yyyy-MM-dd");
    try {
        // Get all active tenants
        const tenantsSnap = await db.collection("tenants").where("status", "==", "active").get();
        for (const tenantDoc of tenantsSnap.docs) {
            const tenantId = tenantDoc.id;
            try {
                await calculateDailyMetrics(tenantId, yesterday);
            }
            catch (error) {
                console.error(`Error calculating metrics for tenant ${tenantId}:`, error);
            }
        }
        console.log("Metrics calculation job completed");
    }
    catch (error) {
        console.error("Metrics job error:", error);
    }
});
async function calculateDailyMetrics(tenantId, date) {
    const db = admin.firestore();
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59`);
    // Get appointments for the day
    const appointmentsSnap = await db
        .collection(`tenants/${tenantId}/appointments`)
        .where("startAt", ">=", startOfDay)
        .where("startAt", "<=", endOfDay)
        .get();
    let revenue = 0;
    let appointmentCount = 0;
    let noshowCount = 0;
    const byStaff = {};
    const byService = {};
    const customerIds = new Set();
    for (const apptDoc of appointmentsSnap.docs) {
        const appt = apptDoc.data();
        appointmentCount++;
        customerIds.add(appt.customerId);
        if (appt.status === "noshow") {
            noshowCount++;
            continue;
        }
        // Get service for price
        const serviceDoc = await db.collection(`tenants/${tenantId}/services`).doc(appt.serviceId).get();
        const service = serviceDoc.data();
        const price = service?.price || 0;
        if (appt.status === "completed") {
            revenue += price;
            // By staff
            if (!byStaff[appt.staffId]) {
                byStaff[appt.staffId] = { revenue: 0, count: 0 };
            }
            byStaff[appt.staffId].revenue += price;
            byStaff[appt.staffId].count++;
            // By service
            if (!byService[appt.serviceId]) {
                byService[appt.serviceId] = { revenue: 0, count: 0 };
            }
            byService[appt.serviceId].revenue += price;
            byService[appt.serviceId].count++;
        }
    }
    const noshowRate = appointmentCount > 0 ? noshowCount / appointmentCount : 0;
    // Save metrics
    await db.collection(`tenants/${tenantId}/metrics`).add({
        tenantId,
        period: "daily",
        date,
        revenue,
        appointmentCount,
        customerCount: customerIds.size,
        noshowRate,
        byStaff,
        byService,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Metrics calculated for tenant ${tenantId}, date ${date}: revenue=${revenue}`);
}
//# sourceMappingURL=metricsJob.js.map