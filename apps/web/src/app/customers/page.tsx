"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Customer } from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Phone, Mail, Calendar } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";

export default function CustomersPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    kana: "",
    email: "",
    phone: "",
    marketingConsent: false,
    photoConsent: false,
    hasDisability: false,
    disabilityType: "",
    specialAccommodations: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
  });

  // Get tenant ID from Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult(false);
        let tenantIds = (tokenResult.claims.tenantIds as string[]) || [];

        if (isDev && tenantIds.length === 0) {
          const devTenantId = localStorage.getItem("dev_tenantId");
          if (devTenantId) tenantIds = [devTenantId];
        }

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

  // Load customers
  useEffect(() => {
    if (!tenantId) return;

    const loadCustomers = async () => {
      try {
        const customersRef = collection(db, `tenants/${tenantId}/customers`);
        const customersQuery = query(customersRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(customersQuery);
        const customersData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          lastVisit: doc.data().lastVisit?.toDate(),
        })) as Customer[];
        setCustomers(customersData);
        setFilteredCustomers(customersData);
      } catch (error) {
        console.error("Error loading customers:", error);
        toast({
          variant: "destructive",
          title: "顧客データの読み込みエラー",
          description: "顧客データの取得に失敗しました",
        });
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, [tenantId]);

  // Search customers
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCustomers(customers);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.kana.toLowerCase().includes(term) ||
        customer.phone?.includes(term) ||
        customer.email?.toLowerCase().includes(term)
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  // Add new customer
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setIsSubmitting(true);

    try {
      const customersRef = collection(db, `tenants/${tenantId}/customers`);

      // Build disability object if hasDisability is checked
      const disabilityData = formData.hasDisability
        ? {
            hasDisability: true,
            disabilityType: formData.disabilityType || undefined,
            specialAccommodations: formData.specialAccommodations || undefined,
            emergencyContact:
              formData.emergencyContactName && formData.emergencyContactPhone
                ? {
                    name: formData.emergencyContactName,
                    phone: formData.emergencyContactPhone,
                    relationship: formData.emergencyContactRelationship || "",
                  }
                : undefined,
          }
        : undefined;

      await addDoc(customersRef, {
        tenantId: tenantId,
        name: formData.name,
        kana: formData.kana,
        email: formData.email || null,
        phone: formData.phone || null,
        consent: {
          marketing: formData.marketingConsent,
          photoUsage: formData.photoConsent,
        },
        disability: disabilityData,
        preferences: [],
        tags: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "顧客を追加しました",
        description: `${formData.name}さんを登録しました`,
      });

      // Reset form and close dialog
      setFormData({
        name: "",
        kana: "",
        email: "",
        phone: "",
        marketingConsent: false,
        photoConsent: false,
        hasDisability: false,
        disabilityType: "",
        specialAccommodations: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        emergencyContactRelationship: "",
      });
      setIsDialogOpen(false);

      // Reload customers
      const customersQuery = query(
        collection(db, `tenants/${tenantId}/customers`),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(customersQuery);
      const customersData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        lastVisit: doc.data().lastVisit?.toDate(),
      })) as Customer[];
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error) {
      console.error("Error adding customer:", error);
      toast({
        variant: "destructive",
        title: "顧客追加エラー",
        description: "顧客の登録に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12">読み込み中...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">顧客管理</h1>
            <p className="text-gray-500">顧客情報と来店履歴</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新規顧客
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="顧客名、カナ、電話番号で検索..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>{searchTerm ? "該当する顧客が見つかりません" : "顧客データがありません"}</p>
                <p className="text-sm mt-2">新規顧客ボタンから顧客を登録してください</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{customer.name}</h3>
                          <span className="text-sm text-gray-500">({customer.kana})</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {customer.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </div>
                          )}
                          {customer.lastVisit && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="h-3 w-3" />
                              最終来店: {customer.lastVisit.toLocaleDateString("ja-JP")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Customer Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>新規顧客登録</DialogTitle>
              <DialogDescription>新しい顧客情報を入力してください</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    氏名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="山田 太郎"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kana">
                    カナ <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="kana"
                    value={formData.kana}
                    onChange={(e) => setFormData({ ...formData, kana: e.target.value })}
                    required
                    placeholder="ヤマダ タロウ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">電話番号</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="090-1234-5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@email.com"
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="marketing"
                      checked={formData.marketingConsent}
                      onChange={(e) =>
                        setFormData({ ...formData, marketingConsent: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="marketing" className="font-normal cursor-pointer">
                      マーケティング配信に同意
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="photo"
                      checked={formData.photoConsent}
                      onChange={(e) =>
                        setFormData({ ...formData, photoConsent: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="photo" className="font-normal cursor-pointer">
                      写真利用に同意
                    </Label>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="hasDisability"
                      checked={formData.hasDisability}
                      onChange={(e) =>
                        setFormData({ ...formData, hasDisability: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="hasDisability" className="font-medium cursor-pointer">
                      障害者情報の登録
                    </Label>
                  </div>

                  {formData.hasDisability && (
                    <div className="space-y-3 pl-6 border-l-2 border-blue-200">
                      <div className="space-y-2">
                        <Label htmlFor="disabilityType">障害の種類</Label>
                        <Input
                          id="disabilityType"
                          value={formData.disabilityType}
                          onChange={(e) =>
                            setFormData({ ...formData, disabilityType: e.target.value })
                          }
                          placeholder="例: 視覚障害、聴覚障害、身体障害など"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="specialAccommodations">特別な配慮事項</Label>
                        <Textarea
                          id="specialAccommodations"
                          value={formData.specialAccommodations}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              specialAccommodations: e.target.value,
                            })
                          }
                          placeholder="施術時に必要な配慮や注意事項を入力してください"
                          rows={3}
                        />
                      </div>
                      <div className="border-t pt-3 mt-3">
                        <Label className="text-sm font-medium mb-2 block">緊急連絡先</Label>
                        <div className="space-y-2">
                          <Input
                            id="emergencyContactName"
                            value={formData.emergencyContactName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                emergencyContactName: e.target.value,
                              })
                            }
                            placeholder="緊急連絡先の氏名"
                          />
                          <Input
                            id="emergencyContactPhone"
                            type="tel"
                            value={formData.emergencyContactPhone}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                emergencyContactPhone: e.target.value,
                              })
                            }
                            placeholder="緊急連絡先の電話番号"
                          />
                          <Input
                            id="emergencyContactRelationship"
                            value={formData.emergencyContactRelationship}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                emergencyContactRelationship: e.target.value,
                              })
                            }
                            placeholder="続柄（例: 家族、介護者など）"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "登録中..." : "登録"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
