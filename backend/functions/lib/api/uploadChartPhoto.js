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
exports.deleteChartPhoto = exports.uploadChartPhoto = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const uploadChartPhotoSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    chartId: zod_1.z.string(),
    fileName: zod_1.z.string(),
    fileData: zod_1.z.string(), // base64 encoded image data
    contentType: zod_1.z.string().default("image/jpeg"),
});
exports.uploadChartPhoto = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, chartId, fileName, fileData, contentType } = uploadChartPhotoSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const bucket = admin.storage().bucket();
        // Create unique file path
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `tenants/${tenantId}/charts/${chartId}/${timestamp}_${sanitizedFileName}`;
        // Convert base64 to buffer
        const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        // Upload to Cloud Storage
        const file = bucket.file(filePath);
        await file.save(buffer, {
            metadata: {
                contentType,
                metadata: {
                    tenantId,
                    chartId,
                    uploadedBy: request.auth?.uid || "unknown",
                    uploadedAt: new Date().toISOString(),
                },
            },
        });
        // Make the file publicly accessible
        await file.makePublic();
        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        return { success: true, url: publicUrl, filePath };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to upload photo");
    }
});
const deleteChartPhotoSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    filePath: zod_1.z.string(),
});
exports.deleteChartPhoto = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, filePath } = deleteChartPhotoSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    // Verify the file path belongs to the tenant
    if (!filePath.startsWith(`tenants/${tenantId}/charts/`)) {
        throw new https_1.HttpsError("permission-denied", "Cannot delete file from another tenant");
    }
    try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(filePath);
        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            throw new https_1.HttpsError("not-found", "File not found");
        }
        // Delete the file
        await file.delete();
        return { success: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", error.message || "Failed to delete photo");
    }
});
//# sourceMappingURL=uploadChartPhoto.js.map