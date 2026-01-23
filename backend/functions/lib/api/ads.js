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
exports.getAds = exports.deleteAd = exports.updateAd = exports.createAd = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
// ==================== Schemas ====================
const createAdSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    month: zod_1.z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
    medium: zod_1.z.string().min(1),
    adCost: zod_1.z.number().nonnegative(),
    newReservations: zod_1.z.number().int().nonnegative(),
    conversions: zod_1.z.number().int().nonnegative(),
    notes: zod_1.z.string().optional(),
});
const updateAdSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    adId: zod_1.z.string(),
    medium: zod_1.z.string().min(1).optional(),
    adCost: zod_1.z.number().nonnegative().optional(),
    newReservations: zod_1.z.number().int().nonnegative().optional(),
    conversions: zod_1.z.number().int().nonnegative().optional(),
    notes: zod_1.z.string().optional(),
});
const deleteAdSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    adId: zod_1.z.string(),
});
const getAdsSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    month: zod_1.z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
    limit: zod_1.z.number().int().positive().max(1000).optional(),
});
// ==================== Helper Functions ====================
function calculateAdMetrics(data) {
    const conversionRate = data.newReservations > 0
        ? data.conversions / data.newReservations
        : 0;
    const cpa = data.conversions > 0
        ? data.adCost / data.conversions
        : 0;
    const roi = (data.ltv && cpa && cpa > 0)
        ? (data.ltv - cpa) / cpa
        : 0;
    return {
        conversionRate,
        cpa,
        roi,
    };
}
// ==================== Create Ad ====================
exports.createAd = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = createAdSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        // Calculate metrics
        const metrics = calculateAdMetrics(data);
        const adData = {
            tenantId: data.tenantId,
            month: data.month,
            medium: data.medium,
            adCost: data.adCost,
            newReservations: data.newReservations,
            conversions: data.conversions,
            conversionRate: metrics.conversionRate,
            cpa: metrics.cpa,
            ltv: null, // Will be calculated by batch job
            roi: null, // Will be calculated by batch job after LTV is known
            notes: data.notes || "",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const adRef = await db
            .collection(`tenants/${data.tenantId}/ads`)
            .add(adData);
        return { success: true, adId: adRef.id };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to create ad");
    }
});
// ==================== Update Ad ====================
exports.updateAd = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, adId, ...updates } = updateAdSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const adRef = db.collection(`tenants/${tenantId}/ads`).doc(adId);
        // Get existing ad
        const adDoc = await adRef.get();
        if (!adDoc.exists) {
            throw new https_1.HttpsError("not-found", "Ad not found");
        }
        const existingAd = adDoc.data();
        // Build update data
        const updateData = {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        // Recalculate metrics if relevant fields changed
        if (updates.adCost !== undefined ||
            updates.newReservations !== undefined ||
            updates.conversions !== undefined) {
            const adCost = updates.adCost ?? existingAd?.adCost ?? 0;
            const newReservations = updates.newReservations ?? existingAd?.newReservations ?? 0;
            const conversions = updates.conversions ?? existingAd?.conversions ?? 0;
            const ltv = existingAd?.ltv;
            const metrics = calculateAdMetrics({
                adCost,
                newReservations,
                conversions,
                ltv,
            });
            updateData.conversionRate = metrics.conversionRate;
            updateData.cpa = metrics.cpa;
            if (ltv) {
                updateData.roi = metrics.roi;
            }
        }
        await adRef.update(updateData);
        return { success: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to update ad");
    }
});
// ==================== Delete Ad ====================
exports.deleteAd = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, adId } = deleteAdSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const adRef = db.collection(`tenants/${tenantId}/ads`).doc(adId);
        // Check if ad exists
        const adDoc = await adRef.get();
        if (!adDoc.exists) {
            throw new https_1.HttpsError("not-found", "Ad not found");
        }
        // Delete ad
        await adRef.delete();
        return { success: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to delete ad");
    }
});
// ==================== Get Ads ====================
exports.getAds = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, month, limit = 100, } = getAdsSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        let query = db
            .collection(`tenants/${tenantId}/ads`)
            .where("tenantId", "==", tenantId);
        // Apply filters
        if (month) {
            query = query.where("month", "==", month);
        }
        // Order by month descending, then medium
        query = query.orderBy("month", "desc").limit(limit);
        const snapshot = await query.get();
        const ads = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
            };
        });
        return {
            success: true,
            ads,
            total: ads.length,
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to get ads");
    }
});
//# sourceMappingURL=ads.js.map