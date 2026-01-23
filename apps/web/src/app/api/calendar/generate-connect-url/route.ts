import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";

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
 * スタッフ用の連携URL生成
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

    // スタッフ情報を確認
    const staffRef = db.collection(`tenants/${tenantId}/staffMembers`).doc(staffMemberId);
    const staffDoc = await staffRef.get();

    if (!staffDoc.exists) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    const staffData = staffDoc.data();

    // 一時的な連携トークンを生成（有効期限: 24時間）
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後

    // トークンをFirestoreに保存
    await db.collection("calendarConnectTokens").doc(token).set({
      tenantId,
      staffMemberId,
      staffName: staffData?.name || "Unknown",
      createdAt: new Date(),
      expiresAt,
      used: false,
    });

    // 連携URLを生成
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3006";
    const connectUrl = `${baseUrl}/staff/calendar-connect?token=${token}`;

    return NextResponse.json({
      success: true,
      connectUrl,
      token,
      expiresAt: expiresAt.toISOString(),
      staffName: staffData?.name,
    });
  } catch (error: any) {
    console.error("Error generating connect URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate connect URL" },
      { status: 500 }
    );
  }
}
