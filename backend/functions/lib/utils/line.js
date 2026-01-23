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
exports.verifySignature = verifySignature;
exports.getProfile = getProfile;
exports.pushMessage = pushMessage;
exports.replyMessage = replyMessage;
exports.createTextMessage = createTextMessage;
exports.createAppointmentReminderMessage = createAppointmentReminderMessage;
exports.pushMessageWithRetry = pushMessageWithRetry;
exports.getTenantLineConfig = getTenantLineConfig;
const crypto = __importStar(require("crypto"));
const LINE_API_BASE = "https://api.line.me/v2/bot";
/**
 * LINE Webhook署名の検証
 * @param body リクエストボディ（文字列）
 * @param signature X-LINE-Signatureヘッダーの値
 * @param channelSecret LINE Channel Secret
 */
function verifySignature(body, signature, channelSecret) {
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
async function getProfile(userId, accessToken) {
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
        const data = await response.json();
        return data;
    }
    catch (error) {
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
async function pushMessage(userId, messages, accessToken) {
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
    }
    catch (error) {
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
async function replyMessage(replyToken, messages, accessToken) {
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
    }
    catch (error) {
        console.error("Failed to reply message:", error);
        throw error;
    }
}
/**
 * テキストメッセージオブジェクトの作成
 * @param text メッセージテキスト
 */
function createTextMessage(text) {
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
function createAppointmentReminderMessage(appointmentDate, serviceName, salonName) {
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
async function pushMessageWithRetry(userId, messages, accessToken, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            await pushMessage(userId, messages, accessToken);
            return;
        }
        catch (error) {
            lastError = error;
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
async function getTenantLineConfig(tenantId) {
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
    }
    catch (error) {
        console.error("Failed to get tenant LINE config:", error);
        return null;
    }
}
//# sourceMappingURL=line.js.map