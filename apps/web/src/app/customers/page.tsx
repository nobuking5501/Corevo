"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { collection, query, getDocs, deleteDoc, doc, orderBy as firestoreOrderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Customer } from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Phone, Mail, Calendar, Edit, Trash2, Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";

export default function CustomersPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

    loadCustomers();
  }, [tenantId]);

  const loadCustomers = async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      const customersRef = collection(db, `tenants/${tenantId}/customers`);
      const q = query(customersRef, firestoreOrderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const customersData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          lastVisit: data.lastVisit?.toDate(),
          birthday: data.birthday?.toDate(),
        } as Customer;
      });

      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error: any) {
      console.error("Error loading customers:", error);
      toast({
        variant: "destructive",
        title: "顧客データの読み込みエラー",
        description: error.message || "顧客データの取得に失敗しました",
      });
    } finally {
      setLoading(false);
    }
  };

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

  // Handle delete customer
  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete || !tenantId) return;

    setIsDeleting(true);
    try {
      const customerRef = doc(db, `tenants/${tenantId}/customers`, customerToDelete.id);
      await deleteDoc(customerRef);

      toast({
        title: "顧客を削除しました",
        description: `${customerToDelete.name}さんを削除しました`,
      });

      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      await loadCustomers();
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      toast({
        variant: "destructive",
        title: "顧客削除エラー",
        description: error.message || "顧客の削除に失敗しました",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewCustomer = (customerId: string) => {
    router.push(`/customers/${customerId}`);
  };

  const handleEditCustomer = (customerId: string) => {
    router.push(`/customers/${customerId}?edit=true`);
  };

  const formatBirthday = (birthday?: Date) => {
    if (!birthday) return null;
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">顧客管理</h1>
            <p className="text-gray-500">顧客情報と来店履歴</p>
          </div>
          <Button onClick={() => router.push("/customers/new")}>
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
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleViewCustomer(customer.id)}
                      >
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{customer.name}</h3>
                          <span className="text-sm text-gray-500">({customer.kana})</span>
                          {customer.birthday && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {calculateAge(customer.birthday)}歳
                            </span>
                          )}
                          {customer.gender && (
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {customer.gender === "male"
                                ? "男性"
                                : customer.gender === "female"
                                ? "女性"
                                : "その他"}
                            </span>
                          )}
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
                          {customer.birthday && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="h-3 w-3" />
                              生年月日: {formatBirthday(customer.birthday)}
                            </div>
                          )}
                          {customer.lastVisit && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="h-3 w-3" />
                              最終来店: {new Date(customer.lastVisit).toLocaleDateString("ja-JP")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewCustomer(customer.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          詳細
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCustomer(customer.id)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(customer)}
                        >
                          <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                          削除
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>顧客を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                {customerToDelete &&
                  `${customerToDelete.name}さんの情報を削除します。この操作は取り消せません。`}
                <br />
                <br />
                ※ 予定されている予約がある場合は削除できません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-red-500 hover:bg-red-600"
              >
                {isDeleting ? "削除中..." : "削除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
