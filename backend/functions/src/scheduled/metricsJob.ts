import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { subDays, format } from "date-fns";

export const metricsJob = onSchedule(
  {
    schedule: "0 3 * * *", // Daily at 03:00 JST
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
  },
  async () => {
    console.log("Starting metrics calculation job");

    const db = admin.firestore();
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

    try {
      // Get all active tenants
      const tenantsSnap = await db.collection("tenants").where("status", "==", "active").get();

      for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;

        try {
          await calculateDailyMetrics(tenantId, yesterday);
        } catch (error) {
          console.error(`Error calculating metrics for tenant ${tenantId}:`, error);
        }
      }

      console.log("Metrics calculation job completed");
    } catch (error) {
      console.error("Metrics job error:", error);
    }
  }
);

async function calculateDailyMetrics(tenantId: string, date: string) {
  const db = admin.firestore();

  const startOfDay = new Date(`${date}T00:00:00`);
  const endOfDay = new Date(`${date}T23:59:59`);

  // Get appointments for the day
  const appointmentsSnap = await db
    .collection(`tenants/${tenantId}/appointments`)
    .where("startAt", ">=", startOfDay)
    .where("startAt", "<=", endOfDay)
    .get();

  let revenue = 0;
  let appointmentCount = 0;
  let noshowCount = 0;
  const byStaff: Record<string, { revenue: number; count: number }> = {};
  const byService: Record<string, { revenue: number; count: number }> = {};
  const customerIds = new Set<string>();

  for (const apptDoc of appointmentsSnap.docs) {
    const appt = apptDoc.data();
    appointmentCount++;
    customerIds.add(appt.customerId);

    if (appt.status === "noshow") {
      noshowCount++;
      continue;
    }

    // Get service for price
    const serviceDoc = await db.collection(`tenants/${tenantId}/services`).doc(appt.serviceId).get();
    const service = serviceDoc.data();
    const price = service?.price || 0;

    if (appt.status === "completed") {
      revenue += price;

      // By staff
      if (!byStaff[appt.staffId]) {
        byStaff[appt.staffId] = { revenue: 0, count: 0 };
      }
      byStaff[appt.staffId].revenue += price;
      byStaff[appt.staffId].count++;

      // By service
      if (!byService[appt.serviceId]) {
        byService[appt.serviceId] = { revenue: 0, count: 0 };
      }
      byService[appt.serviceId].revenue += price;
      byService[appt.serviceId].count++;
    }
  }

  const noshowRate = appointmentCount > 0 ? noshowCount / appointmentCount : 0;

  // Save metrics
  await db.collection(`tenants/${tenantId}/metrics`).add({
    tenantId,
    period: "daily",
    date,
    revenue,
    appointmentCount,
    customerCount: customerIds.size,
    noshowRate,
    byStaff,
    byService,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Metrics calculated for tenant ${tenantId}, date ${date}: revenue=${revenue}`);
}
