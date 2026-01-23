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
 * お店用Googleカレンダーからイベントを取得
 * シフトと予約を含む全イベントを取得
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, timeMin, timeMax } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    // Firestore からお店用連携情報を取得
    const connectionRef = db
      .collection(`tenants/${tenantId}/googleCalendarConnections`)
      .doc("store");

    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json(
        { error: "Store Google Calendar connection not found" },
        { status: 404 }
      );
    }

    const connectionData = connectionDoc.data();
    if (!connectionData || !connectionData.isActive) {
      return NextResponse.json(
        { error: "Store calendar connection is not active" },
        { status: 400 }
      );
    }

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

      // Firestoreを更新
      await connectionRef.update({
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date,
        updatedAt: new Date(),
      });

      oauth2Client.setCredentials(credentials);
    }

    // Google Calendar APIでイベントを取得
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // デフォルトの時間範囲: 現在から1ヶ月先まで
    const startTime = timeMin || new Date().toISOString();
    const endTime = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const response = await calendar.events.list({
      calendarId: connectionData.calendarId || "primary",
      timeMin: startTime,
      timeMax: endTime,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500, // 最大取得件数
    });

    const events = response.data.items || [];

    // イベントを分類
    const shifts: any[] = [];
    const appointments: any[] = [];
    const others: any[] = [];

    for (const event of events) {
      // イベントのタイトルや説明から種類を判定
      const title = (event.summary || "").toLowerCase();
      const description = (event.description || "").toLowerCase();

      // Corevoから同期された予約イベントを識別（説明に特定の文字列を含む）
      const isAppointment = description.includes("corevo") ||
                           description.includes("予約") ||
                           event.extendedProperties?.private?.source === "corevo";

      // シフトイベントを識別（タイトルに「シフト」「勤務」「出勤」などを含む）
      const isShift = title.includes("シフト") ||
                     title.includes("勤務") ||
                     title.includes("出勤") ||
                     title.includes("shift") ||
                     title.includes("work");

      const formattedEvent = {
        id: event.id,
        title: event.summary || "（タイトルなし）",
        description: event.description,
        startTime: event.start?.dateTime || event.start?.date,
        endTime: event.end?.dateTime || event.end?.date,
        status: event.status,
        htmlLink: event.htmlLink,
        created: event.created,
        updated: event.updated,
        colorId: event.colorId,
        // スタッフ情報があれば含める
        attendees: event.attendees?.map(a => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus,
        })),
      };

      if (isAppointment) {
        appointments.push(formattedEvent);
      } else if (isShift) {
        shifts.push(formattedEvent);
      } else {
        others.push(formattedEvent);
      }
    }

    // 最終同期時刻を更新
    await connectionRef.update({
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      shifts,
      appointments,
      others,
      totalCount: events.length,
      shiftsCount: shifts.length,
      appointmentsCount: appointments.length,
      othersCount: others.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching store calendar events:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch store calendar events" },
      { status: 500 }
    );
  }
}
