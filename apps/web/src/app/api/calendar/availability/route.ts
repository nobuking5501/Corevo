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

interface TimeSlot {
  start: string;
  end: string;
}

/**
 * 全スタッフの空き枠を統合して返す
 */
async function getAllStaffAvailability(
  tenantId: string,
  date: string,
  serviceDuration: number
): Promise<NextResponse> {
  try {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

    // 全スタッフのGoogleカレンダー連携情報を取得
    const connectionsSnapshot = await db
      .collection(`tenants/${tenantId}/googleCalendarConnections`)
      .get();

    const allAvailableSlots: Array<TimeSlot & { staffId: string; staffName: string }> = [];
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth credentials not configured" },
        { status: 500 }
      );
    }

    // 各スタッフの空き枠を取得
    for (const connDoc of connectionsSnapshot.docs) {
      // お店用連携はスキップ
      if (connDoc.id === "store") {
        continue;
      }

      const connectionData = connDoc.data();
      if (!connectionData || !connectionData.isActive) {
        continue;
      }

      const staffId = connDoc.id;

      try {
        // OAuth2クライアントを作成
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({
          access_token: connectionData.accessToken,
          refresh_token: connectionData.refreshToken,
          expiry_date: connectionData.expiryDate,
        });

        // トークンが期限切れの場合は自動でリフレッシュ
        const now = Date.now();
        if (connectionData.expiryDate && connectionData.expiryDate < now) {
          const { credentials } = await oauth2Client.refreshAccessToken();
          await db
            .collection(`tenants/${tenantId}/googleCalendarConnections`)
            .doc(staffId)
            .update({
              accessToken: credentials.access_token,
              expiryDate: credentials.expiry_date,
              updatedAt: new Date(),
            });
          oauth2Client.setCredentials(credentials);
        }

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        // Googleカレンダーからイベントを取得
        const response = await calendar.events.list({
          calendarId: connectionData.calendarId || "primary",
          timeMin: startOfDay,
          timeMax: endOfDay,
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = response.data.items || [];

        // シフトイベントのみを抽出
        const workingSlots: TimeSlot[] = events
          .filter((event) => {
            if (!event.start?.dateTime || !event.end?.dateTime) return false;
            const title = (event.summary || "").toLowerCase();
            return (
              title.includes("シフト") ||
              title.includes("勤務") ||
              title.includes("出勤") ||
              title.includes("shift") ||
              title.includes("work")
            );
          })
          .map((event) => ({
            start: event.start!.dateTime!,
            end: event.end!.dateTime!,
          }));

        // シフトがない場合はスキップ
        if (workingSlots.length === 0) {
          continue;
        }

        // Firestoreから既存の予約を取得
        const appointmentsSnapshot = await db
          .collection(`tenants/${tenantId}/appointments`)
          .where("staffId", "==", staffId)
          .where("startAt", ">=", new Date(startOfDay))
          .where("startAt", "<", new Date(endOfDay))
          .where("status", "in", ["scheduled", "confirmed"])
          .get();

        const busySlots: TimeSlot[] = appointmentsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            start: data.startAt.toDate().toISOString(),
            end: data.endAt.toDate().toISOString(),
          };
        });

        // 空き時間を計算
        for (const workingSlot of workingSlots) {
          const workStart = new Date(workingSlot.start);
          const workEnd = new Date(workingSlot.end);

          let currentTime = new Date(workStart);

          while (currentTime < workEnd) {
            const slotEnd = new Date(currentTime.getTime() + serviceDuration * 60 * 1000);

            if (slotEnd > workEnd) break;

            // この時間帯が予約と重ならないかチェック
            const isAvailable = !busySlots.some((busy) => {
              const busyStart = new Date(busy.start);
              const busyEnd = new Date(busy.end);

              return (
                (currentTime >= busyStart && currentTime < busyEnd) ||
                (slotEnd > busyStart && slotEnd <= busyEnd) ||
                (currentTime <= busyStart && slotEnd >= busyEnd)
              );
            });

            if (isAvailable) {
              allAvailableSlots.push({
                start: currentTime.toISOString(),
                end: slotEnd.toISOString(),
                staffId,
                staffName: connectionData.staffName || "スタッフ",
              });
            }

            // 次の時間帯（30分刻み）
            currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
          }
        }
      } catch (staffError) {
        // 個別スタッフのエラーは非クリティカルなので、ログのみ
        console.error(`Failed to get availability for staff ${staffId}:`, staffError);
        continue;
      }
    }

    // 時刻順にソート
    allAvailableSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // 重複を削除（同じ時刻に複数のスタッフが空いている場合は1つにまとめる）
    const uniqueSlots: TimeSlot[] = [];
    const seenTimes = new Set<string>();

    for (const slot of allAvailableSlots) {
      const timeKey = new Date(slot.start).toISOString();
      if (!seenTimes.has(timeKey)) {
        seenTimes.add(timeKey);
        uniqueSlots.push({
          start: slot.start,
          end: slot.end,
        });
      }
    }

    return NextResponse.json({
      success: true,
      date,
      staffId: null,
      allStaff: true,
      serviceDuration,
      availableSlots: uniqueSlots.map((slot) => ({
        start: slot.start,
        end: slot.end,
        startTime: new Date(slot.start).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        endTime: new Date(slot.end).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
      totalAvailableSlots: uniqueSlots.length,
    });
  } catch (error: any) {
    console.error("Error calculating all-staff availability:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate availability" },
      { status: 500 }
    );
  }
}

