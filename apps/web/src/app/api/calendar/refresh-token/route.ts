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
 * Google Calendar APIのアクセストークンをリフレッシュ
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, staffMemberId } = await request.json();

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

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret
    );

    // リフレッシュトークンを設定
    oauth2Client.setCredentials({
      refresh_token: connectionData.refreshToken,
    });

    // トークンをリフレッシュ
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Firestoreを更新
    await connectionRef.update({
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date,
    });
  } catch (error: any) {
    console.error("Error refreshing token:", error);
    return NextResponse.json(
      { error: error.message || "Failed to refresh token" },
      { status: 500 }
    );
  }
}
