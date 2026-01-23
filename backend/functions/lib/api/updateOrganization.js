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
exports.updateOrganization = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const updateOrganizationSchema = zod_1.z.object({
    organizationId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).optional(),
    plan: zod_1.z.enum(["free", "trial", "pro", "enterprise"]).optional(),
    status: zod_1.z.enum(["active", "inactive", "suspended"]).optional(),
});
/**
 * Update Organization information
 * 組織情報を更新
 */
exports.updateOrganization = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { organizationId, name, plan, status } = updateOrganizationSchema.parse(request.data);
    const uid = request.auth.uid;
    try {
        const db = admin.firestore();
        // 1. Verify organization exists
        const orgDoc = await db.collection("organizations").doc(organizationId).get();
        if (!orgDoc.exists) {
            throw new https_1.HttpsError("not-found", "Organization not found");
        }
        // 2. Verify user is the owner
        const orgData = orgDoc.data();
        if (orgData?.ownerId !== uid) {
            throw new https_1.HttpsError("permission-denied", "Only organization owner can update organization");
        }
        // 3. Build update object (only include provided fields)
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (name !== undefined)
            updateData.name = name;
        if (plan !== undefined)
            updateData.plan = plan;
        if (status !== undefined)
            updateData.status = status;
        // 4. Update organization
        await db.collection("organizations").doc(organizationId).update(updateData);
        return {
            success: true,
            message: "Organization updated successfully",
        };
    }
    catch (error) {
        console.error("Error updating organization:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to update organization");
    }
});
//# sourceMappingURL=updateOrganization.js.map