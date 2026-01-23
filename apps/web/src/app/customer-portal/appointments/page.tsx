"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "";
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || "";

interface Appointment {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes?: string;
  services: Array<{
    id: string;
    name: string;
    price: number;
    durationMinutes: number;
  }>;
  staffName: string;
  pricing?: {
    subtotal: number;
    discount: number;
    total: number;
    eligibleCount: number;
  };
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineUserId, setLineUserId] = useState<string>("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    const initializeAndLoadData = async () => {
      try {
        // LIFF初期化
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        // ユーザープロフィール取得
        const profile = await liff.getProfile();
        setLineUserId(profile.userId);

        // 予約一覧を取得
        await loadAppointments(profile.userId);

        setLoading(false);
      } catch (err: any) {
        console.error("Error:", err);
        setError("データの読み込みに失敗しました");
        setLoading(false);
      }
    };

    initializeAndLoadData();
  }, []);

  const loadAppointments = async (userId: string) => {
    try {
      const getCustomerAppointments = httpsCallable(functions, "getCustomerAppointments");
      const result = await getCustomerAppointments({
        lineUserId: userId,
        tenantId: TENANT_ID,
        limit: 10,
      });

      const data = result.data as { success: boolean; appointments: Appointment[] };
      if (data.success) {
        setAppointments(data.appointments);
      }
    } catch (err: any) {
      console.error("Error loading appointments:", err);
      throw err;
    }
  };

  const handleCancelClick = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedAppointmentId || !lineUserId) return;

    setCancelingId(selectedAppointmentId);
    setShowCancelDialog(false);

    try {
      const cancelCustomerAppointment = httpsCallable(functions, "cancelCustomerAppointment");
      const result = await cancelCustomerAppointment({
        lineUserId,
        tenantId: TENANT_ID,
        appointmentId: selectedAppointmentId,
      });

      const data = result.data as { success: boolean; message: string };
      if (data.success) {
        // 予約一覧を再読み込み
        await loadAppointments(lineUserId);
      }
    } catch (err: any) {
      console.error("Error canceling appointment:", err);
      setError("予約のキャンセルに失敗しました");
    } finally {
      setCancelingId(null);
      setSelectedAppointmentId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              エラー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              再読み込み
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* ヘッダー */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/customer-portal")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">予約管理</h1>
        </div>

        {/* 予約一覧 */}
        {appointments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">現在、予約はありません</p>
              <p className="text-sm text-gray-500 mt-2">
                店舗に直接ご連絡いただくか、LINEでお問い合わせください
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg mb-1">
                        {format(new Date(appointment.startAt), "M月d日(E)", { locale: ja })}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {format(new Date(appointment.startAt), "HH:mm")} -{" "}
                        {format(new Date(appointment.endAt), "HH:mm")}
                      </CardDescription>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        appointment.status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {appointment.status === "confirmed" ? "確定" : "予約済み"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* サービス */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">施術内容</p>
                    <div className="space-y-1">
                      {appointment.services.map((service) => (
                        <div
                          key={service.id}
                          className="flex justify-between text-sm text-gray-600"
                        >
                          <span>• {service.name}</span>
                          <span>¥{service.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 料金 */}
                  {appointment.pricing && (
                    <div className="border-t pt-3 mb-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-gray-600">
                          <span>小計</span>
                          <span>¥{appointment.pricing.subtotal.toLocaleString()}</span>
                        </div>
                        {appointment.pricing.discount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>セット割引</span>
                            <span>-¥{appointment.pricing.discount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-gray-900 pt-1 border-t">
                          <span>合計</span>
                          <span>¥{appointment.pricing.total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* スタッフ */}
                  <div className="text-sm text-gray-600 mb-4">
                    <span className="font-medium">担当:</span> {appointment.staffName}
                  </div>

                  {/* メモ */}
                  {appointment.notes && (
                    <div className="text-sm text-gray-600 mb-4">
                      <p className="font-medium mb-1">備考</p>
                      <p className="text-gray-500">{appointment.notes}</p>
                    </div>
                  )}

                  {/* キャンセルボタン */}
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => handleCancelClick(appointment.id)}
                    disabled={cancelingId === appointment.id}
                  >
                    {cancelingId === appointment.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        キャンセル中...
                      </>
                    ) : (
                      "予約をキャンセル"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* キャンセル確認ダイアログ */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>予約をキャンセルしますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作は取り消せません。キャンセルする場合は確認ボタンを押してください。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>戻る</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelConfirm} className="bg-red-600">
                キャンセルする
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* フッター */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>新規予約は店舗に直接お電話ください</p>
        </div>
      </div>
    </div>
  );
}
