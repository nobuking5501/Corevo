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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // エラーチェック
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/settings/google-calendar?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/settings/google-calendar?error=missing_params`
      );
    }

    // stateからtenantIdとuserIdを取得
    const { tenantId, userId } = JSON.parse(state);

    // 環境変数から認証情報を取得
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/auth/google-calendar/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/settings/google-calendar?error=config_missing`
      );
    }

    // OAuth2クライアントを作成
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // 認可コードをトークンに交換
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Googleカレンダー情報を取得
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find((cal) => cal.primary);

    if (!primaryCalendar || !primaryCalendar.id) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/settings/google-calendar?error=no_calendar`
      );
    }

    // お店用かスタッフ用かを判定
    const isStoreConnection = userId === "store";

    let staffName = "Unknown";
    if (isStoreConnection) {
      staffName = "お店全体";
    } else {
      // スタッフ情報をFirestoreから取得
      const staffDoc = await db.collection(`tenants/${tenantId}/staffMembers`).doc(userId).get();
      const staffData = staffDoc.data();
      staffName = staffData?.name || "Unknown";
    }

    // Firestoreに保存
    const connectionRef = db
      .collection(`tenants/${tenantId}/googleCalendarConnections`)
      .doc(userId);

    await connectionRef.set({
      staffMemberId: userId,
      staffName: staffName,
      googleEmail: primaryCalendar.id || "",
      calendarId: primaryCalendar.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      connectedAt: new Date(),
      isActive: true,
      isStoreCalendar: isStoreConnection,
      updatedAt: new Date(),
    });

    // 成功時は設定ページにリダイレクト
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/settings/google-calendar?success=true`
    );
  } catch (error: any) {
    console.error("Error in callback route:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/settings/google-calendar?error=${encodeURIComponent(error.message || "unknown")}`
    );
  }
}
