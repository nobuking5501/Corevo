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
 * スタッフのGoogleカレンダーからイベントを取得
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, staffMemberId, timeMin, timeMax } = await request.json();

    if (!tenantId || !staffMemberId) {
      return NextResponse.json(
        { error: "tenantId and staffMemberId are required" },
        { status: 400 }
      );
    }

    // Firestore から連携情報を取得
    const connectionRef = db
      .collection(`tenants/${tenantId}/googleCalendarConnections`)
      .doc(staffMemberId);

    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json(
        { error: "Google Calendar connection not found" },
        { status: 404 }
      );
    }

    const connectionData = connectionDoc.data();
    if (!connectionData) {
      return NextResponse.json(
        { error: "Connection data is empty" },
        { status: 500 }
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

    // イベントを整形
    const formattedEvents = events.map((event) => ({
      id: event.id,
      title: event.summary || "（タイトルなし）",
      description: event.description,
      startTime: event.start?.dateTime || event.start?.date,
      endTime: event.end?.dateTime || event.end?.date,
      status: event.status,
      htmlLink: event.htmlLink,
      created: event.created,
      updated: event.updated,
    }));

    // 最終同期時刻を更新
    await connectionRef.update({
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      events: formattedEvents,
      count: formattedEvents.length,
      staffMemberId,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