/**
 * スタッフの空き時間を計算
 * staffIdが指定された場合は特定スタッフの空き枠、
 * 指定されない場合は全スタッフの空き枠を返す
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, staffId, date, serviceDuration = 60 } = await request.json();

    if (!tenantId || !date) {
      return NextResponse.json(
        { error: "tenantId and date are required" },
        { status: 400 }
      );
    }

    // スタッフ未指定の場合は全スタッフの空き枠を統合
    if (!staffId) {
      return await getAllStaffAvailability(tenantId, date, serviceDuration);
    }

    // Googleカレンダー連携情報を取得
    const connectionRef = db
      .collection(`tenants/${tenantId}/googleCalendarConnections`)
      .doc(staffId);

    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json(
        { error: "Google Calendar connection not found" },
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

    // 指定日の開始・終了時刻
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

    // Googleカレンダーからイベントを取得（これがシフト = 勤務可能時間）
    const response = await calendar.events.list({
      calendarId: connectionData.calendarId || "primary",
      timeMin: startOfDay,
      timeMax: endOfDay,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];
    console.log(`🔍 [Availability API] Googleカレンダーから取得したイベント数: ${events.length}`);
    console.log(`🔍 [Availability API] イベント一覧:`, events.map(e => ({
      title: e.summary,
      start: e.start?.dateTime,
      end: e.end?.dateTime,
    })));

    // シフトイベントのみを抽出（タイトルに「シフト」「勤務」「出勤」「shift」「work」を含むもの）
    const workingSlots: TimeSlot[] = events
      .filter((event) => {
        if (!event.start?.dateTime || !event.end?.dateTime) return false;

        const title = (event.summary || "").toLowerCase();
        const isShift = title.includes("シフト") ||
                       title.includes("勤務") ||
                       title.includes("出勤") ||
                       title.includes("shift") ||
                       title.includes("work");

        if (isShift) {
          console.log(`🔍 [Availability API] シフトイベント検出: "${event.summary}" (${event.start?.dateTime} - ${event.end?.dateTime})`);
        } else {
          console.log(`🔍 [Availability API] シフトではないイベント: "${event.summary}"`);
        }

        return isShift;
      })
      .map((event) => ({
        start: event.start!.dateTime!,
        end: event.end!.dateTime!,
      }));

    console.log(`🔍 [Availability API] シフト枠数: ${workingSlots.length}`);

    // シフトがない場合は空き枠なし
    if (workingSlots.length === 0) {
      return NextResponse.json({
        success: true,
        availableSlots: [],
        message: "このスタッフはこの日にシフトが入っていません",
        date,
      });
    }

    // Firestoreから既存の予約を取得
    const appointmentsRef = db.collection(`tenants/${tenantId}/appointments`);
    const appointmentsSnapshot = await appointmentsRef
      .where("staffId", "==", staffId)
      .where("startAt", ">=", new Date(startOfDay))
      .where("startAt", "<", new Date(endOfDay))
      .where("status", "in", ["scheduled", "confirmed"])
      .get();

    const busySlots: TimeSlot[] = appointmentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        start: data.startAt.toDate().toISOString(),
        end: data.endAt.toDate().toISOString(),
      };
    });

    // 空き時間を計算
    const availableSlots: TimeSlot[] = [];

    // 各シフト時間帯ごとに空き枠を計算
    for (const workingSlot of workingSlots) {
      const workStart = new Date(workingSlot.start);
      const workEnd = new Date(workingSlot.end);

      let currentTime = new Date(workStart);

      while (currentTime < workEnd) {
        const slotEnd = new Date(currentTime.getTime() + serviceDuration * 60 * 1000);

        if (slotEnd > workEnd) break;

        // この時間帯が予約と重ならないかチェック
        const isAvailable = !busySlots.some((busy) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);

          // 重なりチェック
          return (
            (currentTime >= busyStart && currentTime < busyEnd) ||
            (slotEnd > busyStart && slotEnd <= busyEnd) ||
            (currentTime <= busyStart && slotEnd >= busyEnd)
          );
        });

        if (isAvailable) {
          availableSlots.push({
            start: currentTime.toISOString(),
            end: slotEnd.toISOString(),
          });
        }

        // 次の時間帯（30分刻み）
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
      }
    }

    // 最終同期時刻を更新
    await connectionRef.update({
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      date,
      staffId,
      workingSlots: workingSlots.map((slot) => ({
        start: slot.start,
        end: slot.end,
      })),
      serviceDuration,
      availableSlots: availableSlots.map((slot) => ({
        start: slot.start,
        end: slot.end,
        startTime: new Date(slot.start).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        endTime: new Date(slot.end).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
      busySlots: busySlots.length,
      totalAvailableSlots: availableSlots.length,
    });
  } catch (error: any) {
    console.error("Error calculating availability:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate availability" },
      { status: 500 }
    );
  }
}
