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
exports.cancelAppointment = exports.updateAppointment = exports.createAppointment = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const createAppointmentSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    staffId: zod_1.z.string(),
    serviceId: zod_1.z.string(),
    startAt: zod_1.z.string(),
    endAt: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
});
exports.createAppointment = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const data = createAppointmentSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, data.tenantId);
    try {
        const db = admin.firestore();
        const appointmentRef = await db.collection(`tenants/${data.tenantId}/appointments`).add({
            ...data,
            startAt: new Date(data.startAt),
            endAt: new Date(data.endAt),
            status: "scheduled",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, appointmentId: appointmentRef.id };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to create appointment");
    }
});
const updateAppointmentSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    appointmentId: zod_1.z.string(),
    updates: zod_1.z.object({
        startAt: zod_1.z.string().optional(),
        endAt: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        status: zod_1.z.enum(["scheduled", "confirmed", "completed", "canceled", "noshow"]).optional(),
    }),
});
exports.updateAppointment = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, appointmentId, updates } = updateAppointmentSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const updateData = { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (updates.startAt)
            updateData.startAt = new Date(updates.startAt);
        if (updates.endAt)
            updateData.endAt = new Date(updates.endAt);
        await db.collection(`tenants/${tenantId}/appointments`).doc(appointmentId).update(updateData);
        return { success: true };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to update appointment");
    }
});
const cancelAppointmentSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    appointmentId: zod_1.z.string(),
});
exports.cancelAppointment = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, appointmentId } = cancelAppointmentSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        await db.collection(`tenants/${tenantId}/appointments`).doc(appointmentId).update({
            status: "canceled",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to cancel appointment");
    }
});
//# sourceMappingURL=appointments.js.map