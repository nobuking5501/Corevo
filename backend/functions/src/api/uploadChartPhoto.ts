import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

const uploadChartPhotoSchema = z.object({
  tenantId: z.string(),
  chartId: z.string(),
  fileName: z.string(),
  fileData: z.string(), // base64 encoded image data
  contentType: z.string().default("image/jpeg"),
});

export const uploadChartPhoto = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, chartId, fileName, fileData, contentType } =
      uploadChartPhotoSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

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
    } catch (error: any) {
      throw new HttpsError(
        "internal",
        error.message || "Failed to upload photo"
      );
    }
  }
);

const deleteChartPhotoSchema = z.object({
  tenantId: z.string(),
  filePath: z.string(),
});

export const deleteChartPhoto = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, filePath } = deleteChartPhotoSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    // Verify the file path belongs to the tenant
    if (!filePath.startsWith(`tenants/${tenantId}/charts/`)) {
      throw new HttpsError(
        "permission-denied",
        "Cannot delete file from another tenant"
      );
    }

    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError("not-found", "File not found");
      }

      // Delete the file
      await file.delete();

      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error.message || "Failed to delete photo"
      );
    }
  }
);
