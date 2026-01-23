"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpenses = exports.getExpense = exports.upsertExpense = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
// ==================== Schemas ====================
const upsertExpenseSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    month: zod_1.z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
    rent: zod_1.z.number().nonnegative(),
    labor: zod_1.z.number().nonnegative(),
    advertising: zod_1.z.number().nonnegative(),
    materials: zod_1.z.number().nonnegative(),
    utilities: zod_1.z.number().nonnegative(),
    miscellaneous: zod_1.z.number().nonnegative(),
    systems: zod_1.z.number().nonnegative(),
    notes: zod_1.z.string().optional(),
});
const getExpenseSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    month: zod_1.z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
});
// ==================== Upsert Expense ====================
exports.upsertExpense = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = upsertExpenseSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        // Calculate total
        const total = data.rent +
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
        let expenseId;
        if (expenseQuery.empty) {
            // Create new expense
            const expenseRef = await db
                .collection(`tenants/${data.tenantId}/expenses`)
                .add({
                ...expenseData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            expenseId = expenseRef.id;
        }
        else {
            // Update existing expense
            const existingDoc = expenseQuery.docs[0];
            expenseId = existingDoc.id;
            await db
                .collection(`tenants/${data.tenantId}/expenses`)
                .doc(expenseId)
                .update(expenseData);
        }
        return { success: true, expenseId };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to upsert expense");
    }
});
// ==================== Get Expense ====================
exports.getExpense = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, month } = getExpenseSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
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
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to get expense");
    }
});
// ==================== Get Expenses (Multiple Months) ====================
const getExpensesSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    startMonth: zod_1.z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
    endMonth: zod_1.z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
    limit: zod_1.z.number().int().positive().max(100).optional(),
});
exports.getExpenses = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, startMonth, endMonth, limit = 12, } = getExpensesSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        let query = db
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
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to get expenses");
    }
});
//# sourceMappingURL=expenses.js.map