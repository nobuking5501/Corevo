import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireAuth, requireTenantAccess } from "../utils/middleware";

// ==================== Schema ====================

const getSalesAnalysisSchema = z.object({
  tenantId: z.string(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(), // YYYY-MM-DD
});

// ==================== Sales Analysis ====================

export const getSalesAnalysis = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);
    const data = getSalesAnalysisSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();

      // Fetch sales data for the period
      const salesSnapshot = await db
        .collection(`tenants/${data.tenantId}/sales`)
        .where("tenantId", "==", data.tenantId)
        .where("date", ">=", data.startDate)
        .where("date", "<=", data.endDate)
        .get();

      // Initialize analysis data structures
      const byCourse: Record<string, { count: number; revenue: number }> = {};
      const byCustomerType = {
        new: { count: 0, revenue: 0 },
        existing: { count: 0, revenue: 0 },
      };
      const byPaymentMethod: Record<string, { count: number; revenue: number }> = {
        cash: { count: 0, revenue: 0 },
        card: { count: 0, revenue: 0 },
        paypay: { count: 0, revenue: 0 },
        other: { count: 0, revenue: 0 },
      };
      const byStaff: Record<string, { staffName: string; count: number; revenue: number }> = {};

      let totalRevenue = 0;
      let totalCount = 0;

      // Process each sale
      salesSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        const sale = doc.data();
        totalRevenue += sale.amount;
        totalCount++;

        // By course
        if (!byCourse[sale.serviceName]) {
          byCourse[sale.serviceName] = { count: 0, revenue: 0 };
        }
        byCourse[sale.serviceName].count++;
        byCourse[sale.serviceName].revenue += sale.amount;

        // By customer type
        byCustomerType[sale.customerType as "new" | "existing"].count++;
        byCustomerType[sale.customerType as "new" | "existing"].revenue += sale.amount;

        // By payment method
        if (byPaymentMethod[sale.paymentMethod]) {
          byPaymentMethod[sale.paymentMethod].count++;
          byPaymentMethod[sale.paymentMethod].revenue += sale.amount;
        }

        // By staff
        if (!byStaff[sale.staffId]) {
          byStaff[sale.staffId] = { staffName: sale.staffName, count: 0, revenue: 0 };
        }
        byStaff[sale.staffId].count++;
        byStaff[sale.staffId].revenue += sale.amount;
      });

      // Format course data with ratios
      const byCourseFormatted = Object.entries(byCourse).map(([courseName, data]) => ({
        courseName,
        count: data.count,
        revenue: data.revenue,
        ratio: totalRevenue > 0 ? data.revenue / totalRevenue : 0,
        averagePrice: data.count > 0 ? data.revenue / data.count : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      // Format customer type data
      const byCustomerTypeFormatted = {
        new: {
          count: byCustomerType.new.count,
          revenue: byCustomerType.new.revenue,
          ratio: totalRevenue > 0 ? byCustomerType.new.revenue / totalRevenue : 0,
          averagePrice: byCustomerType.new.count > 0 ? byCustomerType.new.revenue / byCustomerType.new.count : 0,
        },
        existing: {
          count: byCustomerType.existing.count,
          revenue: byCustomerType.existing.revenue,
          ratio: totalRevenue > 0 ? byCustomerType.existing.revenue / totalRevenue : 0,
          averagePrice: byCustomerType.existing.count > 0 ? byCustomerType.existing.revenue / byCustomerType.existing.count : 0,
        },
      };

      // Format payment method data
      const byPaymentMethodFormatted = Object.entries(byPaymentMethod).reduce((acc, [method, data]) => {
        acc[method] = {
          count: data.count,
          revenue: data.revenue,
          ratio: totalRevenue > 0 ? data.revenue / totalRevenue : 0,
        };
        return acc;
      }, {} as Record<string, { count: number; revenue: number; ratio: number }>);

      // Format staff data
      const byStaffFormatted = Object.entries(byStaff).map(([staffId, data]) => ({
        staffId,
        staffName: data.staffName,
        count: data.count,
        revenue: data.revenue,
        ratio: totalRevenue > 0 ? data.revenue / totalRevenue : 0,
        averagePrice: data.count > 0 ? data.revenue / data.count : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      return {
        success: true,
        analysis: {
          period: {
            startDate: data.startDate,
            endDate: data.endDate,
          },
          summary: {
            totalRevenue,
            totalCount,
            averagePrice: totalCount > 0 ? totalRevenue / totalCount : 0,
          },
          byCourse: byCourseFormatted,
          byCustomerType: byCustomerTypeFormatted,
          byPaymentMethod: byPaymentMethodFormatted,
          byStaff: byStaffFormatted,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      console.error("Error fetching sales analysis:", error);
      throw new HttpsError("internal", error.message || "Failed to fetch sales analysis");
    }
  }
);
