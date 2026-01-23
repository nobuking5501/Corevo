import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

const exportDataSchema = z.object({
  tenantId: z.string(),
  type: z.enum(["appointments", "revenue", "customers"]),
  startDate: z.string(),
  endDate: z.string(),
});

export const exportData = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, type, startDate, endDate } = exportDataSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const start = new Date(startDate);
      const end = new Date(endDate);

      let csvData = "";

      if (type === "appointments") {
        const appointmentsSnap = await db
          .collection(`tenants/${tenantId}/appointments`)
          .where("startAt", ">=", start)
          .where("startAt", "<=", end)
          .get();

        csvData = "Date,Customer,Staff,Service,Status\n";
        appointmentsSnap.forEach((doc) => {
          const data = doc.data();
          csvData += `${data.startAt.toDate()},${data.customerId},${data.staffId},${data.serviceId},${data.status}\n`;
        });
      }

      // In production, upload to Cloud Storage and return signed URL
      return {
        success: true,
        csv: csvData,
      };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to export data");
    }
  }
);
