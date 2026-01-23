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
exports.sendMessage = exports.generateSuggestion = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const middleware_1 = require("../utils/middleware");
const zod_1 = require("zod");
const generateSuggestionSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    context: zod_1.z.string().optional(),
});
exports.generateSuggestion = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, customerId } = generateSuggestionSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
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
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to generate suggestion");
    }
});
const sendMessageSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    suggestionId: zod_1.z.string(),
});
exports.sendMessage = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    (0, middleware_1.requireAuth)(request);
    const { tenantId, suggestionId } = sendMessageSchema.parse(request.data);
    await (0, middleware_1.requireTenantAccess)(request, tenantId);
    try {
        const db = admin.firestore();
        // Get suggestion
        const suggestionDoc = await db
            .collection(`tenants/${tenantId}/ai_suggestions`)
            .doc(suggestionId)
            .get();
        if (!suggestionDoc.exists) {
            throw new https_1.HttpsError("not-found", "Suggestion not found");
        }
        const suggestion = suggestionDoc.data();
        if (!suggestion?.approved) {
            throw new https_1.HttpsError("failed-precondition", "Suggestion must be approved before sending");
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
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message || "Failed to send message");
    }
});
//# sourceMappingURL=ai.js.map