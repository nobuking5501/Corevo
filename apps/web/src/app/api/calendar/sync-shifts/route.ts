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
 * スタッフのシフト（Googleカレンダーのイベント）をお店用カレンダーに同期
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, staffMemberId, startDate, endDate } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    // お店用カレンダー連携情報を取得
    const storeConnectionRef = db
      .collection(`tenants/${tenantId}/googleCalendarConnections`)
      .doc("store");

    const storeConnectionDoc = await storeConnectionRef.get();

    if (!storeConnectionDoc.exists) {
      return NextResponse.json(
        { error: "Store calendar connection not found" },
        { status: 404 }
      );
    }

    const storeConnectionData = storeConnectionDoc.data();
    if (!storeConnectionData || !storeConnectionData.isActive) {
      return NextResponse.json(
        { error: "Store calendar connection is not active" },
        { status: 400 }
      );
    }

    // OAuth認証情報を取得
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth credentials not configured" },
        { status: 500 }
      );
    }

    // お店用カレンダーのOAuth2クライアントを作成
    const storeOauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    storeOauth2Client.setCredentials({
      access_token: storeConnectionData.accessToken,
      refresh_token: storeConnectionData.refreshToken,
      expiry_date: storeConnectionData.expiryDate,
    });

    // トークンリフレッシュ
    const now = Date.now();
    if (storeConnectionData.expiryDate && storeConnectionData.expiryDate < now) {
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

    // 同期対象のスタッフを取得
    let staffConnections: any[] = [];

    if (staffMemberId) {
      // 特定のスタッフのみ
      const connectionDoc = await db
        .collection(`tenants/${tenantId}/googleCalendarConnections`)
        .doc(staffMemberId)
        .get();

      if (connectionDoc.exists && connectionDoc.data()?.isActive && !connectionDoc.data()?.isStoreCalendar) {
        staffConnections.push({
          id: connectionDoc.id,
          ...connectionDoc.data(),
        });
      }
    } else {
      // 全スタッフ
      const connectionsSnapshot = await db
        .collection(`tenants/${tenantId}/googleCalendarConnections`)
        .where("isActive", "==", true)
        .get();

      staffConnections = connectionsSnapshot.docs
        .filter((doc) => !doc.data().isStoreCalendar) // お店用連携を除外
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
    }

    if (staffConnections.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active staff calendar connections found",
        syncedStaff: 0,
      });
    }

    // 同期期間を設定（デフォルト: 今日から30日間）
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const results = [];

    // 各スタッフのシフトを同期
    for (const staffConnection of staffConnections) {
      try {
        // スタッフのOAuth2クライアントを作成
        const staffOauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        staffOauth2Client.setCredentials({
          access_token: staffConnection.accessToken,
          refresh_token: staffConnection.refreshToken,
          expiry_date: staffConnection.expiryDate,
        });

        // トークンリフレッシュ
        if (staffConnection.expiryDate && staffConnection.expiryDate < now) {
          const { credentials } = await staffOauth2Client.refreshAccessToken();
          await db
            .collection(`tenants/${tenantId}/googleCalendarConnections`)
            .doc(staffConnection.id)
            .update({
              accessToken: credentials.access_token,
              expiryDate: credentials.expiry_date,
              updatedAt: new Date(),
            });
          staffOauth2Client.setCredentials(credentials);
        }

        const staffCalendar = google.calendar({ version: "v3", auth: staffOauth2Client });
        const staffCalendarId = staffConnection.calendarId || "primary";

        // スタッフのGoogleカレンダーからイベントを取得
        const response = await staffCalendar.events.list({
          calendarId: staffCalendarId,
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = response.data.items || [];
        let syncedCount = 0;

        // 各イベントをお店用カレンダーに同期
        for (const event of events) {
          if (!event.start?.dateTime || !event.end?.dateTime) {
            continue; // 終日イベントはスキップ
          }

          try {
            // お店用カレンダーにシフトイベントを作成
            const storeShiftEvent = {
              summary: `[${staffConnection.staffName || "スタッフ"}] ${event.summary || "シフト"}`,
              description: `
【スタッフシフト】
スタッフ: ${staffConnection.staffName || ""}
${event.description ? `詳細: ${event.description}` : ""}
              `.trim(),
              start: {
                dateTime: event.start.dateTime,
                timeZone: event.start.timeZone || "Asia/Tokyo",
              },
              end: {
                dateTime: event.end.dateTime,
                timeZone: event.end.timeZone || "Asia/Tokyo",
              },
              colorId: "7", // シアン色（シフト）
              extendedProperties: {
                private: {
                  corevoSyncType: "shift",
                  corevoStaffId: staffConnection.id,
                  corevoOriginalEventId: event.id,
                },
              },
            };

            // 既存の同期済みイベントを探す
            const existingEventsResponse = await storeCalendar.events.list({
              calendarId: storeCalendarId,
              timeMin: event.start.dateTime,
              timeMax: event.end.dateTime,
              privateExtendedProperty: `corevoOriginalEventId=${event.id}`,
              singleEvents: true,
            });

            if (existingEventsResponse.data.items && existingEventsResponse.data.items.length > 0) {
              // 既存のイベントを更新
              const existingEvent = existingEventsResponse.data.items[0];
              await storeCalendar.events.update({
                calendarId: storeCalendarId,
                eventId: existingEvent.id!,
                requestBody: storeShiftEvent,
              });
            } else {
              // 新規イベントを作成
              await storeCalendar.events.insert({
                calendarId: storeCalendarId,
                requestBody: storeShiftEvent,
              });
            }

            syncedCount++;
          } catch (eventError) {
            console.error(`Failed to sync event ${event.id}:`, eventError);
          }
        }

        results.push({
          staffId: staffConnection.id,
          staffName: staffConnection.staffName,
          eventsSynced: syncedCount,
          success: true,
        });
      } catch (staffError: any) {
        console.error(`Failed to sync staff ${staffConnection.id}:`, staffError);
        results.push({
          staffId: staffConnection.id,
          staffName: staffConnection.staffName,
          eventsSynced: 0,
          success: false,
          error: staffError.message,
        });
      }
    }

    // 最終同期時刻を更新
    await storeConnectionRef.update({
      lastShiftSyncAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      syncedStaff: results.filter((r) => r.success).length,
      totalStaff: results.length,
      results,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error syncing shifts to store calendar:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync shifts" },
      { status: 500 }
    );
  }
}
