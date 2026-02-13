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
exports.registerLineCustomer = exports.cancelCustomerAppointment = exports.createCustomerAppointment = exports.getCustomerCharts = exports.getCustomerAppointments = exports.getCustomerByLineUserId = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
/**
 * 顧客ポータル用API
 * LIFF経由で顧客が自分の情報にアクセスするためのエンドポイント
 */
// ===== スキーマ定義 =====
const getCustomerByLineUserIdSchema = zod_1.z.object({
    lineUserId: zod_1.z.string(),
    tenantId: zod_1.z.string(),
});
const getCustomerAppointmentsSchema = zod_1.z.object({
    lineUserId: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    limit: zod_1.z.number().optional().default(10),
});
const getCustomerChartsSchema = zod_1.z.object({
    lineUserId: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    limit: zod_1.z.number().optional().default(20),
});
const createCustomerAppointmentSchema = zod_1.z.object({
    lineUserId: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    serviceIds: zod_1.z.array(zod_1.z.string()),
    startAt: zod_1.z.string(), // ISO date string
    notes: zod_1.z.string().optional(),
});
const cancelCustomerAppointmentSchema = zod_1.z.object({
    lineUserId: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    appointmentId: zod_1.z.string(),
});
const registerLineCustomerSchema = zod_1.z.object({
    lineUserId: zod_1.z.string(),
    tenantId: zod_1.z.string(),
    displayName: zod_1.z.string(),
    pictureUrl: zod_1.z.string().optional(),
});
// ===== API実装 =====
/**
 * LINE User IDから顧客情報を取得
 */
exports.getCustomerByLineUserId = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    try {
        const { lineUserId, tenantId } = getCustomerByLineUserIdSchema.parse(request.data);
        const db = admin.firestore();
        const customersRef = db.collection(`tenants/${tenantId}/customers`);
        // LINE User IDで顧客を検索
        const snapshot = await customersRef
            .where("lineUserId", "==", lineUserId)
            .limit(1)
            .get();
        if (snapshot.empty) {
            throw new https_1.HttpsError("not-found", "顧客情報が見つかりませんでした");
        }
        const customerDoc = snapshot.docs[0];
        const customerData = customerDoc.data();
        return {
            success: true,
            customer: {
                id: customerDoc.id,
                ...customerData,
                createdAt: customerData.createdAt?.toDate().toISOString(),
                updatedAt: customerData.updatedAt?.toDate().toISOString(),
                lastVisit: customerData.lastVisit?.toDate().toISOString(),
                lineLinkedAt: customerData.lineLinkedAt?.toDate().toISOString(),
            },
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        console.error("Error getting customer by LINE User ID:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to get customer");
    }
});
/**
 * 顧客の予約一覧を取得
 */
exports.getCustomerAppointments = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    try {
        const { lineUserId, tenantId, limit } = getCustomerAppointmentsSchema.parse(request.data);
        const db = admin.firestore();
        // 顧客情報を取得
        const customersRef = db.collection(`tenants/${tenantId}/customers`);
        const customerSnapshot = await customersRef
            .where("lineUserId", "==", lineUserId)
            .limit(1)
            .get();
        if (customerSnapshot.empty) {
            throw new https_1.HttpsError("not-found", "顧客情報が見つかりませんでした");
        }
        const customerId = customerSnapshot.docs[0].id;
        // 予約を取得（未来の予約のみ）
        const now = admin.firestore.Timestamp.now();
        const appointmentsRef = db.collection(`tenants/${tenantId}/appointments`);
        const appointmentsSnapshot = await appointmentsRef
            .where("customerId", "==", customerId)
            .where("startAt", ">=", now)
            .where("status", "in", ["scheduled", "confirmed"])
            .orderBy("startAt", "asc")
            .limit(limit)
            .get();
        const appointments = await Promise.all(appointmentsSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            // サービス情報を取得
            const services = await Promise.all((data.serviceIds || []).map(async (serviceId) => {
                const serviceDoc = await db
                    .collection(`tenants/${tenantId}/services`)
                    .doc(serviceId)
                    .get();
                if (serviceDoc.exists) {
                    const serviceData = serviceDoc.data();
                    return {
                        id: serviceDoc.id,
                        name: serviceData?.name,
                        price: serviceData?.price,
                        durationMinutes: serviceData?.durationMinutes,
                    };
                }
                return null;
            }));
            // スタッフ情報を取得
            let staffName = "未定";
            if (data.staffId) {
                const staffDoc = await db
                    .collection(`tenants/${tenantId}/staff`)
                    .doc(data.staffId)
                    .get();
                if (staffDoc.exists) {
                    staffName = staffDoc.data()?.name || "未定";
                }
            }
            return {
                id: doc.id,
                startAt: data.startAt?.toDate().toISOString(),
                endAt: data.endAt?.toDate().toISOString(),
                status: data.status,
                notes: data.notes,
                services: services.filter((s) => s !== null),
                staffName,
                pricing: data.pricing,
            };
        }));
        return {
            success: true,
            appointments,
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        console.error("Error getting customer appointments:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to get appointments");
    }
});
/**
 * 顧客のカルテ一覧を取得
 */
