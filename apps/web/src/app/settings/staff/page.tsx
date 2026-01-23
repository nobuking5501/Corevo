"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth";
import { httpsCallable } from "firebase/functions";
import { functions, auth, db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

interface StaffMember {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "manager" | "staff" | "accountant";
  createdAt: any;
}

export default function StaffPage() {
  const { currentTenantId, currentTenant, tenants } = useAuthStore();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [userEmail, setUserEmail] = useState("");
  const [role, setRole] = useState<"owner" | "manager" | "staff" | "accountant">("staff");
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);

  // Load staff members for current tenant
  useEffect(() => {
    if (!currentTenantId) return;

    const loadStaff = async () => {
      setIsLoadingStaff(true);
      try {
        const usersRef = collection(db, `tenants/${currentTenantId}/users`);
        const snapshot = await getDocs(usersRef);
        const staff: StaffMember[] = [];
        snapshot.forEach((doc) => {
          staff.push({
            id: doc.id,
            ...doc.data(),
          } as StaffMember);
        });
        setStaffMembers(staff);
      } catch (error) {
        console.error("[StaffPage] Error loading staff:", error);
      } finally {
        setIsLoadingStaff(false);
      }
    };

    loadStaff();
  }, [currentTenantId]);

  // Initialize selected tenants with current tenant
  useEffect(() => {
    if (currentTenantId && selectedTenantIds.length === 0) {
      setSelectedTenantIds([currentTenantId]);
    }
  }, [currentTenantId]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedTenantIds.length === 0) {
      setError("少なくとも1つの店舗を選択してください。");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const addUserToTenant = httpsCallable(functions, "addUserToTenant");
      const results = [];

      // Add user to each selected tenant
      for (const tenantId of selectedTenantIds) {
        try {
          const result = await addUserToTenant({
            tenantId,
            userEmail,
            role,
          });
          results.push({ tenantId, success: true, data: result.data });
          console.log(`[StaffPage] User added to tenant ${tenantId}:`, result.data);
        } catch (err: any) {
          console.error(`[StaffPage] Error adding user to tenant ${tenantId}:`, err);
          results.push({ tenantId, success: false, error: err.message });
        }
      }

      // Check if at least one succeeded
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (successCount > 0) {
        // Force token refresh if user was added successfully
        const user = auth.currentUser;
        if (user) {
          await user.getIdToken(true);
        }

        setSuccess(
          `ユーザーが ${successCount} 店舗に追加されました。` +
            (failCount > 0 ? ` ${failCount} 店舗への追加に失敗しました。` : "")
        );

        // Reset form
        setUserEmail("");
        setRole("staff");
        setSelectedTenantIds([currentTenantId || ""]);

        // Reload staff list after 1 second
        setTimeout(() => {
          setShowAddModal(false);
          window.location.reload();
        }, 1500);
      } else {
        setError("すべての店舗へのユーザー追加に失敗しました。");
      }
    } catch (error: any) {
      console.error("[StaffPage] Add user error:", error);
      setError(error.message || "ユーザーの追加に失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTenantToggle = (tenantId: string) => {
    setSelectedTenantIds((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId]
    );
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      owner: { label: "オーナー", color: "bg-purple-100 text-purple-800" },
      manager: { label: "マネージャー", color: "bg-blue-100 text-blue-800" },
      staff: { label: "スタッフ", color: "bg-green-100 text-green-800" },
      accountant: { label: "経理", color: "bg-yellow-100 text-yellow-800" },
    };
    const badge = badges[role as keyof typeof badges] || { label: role, color: "bg-gray-100 text-gray-800" };
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color}`}>{badge.label}</span>;
  };

  return (
    <MainLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">スタッフ管理</h1>
            <p className="text-sm text-gray-600 mt-1">
              {currentTenant?.name} のスタッフを管理します
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            + スタッフを追加
          </Button>
        </div>

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle>スタッフ一覧</CardTitle>
            <CardDescription>
              現在の店舗に所属しているスタッフメンバー
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStaff ? (
              <div className="py-8 text-center text-gray-500">
                読み込み中...
              </div>
            ) : staffMembers.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                スタッフが見つかりません。
              </div>
            ) : (
              <div className="space-y-4">
                {staffMembers.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {staff.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{staff.displayName}</p>
                          <p className="text-sm text-gray-600">{staff.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getRoleBadge(staff.role)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>スタッフを追加</CardTitle>
                <CardDescription>
                  既存のユーザーを店舗に追加します。ユーザーのメールアドレスと役割を入力してください。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddUser} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">メールアドレス *</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      placeholder="例: staff@example.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-600">
                      追加するユーザーのメールアドレスを入力してください。ユーザーは既にFirebase Authenticationに登録されている必要があります。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">役割 *</Label>
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="staff">スタッフ</option>
                      <option value="manager">マネージャー</option>
                      <option value="accountant">経理</option>
                      <option value="owner">オーナー</option>
                    </select>
                    <p className="text-xs text-gray-600">
                      ユーザーに割り当てる役割を選択してください
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>追加する店舗 *</Label>
                    <div className="border border-gray-300 rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                      {tenants.map((tenant) => (
                        <label
                          key={tenant.id}
                          className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTenantIds.includes(tenant.id)}
                            onChange={() => handleTenantToggle(tenant.id)}
                            disabled={isLoading}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900">{tenant.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600">
                      ユーザーを追加する店舗を選択してください（複数選択可能）
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                      <p className="font-semibold">エラーが発生しました</p>
                      <p>{error}</p>
                    </div>
                  )}

                  {success && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                      <p className="font-semibold">成功</p>
                      <p>{success}</p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddModal(false)}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? "追加中..." : "スタッフを追加"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
