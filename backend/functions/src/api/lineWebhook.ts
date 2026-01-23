import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  verifySignature,
  replyMessage,
  pushMessage,
  createTextMessage,
  getProfile,
  getTenantLineConfig,
} from "../utils/line";

interface WebhookEvent {
  type: string;
  message?: {
    type: string;
    text?: string;
  };
  replyToken: string;
  source: {
    userId?: string;
  };
}

/**
 * LINE Webhook - Webhook署名からテナントを識別してイベントを処理
 */
export const lineWebhook = onRequest(
  {
    region: "asia-northeast1",
  },
  async (req, res) => {
    // POSTメソッドのみ許可
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    // 署名検証
    const signature = req.headers["x-line-signature"] as string;
    if (!signature) {
      res.status(400).send("Missing signature");
      return;
    }

    const body = JSON.stringify(req.body);

    // すべてのテナントを取得して署名検証
    const tenantId = await verifySignatureAndGetTenant(body, signature);
    if (!tenantId) {
      console.error("Invalid signature - no matching tenant found");
      res.status(401).send("Invalid signature");
      return;
    }

    console.log(`Webhook request from tenant: ${tenantId}`);

    try {
      const events: WebhookEvent[] = req.body.events;

      for (const event of events) {
        if (event.type === "message" && event.message?.type === "text") {
          await handleTextMessage(event, tenantId);
        } else if (event.type === "follow") {
          await handleFollowEvent(event, tenantId);
        } else if (event.type === "unfollow") {
          await handleUnfollowEvent(event, tenantId);
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).send("Internal server error");
    }
  }
);

/**
 * 署名検証とテナント識別
 */
async function verifySignatureAndGetTenant(
  body: string,
  signature: string
): Promise<string | null> {
  const db = admin.firestore();

  // すべてのテナントを取得
  const tenantsSnapshot = await db.collection("tenants").get();

  // 各テナントの channelSecret で署名検証
  for (const tenantDoc of tenantsSnapshot.docs) {
    const tenantId = tenantDoc.id;
    const tenantData = tenantDoc.data();

    const settings = tenantData?.settings || {};
    const lineSettings = settings?.line || {};
    const channelSecret = lineSettings?.channelSecret || "";

    if (!channelSecret) {
      continue;
    }

    // 署名検証
    if (verifySignature(body, signature, channelSecret)) {
      return tenantId;
    }
  }

  return null;
}

/**
 * テキストメッセージの処理
 */
async function handleTextMessage(
  event: WebhookEvent,
  tenantId: string
): Promise<void> {
  if (event.message?.type !== "text") {
    return;
  }

  const userId = event.source.userId;
  if (!userId) {
    return;
  }

  const text = event.message.text?.trim() || "";
  const replyToken = event.replyToken;

  try {
    // テナントのLINE設定を取得
    const lineConfig = await getTenantLineConfig(tenantId);
    if (!lineConfig || !lineConfig.isEnabled) {
      console.log(`LINE integration not enabled for tenant: ${tenantId}`);
      return;
    }

    const db = admin.firestore();

    // コマンド処理
    if (text === "予約確認") {
      await handleReservationCheck(
        db,
        userId,
        tenantId,
        replyToken,
        lineConfig.channelAccessToken
      );
    } else if (text === "配信停止") {
      await handleUnsubscribe(
        db,
        userId,
        tenantId,
        replyToken,
        lineConfig.channelAccessToken
      );
    } else if (text === "再開" || text === "配信再開") {
      await handleResubscribe(
        db,
        userId,
        tenantId,
        replyToken,
        lineConfig.channelAccessToken
      );
    } else {
      // デフォルトメッセージ（任意）
      // 必要に応じて自動応答メッセージを実装
    }
  } catch (error) {
    console.error("Error handling text message:", error);
  }
}

/**
 * 友だち追加イベントの処理
 */
async function handleFollowEvent(
  event: WebhookEvent,
  tenantId: string
): Promise<void> {
  const userId = event.source.userId;
  if (!userId) {
    return;
  }

  try {
    // テナントのLINE設定を取得
    const lineConfig = await getTenantLineConfig(tenantId);
    if (!lineConfig || !lineConfig.isEnabled) {
      return;
    }

    // ユーザープロフィールを取得
    const profile = await getProfile(userId, lineConfig.channelAccessToken);

    // 顧客データにLINE情報を保存
    const db = admin.firestore();
    const customersRef = db.collection(`tenants/${tenantId}/customers`);

    // LINE User IDで顧客を検索
    const existingCustomer = await customersRef
      .where("lineUserId", "==", userId)
      .limit(1)
      .get();

    if (existingCustomer.empty) {
      // 新規顧客として登録
      await customersRef.add({
        tenantId,
        name: profile.displayName,
        kana: "",
        lineUserId: userId,
        lineDisplayName: profile.displayName,
        linePictureUrl: profile.pictureUrl || "",
        lineLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
        lineConsent: true,
        phone: "",
        email: "",
        tags: [],
        notes: "LINE友だち追加から登録",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // 既存顧客のLINE情報を更新
      const customerDoc = existingCustomer.docs[0];
      await customerDoc.ref.update({
        lineUserId: userId,
        lineDisplayName: profile.displayName,
        linePictureUrl: profile.pictureUrl || "",
        lineLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
        lineConsent: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // ウェルカムメッセージを送信
    const welcomeMessage = `友だち追加ありがとうございます！\n\nこのアカウントでは予約のリマインダーやお得な情報をお届けします。\n\n「予約確認」と送信すると、予約状況を確認できます。`;
    await pushMessage(
      userId,
      [createTextMessage(welcomeMessage)],
      lineConfig.channelAccessToken
    );
  } catch (error) {
    console.error("Error handling follow event:", error);
  }
}

/**
 * ブロック（友だち削除）イベントの処理
 */
async function handleUnfollowEvent(
  event: WebhookEvent,
  tenantId: string
): Promise<void> {
  const userId = event.source.userId;
  if (!userId) {
    return;
  }

  try {
    const db = admin.firestore();
    const customersRef = db.collection(`tenants/${tenantId}/customers`);

    // LINE User IDで顧客を検索
    const customerSnapshot = await customersRef
      .where("lineUserId", "==", userId)
      .limit(1)
      .get();

    if (!customerSnapshot.empty) {
      const customerDoc = customerSnapshot.docs[0];
      // LINE同意をfalseに更新
      await customerDoc.ref.update({
        lineConsent: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error handling unfollow event:", error);
  }
}

/**
 * 予約確認コマンドの処理
 */
async function handleReservationCheck(
  db: FirebaseFirestore.Firestore,
  userId: string,
  tenantId: string,
  replyToken: string,
  accessToken: string
): Promise<void> {
  // 顧客情報を取得
  const customersSnapshot = await db
    .collection(`tenants/${tenantId}/customers`)
    .where("lineUserId", "==", userId)
    .limit(1)
    .get();

  if (customersSnapshot.empty) {
    await replyMessage(
      replyToken,
      [createTextMessage("顧客情報が見つかりませんでした。")],
      accessToken
    );
    return;
  }

  const customerId = customersSnapshot.docs[0].id;

  // 今後の予約を取得
  const now = admin.firestore.Timestamp.now();
  const appointmentsSnapshot = await db
    .collection(`tenants/${tenantId}/appointments`)
    .where("customerId", "==", customerId)
    .where("startAt", ">=", now)
    .where("status", "==", "confirmed")
    .orderBy("startAt", "asc")
    .limit(5)
    .get();

  if (appointmentsSnapshot.empty) {
    await replyMessage(
      replyToken,
      [createTextMessage("現在、予約はありません。")],
      accessToken
    );
    return;
  }

  // 予約リストを作成
  let message = "【ご予約一覧】\n\n";
  for (const doc of appointmentsSnapshot.docs) {
    const appointment = doc.data();
    const startAt = appointment.startAt.toDate();
    const dateStr = startAt.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });

    // サービス情報を取得（オプション）
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

    message += `📅 ${dateStr}\n`;
    message += `   ${serviceName}\n\n`;
  }

  message += "ご来店をお待ちしております！";

  await replyMessage(
    replyToken,
    [createTextMessage(message)],
    accessToken
  );
}

/**
 * 配信停止コマンドの処理
 */
async function handleUnsubscribe(
  db: FirebaseFirestore.Firestore,
  userId: string,
  tenantId: string,
  replyToken: string,
  accessToken: string
): Promise<void> {
  const customersSnapshot = await db
    .collection(`tenants/${tenantId}/customers`)
    .where("lineUserId", "==", userId)
    .limit(1)
    .get();

  if (!customersSnapshot.empty) {
    const customerDoc = customersSnapshot.docs[0];
    await customerDoc.ref.update({
      lineConsent: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await replyMessage(
    replyToken,
    [
      createTextMessage(
        "配信を停止しました。\n再開する場合は「再開」と送信してください。"
      ),
    ],
    accessToken
  );
}

/**
 * 配信再開コマンドの処理
 */
async function handleResubscribe(
  db: FirebaseFirestore.Firestore,
  userId: string,
  tenantId: string,
  replyToken: string,
  accessToken: string
): Promise<void> {
  const customersSnapshot = await db
    .collection(`tenants/${tenantId}/customers`)
    .where("lineUserId", "==", userId)
    .limit(1)
    .get();

  if (!customersSnapshot.empty) {
    const customerDoc = customersSnapshot.docs[0];
    await customerDoc.ref.update({
      lineConsent: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await replyMessage(
    replyToken,
    [
      createTextMessage(
        "配信を再開しました。\n今後もお得な情報をお届けします！"
      ),
    ],
    accessToken
  );
}
