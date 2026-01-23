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
    let tenantId = searchParams.get("tenantId");
    let userId = searchParams.get("userId");
    const token = searchParams.get("token");

    // トークンベースの認証（スタッフ用連携URL）
    if (token) {
      const tokenDoc = await db.collection("calendarConnectTokens").doc(token).get();

      if (!tokenDoc.exists) {
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/settings/google-calendar?error=invalid_token`
        );
      }

      const tokenData = tokenDoc.data();

      // トークンの有効期限をチェック
      if (tokenData?.expiresAt?.toDate() < new Date()) {
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/settings/google-calendar?error=token_expired`
        );
      }

      // トークンが既に使用済みかチェック
      if (tokenData?.used) {
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/settings/google-calendar?error=token_used`
        );
      }

      tenantId = tokenData?.tenantId;
      userId = tokenData?.staffMemberId;

      // トークンを使用済みにマーク
      await db.collection("calendarConnectTokens").doc(token).update({
        used: true,
        usedAt: new Date(),
      });
    }

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: "Missing tenantId or userId" },
        { status: 400 }
      );
    }

    // 環境変数から認証情報を取得
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/auth/google-calendar/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google Calendar credentials not configured" },
        { status: 500 }
      );
    }

    // OAuth2クライアントを作成
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // 認証URLを生成
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ],
      state: JSON.stringify({ tenantId, userId }),
      prompt: "consent", // 常に同意画面を表示してrefresh_tokenを取得
    });

    // Googleの認証ページにリダイレクト
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("Error in authorize route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start authorization" },
      { status: 500 }
    );
  }
}
