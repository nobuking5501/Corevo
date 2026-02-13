import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

// ==================== Schemas ====================

// Salon profile schema
const salonProfileSchema = z.object({
  allergies: z.string().optional(),
  // Beauty salon fields
  hairType: z.enum(["straight", "wavy", "curly", "coarse", "fine"]).optional(),
  hairConcerns: z.array(z.string()).optional(),
  scalpType: z.enum(["normal", "dry", "oily", "sensitive"]).optional(),
  // Esthetic salon fields
  skinType: z.enum(["normal", "dry", "oily", "combination", "sensitive"]).optional(),
  skinConcerns: z.array(z.string()).optional(),
  // Nail salon fields
  nailLength: z.enum(["short", "medium", "long"]).optional(),
  nailShape: z.enum(["square", "round", "oval", "almond", "stiletto"]).optional(),
  nailConcerns: z.array(z.string()).optional(),
  // General
  specialNotes: z.string().optional(),
}).optional();

const createCustomerSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(1),
  kana: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  birthday: z.string().optional(), // ISO date string
  gender: z.enum(["male", "female", "other", "prefer-not-to-say"]).optional(),
  address: z.object({
    zipCode: z.string().optional(),
    prefecture: z.string().optional(),
    city: z.string().optional(),
    street: z.string().optional(),
  }).optional(),
  preferredStaffId: z.string().optional(),
  lineUserId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(""),
  consent: z.object({
    marketing: z.boolean().default(false),
    photoUsage: z.boolean().default(false),
  }).optional(),
  salonProfile: salonProfileSchema,
});

const updateCustomerSchema = z.object({
  tenantId: z.string(),
  customerId: z.string(),
  updates: z.object({
    name: z.string().min(1).optional(),
    kana: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    birthday: z.string().optional(), // ISO date string
    gender: z.enum(["male", "female", "other", "prefer-not-to-say"]).optional(),
    address: z.object({
      zipCode: z.string().optional(),
      prefecture: z.string().optional(),
      city: z.string().optional(),
      street: z.string().optional(),
    }).optional(),
    preferredStaffId: z.string().optional(),
    lineUserId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    consent: z.object({
      marketing: z.boolean().optional(),
      photoUsage: z.boolean().optional(),
    }).optional(),
    salonProfile: salonProfileSchema,
  }),
});

const deleteCustomerSchema = z.object({
  tenantId: z.string(),
  customerId: z.string(),
});

const getCustomerSchema = z.object({
  tenantId: z.string(),
  customerId: z.string(),
});

const getCustomersSchema = z.object({
  tenantId: z.string(),
  limit: z.number().int().positive().max(1000).optional().default(100),
  orderBy: z.enum(["name", "createdAt", "lastVisit"]).optional().default("createdAt"),
  orderDirection: z.enum(["asc", "desc"]).optional().default("desc"),
});

const searchCustomersSchema = z.object({
  tenantId: z.string(),
  query: z.string().min(1),
  searchBy: z.enum(["name", "kana", "phone", "email"]).optional().default("name"),
  limit: z.number().int().positive().max(100).optional().default(20),
});

// ==================== Create Customer ====================

export const createCustomer = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const data = createCustomerSchema.parse(request.data);
    await requireTenantAccess(request, data.tenantId);

    try {
      const db = admin.firestore();

      // Check for duplicate email or phone
      if (data.email && data.email !== "") {
        const duplicateEmail = await db
          .collection(`tenants/${data.tenantId}/customers`)
          .where("email", "==", data.email)
          .limit(1)
          .get();

        if (!duplicateEmail.empty) {
          throw new HttpsError(
            "already-exists",
            "このメールアドレスは既に登録されています"
          );
        }
      }

      if (data.phone) {
        const duplicatePhone = await db
          .collection(`tenants/${data.tenantId}/customers`)
          .where("phone", "==", data.phone)
          .limit(1)
          .get();

        if (!duplicatePhone.empty) {
          throw new HttpsError(
            "already-exists",
            "この電話番号は既に登録されています"
          );
        }
      }

      // Create customer document
      const customerData: any = {
        tenantId: data.tenantId,
        name: data.name,
        kana: data.kana || "",
        email: data.email || "",
        phone: data.phone || "",
        birthday: data.birthday ? admin.firestore.Timestamp.fromDate(new Date(data.birthday)) : null,
        gender: data.gender || null,
        address: data.address || null,
        preferredStaffId: data.preferredStaffId || null,
        lineUserId: data.lineUserId || null,
        tags: data.tags || [],
        notes: data.notes || "",
        preferences: [],
        consent: data.consent || {
          marketing: false,
          photoUsage: false,
        },
        salonProfile: data.salonProfile || null,
        visitCount: 0,
        lastVisit: null,
        lastPurchaseAmount: 0,
        visitInterval: null, // Will be calculated after multiple visits
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const customerRef = await db
        .collection(`tenants/${data.tenantId}/customers`)
        .add(customerData);

      return { success: true, customerId: customerRef.id };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to create customer");
    }
  }
);

