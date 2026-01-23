"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useAdsStore } from "@/stores/ads";
import { Ad } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function AdsPage() {
  const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";
  const [tenantId, setTenantId] = useState<string | null>(null);
  const { ads, loading, error, fetchAds, deleteAd } = useAdsStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(
    format(new Date(), "yyyy-MM")
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult(false);
        let tenantIds = (tokenResult.claims.tenantIds as string[]) || [];

        if (isDev && tenantIds.length === 0) {
          const devTenantId = localStorage.getItem("dev_tenantId");
          if (devTenantId) {
            tenantIds = [devTenantId];
          }
        }

        if (tenantIds.length > 0) {
          setTenantId(tenantIds[0]);
        }
      } catch (error) {
        console.error("Error getting tenant ID:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (tenantId) {
      fetchAds({
        tenantId: tenantId,
        month: selectedMonth,
        limit: 100,
      });
    }
  }, [tenantId, selectedMonth, fetchAds]);

  const handleDelete = async (adId: string) => {
    if (!tenantId) return;

    if (confirm("この広告データを削除してもよろしいですか？")) {
      try {
        await deleteAd(adId, tenantId);
      } catch (error) {
        console.error("Failed to delete ad:", error);
      }
    }
  };

  const totalAdCost = ads.reduce((sum, ad) => sum + ad.adCost, 0);
  const totalConversions = ads.reduce((sum, ad) => sum + ad.conversions, 0);
  const averageCPA =
    totalConversions > 0 ? totalAdCost / totalConversions : 0;

  // ROI順にソート
  const sortedByROI = [...ads].sort((a, b) => (b.roi || 0) - (a.roi || 0));

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>テナント情報を読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">広告管理</h1>
          <p className="text-muted-foreground">
            広告媒体ごとの実績を管理します
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              広告を追加
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>広告を追加</DialogTitle>
            </DialogHeader>
            <AdForm
              tenantId={tenantId}
              ad={selectedAd || undefined}
              onSuccess={() => {
                setIsCreateDialogOpen(false);
                setSelectedAd(null);
                fetchAds({ tenantId: tenantId, limit: 100 });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* 月フィルタ */}
      <div className="flex items-center gap-4">
        <div>
          <label className="text-sm font-medium mr-2">対象月:</label>
          <Input
            type="month"
            value={selectedMonth || ""}
            onChange={(e) =>
              setSelectedMonth(e.target.value || undefined)
            }
            className="w-48 inline-block"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setSelectedMonth(undefined)}
        >
          すべて表示
        </Button>
      </div>

      {/* 集計サマリ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">総広告費</p>
          <p className="text-2xl font-bold">
            ¥{totalAdCost.toLocaleString()}
          </p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">成約数</p>
          <p className="text-2xl font-bold">{totalConversions}件</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">平均CPA</p>
          <p className="text-2xl font-bold">
            ¥{Math.round(averageCPA).toLocaleString()}
          </p>
        </div>
      </div>

      {/* ROIランキング */}
      <Card>
        <CardHeader>
          <CardTitle>ROIランキング（高い順）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedByROI.slice(0, 5).map((ad, index) => (
              <div
                key={ad.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg">{index + 1}</span>
                  <span className="font-medium">{ad.medium}</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">
                    {ad.roi ? `${(ad.roi * 100).toFixed(0)}%` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ad.roi && ad.roi > 3
                      ? "◎優秀"
                      : ad.roi && ad.roi > 2
                      ? "○良好"
                      : ad.roi && ad.roi > 0
                      ? "△要改善"
                      : "×停止検討"}
                  </p>
                </div>
              </div>
            ))}
            {sortedByROI.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                データがありません
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 広告テーブル */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>月</TableHead>
              <TableHead>媒体</TableHead>
              <TableHead className="text-right">広告費</TableHead>
              <TableHead className="text-right">予約数</TableHead>
              <TableHead className="text-right">成約数</TableHead>
              <TableHead className="text-right">成約率</TableHead>
              <TableHead className="text-right">CPA</TableHead>
              <TableHead className="text-right">ROI</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  読み込み中...
                </TableCell>
              </TableRow>
            ) : ads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  広告データがありません
                </TableCell>
              </TableRow>
            ) : (
              ads.map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell>{ad.month}</TableCell>
                  <TableCell className="font-medium">{ad.medium}</TableCell>
                  <TableCell className="text-right">
                    ¥{ad.adCost.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {ad.newReservations}
                  </TableCell>
                  <TableCell className="text-right">
                    {ad.conversions}
                  </TableCell>
                  <TableCell className="text-right">
                    {ad.conversionRate
                      ? `${(ad.conversionRate * 100).toFixed(1)}%`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {ad.cpa ? `¥${Math.round(ad.cpa).toLocaleString()}` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {ad.roi ? (
                      <span
                        className={`font-medium ${
                          ad.roi > 3
                            ? "text-green-600"
                            : ad.roi > 2
                            ? "text-blue-600"
                            : ad.roi > 0
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {(ad.roi * 100).toFixed(0)}%
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedAd(ad);
                          setIsCreateDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(ad.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 推奨アクション */}
      <Card>
        <CardHeader>
          <CardTitle>推奨アクション</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>• ROI 300%超の媒体 → 予算を2倍に増額</li>
            <li>• ROI 200%未満の媒体 → クリエイティブ改善</li>
            <li>• CPA 20,000円超の媒体 → 予算削減or停止検討</li>
            <li>• 成約率 25%未満の媒体 → LP・訴求内容を見直し</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// 広告フォームコンポーネント
function AdForm({
  tenantId,
  ad,
  onSuccess,
}: {
  tenantId: string;
  ad?: Ad;
  onSuccess: () => void;
}) {
  const { createAd, updateAd } = useAdsStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    month: ad?.month || format(new Date(), "yyyy-MM"),
    medium: ad?.medium || "",
    adCost: ad?.adCost || 0,
    newReservations: ad?.newReservations || 0,
    conversions: ad?.conversions || 0,
    notes: ad?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (ad) {
        await updateAd(
          {
            adId: ad.id,
            ...formData,
          },
          tenantId
        );
      } else {
        await createAd(formData, tenantId);
      }
      onSuccess();
    } catch (error) {
      console.error("Failed to save ad:", error);
    } finally {
      setLoading(false);
    }
  };

  const conversionRate =
    formData.newReservations > 0
      ? (formData.conversions / formData.newReservations) * 100
      : 0;

  const cpa =
    formData.conversions > 0
      ? formData.adCost / formData.conversions
      : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">対象月</label>
          <Input
            type="month"
            value={formData.month}
            onChange={(e) =>
              setFormData({ ...formData, month: e.target.value })
            }
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">媒体名</label>
          <Input
            value={formData.medium}
            onChange={(e) =>
              setFormData({ ...formData, medium: e.target.value })
            }
            placeholder="例: Instagram広告"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">広告費（円）</label>
          <Input
            type="number"
            value={formData.adCost}
            onChange={(e) =>
              setFormData({
                ...formData,
                adCost: parseInt(e.target.value) || 0,
              })
            }
            min="0"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">新規予約数</label>
          <Input
            type="number"
            value={formData.newReservations}
            onChange={(e) =>
              setFormData({
                ...formData,
                newReservations: parseInt(e.target.value) || 0,
              })
            }
            min="0"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">成約数</label>
          <Input
            type="number"
            value={formData.conversions}
            onChange={(e) =>
              setFormData({
                ...formData,
                conversions: parseInt(e.target.value) || 0,
              })
            }
            min="0"
            required
          />
        </div>
      </div>

      {/* 自動計算指標の表示 */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">成約率</p>
          <p className="text-lg font-semibold">
            {conversionRate.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">CPA</p>
          <p className="text-lg font-semibold">
            ¥{Math.round(cpa).toLocaleString()}
          </p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">備考</label>
        <Input
          value={formData.notes}
          onChange={(e) =>
            setFormData({ ...formData, notes: e.target.value })
          }
          placeholder="備考（任意）"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          キャンセル
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "保存中..." : ad ? "更新" : "追加"}
        </Button>
      </div>
    </form>
  );
}
