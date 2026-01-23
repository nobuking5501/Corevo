"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useExpensesStore } from "@/stores/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export default function ExpensesPage() {
  const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";
  const [tenantId, setTenantId] = useState<string | null>(null);
  const { expenses, loading, error, fetchExpense, upsertExpense } =
    useExpensesStore();

  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM")
  );
  const [formData, setFormData] = useState({
    rent: 0,
    labor: 0,
    advertising: 0,
    materials: 0,
    utilities: 0,
    miscellaneous: 0,
    systems: 0,
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);

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

  // 選択された月の経費データを取得
  useEffect(() => {
    if (tenantId && selectedMonth) {
      fetchExpense(tenantId, selectedMonth);
    }
  }, [tenantId, selectedMonth, fetchExpense]);

  // 経費データが読み込まれたらフォームに反映
  useEffect(() => {
    const expense = expenses[selectedMonth];
    if (expense) {
      setFormData({
        rent: expense.rent,
        labor: expense.labor,
        advertising: expense.advertising,
        materials: expense.materials,
        utilities: expense.utilities,
        miscellaneous: expense.miscellaneous,
        systems: expense.systems,
        notes: expense.notes || "",
      });
    } else {
      // データがない場合は0でリセット
      setFormData({
        rent: 0,
        labor: 0,
        advertising: 0,
        materials: 0,
        utilities: 0,
        miscellaneous: 0,
        systems: 0,
        notes: "",
      });
    }
  }, [expenses, selectedMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setIsSaving(true);
    try {
      await upsertExpense(
        {
          month: selectedMonth,
          ...formData,
        },
        tenantId
      );
      alert("経費を保存しました");
    } catch (error) {
      console.error("Failed to save expense:", error);
      alert("経費の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const total =
    formData.rent +
    formData.labor +
    formData.advertising +
    formData.materials +
    formData.utilities +
    formData.miscellaneous +
    formData.systems;

  // 適正範囲の定義（売上対比）
  const appropriateRanges = {
    rent: { min: 0.05, max: 0.10, name: "家賃" },
    labor: { min: 0.20, max: 0.30, name: "人件費" },
    advertising: { min: 0.10, max: 0.20, name: "広告費" },
    materials: { min: 0.03, max: 0.08, name: "材料費" },
    utilities: { min: 0.02, max: 0.05, name: "光熱費" },
    miscellaneous: { min: 0.01, max: 0.03, name: "雑費" },
    systems: { min: 0.01, max: 0.02, name: "システム費" },
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
        <h1 className="text-3xl font-bold">経費管理</h1>
        <p className="text-muted-foreground">
          月次の経費データを管理します
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* 月選択 */}
      <Card>
        <CardHeader>
          <CardTitle>対象月</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="max-w-xs"
          />
        </CardContent>
      </Card>

      {/* 経費入力フォーム */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>経費入力</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">家賃（円）</label>
                <Input
                  type="number"
                  value={formData.rent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rent: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  適正範囲: 売上の5-10%
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">人件費（円）</label>
                <Input
                  type="number"
                  value={formData.labor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      labor: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  適正範囲: 売上の20-30%
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">広告費（円）</label>
                <Input
                  type="number"
                  value={formData.advertising}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      advertising: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  適正範囲: 売上の10-20%
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">材料費（円）</label>
                <Input
                  type="number"
                  value={formData.materials}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      materials: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  適正範囲: 売上の3-8%
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">光熱費（円）</label>
                <Input
                  type="number"
                  value={formData.utilities}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      utilities: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  適正範囲: 売上の2-5%
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">雑費（円）</label>
                <Input
                  type="number"
                  value={formData.miscellaneous}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      miscellaneous: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  適正範囲: 売上の1-3%
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">システム費（円）</label>
                <Input
                  type="number"
                  value={formData.systems}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      systems: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  適正範囲: 売上の1-2%
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

            {/* 合計表示 */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">合計経費</span>
                <span className="text-2xl font-bold">
                  ¥{total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={isSaving || loading}>
                {isSaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* 経費比率分析（今後実装） */}
      <Card>
        <CardHeader>
          <CardTitle>経費比率分析</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            売上データと組み合わせて経費比率を分析する機能は、今後のバージョンで実装予定です。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