exports.getCustomerCharts = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    try {
        const { lineUserId, tenantId, limit } = getCustomerChartsSchema.parse(request.data);
        const db = admin.firestore();
        // 顧客情報を取得
        const customersRef = db.collection(`tenants/${tenantId}/customers`);
        const customerSnapshot = await customersRef
            .where("lineUserId", "==", lineUserId)
            .limit(1)
            .get();
        if (customerSnapshot.empty) {
            throw new https_1.HttpsError("not-found", "顧客情報が見つかりませんでした");
        }
        const customerId = customerSnapshot.docs[0].id;
        // カルテを取得
        const chartsRef = db.collection(`tenants/${tenantId}/charts`);
        const chartsSnapshot = await chartsRef
            .where("customerId", "==", customerId)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        const charts = await Promise.all(chartsSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            // 予約情報を取得
            let appointmentInfo = null;
            if (data.appointmentId) {
                const appointmentDoc = await db
                    .collection(`tenants/${tenantId}/appointments`)
                    .doc(data.appointmentId)
                    .get();
                if (appointmentDoc.exists) {
                    const appointmentData = appointmentDoc.data();
                    appointmentInfo = {
                        startAt: appointmentData?.startAt?.toDate().toISOString(),
                    };
                }
            }
            // スタッフ情報を取得
            let staffName = "未記録";
            if (data.staffId) {
                const staffDoc = await db
                    .collection(`tenants/${tenantId}/staff`)
                    .doc(data.staffId)
                    .get();
                if (staffDoc.exists) {
                    staffName = staffDoc.data()?.name || "未記録";
                }
            }
            // 次回推奨日を計算
            let nextRecommendedDate = null;
            if (data.effectPeriodDays && data.createdAt) {
                const chartDate = data.createdAt.toDate();
                const nextDate = new Date(chartDate);
                nextDate.setDate(nextDate.getDate() + data.effectPeriodDays);
                nextRecommendedDate = nextDate.toISOString();
            }
            return {
                id: doc.id,
                photos: data.photos || [],
                tags: data.tags || [],
                notes: data.notes || "",
                cautions: data.cautions || "",
                effectPeriodDays: data.effectPeriodDays,
                staffName,
                appointmentInfo,
                nextRecommendedDate,
                createdAt: data.createdAt?.toDate().toISOString(),
                updatedAt: data.updatedAt?.toDate().toISOString(),
            };
        }));
        return {
            success: true,
            charts,
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        console.error("Error getting customer charts:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to get charts");
    }
});
/**
 * 顧客が予約を作成（LIFF経由）
 */
