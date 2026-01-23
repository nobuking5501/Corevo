import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth } from "../utils/middleware";
import { z } from "zod";

const updateOrganizationSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).optional(),
  plan: z.enum(["free", "trial", "pro", "enterprise"]).optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

/**
 * Update Organization information
 * 組織情報を更新
 */
export const updateOrganization = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { organizationId, name, plan, status } = updateOrganizationSchema.parse(request.data);
    const uid = request.auth.uid;

    try {
      const db = admin.firestore();

      // 1. Verify organization exists
      const orgDoc = await db.collection("organizations").doc(organizationId).get();
      if (!orgDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }

      // 2. Verify user is the owner
      const orgData = orgDoc.data();
      if (orgData?.ownerId !== uid) {
        throw new HttpsError("permission-denied", "Only organization owner can update organization");
      }

      // 3. Build update object (only include provided fields)
      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (name !== undefined) updateData.name = name;
      if (plan !== undefined) updateData.plan = plan;
      if (status !== undefined) updateData.status = status;

      // 4. Update organization
      await db.collection("organizations").doc(organizationId).update(updateData);

      return {
        success: true,
        message: "Organization updated successfully",
      };
    } catch (error: any) {
      console.error("Error updating organization:", error);
      throw new HttpsError("internal", error.message || "Failed to update organization");
    }
  }
);
