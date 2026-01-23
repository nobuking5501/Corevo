"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function StaffCalendarConnectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setErrorMessage("連携トークンが見つかりません。管理者に連絡してください。");
      return;
    }

    // トークンがある場合は、OAuth認証フローにリダイレクト
    setStatus("redirecting");
    const authorizeUrl = `/api/auth/google-calendar/authorize?token=${token}`;
    window.location.href = authorizeUrl;
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Googleカレンダー連携</CardTitle>
          <CardDescription>
            カレンダーを連携して予約管理を効率化しましょう
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">連携情報を確認中...</p>
            </div>
          )}

          {status === "redirecting" && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">認証ページに移動中</p>
              <p className="text-sm text-gray-600">
                Googleの認証ページにリダイレクトしています...
              </p>
            </div>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-1">エラーが発生しました</p>
                <p className="text-sm">{errorMessage}</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-semibold mb-2">連携の流れ</p>
            <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
              <li>Googleアカウントでログイン</li>
              <li>カレンダーへのアクセスを許可</li>
              <li>連携完了</li>
            </ol>
            <p className="text-xs text-blue-700 mt-3">
              ※ この連携URLは24時間有効です
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
