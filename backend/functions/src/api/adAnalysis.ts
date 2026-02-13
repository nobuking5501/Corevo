import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { format, parseISO } from "date-fns";

// ==================== Schema ====================

const getAdAnalysisSchema = z.object({
  tenantId: z.string(),
  startMonth: z.string(), // YYYY-MM
  endMonth: z.string(), // YYYY-MM
});

// ==================== Ad Performance Analysis ====================

export const getAdAnalysis = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);
    const data = getAdAnalysisSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();

      // Generate list of months
      const months: string[] = [];
      let currentDate = parseISO(`${data.startMonth}-01`);
      const endDate = parseISO(`${data.endMonth}-01`);

      while (currentDate <= endDate) {
        months.push(format(currentDate, "yyyy-MM"));
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      }

      // Fetch ads for all months
      const adsSnapshot = await db
        .collection(`tenants/${data.tenantId}/ads`)
        .where("tenantId", "==", data.tenantId)
        .where("month", "in", months.slice(0, 10))
        .get();

      // Group by medium and month
      const byMedium: Record<string, {
        totalAdCost: number;
        totalConversions: number;
        averageCPA: number;
        averageROI: number;
        monthlyData: Array<{
          month: string;
          adCost: number;
          conversions: number;
          cpa: number;
          roi: number;
        }>;
      }> = {};

      const monthlyTrend: Record<string, {
        month: string;
        totalAdCost: number;
        totalConversions: number;
        averageCPA: number;
        averageROI: number;
      }> = {};

      adsSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        const ad = doc.data();

        // By medium
        if (!byMedium[ad.medium]) {
          byMedium[ad.medium] = {
            totalAdCost: 0,
            totalConversions: 0,
            averageCPA: 0,
            averageROI: 0,
            monthlyData: [],
          };
        }
        byMedium[ad.medium].totalAdCost += ad.adCost;
        byMedium[ad.medium].totalConversions += ad.conversions;
        byMedium[ad.medium].monthlyData.push({
          month: ad.month,
          adCost: ad.adCost,
          conversions: ad.conversions,
          cpa: ad.cpa || 0,
          roi: ad.roi || 0,
        });

        // Monthly trend
        if (!monthlyTrend[ad.month]) {
          monthlyTrend[ad.month] = {
            month: ad.month,
            totalAdCost: 0,
            totalConversions: 0,
            averageCPA: 0,
            averageROI: 0,
          };
        }
        monthlyTrend[ad.month].totalAdCost += ad.adCost;
        monthlyTrend[ad.month].totalConversions += ad.conversions;
      });

      // Calculate averages for each medium
      Object.keys(byMedium).forEach((medium) => {
        const data = byMedium[medium];
        data.averageCPA = data.totalConversions > 0 ? data.totalAdCost / data.totalConversions : 0;
        data.averageROI = data.monthlyData.length > 0
          ? data.monthlyData.reduce((sum, d) => sum + (d.roi || 0), 0) / data.monthlyData.length
          : 0;
      });

      // Calculate monthly averages
      Object.keys(monthlyTrend).forEach((month) => {
        const data = monthlyTrend[month];
        data.averageCPA = data.totalConversions > 0 ? data.totalAdCost / data.totalConversions : 0;
      });

      // Format medium data
      const byMediumFormatted = Object.entries(byMedium).map(([medium, data]) => ({
        medium,
        totalAdCost: data.totalAdCost,
        totalConversions: data.totalConversions,
        averageCPA: data.averageCPA,
        averageROI: data.averageROI,
        monthlyData: data.monthlyData.sort((a, b) => a.month.localeCompare(b.month)),
      })).sort((a, b) => b.averageROI - a.averageROI);

      // Format trend data
      const trendFormatted = months.map((month) => {
        const data = monthlyTrend[month];
        if (!data) {
          return {
            month,
            totalAdCost: 0,
            totalConversions: 0,
            averageCPA: 0,
            averageROI: 0,
          };
        }
        return data;
      });

      return {
        success: true,
        analysis: {
          period: {
            startMonth: data.startMonth,
            endMonth: data.endMonth,
          },
          summary: {
            totalAdCost: Object.values(byMedium).reduce((sum, m) => sum + m.totalAdCost, 0),
            totalConversions: Object.values(byMedium).reduce((sum, m) => sum + m.totalConversions, 0),
            mediumCount: Object.keys(byMedium).length,
          },
          byMedium: byMediumFormatted,
          trend: trendFormatted,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      console.error("Error fetching ad analysis:", error);
      throw new HttpsError("internal", error.message || "Failed to fetch ad analysis");
    }
  }
);
