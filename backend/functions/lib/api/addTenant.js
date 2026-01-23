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
exports.addTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const addTenantSchema = zod_1.z.object({
    organizationId: zod_1.z.string().min(1),
    tenantName: zod_1.z.string().min(1),
    storeCode: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
});
/**
 * Add new Tenant to existing Organization
 * 既存の組織に新しい店舗を追加
 */
exports.addTenant = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { organizationId, tenantName, storeCode, address, phone } = addTenantSchema.parse(request.data);
    const uid = request.auth.uid;
    try {
        const db = admin.firestore();
        // 1. Verify user has access to organization
        const orgDoc = await db.collection("organizations").doc(organizationId).get();
        if (!orgDoc.exists) {
            throw new https_1.HttpsError("not-found", "Organization not found");
        }
        // 2. Verify user is owner or manager
        const userClaims = request.auth.token;
        const userOrgId = userClaims.organizationId;
        if (userOrgId !== organizationId) {
            throw new https_1.HttpsError("permission-denied", "User does not have access to this organization");
        }
        // 3. Generate slug for tenant
        const slug = generateSlug(tenantName);
        // 4. Check if slug is already taken
        const slugCheck = await db.collection("tenants").where("slug", "==", slug).limit(1).get();
        if (!slugCheck.empty) {
            throw new https_1.HttpsError("already-exists", `Slug "${slug}" is already taken. Please choose a different tenant name.`);
        }
        // 5. Create Tenant under organization
        const tenantRef = await db.collection(`organizations/${organizationId}/tenants`).add({
            organizationId,
            name: tenantName,
            slug,
            storeCode: storeCode || `STORE_${Date.now()}`,
            address: address || "",
            phone: phone || "",
            status: "active",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const tenantId = tenantRef.id;
        // 6. Create global tenant reference for slug lookup
        await db.collection("tenants").doc(tenantId).set({
            id: tenantId,
            organizationId,
            slug,
            name: tenantName,
            storeCode: storeCode || `STORE_${Date.now()}`,
            address: address || "",
            phone: phone || "",
            status: "active",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 7. Add user to tenant's users collection with owner role
        await db.collection(`tenants/${tenantId}/users`).doc(uid).set({
            id: uid,
            organizationId,
            tenantId,
            email: request.auth.token.email || "",
            displayName: request.auth.token.name || "ユーザー",
            role: "owner",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 8. Initialize settings for tenant
        await db.collection(`tenants/${tenantId}/settings`).doc("main").set({
            id: "main",
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
        // 9. Update user's custom claims to include new tenant
        const currentTenantIds = userClaims.tenantIds || [];
        const currentRoles = userClaims.roles || {};
        const newTenantIds = [...currentTenantIds, tenantId];
        const newRoles = { ...currentRoles, [tenantId]: "owner" };
        await (0, middleware_1.setCustomClaims)(uid, {
            organizationId,
            tenantIds: newTenantIds,
            roles: newRoles,
        });
        return {
            success: true,
            tenantId,
            slug,
            message: "Tenant created successfully",
        };
    }
    catch (error) {
        console.error("Error adding tenant:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to add tenant");
    }
});
/**
 * Generate URL-safe slug from tenant name
 */
function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, "-") // spaces to hyphens
        .replace(/[^\w\-]+/g, "") // remove non-word chars
        .replace(/\-\-+/g, "-") // replace multiple hyphens with single
        .replace(/^-+/, "") // trim hyphens from start
        .replace(/-+$/, ""); // trim hyphens from end
}
//# sourceMappingURL=addTenant.js.map