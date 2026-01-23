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
exports.exportData = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const exportDataSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    type: zod_1.z.enum(["appointments", "revenue", "customers"]),
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
});
exports.exportData = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, type, startDate, endDate } = exportDataSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        const start = new Date(startDate);
        const end = new Date(endDate);
        let csvData = "";
        if (type === "appointments") {
            const appointmentsSnap = await db
                .collection(`tenants/${tenantId}/appointments`)
                .where("startAt", ">=", start)
                .where("startAt", "<=", end)
                .get();
            csvData = "Date,Customer,Staff,Service,Status\n";
            appointmentsSnap.forEach((doc) => {
                const data = doc.data();
                csvData += `${data.startAt.toDate()},${data.customerId},${data.staffId},${data.serviceId},${data.status}\n`;
            });
        }
        // In production, upload to Cloud Storage and return signed URL
        return {
            success: true,
            csv: csvData,
        };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to export data");
    }
});
//# sourceMappingURL=export.js.map