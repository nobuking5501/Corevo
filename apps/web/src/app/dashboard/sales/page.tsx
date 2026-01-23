"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useSalesStore } from "@/stores/sales";
import { Sale } from "@/types";
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
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function SalesPage() {
  const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";
  const [tenantId, setTenantId] = useState<string | null>(null);
  const { sales, loading, error, fetchSales, deleteSale } = useSalesStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

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
      fetchSales({
        tenantId: tenantId,
        limit: 100,
      });
    }
  }, [tenantId, fetchSales]);

  const handleDelete = async (saleId: string) => {
    if (!tenantId) return;

    if (confirm("この売上データを削除してもよろしいですか？")) {
      try {
        await deleteSale(saleId, tenantId);
      } catch (error) {
        console.error("Failed to delete sale:", error);
      }
    }
  };

  const filteredSales = sales.filter((sale) => {
    const query = searchQuery.toLowerCase();
    return (
      sale.customerName.toLowerCase().includes(query) ||
      sale.serviceName.toLowerCase().includes(query) ||
      sale.staffName.toLowerCase().includes(query)
    );
  });

  const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);

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
          <h1 className="text-3xl font-bold">売上管理</h1>
          <p className="text-muted-foreground">
            日々の売上データを管理します
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              売上を追加
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>売上を追加</DialogTitle>
            </DialogHeader>
            <SaleForm
              tenantId={tenantId}
              onSuccess={() => {
                setIsCreateDialogOpen(false);
                fetchSales({ tenantId: tenantId, limit: 100 });
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

      {/* フィルタ・検索 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="顧客名、メニュー、スタッフで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* 集計サマリ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">合計売上</p>
          <p className="text-2xl font-bold">
            ¥{totalAmount.toLocaleString()}
          </p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">件数</p>
          <p className="text-2xl font-bold">{filteredSales.length}件</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">平均単価</p>
          <p className="text-2xl font-bold">
            ¥
            {filteredSales.length > 0
              ? Math.round(totalAmount / filteredSales.length).toLocaleString()
              : 0}
          </p>
        </div>
      </div>

      {/* 売上テーブル */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日付</TableHead>
              <TableHead>顧客名</TableHead>
              <TableHead>区分</TableHead>
              <TableHead>メニュー</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>支払方法</TableHead>
              <TableHead>担当スタッフ</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  読み込み中...
                </TableCell>
              </TableRow>
            ) : filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  売上データがありません
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>{sale.date}</TableCell>
                  <TableCell className="font-medium">
                    {sale.customerName}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        sale.customerType === "new"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {sale.customerType === "new" ? "新規" : "既存"}
                    </span>
                  </TableCell>
                  <TableCell>{sale.serviceName}</TableCell>
                  <TableCell className="text-right font-medium">
                    ¥{sale.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {sale.paymentMethod === "cash"
                      ? "現金"
                      : sale.paymentMethod === "card"
                      ? "カード"
                      : sale.paymentMethod === "paypay"
                      ? "PayPay"
                      : "その他"}
                  </TableCell>
                  <TableCell>{sale.staffName}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedSale(sale);
                          setIsCreateDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(sale.id)}
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
    </div>
  );
}

// 売上フォームコンポーネント（簡易版）
function SaleForm({
  tenantId,
  sale,
  onSuccess,
}: {
  tenantId: string;
  sale?: Sale;
  onSuccess: () => void;
}) {
  const { createSale, updateSale } = useSalesStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerId: sale?.customerId || "",
    date: sale?.date || format(new Date(), "yyyy-MM-dd"),
    serviceName: sale?.serviceName || "",
    coursePrice: sale?.coursePrice || 0,
    quantity: sale?.quantity || 1,
    paymentMethod: sale?.paymentMethod || "cash",
    staffId: sale?.staffId || "",
    notes: sale?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (sale) {
        await updateSale(
          {
            saleId: sale.id,
            ...formData,
          },
          tenantId
        );
      } else {
        await createSale(formData, tenantId);
      }
      onSuccess();
    } catch (error) {
      console.error("Failed to save sale:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">日付</label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) =>
              setFormData({ ...formData, date: e.target.value })
            }
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">顧客ID</label>
          <Input
            value={formData.customerId}
            onChange={(e) =>
              setFormData({ ...formData, customerId: e.target.value })
            }
            placeholder="顧客IDを入力"
            required
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">メニュー名</label>
        <Input
          value={formData.serviceName}
          onChange={(e) =>
            setFormData({ ...formData, serviceName: e.target.value })
          }
          placeholder="例: 全身脱毛コース"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">コース単価</label>
          <Input
            type="number"
            value={formData.coursePrice}
            onChange={(e) =>
              setFormData({
                ...formData,
                coursePrice: parseInt(e.target.value),
              })
            }
            placeholder="150000"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">回数</label>
          <Input
            type="number"
            value={formData.quantity}
            onChange={(e) =>
              setFormData({
                ...formData,
                quantity: parseInt(e.target.value),
              })
            }
            min="1"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">支払方法</label>
          <select
            value={formData.paymentMethod}
            onChange={(e) =>
              setFormData({
                ...formData,
                paymentMethod: e.target.value as any,
              })
            }
            className="w-full border rounded-md px-3 py-2"
            required
          >
            <option value="cash">現金</option>
            <option value="card">カード</option>
            <option value="paypay">PayPay</option>
            <option value="other">その他</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">担当スタッフID</label>
          <Input
            value={formData.staffId}
            onChange={(e) =>
              setFormData({ ...formData, staffId: e.target.value })
            }
            placeholder="スタッフIDを入力"
            required
          />
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
          {loading ? "保存中..." : sale ? "更新" : "追加"}
        </Button>
      </div>
    </form>
  );
}
