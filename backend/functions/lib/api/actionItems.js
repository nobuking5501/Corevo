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
exports.getActionItems = exports.deleteActionItem = exports.updateActionItem = exports.createActionItem = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
// ==================== Schemas ====================
const createActionItemSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    title: zod_1.z.string().min(1),
    category: zod_1.z.enum(["sales", "cost", "customer", "staff", "other"]),
    problem: zod_1.z.string().min(1),
    action: zod_1.z.string().min(1),
    dueDate: zod_1.z.string().optional(), // ISO date string
    priority: zod_1.z.number().int().min(1).max(10),
    assignedTo: zod_1.z.string().optional(),
});
const updateActionItemSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    actionId: zod_1.z.string(),
    title: zod_1.z.string().min(1).optional(),
    category: zod_1.z.enum(["sales", "cost", "customer", "staff", "other"]).optional(),
    problem: zod_1.z.string().min(1).optional(),
    action: zod_1.z.string().min(1).optional(),
    dueDate: zod_1.z.string().optional(),
    status: zod_1.z.enum(["pending", "in_progress", "completed", "canceled"]).optional(),
    priority: zod_1.z.number().int().min(1).max(10).optional(),
    assignedTo: zod_1.z.string().optional(),
    measuredAt: zod_1.z.string().optional(),
    effectDescription: zod_1.z.string().optional(),
    effectValue: zod_1.z.number().optional(),
});
const deleteActionItemSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    actionId: zod_1.z.string(),
});
const getActionItemsSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    status: zod_1.z.enum(["pending", "in_progress", "completed", "canceled"]).optional(),
    category: zod_1.z.enum(["sales", "cost", "customer", "staff", "other"]).optional(),
    limit: zod_1.z.number().int().positive().max(1000).optional(),
});
// ==================== Create Action Item ====================
exports.createActionItem = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = createActionItemSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        const actionItemData = {
            tenantId: data.tenantId,
            title: data.title,
            category: data.category,
            problem: data.problem,
            action: data.action,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            status: "pending",
            priority: data.priority,
            assignedTo: data.assignedTo || null,
            measuredAt: null,
            effectDescription: null,
            effectValue: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const actionRef = await db
            .collection(`tenants/${data.tenantId}/action_items`)
            .add(actionItemData);
        return { success: true, actionId: actionRef.id };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to create action item");
    }
});
// ==================== Update Action Item ====================
exports.updateActionItem = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, actionId, ...updates } = updateActionItemSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const actionRef = db.collection(`tenants/${tenantId}/action_items`).doc(actionId);
        // Check if action item exists
        const actionDoc = await actionRef.get();
        if (!actionDoc.exists) {
            throw new https_1.HttpsError("not-found", "Action item not found");
        }
        // Build update data
        const updateData = {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        // Convert date strings to Date objects
        if (updates.dueDate) {
            updateData.dueDate = new Date(updates.dueDate);
        }
        if (updates.measuredAt) {
            updateData.measuredAt = new Date(updates.measuredAt);
        }
        await actionRef.update(updateData);
        return { success: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to update action item");
    }
});
// ==================== Delete Action Item ====================
exports.deleteActionItem = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, actionId } = deleteActionItemSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const actionRef = db.collection(`tenants/${tenantId}/action_items`).doc(actionId);
        // Check if action item exists
        const actionDoc = await actionRef.get();
        if (!actionDoc.exists) {
            throw new https_1.HttpsError("not-found", "Action item not found");
        }
        // Delete action item
        await actionRef.delete();
        return { success: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to delete action item");
    }
});
// ==================== Get Action Items ====================
exports.getActionItems = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, status, category, limit = 100, } = getActionItemsSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        let query = db
            .collection(`tenants/${tenantId}/action_items`)
            .where("tenantId", "==", tenantId);
        // Apply filters
        if (status) {
            query = query.where("status", "==", status);
        }
        if (category) {
            query = query.where("category", "==", category);
        }
        // Order by priority descending, then by dueDate
        query = query.orderBy("priority", "desc").limit(limit);
        const snapshot = await query.get();
        const actionItems = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                dueDate: data.dueDate?.toDate?.()?.toISOString() || null,
                measuredAt: data.measuredAt?.toDate?.()?.toISOString() || null,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
            };
        });
        return {
            success: true,
            actionItems,
            total: actionItems.length,
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to get action items");
    }
});
//# sourceMappingURL=actionItems.js.map