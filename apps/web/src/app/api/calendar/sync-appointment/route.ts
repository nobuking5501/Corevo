import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firebase Admin初期化
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

/**
 * 予約をGoogleカレンダーに同期
 * 操作: create, update, delete
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, appointmentId, staffId, operation } = await request.json();

    if (!tenantId || !appointmentId || !staffId || !operation) {
      return NextResponse.json(
        { error: "Required parameters missing" },
        { status: 400 }
      );
    }

    if (!["create", "update", "delete"].includes(operation)) {
      return NextResponse.json(
        { error: "Invalid operation. Must be: create, update, or delete" },
        { status: 400 }
      );
    }

    // スタッフのGoogleカレンダー連携情報を取得
    const connectionRef = db
      .collection(`tenants/${tenantId}/googleCalendarConnections`)
      .doc(staffId);

    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json(
        { error: "Google Calendar connection not found for this staff member" },
        { status: 404 }
      );
    }

    const connectionData = connectionDoc.data();
    if (!connectionData || !connectionData.isActive) {
      return NextResponse.json(
        { error: "Google Calendar connection is not active" },
        { status: 400 }
      );
    }

    // お店用カレンダー連携情報を取得
    const storeConnectionRef = db
      .collection(`tenants/${tenantId}/googleCalendarConnections`)
      .doc("store");

    const storeConnectionDoc = await storeConnectionRef.get();
    const storeConnectionData = storeConnectionDoc.exists ? storeConnectionDoc.data() : null;
    const hasStoreConnection = storeConnectionData && storeConnectionData.isActive;

    // 予約情報を取得
    const appointmentRef = db
      .collection(`tenants/${tenantId}/appointments`)
      .doc(appointmentId);

    const appointmentDoc = await appointmentRef.get();

    if (!appointmentDoc.exists) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const appointmentData = appointmentDoc.data();

    // OAuth2クライアントを作成
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth credentials not configured" },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

    // アクセストークンを設定
    oauth2Client.setCredentials({
      access_token: connectionData.accessToken,
      refresh_token: connectionData.refreshToken,
      expiry_date: connectionData.expiryDate,
    });

    // トークンが期限切れの場合は自動でリフレッシュ
    const now = Date.now();
    if (connectionData.expiryDate && connectionData.expiryDate < now) {
      const { credentials } = await oauth2Client.refreshAccessToken();

      await connectionRef.update({
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date,
        updatedAt: new Date(),
      });

      oauth2Client.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const calendarId = connectionData.calendarId || "primary";

    let result;

    if (operation === "create") {
      // 顧客情報を取得
      const customerDoc = await db
        .collection(`tenants/${tenantId}/customers`)
        .doc(appointmentData?.customerId)
        .get();

      const customerData = customerDoc.exists ? customerDoc.data() : null;

      // サービス情報を取得
      const serviceIds = appointmentData?.serviceIds || [];
      const services = await Promise.all(
        serviceIds.map(async (serviceId: string) => {
          const serviceDoc = await db
            .collection(`tenants/${tenantId}/services`)
            .doc(serviceId)
            .get();
          return serviceDoc.exists ? serviceDoc.data() : null;
        })
      );

      const serviceNames = services
        .filter((s) => s !== null)
        .map((s) => s?.name)
        .join(", ");

      // Googleカレンダーイベントを作成
      const event = {
        summary: `予約: ${customerData?.name || "顧客"} - ${serviceNames}`,
        description: `
【Corevo予約】
顧客: ${customerData?.name || ""}
サービス: ${serviceNames}
ステータス: ${appointmentData?.status === "scheduled" ? "予約済み" : appointmentData?.status === "confirmed" ? "確定" : "その他"}
${appointmentData?.notes ? `メモ: ${appointmentData.notes}` : ""}
        `.trim(),
        start: {
          dateTime: appointmentData?.startAt?.toDate
            ? appointmentData.startAt.toDate().toISOString()
            : new Date(appointmentData?.startAt).toISOString(),
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: appointmentData?.endAt?.toDate
            ? appointmentData.endAt.toDate().toISOString()
            : new Date(appointmentData?.endAt).toISOString(),
          timeZone: "Asia/Tokyo",
        },
        colorId: "2", // 青色（予約）
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "email", minutes: 60 },
          ],
        },
      };

      result = await calendar.events.insert({
        calendarId,
        requestBody: event,
      });

      // FirestoreのappointmentにGoogleEventIDを保存
      const updateData: any = {
        googleEventId: result.data.id,
        syncedToGoogle: true,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      };

      // お店用カレンダーにも同期
      let storeEventId;
      let storeEventLink;
      if (hasStoreConnection && storeConnectionData) {
        try {
          // お店用カレンダーのOAuth2クライアントを作成
          const storeOauth2Client = new google.auth.OAuth2(clientId, clientSecret);
          storeOauth2Client.setCredentials({
            access_token: storeConnectionData.accessToken,
            refresh_token: storeConnectionData.refreshToken,
            expiry_date: storeConnectionData.expiryDate,
          });

          // トークンリフレッシュ処理
          const storeNow = Date.now();
          if (storeConnectionData.expiryDate && storeConnectionData.expiryDate < storeNow) {
            const { credentials } = await storeOauth2Client.refreshAccessToken();
            await storeConnectionRef.update({
              accessToken: credentials.access_token,
              expiryDate: credentials.expiry_date,
              updatedAt: new Date(),
            });
            storeOauth2Client.setCredentials(credentials);
          }

          const storeCalendar = google.calendar({ version: "v3", auth: storeOauth2Client });
          const storeCalendarId = storeConnectionData.calendarId || "primary";

          // お店用カレンダーイベントを作成（スタッフ名プレフィックス付き）
          const storeEvent = {
            summary: `[${connectionData.staffName || "スタッフ"}] 予約: ${customerData?.name || "顧客"} - ${serviceNames}`,
            description: `
【Corevo予約】
担当: ${connectionData.staffName || "スタッフ"}
顧客: ${customerData?.name || ""}
サービス: ${serviceNames}
ステータス: ${appointmentData?.status === "scheduled" ? "予約済み" : appointmentData?.status === "confirmed" ? "確定" : "その他"}
${appointmentData?.notes ? `メモ: ${appointmentData.notes}` : ""}
            `.trim(),
            start: {
              dateTime: appointmentData?.startAt?.toDate
                ? appointmentData.startAt.toDate().toISOString()
                : new Date(appointmentData?.startAt).toISOString(),
              timeZone: "Asia/Tokyo",
            },
            end: {
              dateTime: appointmentData?.endAt?.toDate
                ? appointmentData.endAt.toDate().toISOString()
                : new Date(appointmentData?.endAt).toISOString(),
              timeZone: "Asia/Tokyo",
            },
            colorId: "9", // 青紫色（お店用の予約）
            reminders: {
              useDefault: false,
              overrides: [
                { method: "popup", minutes: 30 },
              ],
            },
          };

          const storeResult = await storeCalendar.events.insert({
            calendarId: storeCalendarId,
            requestBody: storeEvent,
          });

          storeEventId = storeResult.data.id;
          storeEventLink = storeResult.data.htmlLink;

          // お店用カレンダーのイベントIDも保存
          updateData.storeGoogleEventId = storeEventId;
          updateData.syncedToStoreCalendar = true;
        } catch (storeError) {
          console.error("Failed to sync to store calendar:", storeError);
          // お店用カレンダーへの同期が失敗してもスタッフカレンダーの同期は成功とする
        }
      }

      await appointmentRef.update(updateData);

      return NextResponse.json({
        success: true,
        operation: "create",
        googleEventId: result.data.id,
        eventLink: result.data.htmlLink,
        storeGoogleEventId: storeEventId,
        storeEventLink: storeEventLink,
      });
    } else if (operation === "update") {
      const googleEventId = appointmentData?.googleEventId;

      if (!googleEventId) {
        return NextResponse.json(
          { error: "No Google Event ID found. Cannot update." },
          { status: 400 }
        );
      }

      // 顧客情報を取得
      const customerDoc = await db
        .collection(`tenants/${tenantId}/customers`)
        .doc(appointmentData?.customerId)
        .get();

      const customerData = customerDoc.exists ? customerDoc.data() : null;

      // サービス情報を取得
      const serviceIds = appointmentData?.serviceIds || [];
      const services = await Promise.all(
        serviceIds.map(async (serviceId: string) => {
          const serviceDoc = await db
            .collection(`tenants/${tenantId}/services`)
            .doc(serviceId)
            .get();
          return serviceDoc.exists ? serviceDoc.data() : null;
        })
      );

      const serviceNames = services
        .filter((s) => s !== null)
        .map((s) => s?.name)
        .join(", ");

      // Googleカレンダーイベントを更新
      const event = {
        summary: `予約: ${customerData?.name || "顧客"} - ${serviceNames}`,
        description: `
【Corevo予約】
顧客: ${customerData?.name || ""}
サービス: ${serviceNames}
ステータス: ${appointmentData?.status === "scheduled" ? "予約済み" : appointmentData?.status === "confirmed" ? "確定" : appointmentData?.status === "completed" ? "完了" : appointmentData?.status === "canceled" ? "キャンセル" : "その他"}
${appointmentData?.notes ? `メモ: ${appointmentData.notes}` : ""}
        `.trim(),
        start: {
          dateTime: appointmentData?.startAt?.toDate
            ? appointmentData.startAt.toDate().toISOString()
            : new Date(appointmentData?.startAt).toISOString(),
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: appointmentData?.endAt?.toDate
            ? appointmentData.endAt.toDate().toISOString()
            : new Date(appointmentData?.endAt).toISOString(),
          timeZone: "Asia/Tokyo",
        },
        colorId: appointmentData?.status === "canceled" ? "11" : "2", // キャンセル=赤、通常=青
      };

      result = await calendar.events.update({
        calendarId,
        eventId: googleEventId,
        requestBody: event,
      });

      // Firestoreを更新
      const updateData2: any = {
        syncedToGoogle: true,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      };

      // お店用カレンダーにも同期
      let storeEventId2;
      let storeEventLink2;
      if (hasStoreConnection && storeConnectionData) {
        try {
          // お店用カレンダーのOAuth2クライアントを作成
          const storeOauth2Client = new google.auth.OAuth2(clientId, clientSecret);
          storeOauth2Client.setCredentials({
            access_token: storeConnectionData.accessToken,
            refresh_token: storeConnectionData.refreshToken,
            expiry_date: storeConnectionData.expiryDate,
          });

          // トークンリフレッシュ処理
          const storeNow = Date.now();
          if (storeConnectionData.expiryDate && storeConnectionData.expiryDate < storeNow) {
            const { credentials } = await storeOauth2Client.refreshAccessToken();
            await storeConnectionRef.update({
              accessToken: credentials.access_token,
              expiryDate: credentials.expiry_date,
              updatedAt: new Date(),
            });
            storeOauth2Client.setCredentials(credentials);
          }

          const storeCalendar = google.calendar({ version: "v3", auth: storeOauth2Client });
          const storeCalendarId = storeConnectionData.calendarId || "primary";

          const storeGoogleEventId = appointmentData?.storeGoogleEventId;

          // お店用カレンダーイベントを更新（スタッフ名プレフィックス付き）
          const storeEvent = {
            summary: `[${connectionData.staffName || "スタッフ"}] 予約: ${customerData?.name || "顧客"} - ${serviceNames}`,
            description: `
【Corevo予約】
担当: ${connectionData.staffName || "スタッフ"}
顧客: ${customerData?.name || ""}
サービス: ${serviceNames}
ステータス: ${appointmentData?.status === "scheduled" ? "予約済み" : appointmentData?.status === "confirmed" ? "確定" : appointmentData?.status === "completed" ? "完了" : appointmentData?.status === "canceled" ? "キャンセル" : "その他"}
${appointmentData?.notes ? `メモ: ${appointmentData.notes}` : ""}
            `.trim(),
            start: {
              dateTime: appointmentData?.startAt?.toDate
                ? appointmentData.startAt.toDate().toISOString()
                : new Date(appointmentData?.startAt).toISOString(),
              timeZone: "Asia/Tokyo",
            },
            end: {
              dateTime: appointmentData?.endAt?.toDate
                ? appointmentData.endAt.toDate().toISOString()
                : new Date(appointmentData?.endAt).toISOString(),
              timeZone: "Asia/Tokyo",
            },
            colorId: appointmentData?.status === "canceled" ? "11" : "9", // キャンセル=赤、通常=青紫
          };

          if (storeGoogleEventId) {
            // 既存のイベントを更新
            const storeResult = await storeCalendar.events.update({
              calendarId: storeCalendarId,
              eventId: storeGoogleEventId,
              requestBody: storeEvent,
            });

            storeEventId2 = storeResult.data.id;
            storeEventLink2 = storeResult.data.htmlLink;
          } else {
            // お店用カレンダーイベントが存在しない場合は新規作成
            const storeResult = await storeCalendar.events.insert({
              calendarId: storeCalendarId,
              requestBody: storeEvent,
            });

            storeEventId2 = storeResult.data.id;
            storeEventLink2 = storeResult.data.htmlLink;
            updateData2.storeGoogleEventId = storeEventId2;
          }

          updateData2.syncedToStoreCalendar = true;
        } catch (storeError) {
          console.error("Failed to sync to store calendar:", storeError);
          // お店用カレンダーへの同期が失敗してもスタッフカレンダーの同期は成功とする
        }
      }

      await appointmentRef.update(updateData2);

      return NextResponse.json({
        success: true,
        operation: "update",
        googleEventId: result.data.id,
        eventLink: result.data.htmlLink,
        storeGoogleEventId: storeEventId2,
        storeEventLink: storeEventLink2,
      });
    } else if (operation === "delete") {
      const googleEventId = appointmentData?.googleEventId;
      const storeGoogleEventId = appointmentData?.storeGoogleEventId;

      // スタッフカレンダーからイベントを削除
      if (googleEventId) {
        try {
          await calendar.events.delete({
            calendarId,
            eventId: googleEventId,
          });
        } catch (error) {
          console.error("Failed to delete from staff calendar:", error);
        }
      }

      // お店用カレンダーからイベントを削除
      if (hasStoreConnection && storeConnectionData && storeGoogleEventId) {
        try {
          // お店用カレンダーのOAuth2クライアントを作成
          const storeOauth2Client = new google.auth.OAuth2(clientId, clientSecret);
          storeOauth2Client.setCredentials({
            access_token: storeConnectionData.accessToken,
            refresh_token: storeConnectionData.refreshToken,
            expiry_date: storeConnectionData.expiryDate,
          });

          // トークンリフレッシュ処理
          const storeNow = Date.now();
          if (storeConnectionData.expiryDate && storeConnectionData.expiryDate < storeNow) {
            const { credentials } = await storeOauth2Client.refreshAccessToken();
            await storeConnectionRef.update({
              accessToken: credentials.access_token,
              expiryDate: credentials.expiry_date,
              updatedAt: new Date(),
            });
            storeOauth2Client.setCredentials(credentials);
          }

          const storeCalendar = google.calendar({ version: "v3", auth: storeOauth2Client });
          const storeCalendarId = storeConnectionData.calendarId || "primary";

          // お店用カレンダーからイベントを削除
          await storeCalendar.events.delete({
            calendarId: storeCalendarId,
            eventId: storeGoogleEventId,
          });
        } catch (storeError) {
          console.error("Failed to delete from store calendar:", storeError);
        }
      }

      return NextResponse.json({
        success: true,
        operation: "delete",
        googleEventId,
        storeGoogleEventId,
      });
    }

    return NextResponse.json({ success: false, error: "Unknown error" }, { status: 500 });
  } catch (error: any) {
    console.error("Error syncing appointment to Google Calendar:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync appointment" },
      { status: 500 }
    );
  }
}
