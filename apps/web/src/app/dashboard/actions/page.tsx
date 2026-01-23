"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useActionItemsStore } from "@/stores/actionItems";
import { ActionItem, ActionItemStatus, ActionItemCategory } from "@/types";
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
import { Plus, Edit, Trash2, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function ActionsPage() {
  const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";
  const [tenantId, setTenantId] = useState<string | null>(null);
  const { actionItems, loading, error, fetchActionItems, deleteActionItem } = useActionItemsStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<ActionItemStatus | "all">("all");

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
      fetchActionItems({
        tenantId: tenantId,
        limit: 100,
      });
    }
  }, [tenantId, fetchActionItems]);

  const handleDelete = async (actionId: string) => {
    if (!tenantId) return;

    if (confirm("この改善アクションを削除してもよろしいですか？")) {
      try {
        await deleteActionItem(actionId, tenantId);
      } catch (error) {
        console.error("Failed to delete action item:", error);
      }
    }
  };

  const filteredActions = actionItems.filter((action) => {
    if (statusFilter === "all") return true;
    return action.status === statusFilter;
  });

  const statusCounts = {
    all: actionItems.length,
    pending: actionItems.filter((a) => a.status === "pending").length,
    in_progress: actionItems.filter((a) => a.status === "in_progress").length,
    completed: actionItems.filter((a) => a.status === "completed").length,
    canceled: actionItems.filter((a) => a.status === "canceled").length,
  };

  const getStatusBadge = (status: ActionItemStatus) => {
    switch (status) {
      case "pending":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800"><Clock className="h-3 w-3 mr-1" />未着手</span>;
      case "in_progress":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />進行中</span>;
      case "completed":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />完了</span>;
      case "canceled":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />中止</span>;
    }
  };

  const getCategoryLabel = (category: ActionItemCategory) => {
    const labels = {
      sales: "売上",
      cost: "コスト",
      customer: "顧客",
      staff: "スタッフ",
      other: "その他",
    };
    return labels[category];
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">改善アクション管理</h1>
          <p className="text-muted-foreground">
            PDCAサイクルで継続的な改善を実施
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              アクションを追加
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>改善アクションを追加</DialogTitle>
            </DialogHeader>
            <ActionForm
              tenantId={tenantId}
              action={selectedAction || undefined}
              onSuccess={() => {
                setIsCreateDialogOpen(false);
                setSelectedAction(null);
                fetchActionItems({ tenantId: tenantId, limit: 100 });
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

      {/* ステータスサマリ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={statusFilter === "all" ? "border-primary" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">全体</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.all}件</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setStatusFilter("all")}
            >
              表示
            </Button>
          </CardContent>
        </Card>

        <Card className={statusFilter === "pending" ? "border-primary" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">未着手</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.pending}件</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setStatusFilter("pending")}
            >
              表示
            </Button>
          </CardContent>
        </Card>

        <Card className={statusFilter === "in_progress" ? "border-primary" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">進行中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.in_progress}件</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setStatusFilter("in_progress")}
            >
              表示
            </Button>
          </CardContent>
        </Card>

        <Card className={statusFilter === "completed" ? "border-primary" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">完了</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.completed}件</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setStatusFilter("completed")}
            >
              表示
            </Button>
          </CardContent>
        </Card>

        <Card className={statusFilter === "canceled" ? "border-primary" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">中止</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.canceled}件</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setStatusFilter("canceled")}
            >
              表示
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* アクションテーブル */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ステータス</TableHead>
              <TableHead>カテゴリ</TableHead>
              <TableHead>タイトル</TableHead>
              <TableHead>問題</TableHead>
              <TableHead>対策</TableHead>
              <TableHead>優先度</TableHead>
              <TableHead>期限</TableHead>
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
            ) : filteredActions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  改善アクションがありません
                </TableCell>
              </TableRow>
            ) : (
              filteredActions.map((action) => (
                <TableRow key={action.id}>
                  <TableCell>{getStatusBadge(action.status)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                      {getCategoryLabel(action.category)}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{action.title}</TableCell>
                  <TableCell className="max-w-xs truncate">{action.problem}</TableCell>
                  <TableCell className="max-w-xs truncate">{action.action}</TableCell>
                  <TableCell>
                    <span className={`font-semibold ${action.priority >= 8 ? "text-red-600" : action.priority >= 5 ? "text-yellow-600" : "text-gray-600"}`}>
                      {action.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    {action.dueDate ? format(new Date(action.dueDate), "yyyy-MM-dd") : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedAction(action);
                          setIsCreateDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(action.id)}
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

// アクションフォームコンポーネント
function ActionForm({
  tenantId,
  action,
  onSuccess,
}: {
  tenantId: string;
  action?: ActionItem;
  onSuccess: () => void;
}) {
  const { createActionItem, updateActionItem } = useActionItemsStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: action?.title || "",
    category: action?.category || "other" as ActionItemCategory,
    problem: action?.problem || "",
    action: action?.action || "",
    dueDate: action?.dueDate ? format(new Date(action.dueDate), "yyyy-MM-dd") : "",
    status: action?.status || "pending" as ActionItemStatus,
    priority: action?.priority || 5,
    assignedTo: action?.assignedTo || "",
    effectDescription: action?.effectDescription || "",
    effectValue: action?.effectValue || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSubmit = {
        ...formData,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      };

      if (action) {
        await updateActionItem(
          {
            actionId: action.id,
            ...dataToSubmit,
          },
          tenantId
        );
      } else {
        await createActionItem(dataToSubmit, tenantId);
      }
      onSuccess();
    } catch (error) {
      console.error("Failed to save action item:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">タイトル</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="例: 新規顧客獲得のためのInstagram広告改善"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">カテゴリ</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ActionItemCategory })}
            className="w-full border rounded-md px-3 py-2"
            required
          >
            <option value="sales">売上</option>
            <option value="cost">コスト</option>
            <option value="customer">顧客</option>
            <option value="staff">スタッフ</option>
            <option value="other">その他</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">ステータス</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as ActionItemStatus })}
            className="w-full border rounded-md px-3 py-2"
            required
          >
            <option value="pending">未着手</option>
            <option value="in_progress">進行中</option>
            <option value="completed">完了</option>
            <option value="canceled">中止</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">問題（Plan）</label>
        <Input
          value={formData.problem}
          onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
          placeholder="例: 新規顧客のCPAが20,000円を超えている"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">対策（Do）</label>
        <Input
          value={formData.action}
          onChange={(e) => setFormData({ ...formData, action: e.target.value })}
          placeholder="例: クリエイティブを3パターン作成してA/Bテストを実施"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">優先度（1-10）</label>
          <Input
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })}
            min="1"
            max="10"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">期限</label>
          <Input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">担当者ID（任意）</label>
        <Input
          value={formData.assignedTo}
          onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
          placeholder="担当者のユーザーID"
        />
      </div>

      {action && (
        <>
          <div>
            <label className="text-sm font-medium">効果説明（Check）</label>
            <Input
              value={formData.effectDescription}
              onChange={(e) => setFormData({ ...formData, effectDescription: e.target.value })}
              placeholder="例: CPAが15,000円に改善"
            />
          </div>

          <div>
            <label className="text-sm font-medium">効果値（Act）</label>
            <Input
              type="number"
              value={formData.effectValue}
              onChange={(e) => setFormData({ ...formData, effectValue: parseFloat(e.target.value) || 0 })}
              placeholder="数値で測定可能な効果"
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          キャンセル
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "保存中..." : action ? "更新" : "追加"}
        </Button>
      </div>
    </form>
  );
}