exports.createCustomerAppointment = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    try {
        const { lineUserId, tenantId, serviceIds, startAt, notes } = createCustomerAppointmentSchema.parse(request.data);
        const db = admin.firestore();
        // 顧客情報を取得
        const customersRef = db.collection(`tenants/${tenantId}/customers`);
        const customerSnapshot = await customersRef
            .where("lineUserId", "==", lineUserId)
            .limit(1)
            .get();
        if (customerSnapshot.empty) {
            throw new https_1.HttpsError("not-found", "顧客情報が見つかりませんでした");
        }
        const customerId = customerSnapshot.docs[0].id;
        // サービス情報を取得して合計時間と料金を計算
        let totalDuration = 0;
        let totalPrice = 0;
        let eligibleCount = 0;
        for (const serviceId of serviceIds) {
            const serviceDoc = await db
                .collection(`tenants/${tenantId}/services`)
                .doc(serviceId)
                .get();
            if (!serviceDoc.exists) {
                throw new https_1.HttpsError("not-found", `サービスが見つかりません: ${serviceId}`);
            }
            const serviceData = serviceDoc.data();
            totalDuration += serviceData?.durationMinutes || 0;
            totalPrice += serviceData?.price || 0;
            if (serviceData?.setDiscountEligible) {
                eligibleCount++;
            }
        }
        // セット割引を適用
        const settingsDoc = await db
            .collection(`tenants/${tenantId}/settings`)
            .doc(tenantId)
            .get();
        let discount = 0;
        const setDiscountConfig = settingsDoc.data()?.setDiscountConfig;
        if (setDiscountConfig?.enabled && eligibleCount >= 2) {
            const rules = setDiscountConfig.rules || [];
            // 適用可能な最大の割引を見つける
            for (const rule of rules) {
                if (eligibleCount >= rule.quantity) {
                    discount = Math.max(discount, totalPrice * rule.discountRate);
                }
            }
        }
        const finalPrice = totalPrice - discount;
        // 予約を作成
        const startAtDate = admin.firestore.Timestamp.fromDate(new Date(startAt));
        const endAtDate = admin.firestore.Timestamp.fromDate(new Date(new Date(startAt).getTime() + totalDuration * 60 * 1000));
        const appointmentRef = await db
            .collection(`tenants/${tenantId}/appointments`)
            .add({
            tenantId,
            customerId,
            staffId: "", // LIFF経由の予約はスタッフ未定
            serviceIds,
            startAt: startAtDate,
            endAt: endAtDate,
            status: "scheduled",
            notes: notes || "",
            pricing: {
                subtotal: totalPrice,
                discount,
                total: finalPrice,
                eligibleCount,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 予約完了メッセージを送信（エラーがあってもメイン処理には影響させない）
        try {
            // テナント情報を取得
            const tenantDoc = await db.collection("tenants").doc(tenantId).get();
            const tenantData = tenantDoc.data();
            const salonName = tenantData?.name || "当店";
            // 顧客情報を取得
            const customerDoc = customerSnapshot.docs[0];
            const customerData = customerDoc.data();
            const customerName = customerData?.name || "お客様";
            // サービス名を取得
            const serviceNames = await Promise.all(serviceIds.map(async (serviceId) => {
                const serviceDoc = await db
                    .collection(`tenants/${tenantId}/services`)
                    .doc(serviceId)
                    .get();
                return serviceDoc.exists ? serviceDoc.data()?.name : null;
            }));
            const serviceName = serviceNames.filter((n) => n).join(", ") || "サービス";
            // 日時フォーマット
            const appointmentDate = new Intl.DateTimeFormat("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Tokyo",
            }).format(new Date(startAt));
            // メッセージテンプレートを取得
            const templateDoc = await db
                .collection(`tenants/${tenantId}/lineSettings`)
                .doc("messageTemplates")
                .get();
            let messageBody = "";
            if (templateDoc.exists && templateDoc.data()?.bookingConfirmationMessage) {
                // カスタムテンプレートを使用
                messageBody = templateDoc.data()?.bookingConfirmationMessage || "";
                // 変数を置換
                messageBody = messageBody
                    .replace(/\{\{customerName\}\}/g, customerName)
                    .replace(/\{\{appointmentDate\}\}/g, appointmentDate)
                    .replace(/\{\{serviceName\}\}/g, serviceName)
                    .replace(/\{\{salonName\}\}/g, salonName);
            }
            else {
                // デフォルトメッセージ
                messageBody = `${customerName} 様\n\nご予約ありがとうございます。\n\n【予約内容】\n日時: ${appointmentDate}\nサービス: ${serviceName}\n\n${salonName} にてお待ちしております。`;
            }
            // LINE設定を確認
            const lineSettings = tenantData?.settings?.line;
            const featureFlags = tenantData?.settings?.featureFlags;
            if (featureFlags?.lineIntegration &&
                lineSettings?.channelAccessToken &&
                customerData?.lineUserId) {
                // LINE Messaging APIでメッセージ送信
                const axios = require("axios");
                await axios.post("https://api.line.me/v2/bot/message/push", {
                    to: customerData.lineUserId,
                    messages: [
                        {
                            type: "text",
                            text: messageBody,
                        },
                    ],
                }, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${lineSettings.channelAccessToken}`,
                    },
                });
                console.log(`✅ Booking confirmation message sent to ${customerName}`);
            }
        }
        catch (messageError) {
            // メッセージ送信エラーはログに記録するだけで、予約作成は成功とする
            console.error("Failed to send booking confirmation message:", messageError);
        }
        return {
            success: true,
            appointmentId: appointmentRef.id,
            message: "予約を作成しました。店舗からの確認をお待ちください。",
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        console.error("Error creating customer appointment:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to create appointment");
    }
});
/**
 * 顧客が予約をキャンセル
 */
exports.cancelCustomerAppointment = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    try {
        const { lineUserId, tenantId, appointmentId } = cancelCustomerAppointmentSchema.parse(request.data);
        const db = admin.firestore();
        // 顧客情報を取得
        const customersRef = db.collection(`tenants/${tenantId}/customers`);
        const customerSnapshot = await customersRef
            .where("lineUserId", "==", lineUserId)
            .limit(1)
            .get();
        if (customerSnapshot.empty) {
            throw new https_1.HttpsError("not-found", "顧客情報が見つかりませんでした");
        }
        const customerId = customerSnapshot.docs[0].id;
        // 予約を取得
        const appointmentRef = db
            .collection(`tenants/${tenantId}/appointments`)
            .doc(appointmentId);
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) {
            throw new https_1.HttpsError("not-found", "予約が見つかりませんでした");
        }
        const appointmentData = appointmentDoc.data();
        // 顧客本人の予約か確認
        if (appointmentData?.customerId !== customerId) {
            throw new https_1.HttpsError("permission-denied", "この予約をキャンセルする権限がありません");
        }
        // キャンセル可能な状態か確認
        if (appointmentData?.status !== "scheduled" &&
            appointmentData?.status !== "confirmed") {
            throw new https_1.HttpsError("failed-precondition", "この予約はキャンセルできません");
        }
        // 予約をキャンセル
        await appointmentRef.update({
            status: "canceled",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            success: true,
            message: "予約をキャンセルしました",
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        console.error("Error canceling customer appointment:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to cancel appointment");
    }
});
/**
 * LINE顧客を登録または取得（LIFF初回アクセス時に自動呼び出し）
 */
exports.registerLineCustomer = (0, https_1.onCall)({ region: "asia-northeast1", cors: true }, async (request) => {
    try {
        const { lineUserId, tenantId, displayName, pictureUrl } = registerLineCustomerSchema.parse(request.data);
        const db = admin.firestore();
        const customersRef = db.collection(`tenants/${tenantId}/customers`);
        // 既存の顧客を検索
        const existingSnapshot = await customersRef
            .where("lineUserId", "==", lineUserId)
            .limit(1)
            .get();
        if (!existingSnapshot.empty) {
            // 既に登録されている場合は既存の顧客情報を返す
            const customerDoc = existingSnapshot.docs[0];
            const customerData = customerDoc.data();
            return {
                success: true,
                customer: {
                    id: customerDoc.id,
                    ...customerData,
                    createdAt: customerData.createdAt?.toDate().toISOString(),
                    updatedAt: customerData.updatedAt?.toDate().toISOString(),
                    lastVisit: customerData.lastVisit?.toDate().toISOString(),
                    lineLinkedAt: customerData.lineLinkedAt?.toDate().toISOString(),
                },
                isNew: false,
            };
        }
        // 新しい顧客を作成
        const newCustomerRef = await customersRef.add({
            tenantId,
            lineUserId,
            name: displayName,
            kana: "", // LINEからは取得できないため空
            phone: "", // LINEからは取得できないため空
            email: "", // LINEからは取得できないため空
            pictureUrl: pictureUrl || "",
            lineLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            tags: [],
            notes: "LINE経由で登録",
        });
        const newCustomerDoc = await newCustomerRef.get();
        const newCustomerData = newCustomerDoc.data();
        return {
            success: true,
            customer: {
                id: newCustomerRef.id,
                ...newCustomerData,
                createdAt: newCustomerData?.createdAt?.toDate().toISOString(),
                updatedAt: newCustomerData?.updatedAt?.toDate().toISOString(),
                lineLinkedAt: newCustomerData?.lineLinkedAt?.toDate().toISOString(),
            },
            isNew: true,
            message: "新しい顧客として登録しました",
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        console.error("Error registering LINE customer:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to register customer");
    }
});
//# sourceMappingURL=customerPortal.js.map