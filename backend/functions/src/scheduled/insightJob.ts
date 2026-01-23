import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

export const insightJob = onSchedule(
  {
    schedule: "45 3 * * *", // Daily at 03:45 JST
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
  },
  async () => {
    console.log("Starting insight generation job");

    const db = admin.firestore();

    try {
      const tenantsSnap = await db.collection("tenants").where("status", "==", "active").get();

      for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;

        try {
          await generateInsights(tenantId);
        } catch (error) {
          console.error(`Error generating insights for tenant ${tenantId}:`, error);
        }
      }

      console.log("Insight generation job completed");
    } catch (error) {
      console.error("Insight job error:", error);
    }
  }
);

async function generateInsights(tenantId: string) {
  const db = admin.firestore();

  // Clear old insights (keep last 30 days)
  const oldInsightsSnap = await db
    .collection(`tenants/${tenantId}/insights`)
    .where("createdAt", "<", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .get();

  const batch = db.batch();
  oldInsightsSnap.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // Get recent metrics
  const metricsSnap = await db
    .collection(`tenants/${tenantId}/metrics`)
    .where("period", "==", "daily")
    .orderBy("date", "desc")
    .limit(7)
    .get();

  if (metricsSnap.empty) return;

  const metrics = metricsSnap.docs.map((doc) => doc.data());
  const avgNoshowRate = metrics.reduce((sum, m) => sum + (m.noshowRate || 0), 0) / metrics.length;

  // Alert: High no-show rate
  if (avgNoshowRate > 0.1) {
    await db.collection(`tenants/${tenantId}/insights`).add({
      tenantId,
      type: "alert",
      title: "No-show率が高くなっています",
      description: `直近7日間の平均No-show率が${(avgNoshowRate * 100).toFixed(1)}%です。`,
      actionable: "前日リマインダーの強化や予約確認の徹底をご検討ください。",
      priority: 9,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Opportunity: Peak day analysis
  const revenueByDay: Record<string, number> = {};
  metrics.forEach((m) => {
    revenueByDay[m.date] = m.revenue;
  });

  const sortedDays = Object.entries(revenueByDay).sort((a, b) => b[1] - a[1]);
  if (sortedDays.length > 0) {
    await db.collection(`tenants/${tenantId}/insights`).add({
      tenantId,
      type: "opportunity",
      title: "売上ピーク日を活用しましょう",
      description: `最も売上が高かった日は¥${sortedDays[0][1].toLocaleString()}でした。`,
      actionable: "人気の曜日や時間帯を分析し、スタッフ配置を最適化できます。",
      priority: 7,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Shortage: Low customer count
  const avgCustomerCount = metrics.reduce((sum, m) => sum + (m.customerCount || 0), 0) / metrics.length;
  if (avgCustomerCount < 5) {
    await db.collection(`tenants/${tenantId}/insights`).add({
      tenantId,
      type: "shortage",
      title: "新規顧客の獲得を強化しましょう",
      description: `1日あたりの平均顧客数が${avgCustomerCount.toFixed(1)}人です。`,
      actionable: "AI提案機能を活用して既存顧客へのアプローチを増やしましょう。",
      priority: 8,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log(`Insights generated for tenant ${tenantId}`);
}
