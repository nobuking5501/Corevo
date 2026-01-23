import * as crypto from "crypto";

const LINE_API_BASE = "https://api.line.me/v2/bot";

/**
 * LINE Webhook署名の検証
 * @param body リクエストボディ（文字列）
 * @param signature X-LINE-Signatureヘッダーの値
 * @param channelSecret LINE Channel Secret
 */
export function verifySignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  const hash = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

/**
 * LINEユーザープロフィールの取得
 * @param userId LINE User ID
 * @param accessToken LINE Channel Access Token
 */
export async function getProfile(
  userId: string,
  accessToken: string
): Promise<{
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
}> {
  try {
    const response = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to get LINE profile:", errorText);
      throw new Error(`LINE API error: ${response.status}`);
    }

    const data = await response.json() as {
      displayName: string;
      userId: string;
      pictureUrl?: string;
      statusMessage?: string;
    };
    return data;
  } catch (error) {
    console.error("Failed to get profile:", error);
    throw error;
  }
}

/**
 * LINEプッシュメッセージの送信
 * @param userId LINE User ID
 * @param messages LINEメッセージの配列
 * @param accessToken LINE Channel Access Token
 */
export async function pushMessage(
  userId: string,
  messages: any[],
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(`${LINE_API_BASE}/message/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to push LINE message:", errorText);
      throw new Error(`LINE API error: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to push message:", error);
    throw error;
  }
}

/**
 * LINE返信メッセージの送信
 * @param replyToken Reply Token
 * @param messages LINEメッセージの配列
 * @param accessToken LINE Channel Access Token
 */
export async function replyMessage(
  replyToken: string,
  messages: any[],
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(`${LINE_API_BASE}/message/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to reply LINE message:", errorText);
      throw new Error(`LINE API error: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to reply message:", error);
    throw error;
  }
}

/**
 * テキストメッセージオブジェクトの作成
 * @param text メッセージテキスト
 */
export function createTextMessage(text: string): any {
  return {
    type: "text",
    text,
  };
}

/**
 * Flex Messageオブジェクトの作成（予約リマインダー用）
 * @param appointmentDate 予約日時
 * @param serviceName サービス名
 * @param salonName サロン名
 */
export function createAppointmentReminderMessage(
  appointmentDate: string,
  serviceName: string,
  salonName: string
): any {
  return {
    type: "flex",
    altText: `【予約リマインダー】${appointmentDate} ${serviceName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "予約リマインダー",
            weight: "bold",
            size: "lg",
            color: "#ffffff",
          },
        ],
        backgroundColor: "#6C63FF",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: salonName,
            weight: "bold",
            size: "md",
            margin: "md",
          },
          {
            type: "text",
            text: `ご予約日時: ${appointmentDate}`,
            size: "sm",
            color: "#666666",
            margin: "md",
          },
          {
            type: "text",
            text: `サービス: ${serviceName}`,
            size: "sm",
            color: "#666666",
            margin: "md",
          },
          {
            type: "text",
            text: "ご来店をお待ちしております！",
            size: "sm",
            margin: "lg",
          },
        ],
      },
    },
  };
}

/**
 * 指数バックオフでプッシュメッセージを送信（リトライ機能付き）
 * @param userId LINE User ID
 * @param messages LINEメッセージの配列
 * @param accessToken LINE Channel Access Token
 * @param maxRetries 最大リトライ回数
 */
export async function pushMessageWithRetry(
  userId: string,
  messages: any[],
  accessToken: string,
  maxRetries = 3
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await pushMessage(userId, messages, accessToken);
      return;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Push message attempt ${attempt + 1} failed:`, error);

      if (attempt < maxRetries - 1) {
        // 指数バックオフ: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Failed to push message after retries");
}

/**
 * テナントのLINE設定を取得
 * @param tenantId テナントID
 */
export async function getTenantLineConfig(
  tenantId: string
): Promise<{
  channelAccessToken: string;
  channelSecret: string;
  isEnabled: boolean;
} | null> {
  const admin = require("firebase-admin");
  const db = admin.firestore();

  try {
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();

    if (!tenantDoc.exists) {
      return null;
    }

    const tenantData = tenantDoc.data();
    const settings = tenantData?.settings || {};

    // LINE連携がEnterprise プランでのみ有効か確認
    const plan = tenantData?.plan || "free";
    const featureFlags = settings?.featureFlags || {};
    const isEnabled = plan === "enterprise" && featureFlags?.lineIntegration === true;

    if (!isEnabled) {
      return null;
    }

    // LINE認証情報を取得
    const lineSettings = settings?.line || {};
    const channelAccessToken = lineSettings?.channelAccessToken || "";
    const channelSecret = lineSettings?.channelSecret || "";

    if (!channelAccessToken || !channelSecret) {
      return null;
    }

    return {
      channelAccessToken,
      channelSecret,
      isEnabled: true,
    };
  } catch (error) {
    console.error("Failed to get tenant LINE config:", error);
    return null;
  }
}
