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
exports.addUserToTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const addUserToTenantSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    userEmail: zod_1.z.string().email(),
    role: zod_1.z.enum(["owner", "manager", "staff", "accountant"]),
});
/**
 * Add an existing user to a tenant (店舗) with a specific role
 * 既存ユーザーを店舗に追加
 */
exports.addUserToTenant = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const context = request;
    const { tenantId, userEmail, role } = addUserToTenantSchema.parse(request.data);
    try {
        const db = admin.firestore();
        const auth = admin.auth();
        // Get tenant information
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        if (!tenantDoc.exists) {
            throw new https_1.HttpsError("not-found", "Tenant not found");
        }
        const tenantData = tenantDoc.data();
        if (!tenantData) {
            throw new https_1.HttpsError("not-found", "Tenant data is empty");
        }
        const organizationId = tenantData.organizationId;
        // Check if requester has access to this organization
        await (0, middleware_1.requireOrganizationAccess)(context, organizationId);
        // Check if requester has permission (owner or manager of this tenant)
        const requestorRoles = context.auth.token.roles;
        const requestorRole = requestorRoles?.[tenantId];
        if (requestorRole !== "owner" && requestorRole !== "manager") {
            throw new https_1.HttpsError("permission-denied", "Only owners and managers can add users to tenant");
        }
        // Find user by email
        let targetUser;
        try {
            targetUser = await auth.getUserByEmail(userEmail);
        }
        catch (error) {
            throw new https_1.HttpsError("not-found", `User with email ${userEmail} not found`);
        }
        const targetUid = targetUser.uid;
        // Get target user's current claims
        const targetClaims = await (0, middleware_1.getUserCustomClaims)(targetUid);
        // Check if user belongs to the same organization
        if (targetClaims.organizationId && targetClaims.organizationId !== organizationId) {
            throw new https_1.HttpsError("failed-precondition", "User belongs to a different organization");
        }
        // Check if user is already in this tenant
        const existingTenantIds = targetClaims.tenantIds || [];
        if (existingTenantIds.includes(tenantId)) {
            throw new https_1.HttpsError("already-exists", "User is already a member of this tenant");
        }
        // Add user to tenant's users collection
        await db.collection(`tenants/${tenantId}/users`).doc(targetUid).set({
            organizationId,
            tenantId,
            email: userEmail,
            displayName: targetUser.displayName || userEmail.split("@")[0],
            role,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Update user's custom claims
        await (0, middleware_1.addUserToTenantClaims)(targetUid, tenantId, role);
        // If user doesn't have an organizationId yet, set it
        if (!targetClaims.organizationId) {
            const updatedClaims = await (0, middleware_1.getUserCustomClaims)(targetUid);
            await auth.setCustomUserClaims(targetUid, {
                ...updatedClaims,
                organizationId,
            });
        }
        return {
            success: true,
            message: `User ${userEmail} added to tenant as ${role}`,
        };
    }
    catch (error) {
        console.error("Error adding user to tenant:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", error.message || "Failed to add user to tenant");
    }
});
//# sourceMappingURL=addUserToTenant.js.map