import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

// ==================== Schemas ====================

const createSaleSchema = z.object({
  tenantId: z.string(),
  appointmentId: z.string().optional(),
  customerId: z.string(),
  date: z.string(), // YYYY-MM-DD
  serviceName: z.string(),
  coursePrice: z.number().positive(),
  quantity: z.number().int().positive(),
  paymentMethod: z.enum(["cash", "card", "paypay", "other"]),
  staffId: z.string(),
  notes: z.string().optional(),
});

const updateSaleSchema = z.object({
  tenantId: z.string(),
  saleId: z.string(),
  serviceName: z.string().optional(),
  coursePrice: z.number().positive().optional(),
  quantity: z.number().int().positive().optional(),
  paymentMethod: z.enum(["cash", "card", "paypay", "other"]).optional(),
  staffId: z.string().optional(),
  notes: z.string().optional(),
});

const deleteSaleSchema = z.object({
  tenantId: z.string(),
  saleId: z.string(),
});

const getSalesSchema = z.object({
  tenantId: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  customerId: z.string().optional(),
  staffId: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

// ==================== Create Sale ====================

export const createSale = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const data = createSaleSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();

      // Fetch customer info
      const customerDoc = await db
        .collection(`tenants/${data.tenantId}/customers`)
        .doc(data.customerId)
        .get();

      if (!customerDoc.exists) {
        throw new HttpsError("not-found", "Customer not found");
      }

      const customer = customerDoc.data();

      // Fetch staff info
      const staffDoc = await db
        .collection(`tenants/${data.tenantId}/users`)
        .doc(data.staffId)
        .get();

      if (!staffDoc.exists) {
        throw new HttpsError("not-found", "Staff not found");
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
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create sale");
    }
  }
);

// ==================== Update Sale ====================

export const updateSale = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, saleId, ...updates } = updateSaleSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const saleRef = db.collection(`tenants/${tenantId}/sales`).doc(saleId);

      // Get existing sale
      const saleDoc = await saleRef.get();
      if (!saleDoc.exists) {
        throw new HttpsError("not-found", "Sale not found");
      }

      const existingSale = saleDoc.data();

      // Build update data
      const updateData: any = {
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
          throw new HttpsError("not-found", "Staff not found");
        }

        const staff = staffDoc.data();
        updateData.staffName = staff?.displayName || "Unknown";
      }

      await saleRef.update(updateData);

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update sale");
    }
  }
);

// ==================== Delete Sale ====================

export const deleteSale = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, saleId } = deleteSaleSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const saleRef = db.collection(`tenants/${tenantId}/sales`).doc(saleId);

      // Check if sale exists
      const saleDoc = await saleRef.get();
      if (!saleDoc.exists) {
        throw new HttpsError("not-found", "Sale not found");
      }

      // Delete sale
      await saleRef.delete();

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete sale");
    }
  }
);

// ==================== Get Sales ====================

export const getSales = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const {
      tenantId,
      startDate,
      endDate,
      customerId,
      staffId,
      limit = 100,
    } = getSalesSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      let query: admin.firestore.Query = db
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
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to get sales");
    }
  }
);
