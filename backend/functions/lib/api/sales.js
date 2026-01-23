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
exports.getSales = exports.deleteSale = exports.updateSale = exports.createSale = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
// ==================== Schemas ====================
const createSaleSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    appointmentId: zod_1.z.string().optional(),
    customerId: zod_1.z.string(),
    date: zod_1.z.string(), // YYYY-MM-DD
    serviceName: zod_1.z.string(),
    coursePrice: zod_1.z.number().positive(),
    quantity: zod_1.z.number().int().positive(),
    paymentMethod: zod_1.z.enum(["cash", "card", "paypay", "other"]),
    staffId: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
});
const updateSaleSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    saleId: zod_1.z.string(),
    serviceName: zod_1.z.string().optional(),
    coursePrice: zod_1.z.number().positive().optional(),
    quantity: zod_1.z.number().int().positive().optional(),
    paymentMethod: zod_1.z.enum(["cash", "card", "paypay", "other"]).optional(),
    staffId: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
const deleteSaleSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    saleId: zod_1.z.string(),
});
const getSalesSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    customerId: zod_1.z.string().optional(),
    staffId: zod_1.z.string().optional(),
    limit: zod_1.z.number().int().positive().max(1000).optional(),
});
// ==================== Create Sale ====================
exports.createSale = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = createSaleSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        // Fetch customer info
        const customerDoc = await db
            .collection(`tenants/${data.tenantId}/customers`)
            .doc(data.customerId)
            .get();
        if (!customerDoc.exists) {
            throw new https_1.HttpsError("not-found", "Customer not found");
        }
        const customer = customerDoc.data();
        // Fetch staff info
        const staffDoc = await db
            .collection(`tenants/${data.tenantId}/users`)
            .doc(data.staffId)
            .get();
        if (!staffDoc.exists) {
            throw new https_1.HttpsError("not-found", "Staff not found");
        }
        const staff = staffDoc.data();
        // Determine customer type (new or existing)
        // Check if this customer has any previous sales
        const previousSales = await db
            .collection(`tenants/${data.tenantId}/sales`)
            .where("customerId", "==", data.customerId)
            .where("date", "<", data.date)
            .limit(1)
            .get();
        const customerType = previousSales.empty ? "new" : "existing";
        // Calculate amount
        const amount = data.coursePrice * data.quantity;
        // Create sale document
        const saleData = {
            tenantId: data.tenantId,
            appointmentId: data.appointmentId || null,
            customerId: data.customerId,
            customerName: customer?.name || "Unknown",
            customerType,
            date: data.date,
            serviceName: data.serviceName,
            coursePrice: data.coursePrice,
            quantity: data.quantity,
            amount,
            paymentMethod: data.paymentMethod,
            staffId: data.staffId,
            staffName: staff?.displayName || "Unknown",
            notes: data.notes || "",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const saleRef = await db
            .collection(`tenants/${data.tenantId}/sales`)
            .add(saleData);
        // Update customer's last purchase info
        await db
            .collection(`tenants/${data.tenantId}/customers`)
            .doc(data.customerId)
            .update({
            lastPurchaseAmount: amount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, saleId: saleRef.id };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to create sale");
    }
});
// ==================== Update Sale ====================
exports.updateSale = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, saleId, ...updates } = updateSaleSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const saleRef = db.collection(`tenants/${tenantId}/sales`).doc(saleId);
        // Get existing sale
        const saleDoc = await saleRef.get();
        if (!saleDoc.exists) {
            throw new https_1.HttpsError("not-found", "Sale not found");
        }
        const existingSale = saleDoc.data();
        // Build update data
        const updateData = {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        // Recalculate amount if price or quantity changed
        const coursePrice = updates.coursePrice || existingSale?.coursePrice;
        const quantity = updates.quantity || existingSale?.quantity;
        if (updates.coursePrice || updates.quantity) {
            updateData.amount = coursePrice * quantity;
        }
        // Update staff name if staffId changed
        if (updates.staffId) {
            const staffDoc = await db
                .collection(`tenants/${tenantId}/users`)
                .doc(updates.staffId)
                .get();
            if (!staffDoc.exists) {
                throw new https_1.HttpsError("not-found", "Staff not found");
            }
            const staff = staffDoc.data();
            updateData.staffName = staff?.displayName || "Unknown";
        }
        await saleRef.update(updateData);
        return { success: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to update sale");
    }
});
// ==================== Delete Sale ====================
exports.deleteSale = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, saleId } = deleteSaleSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const saleRef = db.collection(`tenants/${tenantId}/sales`).doc(saleId);
        // Check if sale exists
        const saleDoc = await saleRef.get();
        if (!saleDoc.exists) {
            throw new https_1.HttpsError("not-found", "Sale not found");
        }
        // Delete sale
        await saleRef.delete();
        return { success: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to delete sale");
    }
});
// ==================== Get Sales ====================
exports.getSales = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, startDate, endDate, customerId, staffId, limit = 100, } = getSalesSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        let query = db
            .collection(`tenants/${tenantId}/sales`)
            .where("tenantId", "==", tenantId);
        // Apply filters
        if (customerId) {
            query = query.where("customerId", "==", customerId);
        }
        if (staffId) {
            query = query.where("staffId", "==", staffId);
        }
        if (startDate) {
            query = query.where("date", ">=", startDate);
        }
        if (endDate) {
            query = query.where("date", "<=", endDate);
        }
        // Order by date descending
        query = query.orderBy("date", "desc").limit(limit);
        const snapshot = await query.get();
        const sales = snapshot.docs.map((doc) => {
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
            sales,
            total: sales.length,
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to get sales");
    }
});
//# sourceMappingURL=sales.js.map