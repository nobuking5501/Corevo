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
exports.sendAppointmentReminders = exports.sendLineMessage = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const zod_1 = require("zod");
const middleware_1 = require("../utils/middleware");
const line_1 = require("../utils/line");
// リクエストスキーマ
const sendMessageSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    messageBody: zod_1.z.string(),
    messageType: zod_1.z.enum(["text", "appointmentReminder"]).optional(),
    // 予約リマインダー用のオプションフィールド
    appointmentDate: zod_1.z.string().optional(),
    serviceName: zod_1.z.string().optional(),
});
/**
 * LINE メッセージ送信 Callable Function
 * フロントエンドから呼び出されて、顧客にLINEメッセージを送信
 */
exports.sendLineMessage = (0, https_1.onCall)({ region: "asia-northeast1" }, async (request) => {
    // 認証チェック
    (0, middleware_1.requireAuth)(request);
    const context = request;
    // リクエストボディの検証
    const parsed = sendMessageSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError("invalid-argument", "Invalid request data", {
            errors: parsed.error.errors,
        });
    }
    const { tenantId, customerId, messageBody, messageType, appointmentDate, serviceName } = parsed.data;
    // テナントアクセス権限チェック
    await (0, middleware_1.requireTenantAccess)(context, tenantId);
    try {
        // テナントのLINE設定を取得
        const lineConfig = await (0, line_1.getTenantLineConfig)(tenantId);
        if (!lineConfig || !lineConfig.isEnabled) {
            throw new https_1.HttpsError("failed-precondition", "LINE integration is not enabled for this tenant");
        }
        // 顧客情報を取得
        const db = admin.firestore();
        const customerDoc = await db
            .collection(`tenants/${tenantId}/customers`)
            .doc(customerId)
            .get();
        if (!customerDoc.exists) {
            throw new https_1.HttpsError("not-found", "Customer not found");
        }
        const customerData = customerDoc.data();
        if (!customerData) {
            throw new https_1.HttpsError("not-found", "Customer data is empty");
        }
        // LINE User IDを確認
        const lineUserId = customerData.lineUserId;
        if (!lineUserId) {
            throw new https_1.HttpsError("failed-precondition", "Customer has not linked their LINE account");
        }
        // LINE同意フラグを確認
        if (customerData.lineConsent === false) {
            throw new https_1.HttpsError("failed-precondition", "Customer has opted out of LINE messages");
        }
        // メッセージを作成
        let messages;
        if (messageType === "appointmentReminder" && appointmentDate && serviceName) {
            // 予約リマインダーメッセージ
            const tenantDoc = await db.collection("tenants").doc(tenantId).get();
            const salonName = tenantDoc.data()?.name || "サロン";
            messages = [(0, line_1.createAppointmentReminderMessage)(appointmentDate, serviceName, salonName)];
        }
        else {
            // 通常のテキストメッセージ
            messages = [(0, line_1.createTextMessage)(messageBody)];
        }
        // LINEメッセージを送信
        await (0, line_1.pushMessage)(lineUserId, messages, lineConfig.channelAccessToken);
        // メッセージ履歴を保存
        await db.collection(`tenants/${tenantId}/messages`).add({
            tenantId,
            customerId,
            channel: "line",
            purpose: messageType || "manual",
            body: messageBody,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            sentBy: context.auth.uid,
        });
        return { success: true, message: "LINE message sent successfully" };
    }
    catch (error) {
        console.error("Error sending LINE message:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Failed to send LINE message", { error: String(error) });
    }
});
/**
 * 予約リマインダーを送信（バッチ処理用）
 */
