import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

const createChartSchema = z.object({
  tenantId: z.string(),
  customerId: z.string(),
  appointmentId: z.string(),
  staffId: z.string(),
  notes: z.string(),
  cautions: z.string().optional(),
  effectPeriodDays: z.number().optional(),
  photos: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const createChart = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const data = createChartSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();
      const chartRef = await db.collection(`tenants/${data.tenantId}/charts`).add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, chartId: chartRef.id };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to create chart");
    }
  }
);

const getChartsSchema = z.object({
  tenantId: z.string(),
  customerId: z.string().optional(),
  limit: z.number().optional().default(50),
});

export const getCharts = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, customerId, limit } = getChartsSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      let query: admin.firestore.Query = db
        .collection(`tenants/${tenantId}/charts`)
        .orderBy("createdAt", "desc")
        .limit(limit);

      // Filter by customer if specified
      if (customerId) {
        query = query.where("customerId", "==", customerId);
      }

      const snapshot = await query.get();
      const charts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate().toISOString(),
      }));

      return { success: true, charts };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to get charts");
    }
  }
);

const getChartSchema = z.object({
  tenantId: z.string(),
  chartId: z.string(),
});

export const getChart = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, chartId } = getChartSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const doc = await db
        .collection(`tenants/${tenantId}/charts`)
        .doc(chartId)
        .get();

      if (!doc.exists) {
        throw new HttpsError("not-found", "Chart not found");
      }

      const chart = {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data()?.createdAt?.toDate().toISOString(),
        updatedAt: doc.data()?.updatedAt?.toDate().toISOString(),
      };

      return { success: true, chart };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to get chart");
    }
  }
);

const updateChartSchema = z.object({
  tenantId: z.string(),
  chartId: z.string(),
  updates: z.object({
    notes: z.string().optional(),
    cautions: z.string().optional(),
    effectPeriodDays: z.number().optional(),
    photos: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const updateChart = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, chartId, updates } = updateChartSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const updateData: any = {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db
        .collection(`tenants/${tenantId}/charts`)
        .doc(chartId)
        .update(updateData);

      return { success: true };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to update chart");
    }
  }
);

const deleteChartSchema = z.object({
  tenantId: z.string(),
  chartId: z.string(),
});

export const deleteChart = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, chartId } = deleteChartSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();

      // Check if chart exists
      const chartDoc = await db
        .collection(`tenants/${tenantId}/charts`)
        .doc(chartId)
        .get();

      if (!chartDoc.exists) {
        throw new HttpsError("not-found", "Chart not found");
      }

      // Delete the chart document
      await db
        .collection(`tenants/${tenantId}/charts`)
        .doc(chartId)
        .delete();

      // TODO: Delete associated photos from Cloud Storage
      // This will be implemented when storage functionality is added

      return { success: true };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to delete chart");
    }
  }
);
