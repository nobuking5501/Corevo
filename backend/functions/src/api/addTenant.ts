import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, setCustomClaims, UserRole } from "../utils/middleware";
import { z } from "zod";

const addTenantSchema = z.object({
  organizationId: z.string().min(1),
  tenantName: z.string().min(1),
  storeCode: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

/**
 * Add new Tenant to existing Organization
 * 既存の組織に新しい店舗を追加
 */
export const addTenant = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { organizationId, tenantName, storeCode, address, phone } =
      addTenantSchema.parse(request.data);
    const uid = request.auth.uid;

    try {
      const db = admin.firestore();

      // 1. Verify user has access to organization
      const orgDoc = await db.collection("organizations").doc(organizationId).get();
      if (!orgDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }

      // 2. Verify user is owner or manager
      const userClaims = request.auth.token;
      const userOrgId = userClaims.organizationId as string;
      if (userOrgId !== organizationId) {
        throw new HttpsError("permission-denied", "User does not have access to this organization");
      }

      // 3. Generate slug for tenant
      const slug = generateSlug(tenantName);

      // 4. Check if slug is already taken
      const slugCheck = await db.collection("tenants").where("slug", "==", slug).limit(1).get();
      if (!slugCheck.empty) {
        throw new HttpsError(
          "already-exists",
          `Slug "${slug}" is already taken. Please choose a different tenant name.`
        );
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
      const currentTenantIds = (userClaims.tenantIds as string[]) || [];
      const currentRoles = (userClaims.roles as Record<string, UserRole>) || {};

      const newTenantIds = [...currentTenantIds, tenantId];
      const newRoles: Record<string, UserRole> = { ...currentRoles, [tenantId]: "owner" as UserRole };

      await setCustomClaims(uid, {
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
    } catch (error: any) {
      console.error("Error adding tenant:", error);
      throw new HttpsError("internal", error.message || "Failed to add tenant");
    }
  }
);

/**
 * Generate URL-safe slug from tenant name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/[^\w\-]+/g, "") // remove non-word chars
    .replace(/\-\-+/g, "-") // replace multiple hyphens with single
    .replace(/^-+/, "") // trim hyphens from start
    .replace(/-+$/, ""); // trim hyphens from end
}
