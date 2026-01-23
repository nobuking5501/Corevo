"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useKPITargetsStore } from "@/stores/kpiTargets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Target, TrendingUp, DollarSign, Users, BarChart3 } from "lucide-react";

const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";

export default function KPITargetsPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const { targets, loading, error, fetchKPITargets, updateKPITargets } = useKPITargetsStore();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    profitMarginTarget: 0.20,
    continuationRateTarget: 0.85,
    nextReservationRateTarget: 0.70,
    newCustomersMonthlyTarget: 30,
    cpaMaxTarget: 20000,
    adCostRatioMaxTarget: 0.15,
    laborCostRatioMaxTarget: 0.30,
    expenseRatioMaxTarget: 0.60,
    monthlyRevenueTarget: 3000000,
    monthlyProfitTarget: 600000,
  });

  // Get tenant ID from Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult(false);
        let tenantIds = (tokenResult.claims.tenantIds as string[]) || [];

        // Dev mode: use localStorage if no tenantIds
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
      fetchKPITargets(tenantId);
    }
  }, [tenantId, fetchKPITargets]);

  useEffect(() => {
    if (targets) {
      setFormData({
        profitMarginTarget: targets.profitMarginTarget,
        continuationRateTarget: targets.continuationRateTarget,
        nextReservationRateTarget: targets.nextReservationRateTarget,
        newCustomersMonthlyTarget: targets.newCustomersMonthlyTarget,
        cpaMaxTarget: targets.cpaMaxTarget,
        adCostRatioMaxTarget: targets.adCostRatioMaxTarget,
        laborCostRatioMaxTarget: targets.laborCostRatioMaxTarget,
        expenseRatioMaxTarget: targets.expenseRatioMaxTarget,
        monthlyRevenueTarget: targets.monthlyRevenueTarget || 3000000,
        monthlyProfitTarget: targets.monthlyProfitTarget || 600000,
      });
    }
  }, [targets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setIsSaving(true);
    try {
      await updateKPITargets(formData, tenantId);
      alert("KPI目標を保存しました");
    } catch (error) {
      console.error("Failed to save KPI targets:", error);
      alert("KPI目標の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

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
      <div>
        <h1 className="text-3xl font-bold">KPI目標設定</h1>
        <p className="text-muted-foreground">
          経営目標となるKPIの目標値を設定します
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 売上・利益目標 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              売上・利益目標
            </CardTitle>
            <CardDescription>月次の売上と利益の目標値</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">月次売上目標（円）</label>
                <Input
                  type="number"
                  value={formData.monthlyRevenueTarget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      monthlyRevenueTarget: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step="100000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 業界平均300万円/月
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">月次利益目標（円）</label>
                <Input
                  type="number"
                  value={formData.monthlyProfitTarget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      monthlyProfitTarget: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step="50000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 売上の20%
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">利益率目標</label>
                <Input
                  type="number"
                  value={formData.profitMarginTarget * 100}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      profitMarginTarget: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                  min="0"
                  max="100"
                  step="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 20%以上（現在: {(formData.profitMarginTarget * 100).toFixed(0)}%）
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 顧客関連目標 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              顧客関連目標
            </CardTitle>
            <CardDescription>顧客獲得・継続の目標値</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">継続率目標</label>
                <Input
                  type="number"
                  value={formData.continuationRateTarget * 100}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      continuationRateTarget: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                  min="0"
                  max="100"
                  step="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 85%以上（現在: {(formData.continuationRateTarget * 100).toFixed(0)}%）
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">次回予約率目標</label>
                <Input
                  type="number"
                  value={formData.nextReservationRateTarget * 100}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nextReservationRateTarget: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                  min="0"
                  max="100"
                  step="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 70%以上（現在: {(formData.nextReservationRateTarget * 100).toFixed(0)}%）
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">新規顧客獲得目標（月）</label>
                <Input
                  type="number"
                  value={formData.newCustomersMonthlyTarget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      newCustomersMonthlyTarget: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 30人/月以上
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 広告・マーケティング目標 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              広告・マーケティング目標
            </CardTitle>
            <CardDescription>広告効率の目標値</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">CPA上限（円）</label>
                <Input
                  type="number"
                  value={formData.cpaMaxTarget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cpaMaxTarget: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step="1000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 20,000円以下
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">広告費率上限</label>
                <Input
                  type="number"
                  value={formData.adCostRatioMaxTarget * 100}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adCostRatioMaxTarget: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                  min="0"
                  max="100"
                  step="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 売上の15%以下（現在: {(formData.adCostRatioMaxTarget * 100).toFixed(0)}%）
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 経費目標 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              経費目標
            </CardTitle>
            <CardDescription>経費比率の目標値</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">人件費率上限</label>
                <Input
                  type="number"
                  value={formData.laborCostRatioMaxTarget * 100}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      laborCostRatioMaxTarget: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                  min="0"
                  max="100"
                  step="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 売上の30%以下（現在: {(formData.laborCostRatioMaxTarget * 100).toFixed(0)}%）
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">総経費率上限</label>
                <Input
                  type="number"
                  value={formData.expenseRatioMaxTarget * 100}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expenseRatioMaxTarget: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                  min="0"
                  max="100"
                  step="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  推奨: 売上の60%以下（現在: {(formData.expenseRatioMaxTarget * 100).toFixed(0)}%）
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving || loading} size="lg">
            {isSaving ? "保存中..." : "KPI目標を保存"}
          </Button>
        </div>
      </form>

      {/* 推奨値の説明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            推奨値について
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• 利益率: 20%以上を目標にすると健全な経営が可能</li>
            <li>• 継続率: 85%以上を維持することで安定収益を確保</li>
            <li>• 次回予約率: 70%以上で顧客離脱を防止</li>
            <li>• CPA: 顧客のLTVの30%以下に抑えることが理想</li>
            <li>• 広告費率: 売上の10-15%が適正範囲</li>
            <li>• 人件費率: 売上の25-30%が業界標準</li>
            <li>• 総経費率: 売上の60%以下で利益率20%を確保</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
