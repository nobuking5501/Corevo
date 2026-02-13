"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { isPlatformAdmin } from "@/lib/auth";
import { PlatformAdminLayout } from "@/components/layout/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";

export default function PlatformAdminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      const isAdmin = await isPlatformAdmin(user.uid, user.email || "");
      if (!isAdmin) {
        router.push("/dashboard");
        return;
      }

      setAuthorized(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <PlatformAdminLayout>
        <div className="text-center py-12">読み込み中...</div>
      </PlatformAdminLayout>
    );
  }

  if (!authorized) {
    return (
      <PlatformAdminLayout>
        <div className="text-center py-12">アクセスが拒否されました</div>
      </PlatformAdminLayout>
    );
  }

  return (
    <PlatformAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/platform-admin")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">システム設定</h1>
            <p className="text-gray-500">プラットフォーム全体の設定</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              システム設定
            </CardTitle>
            <CardDescription>
              プラットフォームレベルの設定と構成
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-2">認証</h3>
                <p className="text-sm text-gray-600 mb-3">
                  現在: メールホワイトリスト (admin@corevo.com)
                </p>
                <p className="text-sm text-gray-500">
                  推奨: セールス開始前にFirestore isPlatformAdminフラグに移行
                </p>
              </div>

              <div className="border-b pb-4">
                <h3 className="font-semibold mb-2">請求連携</h3>
                <p className="text-sm text-gray-600 mb-3">
                  ステータス: 未設定
                </p>
                <p className="text-sm text-gray-500">
                  自動請求管理にはStripe連携が必要
                </p>
              </div>

              <div className="border-b pb-4">
                <h3 className="font-semibold mb-2">デフォルトプラン</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">トライアル:</span>
                    <span className="font-medium">14日間、1店舗</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ベーシック:</span>
                    <span className="font-medium">最大3店舗</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">プロ:</span>
                    <span className="font-medium">最大10店舗</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">エンタープライズ:</span>
                    <span className="font-medium">無制限</span>
                  </div>
                </div>
              </div>

              <div className="pb-4">
                <h3 className="font-semibold mb-2">今後の機能</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>組織CRUD APIエンドポイント</li>
                  <li>自動請求と請求書発行</li>
                  <li>使用状況分析とレポート</li>
                  <li>メール通知テンプレート</li>
                  <li>マルチリージョンサポート</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>システム情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">環境:</span>
                <span className="font-medium">開発環境</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Firebaseリージョン:</span>
                <span className="font-medium">asia-northeast1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">認証:</span>
                <span className="font-medium">Firebase Auth</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">データベース:</span>
                <span className="font-medium">Cloud Firestore</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PlatformAdminLayout>
  );
}
