import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireTenantAccess } from "../utils/middleware";
import { z } from "zod";

const generateSuggestionSchema = z.object({
  tenantId: z.string(),
  customerId: z.string(),
  context: z.string().optional(),
});

export const generateSuggestion = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, customerId } = generateSuggestionSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();

      // In production, this would call Claude API
      // For now, generate a simple suggestion
      const messageBody = `こんにちは！前回の施術から時間が経ちましたので、次回のご予約はいかがでしょうか？`;
      const reason = `来店間隔が30日を超えています`;

      const suggestionRef = await db.collection(`tenants/${tenantId}/ai_suggestions`).add({
        tenantId,
        customerId,
        messageBody,
        reason,
        scheduledAt: new Date(),
        approved: false,
        priority: 5,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        suggestionId: suggestionRef.id,
        messageBody,
        reason,
      };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to generate suggestion");
    }
  }
);

const sendMessageSchema = z.object({
  tenantId: z.string(),
  suggestionId: z.string(),
});

export const sendMessage = onCall(
  { region: "asia-northeast1", cors: true },
  async (request) => {
    requireAuth(request);

    const { tenantId, suggestionId } = sendMessageSchema.parse(request.data);
    await requireTenantAccess(request, tenantId);

    try {
      const db = admin.firestore();

      // Get suggestion
      const suggestionDoc = await db
        .collection(`tenants/${tenantId}/ai_suggestions`)
        .doc(suggestionId)
        .get();

      if (!suggestionDoc.exists) {
        throw new HttpsError("not-found", "Suggestion not found");
      }

      const suggestion = suggestionDoc.data();

      if (!suggestion?.approved) {
        throw new HttpsError("failed-precondition", "Suggestion must be approved before sending");
      }

      // Create message record
      const messageRef = await db.collection(`tenants/${tenantId}/messages`).add({
        tenantId,
        customerId: suggestion.customerId,
        channel: "email",
        purpose: "nba",
        body: suggestion.messageBody,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update suggestion
      await suggestionDoc.ref.update({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // In production, send actual email via SendGrid/Gmail
      console.log("Message sent:", messageRef.id);

      return { success: true, messageId: messageRef.id };
    } catch (error: any) {
      throw new HttpsError("internal", error.message || "Failed to send message");
    }
  }
);
