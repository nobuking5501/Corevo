import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

// ==================== Schemas ====================

const createActionItemSchema = z.object({
  tenantId: z.string(),
  title: z.string().min(1),
  category: z.enum(["sales", "cost", "customer", "staff", "other"]),
  problem: z.string().min(1),
  action: z.string().min(1),
  dueDate: z.string().optional(), // ISO date string
  priority: z.number().int().min(1).max(10),
  assignedTo: z.string().optional(),
});

const updateActionItemSchema = z.object({
  tenantId: z.string(),
  actionId: z.string(),
  title: z.string().min(1).optional(),
  category: z.enum(["sales", "cost", "customer", "staff", "other"]).optional(),
  problem: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  dueDate: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "canceled"]).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  assignedTo: z.string().optional(),
  measuredAt: z.string().optional(),
  effectDescription: z.string().optional(),
  effectValue: z.number().optional(),
});

const deleteActionItemSchema = z.object({
  tenantId: z.string(),
  actionId: z.string(),
});

const getActionItemsSchema = z.object({
  tenantId: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "canceled"]).optional(),
  category: z.enum(["sales", "cost", "customer", "staff", "other"]).optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

// ==================== Create Action Item ====================

export const createActionItem = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const data = createActionItemSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();

      const actionItemData = {
        tenantId: data.tenantId,
        title: data.title,
        category: data.category,
        problem: data.problem,
        action: data.action,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: "pending" as const,
        priority: data.priority,
        assignedTo: data.assignedTo || null,
        measuredAt: null,
        effectDescription: null,
        effectValue: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const actionRef = await db
        .collection(`tenants/${data.tenantId}/action_items`)
        .add(actionItemData);

      return { success: true, actionId: actionRef.id };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create action item");
    }
  }
);

// ==================== Update Action Item ====================

export const updateActionItem = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, actionId, ...updates } = updateActionItemSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const actionRef = db.collection(`tenants/${tenantId}/action_items`).doc(actionId);

      // Check if action item exists
      const actionDoc = await actionRef.get();
      if (!actionDoc.exists) {
        throw new HttpsError("not-found", "Action item not found");
      }

      // Build update data
      const updateData: any = {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Convert date strings to Date objects
      if (updates.dueDate) {
        updateData.dueDate = new Date(updates.dueDate);
      }

      if (updates.measuredAt) {
        updateData.measuredAt = new Date(updates.measuredAt);
      }

      await actionRef.update(updateData);

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update action item");
    }
  }
);

// ==================== Delete Action Item ====================

export const deleteActionItem = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, actionId } = deleteActionItemSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const actionRef = db.collection(`tenants/${tenantId}/action_items`).doc(actionId);

      // Check if action item exists
      const actionDoc = await actionRef.get();
      if (!actionDoc.exists) {
        throw new HttpsError("not-found", "Action item not found");
      }

      // Delete action item
      await actionRef.delete();

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete action item");
    }
  }
);

// ==================== Get Action Items ====================

export const getActionItems = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const {
      tenantId,
      status,
      category,
      limit = 100,
    } = getActionItemsSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      let query: admin.firestore.Query = db
        .collection(`tenants/${tenantId}/action_items`)
        .where("tenantId", "==", tenantId);

      // Apply filters
      if (status) {
        query = query.where("status", "==", status);
      }

      if (category) {
        query = query.where("category", "==", category);
      }

      // Order by priority descending, then by dueDate
      query = query.orderBy("priority", "desc").limit(limit);

      const snapshot = await query.get();

      const actionItems = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate?.toDate?.()?.toISOString() || null,
          measuredAt: data.measuredAt?.toDate?.()?.toISOString() || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        };
      });

      return {
        success: true,
        actionItems,
        total: actionItems.length,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to get action items");
    }
  }
);
