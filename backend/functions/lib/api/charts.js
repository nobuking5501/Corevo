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
exports.deleteChart = exports.updateChart = exports.getChart = exports.getCharts = exports.createChart = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const createChartSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    appointmentId: zod_1.z.string(),
    staffId: zod_1.z.string(),
    notes: zod_1.z.string(),
    cautions: zod_1.z.string().optional(),
    effectPeriodDays: zod_1.z.number().optional(),
    photos: zod_1.z.array(zod_1.z.string()).default([]),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.createChart = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = createChartSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        const chartRef = await db.collection(`tenants/${data.tenantId}/charts`).add({
            ...data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, chartId: chartRef.id };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to create chart");
    }
});
const getChartsSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    customerId: zod_1.z.string().optional(),
    limit: zod_1.z.number().optional().default(50),
});
exports.getCharts = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, customerId, limit } = getChartsSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        let query = db
            .collection(`tenants/${tenantId}/charts`)
            .orderBy("createdAt", "desc")
            .limit(limit);
        // Filter by customer if specified
        if (customerId) {
            query = query.where("customerId", "==", customerId);
        }
        const snapshot = await query.get();
        const charts = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate().toISOString(),
            updatedAt: doc.data().updatedAt?.toDate().toISOString(),
        }));
        return { success: true, charts };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to get charts");
    }
});
const getChartSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    chartId: zod_1.z.string(),
});
exports.getChart = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, chartId } = getChartSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const doc = await db
            .collection(`tenants/${tenantId}/charts`)
            .doc(chartId)
            .get();
        if (!doc.exists) {
            throw new https_1.HttpsError("not-found", "Chart not found");
        }
        const chart = {
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data()?.createdAt?.toDate().toISOString(),
            updatedAt: doc.data()?.updatedAt?.toDate().toISOString(),
        };
        return { success: true, chart };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to get chart");
    }
});
const updateChartSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    chartId: zod_1.z.string(),
    updates: zod_1.z.object({
        notes: zod_1.z.string().optional(),
        cautions: zod_1.z.string().optional(),
        effectPeriodDays: zod_1.z.number().optional(),
        photos: zod_1.z.array(zod_1.z.string()).optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
exports.updateChart = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, chartId, updates } = updateChartSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const updateData = {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await db
            .collection(`tenants/${tenantId}/charts`)
            .doc(chartId)
            .update(updateData);
        return { success: true };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to update chart");
    }
});
const deleteChartSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    chartId: zod_1.z.string(),
});
exports.deleteChart = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, chartId } = deleteChartSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        // Check if chart exists
        const chartDoc = await db
            .collection(`tenants/${tenantId}/charts`)
            .doc(chartId)
            .get();
        if (!chartDoc.exists) {
            throw new https_1.HttpsError("not-found", "Chart not found");
        }
        // Delete the chart document
        await db
            .collection(`tenants/${tenantId}/charts`)
            .doc(chartId)
            .delete();
        // TODO: Delete associated photos from Cloud Storage
        // This will be implemented when storage functionality is added
        return { success: true };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to delete chart");
    }
});
//# sourceMappingURL=charts.js.map