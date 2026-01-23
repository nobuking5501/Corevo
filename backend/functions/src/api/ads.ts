import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

// ==================== Schemas ====================

const createAdSchema = z.object({
  tenantId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  medium: z.string().min(1),
  adCost: z.number().nonnegative(),
  newReservations: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

const updateAdSchema = z.object({
  tenantId: z.string(),
  adId: z.string(),
  medium: z.string().min(1).optional(),
  adCost: z.number().nonnegative().optional(),
  newReservations: z.number().int().nonnegative().optional(),
  conversions: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

const deleteAdSchema = z.object({
  tenantId: z.string(),
  adId: z.string(),
});

const getAdsSchema = z.object({
  tenantId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
  limit: z.number().int().positive().max(1000).optional(),
});

// ==================== Helper Functions ====================

function calculateAdMetrics(data: {
  adCost: number;
  newReservations: number;
  conversions: number;
  ltv?: number;
}) {
  const conversionRate = data.newReservations > 0
    ? data.conversions / data.newReservations
    : 0;

  const cpa = data.conversions > 0
    ? data.adCost / data.conversions
    : 0;

  const roi = (data.ltv && cpa && cpa > 0)
    ? (data.ltv - cpa) / cpa
    : 0;

  return {
    conversionRate,
    cpa,
    roi,
  };
}

// ==================== Create Ad ====================

export const createAd = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const data = createAdSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();

      // Calculate metrics
      const metrics = calculateAdMetrics(data);

      const adData = {
        tenantId: data.tenantId,
        month: data.month,
        medium: data.medium,
        adCost: data.adCost,
        newReservations: data.newReservations,
        conversions: data.conversions,
        conversionRate: metrics.conversionRate,
        cpa: metrics.cpa,
        ltv: null, // Will be calculated by batch job
        roi: null, // Will be calculated by batch job after LTV is known
        notes: data.notes || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const adRef = await db
        .collection(`tenants/${data.tenantId}/ads`)
        .add(adData);

      return { success: true, adId: adRef.id };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create ad");
    }
  }
);

// ==================== Update Ad ====================

export const updateAd = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, adId, ...updates } = updateAdSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const adRef = db.collection(`tenants/${tenantId}/ads`).doc(adId);

      // Get existing ad
      const adDoc = await adRef.get();
      if (!adDoc.exists) {
        throw new HttpsError("not-found", "Ad not found");
      }

      const existingAd = adDoc.data();

      // Build update data
      const updateData: any = {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Recalculate metrics if relevant fields changed
      if (
        updates.adCost !== undefined ||
        updates.newReservations !== undefined ||
        updates.conversions !== undefined
      ) {
        const adCost = updates.adCost ?? existingAd?.adCost ?? 0;
        const newReservations = updates.newReservations ?? existingAd?.newReservations ?? 0;
        const conversions = updates.conversions ?? existingAd?.conversions ?? 0;
        const ltv = existingAd?.ltv;

        const metrics = calculateAdMetrics({
          adCost,
          newReservations,
          conversions,
          ltv,
        });

        updateData.conversionRate = metrics.conversionRate;
        updateData.cpa = metrics.cpa;
        if (ltv) {
          updateData.roi = metrics.roi;
        }
      }

      await adRef.update(updateData);

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update ad");
    }
  }
);

// ==================== Delete Ad ====================

export const deleteAd = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, adId } = deleteAdSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const adRef = db.collection(`tenants/${tenantId}/ads`).doc(adId);

      // Check if ad exists
      const adDoc = await adRef.get();
      if (!adDoc.exists) {
        throw new HttpsError("not-found", "Ad not found");
      }

      // Delete ad
      await adRef.delete();

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete ad");
    }
  }
);

// ==================== Get Ads ====================

export const getAds = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const {
      tenantId,
      month,
      limit = 100,
    } = getAdsSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      let query: admin.firestore.Query = db
        .collection(`tenants/${tenantId}/ads`)
        .where("tenantId", "==", tenantId);

      // Apply filters
      if (month) {
        query = query.where("month", "==", month);
      }

      // Order by month descending, then medium
      query = query.orderBy("month", "desc").limit(limit);

      const snapshot = await query.get();

      const ads = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        };
      });

      return {
        success: true,
        ads,
        total: ads.length,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to get ads");
    }
  }
);
