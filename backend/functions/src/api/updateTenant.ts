import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, UserRole } from "../utils/middleware";
import { z } from "zod";

const updateTenantSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).optional(),
  storeCode: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

/**
 * Update Tenant information
 * 店舗情報を更新
 */
export const updateTenant = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, name, storeCode, address, phone, status } = updateTenantSchema.parse(request.data);

    try {
      const db = admin.firestore();

      // 1. Verify tenant exists
      const tenantDoc = await db.collection("tenants").doc(tenantId).get();
      if (!tenantDoc.exists) {
        throw new HttpsError("not-found", "Tenant not found");
      }

      const tenantData = tenantDoc.data();
      const organizationId = tenantData?.organizationId;

      // 2. Verify user has permission (owner or manager role)
      const userClaims = request.auth.token;
      const userRoles = (userClaims.roles as Record<string, UserRole>) || {};
      const userRole = userRoles[tenantId];

      if (userRole !== "owner" && userRole !== "manager") {
        throw new HttpsError(
          "permission-denied",
          "Only owners and managers can update tenant information"
        );
      }

      // 3. Build update object (only include provided fields)
      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (name !== undefined) updateData.name = name;
      if (storeCode !== undefined) updateData.storeCode = storeCode;
      if (address !== undefined) updateData.address = address;
      if (phone !== undefined) updateData.phone = phone;
      if (status !== undefined) updateData.status = status;

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
    } catch (error: any) {
      console.error("Error updating tenant:", error);
      throw new HttpsError("internal", error.message || "Failed to update tenant");
    }
  }
);
