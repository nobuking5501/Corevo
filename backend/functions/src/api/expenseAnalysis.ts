import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { format, parseISO } from "date-fns";

// ==================== Schema ====================

const getExpenseAnalysisSchema = z.object({
  tenantId: z.string(),
  startMonth: z.string(), // YYYY-MM
  endMonth: z.string(), // YYYY-MM
});

// ==================== Expense Analysis ====================

export const getExpenseAnalysis = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);
    const data = getExpenseAnalysisSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();

      // Generate list of months between startMonth and endMonth
      const months: string[] = [];
      let currentDate = parseISO(`${data.startMonth}-01`);
      const endDate = parseISO(`${data.endMonth}-01`);

      while (currentDate <= endDate) {
        months.push(format(currentDate, "yyyy-MM"));
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      }

      // Fetch expenses for all months
      const expensesSnapshot = await db
        .collection(`tenants/${data.tenantId}/expenses`)
        .where("tenantId", "==", data.tenantId)
        .where("month", "in", months.slice(0, 10)) // Firestore 'in' limit is 10
        .get();

      const expensesByMonth: Record<string, admin.firestore.DocumentData> = {};
      expensesSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        const expense = doc.data();
        expensesByMonth[expense.month] = expense;
      });

      // Calculate trends
      const trend = months.map((month) => {
        const expense = expensesByMonth[month];
        if (!expense) {
          return {
            month,
            total: 0,
            rent: 0,
            labor: 0,
            advertising: 0,
            materials: 0,
            utilities: 0,
            miscellaneous: 0,
            systems: 0,
          };
        }

        return {
          month,
          total: expense.total,
          rent: expense.rent,
          labor: expense.labor,
          advertising: expense.advertising,
          materials: expense.materials,
          utilities: expense.utilities,
          miscellaneous: expense.miscellaneous,
          systems: expense.systems,
        };
      });

      // Calculate average composition
      const totalExpenses = trend.reduce((sum, t) => sum + t.total, 0);
      const composition = {
        rent: trend.reduce((sum, t) => sum + t.rent, 0),
        labor: trend.reduce((sum, t) => sum + t.labor, 0),
        advertising: trend.reduce((sum, t) => sum + t.advertising, 0),
        materials: trend.reduce((sum, t) => sum + t.materials, 0),
        utilities: trend.reduce((sum, t) => sum + t.utilities, 0),
        miscellaneous: trend.reduce((sum, t) => sum + t.miscellaneous, 0),
        systems: trend.reduce((sum, t) => sum + t.systems, 0),
      };

      const compositionWithRatio = Object.entries(composition).map(([category, amount]) => ({
        category,
        amount,
        ratio: totalExpenses > 0 ? amount / totalExpenses : 0,
      })).sort((a, b) => b.amount - a.amount);

      return {
        success: true,
        analysis: {
          period: {
            startMonth: data.startMonth,
            endMonth: data.endMonth,
          },
          summary: {
            totalExpenses,
            averageMonthly: months.length > 0 ? totalExpenses / months.length : 0,
            monthCount: months.length,
          },
          trend,
          composition: compositionWithRatio,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      console.error("Error fetching expense analysis:", error);
      throw new HttpsError("internal", error.message || "Failed to fetch expense analysis");
    }
  }
);
