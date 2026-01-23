"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { StaffMember, Service } from "@/types";
import { toast } from "@/hooks/use-toast";
import { User, Trash2, Edit, X, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// カラーパレット
const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788"
];

export default function StaffMembersPage() {
  const { currentTenantId } = useAuthStore();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [kana, setKana] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load staff members
  useEffect(() => {
    if (!currentTenantId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load staff members
        const staffRef = collection(db, `tenants/${currentTenantId}/staffMembers`);
        const staffQuery = query(staffRef, orderBy("name", "asc"));
        const staffSnapshot = await getDocs(staffQuery);
        const staffData = staffSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as StaffMember[];
        setStaffMembers(staffData);

        // Load services
        const servicesRef = collection(db, `tenants/${currentTenantId}/services`);
        const servicesQuery = query(
          servicesRef,
          where("active", "==", true),
          orderBy("sortOrder", "asc")
        );
        const servicesSnapshot = await getDocs(servicesQuery);
        const servicesData = servicesSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Service[];
        setServices(servicesData);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          variant: "destructive",
          title: "データ読み込みエラー",
          description: "データの取得に失敗しました",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentTenantId]);

  const openAddModal = () => {
    setEditingStaff(null);
    setName("");
    setKana("");
    setColor(COLORS[0]);
    setPhone("");
    setEmail("");
    setSelectedServices(new Set());
    setNotes("");
    setShowModal(true);
  };

  const openEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setName(staff.name);
    setKana(staff.kana);
    setColor(staff.color);
    setPhone(staff.phone || "");
    setEmail(staff.email || "");
    setSelectedServices(new Set(staff.services));
    setNotes(staff.notes || "");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenantId) return;

    setIsSaving(true);

    try {
      const staffData = {
        tenantId: currentTenantId,
        name,
        kana,
        color,
        phone: phone || null,
        email: email || null,
        active: true,
        services: Array.from(selectedServices),
        notes: notes || null,
        updatedAt: serverTimestamp(),
      };

      if (editingStaff) {
        // Update existing staff
        const staffRef = doc(db, `tenants/${currentTenantId}/staffMembers`, editingStaff.id);
        await updateDoc(staffRef, staffData);
        toast({
          title: "スタッフを更新しました",
          description: `${name}の情報を更新しました`,
        });
      } else {
        // Add new staff
        await addDoc(collection(db, `tenants/${currentTenantId}/staffMembers`), {
          ...staffData,
          createdAt: serverTimestamp(),
        });
        toast({
          title: "スタッフを追加しました",
          description: `${name}を追加しました`,
        });
      }

      setShowModal(false);
      // Reload staff members
      const staffRef = collection(db, `tenants/${currentTenantId}/staffMembers`);
      const staffQuery = query(staffRef, orderBy("name", "asc"));
      const staffSnapshot = await getDocs(staffQuery);
      const updatedStaffData = staffSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as StaffMember[];
      setStaffMembers(updatedStaffData);
    } catch (error) {
      console.error("Error saving staff:", error);
      toast({
        variant: "destructive",
        title: "保存エラー",
        description: "スタッフの保存に失敗しました",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (staff: StaffMember) => {
    if (!currentTenantId) return;
    if (!confirm(`${staff.name}を削除してもよろしいですか？`)) return;

    try {
      await deleteDoc(doc(db, `tenants/${currentTenantId}/staffMembers`, staff.id));
      setStaffMembers(staffMembers.filter((s) => s.id !== staff.id));
      toast({
        title: "スタッフを削除しました",
        description: `${staff.name}を削除しました`,
      });
    } catch (error) {
      console.error("Error deleting staff:", error);
      toast({
        variant: "destructive",
        title: "削除エラー",
        description: "スタッフの削除に失敗しました",
      });
    }
  };

  const toggleService = (serviceId: string) => {
    const newSet = new Set(selectedServices);
    if (newSet.has(serviceId)) {
      newSet.delete(serviceId);
    } else {
      newSet.add(serviceId);
    }
    setSelectedServices(newSet);
  };

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const category = service.category || "その他";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  return (
    <MainLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">施術スタッフ管理</h1>
            <p className="text-sm text-gray-600 mt-1">
              施術を担当するスタッフを管理します
            </p>
          </div>
          <Button onClick={openAddModal}>
            + スタッフを追加
          </Button>
        </div>

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle>スタッフ一覧</CardTitle>
            <CardDescription>
              現在登録されている施術スタッフ
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-gray-500">
                読み込み中...
              </div>
            ) : staffMembers.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                スタッフが登録されていません。
                <br />
                上の「スタッフを追加」ボタンから追加してください。
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
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                          style={{ backgroundColor: staff.color }}
                        >
                          {staff.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{staff.name}</p>
                            <span className="text-xs text-gray-500">({staff.kana})</span>
                          </div>
                          {(staff.phone || staff.email) && (
                            <p className="text-sm text-gray-600">
                              {staff.phone && staff.phone}
                              {staff.phone && staff.email && " / "}
                              {staff.email && staff.email}
                            </p>
                          )}
                          {staff.services.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              対応可能: {staff.services.length}件のサービス
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(staff)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(staff)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>
                  {editingStaff ? "スタッフを編集" : "スタッフを追加"}
                </CardTitle>
                <CardDescription>
                  施術を担当するスタッフの情報を入力してください
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">名前 *</Label>
                      <Input
                        id="name"
                        placeholder="例: 山田花子"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kana">フリガナ *</Label>
                      <Input
                        id="kana"
                        placeholder="例: ヤマダハナコ"
                        value={kana}
                        onChange={(e) => setKana(e.target.value)}
                        required
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>カレンダー表示色 *</Label>
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`w-10 h-10 rounded-full border-2 ${
                            color === c ? "border-gray-900 scale-110" : "border-gray-300"
                          }`}
                          style={{ backgroundColor: c }}
                          onClick={() => setColor(c)}
                          disabled={isSaving}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">電話番号</Label>
                      <Input
                        id="phone"
                        placeholder="例: 090-1234-5678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">メールアドレス</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="例: staff@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>対応可能なサービス</Label>
                    <div className="border border-gray-300 rounded-md p-4 space-y-4 max-h-80 overflow-y-auto">
                      {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
                        <div key={category}>
                          <h4 className="font-semibold text-sm mb-2 text-gray-700">{category}</h4>
                          <div className="space-y-2 pl-2">
                            {categoryServices.map((service) => (
                              <label
                                key={service.id}
                                className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                              >
                                <Checkbox
                                  checked={selectedServices.has(service.id)}
                                  onCheckedChange={() => toggleService(service.id)}
                                  disabled={isSaving}
                                />
                                <span className="text-sm text-gray-900">{service.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      {services.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">
                          サービスが登録されていません
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">メモ</Label>
                    <Input
                      id="notes"
                      placeholder="例: ベテランスタッフ"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowModal(false)}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1"
                    >
                      {isSaving ? "保存中..." : editingStaff ? "更新" : "追加"}
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
