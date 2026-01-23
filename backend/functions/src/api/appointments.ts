import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

const createAppointmentSchema = z.object({
  tenantId: z.string(),
  customerId: z.string(),
  staffId: z.string(),
  serviceId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  notes: z.string().optional(),
});

export const createAppointment = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const data = createAppointmentSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();
      const appointmentRef = await db.collection(`tenants/${data.tenantId}/appointments`).add({
        ...data,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        status: "scheduled",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, appointmentId: appointmentRef.id };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to create appointment");
    }
  }
);

const updateAppointmentSchema = z.object({
  tenantId: z.string(),
  appointmentId: z.string(),
  updates: z.object({
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["scheduled", "confirmed", "completed", "canceled", "noshow"]).optional(),
  }),
});

export const updateAppointment = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, appointmentId, updates } = updateAppointmentSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const updateData: any = { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

      if (updates.startAt) updateData.startAt = new Date(updates.startAt);
      if (updates.endAt) updateData.endAt = new Date(updates.endAt);

      await db.collection(`tenants/${tenantId}/appointments`).doc(appointmentId).update(updateData);

      return { success: true };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to update appointment");
    }
  }
);

const cancelAppointmentSchema = z.object({
  tenantId: z.string(),
  appointmentId: z.string(),
});

export const cancelAppointment = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, appointmentId } = cancelAppointmentSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      await db.collection(`tenants/${tenantId}/appointments`).doc(appointmentId).update({
        status: "canceled",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to cancel appointment");
    }
  }
);
