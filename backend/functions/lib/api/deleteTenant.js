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
exports.deleteTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const deleteTenantSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
});
/**
 * Delete Tenant
 * 店舗を削除（注意：すべての関連データも削除されます）
 */
exports.deleteTenant = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId } = deleteTenantSchema.parse(request.data);
    try {
        const db = admin.firestore();
        const auth = admin.auth();
        // 1. Verify tenant exists
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        if (!tenantDoc.exists) {
            throw new https_1.HttpsError("not-found", "Tenant not found");
        }
        const tenantData = tenantDoc.data();
        const organizationId = tenantData?.organizationId;
        // 2. Verify user has permission (only owner can delete)
        const userClaims = request.auth.token;
        const userRoles = userClaims.roles || {};
        const userRole = userRoles[tenantId];
        if (userRole !== "owner") {
            throw new https_1.HttpsError("permission-denied", "Only tenant owners can delete the tenant");
        }
        // 3. Get all users who have access to this tenant
        const usersSnapshot = await db.collection(`tenants/${tenantId}/users`).get();
        const userIds = usersSnapshot.docs.map((doc) => doc.id);
        // 4. Update Custom Claims for all users (remove tenantId and role)
        for (const userId of userIds) {
            try {
                const claims = await (0, middleware_1.getUserCustomClaims)(userId);
                const tenantIds = claims.tenantIds || [];
                const roles = claims.roles || {};
                // Remove this tenant from tenantIds
                const newTenantIds = tenantIds.filter((id) => id !== tenantId);
                // Remove this tenant from roles
                const newRoles = { ...roles };
                delete newRoles[tenantId];
                await auth.setCustomUserClaims(userId, {
                    organizationId: claims.organizationId,
                    tenantIds: newTenantIds,
                    roles: newRoles,
                });
            }
            catch (error) {
                console.error(`Error updating claims for user ${userId}:`, error);
                // Continue with other users even if one fails
            }
        }
        // 5. Delete tenant subcollections (users, settings, services, etc.)
        const subcollections = ["users", "settings", "services", "appointments", "customers"];
        for (const collectionName of subcollections) {
            const snapshot = await db.collection(`tenants/${tenantId}/${collectionName}`).get();
            const batch = db.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            if (!snapshot.empty) {
                await batch.commit();
            }
        }
        // 6. Delete tenant from organization's subcollection
        if (organizationId) {
            try {
                await db.collection(`organizations/${organizationId}/tenants`).doc(tenantId).delete();
            }
            catch (error) {
                console.error("Error deleting tenant from organization subcollection:", error);
            }
        }
        // 7. Delete global tenant reference
        await db.collection("tenants").doc(tenantId).delete();
        return {
            success: true,
            message: "Tenant deleted successfully",
        };
    }
    catch (error) {
        console.error("Error deleting tenant:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to delete tenant");
    }
});
//# sourceMappingURL=deleteTenant.js.map