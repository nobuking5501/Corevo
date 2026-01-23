import { NextResponse } from "next/server";

/**
 * Google Calendar連携の設定状態をチェック
 */
export async function GET() {
  try {
    const checks = {
      firebaseProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      firebasePrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      googleCalendarClientId: !!process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID,
      googleCalendarClientSecret: !!process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      appUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    };

    const allConfigured = Object.values(checks).every((check) => check === true);

    const missingConfigs = Object.entries(checks)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    return NextResponse.json({
      success: true,
      configured: allConfigured,
      checks,
      missingConfigs,
      redirectUri: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`
        : "http://localhost:3006/api/auth/google-calendar/callback",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to check setup",
      },
      { status: 500 }
    );
  }
}
