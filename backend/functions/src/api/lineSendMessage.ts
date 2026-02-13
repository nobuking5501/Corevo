import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { z } from "zod";
import {
  requireAuth,
  requireTenantAccess,
  AuthenticatedContext,
} from "../utils/middleware";
import {
  pushMessage,
  createTextMessage,
  createAppointmentReminderMessage,
  getTenantLineConfig,
} from "../utils/line";

// リクエストスキーマ
const sendMessageSchema = z.object({
  tenantId: z.string(),
  customerId: z.string(),
  messageBody: z.string(),
  messageType: z.enum(["text", "appointmentReminder"]).optional(),
  // 予約リマインダー用のオプションフィールド
  appointmentDate: z.string().optional(),
  serviceName: z.string().optional(),
});

/**
 * LINE メッセージ送信 Callable Function
 * フロントエンドから呼び出されて、顧客にLINEメッセージを送信
 */
export const sendLineMessage = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    // 認証チェック
    requireAuth(request);
    const context = request as AuthenticatedContext;

    // リクエストボディの検証
    const parsed = sendMessageSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid request data", {
        errors: parsed.error.errors,
      });
    }

    const { tenantId, customerId, messageBody, messageType, appointmentDate, serviceName } =
      parsed.data;

    // テナントアクセス権限チェック
    await requireTenantAccess(context, tenantId);

    try {
      // テナントのLINE設定を取得
      const lineConfig = await getTenantLineConfig(tenantId);
      if (!lineConfig || !lineConfig.isEnabled) {
        throw new HttpsError(
          "failed-precondition",
          "LINE integration is not enabled for this tenant"
        );
      }

      // 顧客情報を取得
      const db = admin.firestore();
      const customerDoc = await db
        .collection(`tenants/${tenantId}/customers`)
        .doc(customerId)
        .get();

      if (!customerDoc.exists) {
        throw new HttpsError("not-found", "Customer not found");
      }

      const customerData = customerDoc.data();
      if (!customerData) {
        throw new HttpsError("not-found", "Customer data is empty");
      }

      // LINE User IDを確認
      const lineUserId = customerData.lineUserId;
      if (!lineUserId) {
        throw new HttpsError(
          "failed-precondition",
          "Customer has not linked their LINE account"
        );
      }

      // LINE同意フラグを確認
      if (customerData.lineConsent === false) {
        throw new HttpsError(
          "failed-precondition",
          "Customer has opted out of LINE messages"
        );
      }

      // メッセージを作成
      let messages: any[];
      if (messageType === "appointmentReminder" && appointmentDate && serviceName) {
        // 予約リマインダーメッセージ
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        const salonName = tenantDoc.data()?.name || "サロン";
        messages = [createAppointmentReminderMessage(appointmentDate, serviceName, salonName)];
      } else {
        // 通常のテキストメッセージ
        messages = [createTextMessage(messageBody)];
      }

      // LINEメッセージを送信
      await pushMessage(
        lineUserId,
        messages,
        lineConfig.channelAccessToken
      );

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
    } catch (error) {
      console.error("Error sending LINE message:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to send LINE message",
        { error: String(error) }
      );
    }
  }
);

/**
 * 予約リマインダーを送信（バッチ処理用）
 */
export const sendAppointmentReminders = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    // 認証チェック（管理者のみ実行可能）
    requireAuth(request);

    try {
      const db = admin.firestore();

      // 24時間後の予約を取得
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      const tomorrowStart = admin.firestore.Timestamp.fromDate(
        new Date(tomorrow.setHours(0, 0, 0, 0))
      );
      const tomorrowEnd = admin.firestore.Timestamp.fromDate(
        new Date(tomorrow.setHours(23, 59, 59, 999))
      );

      // すべてのテナントを取得
      const tenantsSnapshot = await db.collection("tenants").get();

      let totalSent = 0;
      let totalErrors = 0;

      for (const tenantDoc of tenantsSnapshot.docs) {
        const tenantId = tenantDoc.id;

        // LINE連携が有効か確認
        const lineConfig = await getTenantLineConfig(tenantId);
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
            if (
              !customerData?.lineUserId ||
              customerData.lineConsent === false
            ) {
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
            } else {
              // デフォルトメッセージ（既存の動作を維持）
              messageBody = `${customerName} 様\n\n明日のご予約のリマインドです。\n\n【予約内容】\n日時: ${appointmentDate}\nサービス: ${serviceName}\n\nご来店をお待ちしております。\n${salonName}`;
            }

            // リマインダーメッセージを送信
            await pushMessage(
              customerData.lineUserId,
              [createTextMessage(messageBody)],
              lineConfig.channelAccessToken
            );

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
          } catch (error) {
            console.error(
              `Failed to send reminder for appointment ${appointmentDoc.id}:`,
              error
            );
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
    } catch (error) {
      console.error("Error sending appointment reminders:", error);
      throw new HttpsError(
        "internal",
        "Failed to send appointment reminders",
        { error: String(error) }
      );
    }
  }
);
