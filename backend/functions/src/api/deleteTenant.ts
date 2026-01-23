import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, UserRole, getUserCustomClaims } from "../utils/middleware";
import { z } from "zod";

const deleteTenantSchema = z.object({
  tenantId: z.string().min(1),
});

/**
 * Delete Tenant
 * 店舗を削除（注意：すべての関連データも削除されます）
 */
export const deleteTenant = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId } = deleteTenantSchema.parse(request.data);

    try {
      const db = admin.firestore();
      const auth = admin.auth();

      // 1. Verify tenant exists
      const tenantDoc = await db.collection("tenants").doc(tenantId).get();
      if (!tenantDoc.exists) {
        throw new HttpsError("not-found", "Tenant not found");
      }

      const tenantData = tenantDoc.data();
      const organizationId = tenantData?.organizationId;

      // 2. Verify user has permission (only owner can delete)
      const userClaims = request.auth.token;
      const userRoles = (userClaims.roles as Record<string, UserRole>) || {};
      const userRole = userRoles[tenantId];

      if (userRole !== "owner") {
        throw new HttpsError(
          "permission-denied",
          "Only tenant owners can delete the tenant"
        );
      }

      // 3. Get all users who have access to this tenant
      const usersSnapshot = await db.collection(`tenants/${tenantId}/users`).get();
      const userIds = usersSnapshot.docs.map((doc) => doc.id);

      // 4. Update Custom Claims for all users (remove tenantId and role)
      for (const userId of userIds) {
        try {
          const claims = await getUserCustomClaims(userId);
          const tenantIds = (claims.tenantIds as string[]) || [];
          const roles = (claims.roles as Record<string, UserRole>) || {};

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
        } catch (error) {
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
        } catch (error) {
          console.error("Error deleting tenant from organization subcollection:", error);
        }
      }

      // 7. Delete global tenant reference
      await db.collection("tenants").doc(tenantId).delete();

      return {
        success: true,
        message: "Tenant deleted successfully",
      };
    } catch (error: any) {
      console.error("Error deleting tenant:", error);
      throw new HttpsError("internal", error.message || "Failed to delete tenant");
    }
  }
);
