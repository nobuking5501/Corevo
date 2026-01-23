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
exports.createOrganization = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const createOrganizationSchema = zod_1.z.object({
    organizationName: zod_1.z.string().min(1),
    firstTenantName: zod_1.z.string().min(1),
    tenantAddress: zod_1.z.string().optional(),
    tenantPhone: zod_1.z.string().optional(),
    tenantStoreCode: zod_1.z.string().optional(),
    ownerEmail: zod_1.z.string().email(),
    ownerName: zod_1.z.string().min(1),
});
/**
 * Create Organization with first tenant (店舗)
 * 組織を作成し、最初の店舗とオーナーユーザーを設定
 */
exports.createOrganization = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { organizationName, firstTenantName, tenantAddress, tenantPhone, tenantStoreCode, ownerEmail, ownerName } = createOrganizationSchema.parse(request.data);
    const uid = request.auth.uid;
    try {
        const db = admin.firestore();
        // Generate slug for first tenant
        const slug = generateSlug(firstTenantName);
        // Check if slug is already taken
        const slugCheck = await db.collection("tenants").where("slug", "==", slug).limit(1).get();
        if (!slugCheck.empty) {
            throw new https_1.HttpsError("already-exists", `Slug "${slug}" is already taken. Please choose a different tenant name.`);
        }
        // 1. Create Organization
        const orgRef = await db.collection("organizations").add({
            name: organizationName,
            ownerId: uid,
            plan: "trial",
            status: "active",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const organizationId = orgRef.id;
        // 2. Create first Tenant (店舗) under organization
        const tenantRef = await db.collection(`organizations/${organizationId}/tenants`).add({
            organizationId,
            name: firstTenantName,
            slug,
            status: "active",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const tenantId = tenantRef.id;
        // 3. Create global tenant reference for slug lookup
        await db.collection("tenants").doc(tenantId).set({
            id: tenantId,
            organizationId,
            slug,
            name: firstTenantName,
            storeCode: tenantStoreCode || `STORE_${Date.now()}`,
            address: tenantAddress || "",
            phone: tenantPhone || "",
            status: "active",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 4. Create owner user in tenant's users collection
        await db.collection(`tenants/${tenantId}/users`).doc(uid).set({
            organizationId,
            tenantId,
            email: ownerEmail,
            displayName: ownerName,
            role: "owner",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 5. Initialize settings for tenant
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
        // 6. Set custom claims
        await (0, middleware_1.setCustomClaims)(uid, {
            organizationId,
            tenantIds: [tenantId],
            roles: {
                [tenantId]: "owner",
            },
        });
        return {
            success: true,
            organizationId,
            tenantId,
            slug,
            message: "Organization and first tenant created successfully",
        };
    }
    catch (error) {
        console.error("Error creating organization:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to create organization");
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
//# sourceMappingURL=createOrganization.js.map