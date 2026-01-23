"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Loader2, AlertCircle, Image, FileText } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "";
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || "";

interface Chart {
  id: string;
  photos: string[];
  tags: string[];
  notes: string;
  cautions: string;
  effectPeriodDays?: number;
  staffName: string;
  appointmentInfo?: {
    startAt: string;
  };
  nextRecommendedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ChartsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineUserId, setLineUserId] = useState<string>("");
  const [charts, setCharts] = useState<Chart[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

        // カルテ一覧を取得
        await loadCharts(profile.userId);

        setLoading(false);
      } catch (err: any) {
        console.error("Error:", err);
        setError("データの読み込みに失敗しました");
        setLoading(false);
      }
    };

    initializeAndLoadData();
  }, []);

  const loadCharts = async (userId: string) => {
    try {
      const getCustomerCharts = httpsCallable(functions, "getCustomerCharts");
      const result = await getCustomerCharts({
        lineUserId: userId,
        tenantId: TENANT_ID,
        limit: 20,
      });

      const data = result.data as { success: boolean; charts: Chart[] };
      if (data.success) {
        setCharts(data.charts);
      }
    } catch (err: any) {
      console.error("Error loading charts:", err);
      throw err;
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
          <h1 className="text-2xl font-bold text-gray-900">カルテ履歴</h1>
        </div>

        {/* カルテ一覧 */}
        {charts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">カルテ履歴がありません</p>
              <p className="text-sm text-gray-500 mt-2">
                施術を受けるとカルテが記録されます
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* タイムライン */}
            <div className="relative">
              {/* タイムライン線 */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300" />

              {charts.map((chart, index) => (
                <div key={chart.id} className="relative pl-16 pb-8">
                  {/* タイムラインドット */}
                  <div className="absolute left-6 top-2 w-5 h-5 bg-blue-600 rounded-full border-4 border-white shadow" />

                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <CardTitle className="text-lg">
                            {chart.appointmentInfo
                              ? format(new Date(chart.appointmentInfo.startAt), "M月d日(E)", {
                                  locale: ja,
                                })
                              : "日付不明"}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            施術日: {format(new Date(chart.createdAt), "yyyy/MM/dd")}
                          </CardDescription>
                        </div>
                      </div>

                      {/* タグ */}
                      {chart.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {chart.tags.map((tag, tagIndex) => (
                            <Badge key={tagIndex} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardHeader>

                    <CardContent>
                      {/* 写真 */}
                      {chart.photos.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            写真
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {chart.photos.map((photo, photoIndex) => (
                              <div
                                key={photoIndex}
                                className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setSelectedImage(photo)}
                              >
                                <img
                                  src={photo}
                                  alt={`施術写真 ${photoIndex + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* メモ */}
                      {chart.notes && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">施術内容</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {chart.notes}
                          </p>
                        </div>
                      )}

                      {/* 注意事項 */}
                      {chart.cautions && (
                        <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="text-sm font-medium text-yellow-800 mb-1">注意事項</p>
                          <p className="text-sm text-yellow-700 whitespace-pre-wrap">
                            {chart.cautions}
                          </p>
                        </div>
                      )}

                      {/* 次回推奨日 */}
                      {chart.nextRecommendedDate && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm font-medium text-blue-800 mb-1">次回推奨日</p>
                          <p className="text-lg font-bold text-blue-900">
                            {format(new Date(chart.nextRecommendedDate), "yyyy年M月d日(E)", {
                              locale: ja,
                            })}
                          </p>
                          {chart.effectPeriodDays && (
                            <p className="text-xs text-blue-600 mt-1">
                              効果持続期間: {chart.effectPeriodDays}日
                            </p>
                          )}
                        </div>
                      )}

                      {/* スタッフ */}
                      <div className="text-sm text-gray-600 mt-4">
                        <span className="font-medium">担当:</span> {chart.staffName}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 画像モーダル */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl max-h-full">
              <img
                src={selectedImage}
                alt="施術写真"
                className="max-w-full max-h-[90vh] object-contain"
              />
              <Button
                variant="ghost"
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={() => setSelectedImage(null)}
              >
                閉じる
              </Button>
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>ご不明な点はLINEでお問い合わせください</p>
        </div>
      </div>
    </div>
  );
}
