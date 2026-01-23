import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

// ==================== Schemas ====================

const upsertExpenseSchema = z.object({
  tenantId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  rent: z.number().nonnegative(),
  labor: z.number().nonnegative(),
  advertising: z.number().nonnegative(),
  materials: z.number().nonnegative(),
  utilities: z.number().nonnegative(),
  miscellaneous: z.number().nonnegative(),
  systems: z.number().nonnegative(),
  notes: z.string().optional(),
});

const getExpenseSchema = z.object({
  tenantId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
});

// ==================== Upsert Expense ====================

export const upsertExpense = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const data = upsertExpenseSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();

      // Calculate total
      const total =
        data.rent +
        data.labor +
        data.advertising +
        data.materials +
        data.utilities +
        data.miscellaneous +
        data.systems;

      // Check if expense for this month already exists
      const expenseQuery = await db
        .collection(`tenants/${data.tenantId}/expenses`)
        .where("tenantId", "==", data.tenantId)
        .where("month", "==", data.month)
        .limit(1)
        .get();

      const expenseData = {
        tenantId: data.tenantId,
        month: data.month,
        rent: data.rent,
        labor: data.labor,
        advertising: data.advertising,
        materials: data.materials,
        utilities: data.utilities,
        miscellaneous: data.miscellaneous,
        systems: data.systems,
        total,
        notes: data.notes || "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      let expenseId: string;

      if (expenseQuery.empty) {
        // Create new expense
        const expenseRef = await db
          .collection(`tenants/${data.tenantId}/expenses`)
          .add({
            ...expenseData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        expenseId = expenseRef.id;
      } else {
        // Update existing expense
        const existingDoc = expenseQuery.docs[0];
        expenseId = existingDoc.id;
        await db
          .collection(`tenants/${data.tenantId}/expenses`)
          .doc(expenseId)
          .update(expenseData);
      }

      return { success: true, expenseId };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to upsert expense");
    }
  }
);

// ==================== Get Expense ====================

export const getExpense = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, month } = getExpenseSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();

      const expenseQuery = await db
        .collection(`tenants/${tenantId}/expenses`)
        .where("tenantId", "==", tenantId)
        .where("month", "==", month)
        .limit(1)
        .get();

      if (expenseQuery.empty) {
        return {
          success: true,
          expense: null,
        };
      }

      const doc = expenseQuery.docs[0];
      const data = doc.data();

      return {
        success: true,
        expense: {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to get expense");
    }
  }
);

// ==================== Get Expenses (Multiple Months) ====================

const getExpensesSchema = z.object({
  tenantId: z.string(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
  endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
  limit: z.number().int().positive().max(100).optional(),
});

export const getExpenses = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const {
      tenantId,
      startMonth,
      endMonth,
      limit = 12,
    } = getExpensesSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      let query: admin.firestore.Query = db
        .collection(`tenants/${tenantId}/expenses`)
        .where("tenantId", "==", tenantId);

      if (startMonth) {
        query = query.where("month", ">=", startMonth);
      }

      if (endMonth) {
        query = query.where("month", "<=", endMonth);
      }

      query = query.orderBy("month", "desc").limit(limit);

      const snapshot = await query.get();

      const expenses = snapshot.docs.map((doc) => {
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
        expenses,
        total: expenses.length,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to get expenses");
    }
  }
);
