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
exports.createTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const createTenantSchema = zod_1.z.object({
    tenantName: zod_1.z.string().min(1),
    ownerEmail: zod_1.z.string().email(),
    ownerName: zod_1.z.string().min(1),
});
exports.createTenant = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantName, ownerEmail, ownerName } = createTenantSchema.parse(request.data);
    const uid = request.auth.uid;
    try {
        const db = admin.firestore();
        // Check if user already has a tenant
        const existingTenantIds = await (0, middleware_1.getUserTenantIds)(uid);
        if (existingTenantIds.length > 0) {
            throw new https_1.HttpsError("already-exists", "User already has a tenant");
        }
        // Create tenant
        const tenantRef = await db.collection("tenants").add({
            name: tenantName,
            plan: "trial",
            status: "active",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const tenantId = tenantRef.id;
        // Create owner user in tenant's users collection
        await db.collection(`tenants/${tenantId}/users`).doc(uid).set({
            tenantId,
            email: ownerEmail,
            displayName: ownerName,
            role: "owner",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Initialize settings
        await db.collection(`tenants/${tenantId}/settings`).doc("main").set({
            tenantId,
            businessHours: {
                monday: { open: "09:00", close: "18:00" },
                tuesday: { open: "09:00", close: "18:00" },
                wednesday: { open: "09:00", close: "18:00" },
                thursday: { open: "09:00", close: "18:00" },
                friday: { open: "09:00", close: "18:00" },
                saturday: { open: "09:00", close: "18:00" },
                sunday: null,
            },
            featureFlags: {
                aiAutoSuggest: false,
                lineIntegration: false,
                advancedAnalytics: false,
            },
            billingStatus: {
                plan: "trial",
                periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Set custom claims
        await (0, middleware_1.setCustomClaims)(uid, { tenantIds: [tenantId] });
        return {
            success: true,
            tenantId,
            message: "Tenant created successfully",
        };
    }
    catch (error) {
        console.error("Error creating tenant:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to create tenant");
    }
});
//# sourceMappingURL=createTenant.js.map