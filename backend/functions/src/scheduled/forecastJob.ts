import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { addMonths, format } from "date-fns";

export const forecastJob = onSchedule(
  {
    schedule: "30 3 * * *", // Daily at 03:30 JST
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
  },
  async () => {
    console.log("Starting forecast calculation job");

    const db = admin.firestore();

    try {
      const tenantsSnap = await db.collection("tenants").where("status", "==", "active").get();

      for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;

        try {
          await calculateForecasts(tenantId);
        } catch (error) {
          console.error(`Error calculating forecasts for tenant ${tenantId}:`, error);
        }
      }

      console.log("Forecast calculation job completed");
    } catch (error) {
      console.error("Forecast job error:", error);
    }
  }
);

async function calculateForecasts(tenantId: string) {
  const db = admin.firestore();

  // Get last 3 months of metrics
  const metricsSnap = await db
    .collection(`tenants/${tenantId}/metrics`)
    .where("period", "==", "daily")
    .orderBy("date", "desc")
    .limit(90)
    .get();

  if (metricsSnap.empty) {
    console.log(`No metrics found for tenant ${tenantId}`);
    return;
  }

  const revenues: number[] = [];
  metricsSnap.forEach((doc) => {
    revenues.push(doc.data().revenue || 0);
  });

  // Simple moving average with trend
  const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  const recentAvg = revenues.slice(0, 30).reduce((a, b) => a + b, 0) / Math.min(30, revenues.length);
  const trend = recentAvg - avgRevenue;

  // Forecast for next 2 months
  const nextMonth = format(addMonths(new Date(), 1), "yyyy-MM");
  const monthAfter = format(addMonths(new Date(), 2), "yyyy-MM");

  const predictedRevenue1 = Math.max(0, (recentAvg + trend) * 30);
  const predictedRevenue2 = Math.max(0, (recentAvg + trend * 1.5) * 30);

  const confidence = 0.2; // 20% confidence interval

  await db.collection(`tenants/${tenantId}/forecasts`).add({
    tenantId,
    targetMonth: nextMonth,
    predictedRevenue: predictedRevenue1,
    confidenceLower: predictedRevenue1 * (1 - confidence),
    confidenceUpper: predictedRevenue1 * (1 + confidence),
    methodology: "Moving average with trend analysis",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection(`tenants/${tenantId}/forecasts`).add({
    tenantId,
    targetMonth: monthAfter,
    predictedRevenue: predictedRevenue2,
    confidenceLower: predictedRevenue2 * (1 - confidence),
    confidenceUpper: predictedRevenue2 * (1 + confidence),
    methodology: "Moving average with trend analysis",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Forecasts calculated for tenant ${tenantId}`);
}
