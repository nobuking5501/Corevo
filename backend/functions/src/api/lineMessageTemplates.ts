import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { z } from "zod";
import {
  requireAuth,
  requireTenantAccess,
  AuthenticatedContext,
} from "../utils/middleware";

// メッセージテンプレートスキーマ
const messageTemplatesSchema = z.object({
  tenantId: z.string(),
  bookingConfirmationMessage: z.string().optional(),
  reminderMessage: z.string().optional(),
});

/**
 * メッセージテンプレートを取得
 */
export const getLineMessageTemplates = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    requireAuth(request);
    const context = request as AuthenticatedContext;

    const { tenantId } = z.object({ tenantId: z.string() }).parse(request.data);
    await requireTenantAccess(context, tenantId);

    try {
      const db = admin.firestore();
      const doc = await db
        .collection(`tenants/${tenantId}/lineSettings`)
        .doc("messageTemplates")
        .get();

      if (!doc.exists) {
        // デフォルトテンプレートを返す
        return {
          success: true,
          templates: {
            bookingConfirmationMessage:
              "{{customerName}} 様\n\nご予約ありがとうございます。\n\n【予約内容】\n日時: {{appointmentDate}}\nサービス: {{serviceName}}\n\n{{salonName}} にてお待ちしております。",
            reminderMessage:
              "{{customerName}} 様\n\n明日のご予約のリマインドです。\n\n【予約内容】\n日時: {{appointmentDate}}\nサービス: {{serviceName}}\n\nご来店をお待ちしております。\n{{salonName}}",
          },
        };
      }

      return {
        success: true,
        templates: doc.data(),
      };
    } catch (error: any) {
      console.error("Error getting message templates:", error);
      throw new HttpsError(
        "internal",
        error.message || "Failed to get message templates"
      );
    }
  }
);

/**
 * メッセージテンプレートを更新
 */
export const updateLineMessageTemplates = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    requireAuth(request);
    const context = request as AuthenticatedContext;

    const data = messageTemplatesSchema.parse(request.data);
    await requireTenantAccess(context, data.tenantId);

    try {
      const db = admin.firestore();
      const docRef = db
        .collection(`tenants/${data.tenantId}/lineSettings`)
        .doc("messageTemplates");

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
      };

      if (data.bookingConfirmationMessage !== undefined) {
        updateData.bookingConfirmationMessage = data.bookingConfirmationMessage;
      }

      if (data.reminderMessage !== undefined) {
        updateData.reminderMessage = data.reminderMessage;
      }

      await docRef.set(updateData, { merge: true });

      return {
        success: true,
        message: "Message templates updated successfully",
      };
    } catch (error: any) {
      console.error("Error updating message templates:", error);
      throw new HttpsError(
        "internal",
        error.message || "Failed to update message templates"
      );
    }
  }
);

/**
 * テンプレートのプレースホルダーを置換
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}
