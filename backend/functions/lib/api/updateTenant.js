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
exports.updateTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const updateTenantSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).optional(),
    storeCode: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    status: zod_1.z.enum(["active", "inactive", "suspended"]).optional(),
});
/**
 * Update Tenant information
 * 店舗情報を更新
 */
exports.updateTenant = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, name, storeCode, address, phone, status } = updateTenantSchema.parse(request.data);
    try {
        const db = admin.firestore();
        // 1. Verify tenant exists
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        if (!tenantDoc.exists) {
            throw new https_1.HttpsError("not-found", "Tenant not found");
        }
        const tenantData = tenantDoc.data();
        const organizationId = tenantData?.organizationId;
        // 2. Verify user has permission (owner or manager role)
        const userClaims = request.auth.token;
        const userRoles = userClaims.roles || {};
        const userRole = userRoles[tenantId];
        if (userRole !== "owner" && userRole !== "manager") {
            throw new https_1.HttpsError("permission-denied", "Only owners and managers can update tenant information");
        }
        // 3. Build update object (only include provided fields)
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (name !== undefined)
            updateData.name = name;
        if (storeCode !== undefined)
            updateData.storeCode = storeCode;
        if (address !== undefined)
            updateData.address = address;
        if (phone !== undefined)
            updateData.phone = phone;
        if (status !== undefined)
            updateData.status = status;
        // 4. Update global tenant reference
        await db.collection("tenants").doc(tenantId).update(updateData);
        // 5. Update tenant in organization's subcollection
        if (organizationId) {
            const orgTenantSnapshot = await db
                .collection(`organizations/${organizationId}/tenants`)
                .where("__name__", "==", tenantId)
                .limit(1)
                .get();
            if (!orgTenantSnapshot.empty) {
                await db
                    .collection(`organizations/${organizationId}/tenants`)
                    .doc(tenantId)
                    .update(updateData);
            }
        }
        return {
            success: true,
            message: "Tenant updated successfully",
        };
    }
    catch (error) {
        console.error("Error updating tenant:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to update tenant");
    }
});
//# sourceMappingURL=updateTenant.js.map