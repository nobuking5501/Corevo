"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Customer } from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, Save, X, Phone, Mail, Calendar, MapPin } from "lucide-react";

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const customerId = params.id as string;
  const isEditMode = searchParams.get("edit") === "true";

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  // Get tenant ID from Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult(false);
        const tenantIds = (tokenResult.claims.tenantIds as string[]) || [];

        if (tenantIds.length > 0) {
          setTenantId(tenantIds[0]);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error getting tenant ID:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load customer data
  useEffect(() => {
    if (!tenantId || !customerId) return;

    loadCustomer();
  }, [tenantId, customerId]);

  const loadCustomer = async () => {
    if (!tenantId || !customerId) return;

    setLoading(true);
    try {
      const customerRef = doc(db, `tenants/${tenantId}/customers`, customerId);
      const customerSnap = await getDoc(customerRef);

      if (customerSnap.exists()) {
        const data = customerSnap.data();
        const customerData = {
          id: customerSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          lastVisit: data.lastVisit?.toDate(),
          birthday: data.birthday?.toDate(),
        } as Customer;

        setCustomer(customerData);
        setFormData(customerData);
      } else {
        toast({
          variant: "destructive",
          title: "顧客が見つかりません",
          description: "指定された顧客が存在しません",
        });
        router.push("/customers");
      }
    } catch (error: any) {
      console.error("Error loading customer:", error);
      toast({
        variant: "destructive",
        title: "顧客データの読み込みエラー",
        description: error.message || "顧客データの取得に失敗しました",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId || !customerId || !formData) return;

    setSaving(true);
    try {
      const customerRef = doc(db, `tenants/${tenantId}/customers`, customerId);
      await updateDoc(customerRef, {
        name: formData.name,
        kana: formData.kana,
        email: formData.email || null,
        phone: formData.phone || null,
        gender: formData.gender || null,
        birthday: formData.birthday || null,
        address: formData.address || null,
        preferredStaffId: formData.preferredStaffId || null,
        updatedAt: new Date(),
      });

      toast({
        title: "顧客情報を更新しました",
        description: `${formData.name}さんの情報を保存しました`,
      });

      setEditing(false);
      await loadCustomer();
    } catch (error: any) {
      console.error("Error updating customer:", error);
      toast({
        variant: "destructive",
        title: "顧客更新エラー",
        description: error.message || "顧客情報の更新に失敗しました",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setFormData(customer || {});
  };

  const formatBirthday = (birthday?: Date) => {
    if (!birthday) return "未設定";
    return new Date(birthday).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateAge = (birthday?: Date) => {
    if (!birthday) return null;
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12">読み込み中...</div>
      </MainLayout>
    );
  }

  if (!customer) {
    return (
      <MainLayout>
        <div className="text-center py-12">顧客が見つかりません</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => router.push("/customers")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              戻る
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{customer.name}</h1>
              <p className="text-gray-500">{customer.kana}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <Button onClick={() => setEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                編集
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  <X className="mr-2 h-4 w-4" />
                  キャンセル
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "保存中..." : "保存"}
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>氏名</Label>
                {editing ? (
                  <Input
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                ) : (
                  <p className="mt-1 text-lg">{customer.name}</p>
                )}
              </div>

              <div>
                <Label>フリガナ</Label>
                {editing ? (
                  <Input
                    value={formData.kana || ""}
                    onChange={(e) => setFormData({ ...formData, kana: e.target.value })}
                  />
                ) : (
                  <p className="mt-1 text-lg">{customer.kana}</p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  電話番号
                </Label>
                {editing ? (
                  <Input
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                ) : (
                  <p className="mt-1 text-lg">{customer.phone || "未設定"}</p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  メールアドレス
                </Label>
                {editing ? (
                  <Input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                ) : (
                  <p className="mt-1 text-lg">{customer.email || "未設定"}</p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  生年月日
                </Label>
                {editing ? (
                  <Input
                    type="date"
                    value={
                      formData.birthday
                        ? new Date(formData.birthday).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        birthday: e.target.value ? new Date(e.target.value) : undefined,
                      })
                    }
                  />
                ) : (
                  <p className="mt-1 text-lg">
                    {formatBirthday(customer.birthday)}
                    {customer.birthday && (
                      <span className="ml-2 text-sm text-gray-500">
                        ({calculateAge(customer.birthday)}歳)
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div>
                <Label>性別</Label>
                {editing ? (
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.gender || ""}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  >
                    <option value="">選択してください</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                  </select>
                ) : (
                  <p className="mt-1 text-lg">
                    {customer.gender === "male"
                      ? "男性"
                      : customer.gender === "female"
                      ? "女性"
                      : customer.gender === "other"
                      ? "その他"
                      : "未設定"}
                  </p>
                )}
              </div>
            </div>

            {customer.lastVisit && (
              <div>
                <Label>最終来店日</Label>
                <p className="mt-1 text-lg">
                  {new Date(customer.lastVisit).toLocaleDateString("ja-JP")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
