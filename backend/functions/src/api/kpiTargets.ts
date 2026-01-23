import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

// ==================== Schemas ====================

const updateKPITargetsSchema = z.object({
  tenantId: z.string(),
  profitMarginTarget: z.number().min(0).max(1).optional(), // 0.0-1.0
  continuationRateTarget: z.number().min(0).max(1).optional(),
  nextReservationRateTarget: z.number().min(0).max(1).optional(),
  newCustomersMonthlyTarget: z.number().int().nonnegative().optional(),
  cpaMaxTarget: z.number().nonnegative().optional(),
  adCostRatioMaxTarget: z.number().min(0).max(1).optional(),
  laborCostRatioMaxTarget: z.number().min(0).max(1).optional(),
  expenseRatioMaxTarget: z.number().min(0).max(1).optional(),
  monthlyRevenueTarget: z.number().nonnegative().optional(),
  monthlyProfitTarget: z.number().nonnegative().optional(),
});

const getKPITargetsSchema = z.object({
  tenantId: z.string(),
});

// ==================== Default KPI Targets ====================

const DEFAULT_KPI_TARGETS = {
  profitMarginTarget: 0.20, // 20%
  continuationRateTarget: 0.85, // 85%
  nextReservationRateTarget: 0.80, // 80%
  newCustomersMonthlyTarget: 20,
  cpaMaxTarget: 15000,
  adCostRatioMaxTarget: 0.15, // 15%
  laborCostRatioMaxTarget: 0.30, // 30%
  expenseRatioMaxTarget: 0.60, // 60%
  monthlyRevenueTarget: null,
  monthlyProfitTarget: null,
};

// ==================== Update KPI Targets ====================

export const updateKPITargets = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, ...updates } = updateKPITargetsSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();

      // Use a fixed document ID "main" for KPI targets (one per tenant)
      const kpiTargetRef = db
        .collection(`tenants/${tenantId}/kpi_targets`)
        .doc("main");

      // Check if KPI targets document exists
      const kpiTargetDoc = await kpiTargetRef.get();

      if (kpiTargetDoc.exists) {
        // Update existing targets
        await kpiTargetRef.update({
          ...updates,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Create new targets with defaults
        await kpiTargetRef.set({
          id: "main",
          tenantId,
          ...DEFAULT_KPI_TARGETS,
          ...updates,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update KPI targets");
    }
  }
);

// ==================== Get KPI Targets ====================

export const getKPITargets = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId } = getKPITargetsSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const kpiTargetRef = db
        .collection(`tenants/${tenantId}/kpi_targets`)
        .doc("main");

      const kpiTargetDoc = await kpiTargetRef.get();

      if (kpiTargetDoc.exists) {
        const data = kpiTargetDoc.data();
        return {
          success: true,
          targets: {
            id: kpiTargetDoc.id,
            ...data,
            updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
          },
        };
      } else {
        // Return default targets if not set
        return {
          success: true,
          targets: {
            id: "main",
            tenantId,
            ...DEFAULT_KPI_TARGETS,
            updatedAt: null,
          },
        };
      }
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to get KPI targets");
    }
  }
);

// ==================== Initialize KPI Targets (Called on tenant creation) ====================

export const initializeKPITargets = async (tenantId: string) => {
  const db = admin.firestore();
  const kpiTargetRef = db
    .collection(`tenants/${tenantId}/kpi_targets`)
    .doc("main");

  await kpiTargetRef.set({
    id: "main",
    tenantId,
    ...DEFAULT_KPI_TARGETS,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};