// ==================== Update Customer ====================

export const updateCustomer = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, customerId, updates } = updateCustomerSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const customerRef = db.collection(`tenants/${tenantId}/customers`).doc(customerId);

      // Check if customer exists
      const customerDoc = await customerRef.get();
      if (!customerDoc.exists) {
        throw new HttpsError("not-found", "Customer not found");
      }

      // Check for duplicate email or phone if being updated
      if (updates.email && updates.email !== "") {
        const currentData = customerDoc.data();
        if (currentData?.email !== updates.email) {
          const duplicateEmail = await db
            .collection(`tenants/${tenantId}/customers`)
            .where("email", "==", updates.email)
            .limit(1)
            .get();

          if (!duplicateEmail.empty && duplicateEmail.docs[0].id !== customerId) {
            throw new HttpsError(
              "already-exists",
              "このメールアドレスは既に使用されています"
            );
          }
        }
      }

      if (updates.phone) {
        const currentData = customerDoc.data();
        if (currentData?.phone !== updates.phone) {
          const duplicatePhone = await db
            .collection(`tenants/${tenantId}/customers`)
            .where("phone", "==", updates.phone)
            .limit(1)
            .get();

          if (!duplicatePhone.empty && duplicatePhone.docs[0].id !== customerId) {
            throw new HttpsError(
              "already-exists",
              "この電話番号は既に使用されています"
            );
          }
        }
      }

      // Build update data
      const updateData: any = {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Remove undefined fields
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await customerRef.update(updateData);

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to update customer");
    }
  }
);

// ==================== Delete Customer ====================

export const deleteCustomer = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, customerId } = deleteCustomerSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const customerRef = db.collection(`tenants/${tenantId}/customers`).doc(customerId);

      // Check if customer exists
      const customerDoc = await customerRef.get();
      if (!customerDoc.exists) {
        throw new HttpsError("not-found", "Customer not found");
      }

      // Check for existing appointments
      const appointmentsSnap = await db
        .collection(`tenants/${tenantId}/appointments`)
        .where("customerId", "==", customerId)
        .where("status", "in", ["scheduled", "confirmed"])
        .limit(1)
        .get();

      if (!appointmentsSnap.empty) {
        throw new HttpsError(
          "failed-precondition",
          "予約が存在する顧客は削除できません。先に予約をキャンセルしてください。"
        );
      }

      // Delete customer
      await customerRef.delete();

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to delete customer");
    }
  }
);

// ==================== Get Customer ====================

export const getCustomer = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, customerId } = getCustomerSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      const doc = await db
        .collection(`tenants/${tenantId}/customers`)
        .doc(customerId)
        .get();

      if (!doc.exists) {
        throw new HttpsError("not-found", "Customer not found");
      }

      const data = doc.data();
      const customer = {
        id: doc.id,
        ...data,
        birthday: data?.birthday?.toDate?.()?.toISOString() || null,
        createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
        lastVisit: data?.lastVisit?.toDate?.()?.toISOString() || null,
        lineLinkedAt: data?.lineLinkedAt?.toDate?.()?.toISOString() || null,
      };

      return { success: true, customer };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to get customer");
    }
  }
);

// ==================== Get Customers (List) ====================

export const getCustomers = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, limit, orderBy, orderDirection } = getCustomersSchema.parse(
      request.data
    );
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();
      let query: admin.firestore.Query = db
        .collection(`tenants/${tenantId}/customers`)
        .where("tenantId", "==", tenantId);

      // Apply ordering
      query = query.orderBy(orderBy, orderDirection).limit(limit);

      const snapshot = await query.get();

      const customers = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          birthday: data.birthday?.toDate?.()?.toISOString() || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
          lastVisit: data.lastVisit?.toDate?.()?.toISOString() || null,
          lineLinkedAt: data.lineLinkedAt?.toDate?.()?.toISOString() || null,
        };
      });

      return {
        success: true,
        customers,
        total: customers.length,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to get customers");
    }
  }
);

// ==================== Search Customers ====================

export const searchCustomers = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, query, searchBy, limit } = searchCustomersSchema.parse(
      request.data
    );
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();

      // Firestore range query for prefix search
      const searchQuery = query.trim();
      const searchQueryEnd = searchQuery + "\uf8ff"; // Unicode max character for range query

      let firestoreQuery: admin.firestore.Query = db
        .collection(`tenants/${tenantId}/customers`)
        .where("tenantId", "==", tenantId)
        .where(searchBy, ">=", searchQuery)
        .where(searchBy, "<=", searchQueryEnd)
        .limit(limit);

      const snapshot = await firestoreQuery.get();

      const customers = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          birthday: data.birthday?.toDate?.()?.toISOString() || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
          lastVisit: data.lastVisit?.toDate?.()?.toISOString() || null,
          lineLinkedAt: data.lineLinkedAt?.toDate?.()?.toISOString() || null,
        };
      });

      return {
        success: true,
        customers,
        total: customers.length,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to search customers");
    }
  }
);
