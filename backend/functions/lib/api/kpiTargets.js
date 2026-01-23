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
exports.initializeKPITargets = exports.getKPITargets = exports.updateKPITargets = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
// ==================== Schemas ====================
const updateKPITargetsSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    profitMarginTarget: zod_1.z.number().min(0).max(1).optional(), // 0.0-1.0
    continuationRateTarget: zod_1.z.number().min(0).max(1).optional(),
    nextReservationRateTarget: zod_1.z.number().min(0).max(1).optional(),
    newCustomersMonthlyTarget: zod_1.z.number().int().nonnegative().optional(),
    cpaMaxTarget: zod_1.z.number().nonnegative().optional(),
    adCostRatioMaxTarget: zod_1.z.number().min(0).max(1).optional(),
    laborCostRatioMaxTarget: zod_1.z.number().min(0).max(1).optional(),
    expenseRatioMaxTarget: zod_1.z.number().min(0).max(1).optional(),
    monthlyRevenueTarget: zod_1.z.number().nonnegative().optional(),
    monthlyProfitTarget: zod_1.z.number().nonnegative().optional(),
});
const getKPITargetsSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
});
// ==================== Default KPI Targets ====================
const DEFAULT_KPI_TARGETS = {
    profitMarginTarget: 0.20, // 20%
    continuationRateTarget: 0.85, // 85%
    nextReservationRateTarget: 0.80, // 80%
    newCustomersMonthlyTarget: 20,
    cpaMaxTarget: 15000,
    adCostRatioMaxTarget: 0.15, // 15%
    laborCostRatioMaxTarget: 0.30, // 30%
    expenseRatioMaxTarget: 0.60, // 60%
    monthlyRevenueTarget: null,
    monthlyProfitTarget: null,
};
// ==================== Update KPI Targets ====================
exports.updateKPITargets = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, ...updates } = updateKPITargetsSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        // Use a fixed document ID "main" for KPI targets (one per tenant)
        const kpiTargetRef = db
            .collection(`tenants/${tenantId}/kpi_targets`)
            .doc("main");
        // Check if KPI targets document exists
        const kpiTargetDoc = await kpiTargetRef.get();
        if (kpiTargetDoc.exists) {
            // Update existing targets
            await kpiTargetRef.update({
                ...updates,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            // Create new targets with defaults
            await kpiTargetRef.set({
                id: "main",
                tenantId,
                ...DEFAULT_KPI_TARGETS,
                ...updates,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to update KPI targets");
    }
});
// ==================== Get KPI Targets ====================
exports.getKPITargets = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId } = getKPITargetsSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const kpiTargetRef = db
            .collection(`tenants/${tenantId}/kpi_targets`)
            .doc("main");
        const kpiTargetDoc = await kpiTargetRef.get();
        if (kpiTargetDoc.exists) {
            const data = kpiTargetDoc.data();
            return {
                success: true,
                targets: {
                    id: kpiTargetDoc.id,
                    ...data,
                    updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
                },
            };
        }
        else {
            // Return default targets if not set
            return {
                success: true,
                targets: {
                    id: "main",
                    tenantId,
                    ...DEFAULT_KPI_TARGETS,
                    updatedAt: null,
                },
            };
        }
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to get KPI targets");
    }
});
// ==================== Initialize KPI Targets (Called on tenant creation) ====================
const initializeKPITargets = async (tenantId) => {
    const db = admin.firestore();
    const kpiTargetRef = db
        .collection(`tenants/${tenantId}/kpi_targets`)
        .doc("main");
    await kpiTargetRef.set({
        id: "main",
        tenantId,
        ...DEFAULT_KPI_TARGETS,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};
exports.initializeKPITargets = initializeKPITargets;
//# sourceMappingURL=kpiTargets.js.map