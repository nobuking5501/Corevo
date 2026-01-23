import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  requireAuth,
  requireOrganizationAccess,
  addUserToTenantClaims,
  getUserCustomClaims,
  AuthenticatedContext,
} from "../utils/middleware";
import { z } from "zod";

const addUserToTenantSchema = z.object({
  tenantId: z.string(),
  userEmail: z.string().email(),
  role: z.enum(["owner", "manager", "staff", "accountant"]),
});

/**
 * Add an existing user to a tenant (店舗) with a specific role
 * 既存ユーザーを店舗に追加
 */
export const addUserToTenant = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);
    const context = request as AuthenticatedContext;

    const { tenantId, userEmail, role } = addUserToTenantSchema.parse(request.data);

    try {
      const db = admin.firestore();
      const auth = admin.auth();

      // Get tenant information
      const tenantDoc = await db.collection("tenants").doc(tenantId).get();
      if (!tenantDoc.exists) {
        throw new HttpsError("not-found", "Tenant not found");
      }

      const tenantData = tenantDoc.data();
      if (!tenantData) {
        throw new HttpsError("not-found", "Tenant data is empty");
      }

      const organizationId = tenantData.organizationId;

      // Check if requester has access to this organization
      await requireOrganizationAccess(context, organizationId);

      // Check if requester has permission (owner or manager of this tenant)
      const requestorRoles = context.auth.token.roles as Record<string, string> | undefined;
      const requestorRole = requestorRoles?.[tenantId];

      if (requestorRole !== "owner" && requestorRole !== "manager") {
        throw new HttpsError(
          "permission-denied",
          "Only owners and managers can add users to tenant"
        );
      }

      // Find user by email
      let targetUser;
      try {
        targetUser = await auth.getUserByEmail(userEmail);
      } catch (error) {
        throw new HttpsError("not-found", `User with email ${userEmail} not found`);
      }

      const targetUid = targetUser.uid;

      // Get target user's current claims
      const targetClaims = await getUserCustomClaims(targetUid);

      // Check if user belongs to the same organization
      if (targetClaims.organizationId && targetClaims.organizationId !== organizationId) {
        throw new HttpsError(
          "failed-precondition",
          "User belongs to a different organization"
        );
      }

      // Check if user is already in this tenant
      const existingTenantIds = targetClaims.tenantIds || [];
      if (existingTenantIds.includes(tenantId)) {
        throw new HttpsError("already-exists", "User is already a member of this tenant");
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
      await addUserToTenantClaims(targetUid, tenantId, role);

      // If user doesn't have an organizationId yet, set it
      if (!targetClaims.organizationId) {
        const updatedClaims = await getUserCustomClaims(targetUid);
        await auth.setCustomUserClaims(targetUid, {
          ...updatedClaims,
          organizationId,
        });
      }

      return {
        success: true,
        message: `User ${userEmail} added to tenant as ${role}`,
      };
    } catch (error: any) {
      console.error("Error adding user to tenant:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", error.message || "Failed to add user to tenant");
    }
  }
);
