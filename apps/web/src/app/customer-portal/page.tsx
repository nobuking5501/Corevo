"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Loader2 } from "lucide-react";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "";

export default function CustomerPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>("");

  useEffect(() => {
    const initializeLiff = async () => {
      try {
        // LIFF初期化
        await liff.init({ liffId: LIFF_ID });

        // LINEログイン確認
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        // ユーザープロフィール取得
        const profile = await liff.getProfile();
        setCustomerName(profile.displayName);

        setLoading(false);
      } catch (err: any) {
        console.error("LIFF initialization failed:", err);
        setError("初期化に失敗しました。もう一度お試しください。");
        setLoading(false);
      }
    };

    initializeLiff();
  }, []);

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
            <CardTitle className="text-red-600">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4 w-full"
            >
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            マイページ
          </h1>
          <p className="text-gray-600">
            ようこそ、{customerName}さん
          </p>
        </div>

        {/* メニューカード */}
        <div className="space-y-4">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push("/customer-portal/appointments")}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 bg-blue-100 rounded-full">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">予約管理</CardTitle>
                <CardDescription>
                  予約の確認・新規予約・キャンセル
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push("/customer-portal/charts")}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 bg-green-100 rounded-full">
                <FileText className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-xl">カルテ確認</CardTitle>
                <CardDescription>
                  施術履歴と次回推奨日の確認
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* フッター */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>お困りの際はLINEでお問い合わせください</p>
        </div>
      </div>
    </div>
  );
}
