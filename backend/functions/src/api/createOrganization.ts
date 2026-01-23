import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, setCustomClaims } from "../utils/middleware";
import { z } from "zod";

const createOrganizationSchema = z.object({
  organizationName: z.string().min(1),
  firstTenantName: z.string().min(1),
  tenantAddress: z.string().optional(),
  tenantPhone: z.string().optional(),
  tenantStoreCode: z.string().optional(),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1),
});

/**
 * Create Organization with first tenant (店舗)
 * 組織を作成し、最初の店舗とオーナーユーザーを設定
 */
export const createOrganization = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { organizationName, firstTenantName, tenantAddress, tenantPhone, tenantStoreCode, ownerEmail, ownerName } =
      createOrganizationSchema.parse(request.data);
    const uid = request.auth.uid;

    try {
      const db = admin.firestore();

      // Generate slug for first tenant
      const slug = generateSlug(firstTenantName);

      // Check if slug is already taken
      const slugCheck = await db.collection("tenants").where("slug", "==", slug).limit(1).get();
      if (!slugCheck.empty) {
        throw new HttpsError(
          "already-exists",
          `Slug "${slug}" is already taken. Please choose a different tenant name.`
        );
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
      await setCustomClaims(uid, {
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
    } catch (error: any) {
      console.error("Error creating organization:", error);
      throw new HttpsError("internal", error.message || "Failed to create organization");
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