exports.sendAppointmentReminders = (0, https_1.onCall)({ region: "asia-northeast1" }, async (request) => {
    // 認証チェック（管理者のみ実行可能）
    (0, middleware_1.requireAuth)(request);
    try {
        const db = admin.firestore();
        // 24時間後の予約を取得
        const tomorrow = new Date();
        tomorrow.setHours(tomorrow.getHours() + 24);
        const tomorrowStart = admin.firestore.Timestamp.fromDate(new Date(tomorrow.setHours(0, 0, 0, 0)));
        const tomorrowEnd = admin.firestore.Timestamp.fromDate(new Date(tomorrow.setHours(23, 59, 59, 999)));
        // すべてのテナントを取得
        const tenantsSnapshot = await db.collection("tenants").get();
        let totalSent = 0;
        let totalErrors = 0;
        for (const tenantDoc of tenantsSnapshot.docs) {
            const tenantId = tenantDoc.id;
            // LINE連携が有効か確認
            const lineConfig = await (0, line_1.getTenantLineConfig)(tenantId);
            if (!lineConfig || !lineConfig.isEnabled) {
                continue;
            }
            // 明日の予約を取得
            const appointmentsSnapshot = await db
                .collection(`tenants/${tenantId}/appointments`)
                .where("startAt", ">=", tomorrowStart)
                .where("startAt", "<=", tomorrowEnd)
                .where("status", "==", "confirmed")
                .get();
            for (const appointmentDoc of appointmentsSnapshot.docs) {
                try {
                    const appointment = appointmentDoc.data();
                    // 顧客情報を取得
                    const customerDoc = await db
                        .collection(`tenants/${tenantId}/customers`)
                        .doc(appointment.customerId)
                        .get();
                    if (!customerDoc.exists) {
                        continue;
                    }
                    const customerData = customerDoc.data();
                    if (!customerData?.lineUserId ||
                        customerData.lineConsent === false) {
                        continue;
                    }
                    // サービス情報を取得
                    let serviceName = "サービス情報なし";
                    if (appointment.serviceId) {
                        const serviceDoc = await db
                            .collection(`tenants/${tenantId}/services`)
                            .doc(appointment.serviceId)
                            .get();
                        if (serviceDoc.exists) {
                            serviceName = serviceDoc.data()?.name || serviceName;
                        }
                    }
                    // 予約日時をフォーマット
                    const appointmentDate = appointment.startAt.toDate().toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Tokyo",
                    });
                    // サロン名を取得
                    const salonName = tenantDoc.data()?.name || "サロン";
                    // 顧客名を取得
                    const customerName = customerData?.name || "お客様";
                    // メッセージテンプレートを取得
                    const templateDoc = await db
                        .collection(`tenants/${tenantId}/lineSettings`)
                        .doc("messageTemplates")
                        .get();
                    let messageBody = "";
                    if (templateDoc.exists && templateDoc.data()?.reminderMessage) {
                        // カスタムテンプレートを使用
                        messageBody = templateDoc.data()?.reminderMessage || "";
                        // 変数を置換
                        messageBody = messageBody
                            .replace(/\{\{customerName\}\}/g, customerName)
                            .replace(/\{\{appointmentDate\}\}/g, appointmentDate)
                            .replace(/\{\{serviceName\}\}/g, serviceName)
                            .replace(/\{\{salonName\}\}/g, salonName);
                    }
                    else {
                        // デフォルトメッセージ（既存の動作を維持）
                        messageBody = `${customerName} 様\n\n明日のご予約のリマインドです。\n\n【予約内容】\n日時: ${appointmentDate}\nサービス: ${serviceName}\n\nご来店をお待ちしております。\n${salonName}`;
                    }
                    // リマインダーメッセージを送信
                    await (0, line_1.pushMessage)(customerData.lineUserId, [(0, line_1.createTextMessage)(messageBody)], lineConfig.channelAccessToken);
                    // メッセージ履歴を保存
                    await db.collection(`tenants/${tenantId}/messages`).add({
                        tenantId,
                        customerId: appointment.customerId,
                        channel: "line",
                        purpose: "appointmentReminder",
                        body: `予約リマインダー: ${appointmentDate} ${serviceName}`,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                        sentBy: "system",
                    });
                    totalSent++;
                }
                catch (error) {
                    console.error(`Failed to send reminder for appointment ${appointmentDoc.id}:`, error);
                    totalErrors++;
                }
            }
        }
        return {
            success: true,
            totalSent,
            totalErrors,
            message: `Sent ${totalSent} reminders with ${totalErrors} errors`,
        };
    }
    catch (error) {
        console.error("Error sending appointment reminders:", error);
        throw new https_1.HttpsError("internal", "Failed to send appointment reminders", { error: String(error) });
    }
});
//# sourceMappingURL=lineSendMessage.js.map