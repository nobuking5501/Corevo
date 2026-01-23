"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "@/lib/firebase";
import type { Tenant } from "@/types";

export default function TenantsPage() {
  const { tenants, organizationId, organization } = useAuthStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);
  const [showEditTenantModal, setShowEditTenantModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Add Tenant form state
  const [tenantName, setTenantName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  // Edit Organization form state
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgPlan, setEditOrgPlan] = useState<"free" | "trial" | "pro" | "enterprise">("trial");
  const [editOrgStatus, setEditOrgStatus] = useState<"active" | "inactive" | "suspended">("active");

  // Edit Tenant form state
  const [editTenantName, setEditTenantName] = useState("");
  const [editStoreCode, setEditStoreCode] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive" | "suspended">("active");

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      setError("組織IDが見つかりません。");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const addTenant = httpsCallable(functions, "addTenant");
      const result = await addTenant({
        organizationId,
        tenantName,
        storeCode,
        address,
        phone,
      });

      console.log("[TenantsPage] Tenant added:", result.data);

      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true);
      }

      setSuccess("店舗が正常に追加されました。ページを再読み込みします。");
      setTimeout(() => {
        setShowAddModal(false);
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("[TenantsPage] Add tenant error:", error);
      setError(error.message || "店舗の追加に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      setError("組織IDが見つかりません。");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const updateOrganization = httpsCallable(functions, "updateOrganization");
      await updateOrganization({
        organizationId,
        name: editOrgName,
        plan: editOrgPlan,
        status: editOrgStatus,
      });

      setSuccess("組織情報が正常に更新されました。ページを再読み込みします。");
      setTimeout(() => {
        setShowEditOrgModal(false);
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("[TenantsPage] Update organization error:", error);
      setError(error.message || "組織情報の更新に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const updateTenant = httpsCallable(functions, "updateTenant");
      await updateTenant({
        tenantId: selectedTenant.id,
        name: editTenantName,
        storeCode: editStoreCode,
        address: editAddress,
        phone: editPhone,
        status: editStatus,
      });

      setSuccess("店舗情報が正常に更新されました。ページを再読み込みします。");
      setTimeout(() => {
        setShowEditTenantModal(false);
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("[TenantsPage] Update tenant error:", error);
      setError(error.message || "店舗情報の更新に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!selectedTenant) return;

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const deleteTenant = httpsCallable(functions, "deleteTenant");
      await deleteTenant({
        tenantId: selectedTenant.id,
      });

      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true);
      }

      setSuccess("店舗が正常に削除されました。ページを再読み込みします。");
      setTimeout(() => {
        setShowDeleteModal(false);
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("[TenantsPage] Delete tenant error:", error);
      setError(error.message || "店舗の削除に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const openEditOrgModal = () => {
    if (organization) {
      setEditOrgName(organization.name);
      setEditOrgPlan(organization.plan as any);
      setEditOrgStatus(organization.status as any);
      setShowEditOrgModal(true);
    }
  };

  const openEditTenantModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditTenantName(tenant.name);
    setEditStoreCode(tenant.storeCode || "");
    setEditAddress(tenant.address || "");
    setEditPhone(tenant.phone || "");
    setEditStatus((tenant.status as any) || "active");
    setShowEditTenantModal(true);
  };

  const openDeleteModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowDeleteModal(true);
  };

  return (
    <MainLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">店舗管理</h1>
            <p className="text-sm text-gray-600 mt-1">
              組織内の店舗を追加・管理します
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            + 店舗を追加
          </Button>
        </div>

        {/* Organization Info */}
        {organization && (
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>組織情報</CardTitle>
              <Button variant="outline" size="sm" onClick={openEditOrgModal}>
                編集
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-semibold text-gray-700">組織名:</span>
                  <span className="ml-2 text-sm text-gray-900">{organization.name}</span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-700">プラン:</span>
                  <span className="ml-2 text-sm text-gray-900">{organization.plan}</span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-700">ステータス:</span>
                  <span className="ml-2 text-sm text-gray-900">{organization.status}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tenants List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
            <Card key={tenant.id}>
              <CardHeader>
                <CardTitle className="text-lg">{tenant.name}</CardTitle>
                <CardDescription>{tenant.slug}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm mb-4">
                  {tenant.storeCode && (
                    <div>
                      <span className="font-semibold text-gray-700">店舗コード:</span>
                      <span className="ml-2 text-gray-900">{tenant.storeCode}</span>
                    </div>
                  )}
                  {tenant.address && (
                    <div>
                      <span className="font-semibold text-gray-700">住所:</span>
                      <span className="ml-2 text-gray-900">{tenant.address}</span>
                    </div>
                  )}
                  {tenant.phone && (
                    <div>
                      <span className="font-semibold text-gray-700">電話番号:</span>
                      <span className="ml-2 text-gray-900">{tenant.phone}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-gray-700">ステータス:</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      tenant.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {tenant.status === "active" ? "アクティブ" : tenant.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditTenantModal(tenant)}
                  >
                    編集
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => openDeleteModal(tenant)}
                  >
                    削除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {tenants.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">店舗が見つかりません。</p>
              <p className="text-sm text-gray-400 mt-2">「店舗を追加」ボタンから新しい店舗を追加してください。</p>
            </CardContent>
          </Card>
        )}

        {/* Add Tenant Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>新しい店舗を追加</CardTitle>
                <CardDescription>
                  組織に新しい店舗を追加します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddTenant} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenantName">店舗名 *</Label>
                    <Input
                      id="tenantName"
                      type="text"
                      placeholder="例: ABC大阪店"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeCode">店舗コード</Label>
                    <Input
                      id="storeCode"
                      type="text"
                      placeholder="例: OSK001"
                      value={storeCode}
                      onChange={(e) => setStoreCode(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">住所</Label>
                    <Input
                      id="address"
                      type="text"
                      placeholder="例: 大阪府大阪市北区2-2-2"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">電話番号</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="例: 06-1234-5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                      <p className="font-semibold">エラー</p>
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
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? "追加中..." : "店舗を追加"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit Organization Modal */}
        {showEditOrgModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>組織情報を編集</CardTitle>
                <CardDescription>
                  組織の基本情報を更新します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEditOrganization} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="editOrgName">組織名 *</Label>
                    <Input
                      id="editOrgName"
                      type="text"
                      value={editOrgName}
                      onChange={(e) => setEditOrgName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editOrgPlan">プラン</Label>
                    <select
                      id="editOrgPlan"
                      value={editOrgPlan}
                      onChange={(e) => setEditOrgPlan(e.target.value as any)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="free">Free</option>
                      <option value="trial">Trial</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editOrgStatus">ステータス</Label>
                    <select
                      id="editOrgStatus"
                      value={editOrgStatus}
                      onChange={(e) => setEditOrgStatus(e.target.value as any)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                      <p className="font-semibold">エラー</p>
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
                      onClick={() => setShowEditOrgModal(false)}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      キャンセル
                    </Button>
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? "更新中..." : "更新"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit Tenant Modal */}
        {showEditTenantModal && selectedTenant && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>店舗情報を編集</CardTitle>
                <CardDescription>
                  {selectedTenant.name} の情報を更新します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEditTenant} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="editTenantName">店舗名 *</Label>
                    <Input
                      id="editTenantName"
                      type="text"
                      value={editTenantName}
                      onChange={(e) => setEditTenantName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editStoreCode">店舗コード</Label>
                    <Input
                      id="editStoreCode"
                      type="text"
                      value={editStoreCode}
                      onChange={(e) => setEditStoreCode(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editAddress">住所</Label>
                    <Input
                      id="editAddress"
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editPhone">電話番号</Label>
                    <Input
                      id="editPhone"
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editStatus">ステータス</Label>
                    <select
                      id="editStatus"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                      <p className="font-semibold">エラー</p>
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
                      onClick={() => setShowEditTenantModal(false)}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      キャンセル
                    </Button>
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? "更新中..." : "更新"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedTenant && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-red-600">店舗を削除</CardTitle>
                <CardDescription>
                  この操作は取り消せません。本当に削除しますか？
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>{selectedTenant.name}</strong> を削除すると、以下のデータもすべて削除されます：
                    </p>
                    <ul className="list-disc list-inside text-sm text-yellow-800 mt-2">
                      <li>店舗のすべてのスタッフ情報</li>
                      <li>顧客情報</li>
                      <li>予約情報</li>
                      <li>サービス情報</li>
                      <li>設定情報</li>
                    </ul>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                      <p className="font-semibold">エラー</p>
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
                      onClick={() => setShowDeleteModal(false)}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="button"
                      onClick={handleDeleteTenant}
                      disabled={isLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {isLoading ? "削除中..." : "削除する"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
